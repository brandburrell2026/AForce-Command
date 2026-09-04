/**
 * Rollups failure classification — finish the `intakeFailure.ts` remediation on
 * the one route that never got it.
 *
 * `GET /aforce/journal/rollups` answered `400 rollups_failed` for EVERY throw:
 * a malformed `?days=`, a missing column, a dead connection, a bug in the
 * aggregation — one status for all of them. That is exactly the confusion
 * `intakeFailure.ts` was written to end on the intake route, and this route was
 * left behind.
 *
 * It cost us. `/journal/rollups` selects `aforce_user_state.history_start_at`
 * UNCONDITIONALLY — for sparse callers too, not only dense ones — so when that
 * column was absent from production every rollups request threw `42703` and was
 * reported as a 4xx. The only counter that could see it,
 * `requests_total.api_aforce.4xx`, buckets by the first two path segments, so
 * every AForce route shares it: a total schema outage was indistinguishable
 * from someone sending a bad query string, and it ran for over a day.
 *
 * ── THE DISCRIMINATOR, AND WHY THE OBVIOUS ONE IS DEAD CODE ───────────────
 *
 * `if (err.code === "42703")` DOES NOT WORK HERE, and it fails silently, which
 * is worse than failing loudly. drizzle-orm 0.45.2 wraps every driver error:
 * `DrizzleQueryError` sets `this.cause = cause` and copies NOTHING else — no
 * `.code`, no `.name` override (errors.js:10-18). So the SQLSTATE lives one or
 * more levels down the cause chain, and a top-level read is always `undefined`.
 * A canary shipped that way would classify every schema fault as an aggregation
 * bug — the exact inversion it exists to prevent.
 *
 * `serializeError` does not rescue it either: it returns `{ type, message,
 * stack }` and drops both `.code` and `.cause`, which is why today's log line
 * cannot tell the two apart even for a human reading it afterwards.
 *
 * So we walk the chain.
 */

/** Stable, member-safe outcomes. Never interpolate error text into these. */
export type RollupsFailureKind = "bad_request" | "schema" | "db" | "aggregation";

export interface RollupsFailure {
  readonly kind: RollupsFailureKind;
  /** 400 only when the REQUEST was genuinely at fault. Everything else is ours. */
  readonly status: 400 | 500;
  /** SQLSTATE when one was found, for the log line. Never sent to a client. */
  readonly sqlState?: string;
}

/**
 * Structural, not `instanceof` — zod may be duplicated in the tree, and a failed
 * `instanceof` would silently report a bad query string as a server fault.
 * Same reasoning, same shape as `intakeFailure.isZodError`.
 */
function isZodError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; issues?: unknown };
  return e.name === "ZodError" || Array.isArray(e.issues);
}

/**
 * First string `.code` found walking `err` then `err.cause` then deeper.
 *
 * Depth-limited because a cause chain can be cyclic, and an unbounded walk in a
 * catch block is a way to turn one failure into two.
 */
export function pgSqlState(err: unknown, depth = 0): string | undefined {
  if (err === null || typeof err !== "object" || depth > 4) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && code.length > 0) return code;
  return pgSqlState((err as { cause?: unknown }).cause, depth + 1);
}

/**
 * SQLSTATE classes that mean "the database does not have the shape the code
 * expects" — i.e. an un-run migration, which is an operator action, not a bug.
 *
 * 42703 undefined_column · 42P01 undefined_table · 42P07 duplicate_table
 * 42883 undefined_function · 42704 undefined_object · 3F000 invalid_schema_name
 */
const SCHEMA_STATES = new Set(["42703", "42P01", "42P07", "42883", "42704", "3F000"]);

/**
 * Classify a thrown value from the rollups read path.
 *
 * - `bad_request` (400) — the query string did not parse. The ONLY case where
 *   4xx is honest, and the only one a client can act on.
 * - `schema`      (500) — the database is missing something the code names.
 *   Fix by applying the outstanding migration, not by changing code.
 * - `db`          (500) — any other database-reported error: a dropped
 *   connection, a timeout, a constraint. Fix by looking at the database.
 * - `aggregation` (500) — nothing carried a SQLSTATE, so the throw came from
 *   our own code. Fix by looking at the code.
 *
 * The default is `aggregation` rather than `db` on purpose: the only things
 * that can throw in this handler are the query parse, the four drizzle reads,
 * and `buildJournalRollupsResponse`. If no SQLSTATE surfaced anywhere in the
 * cause chain, a database did not report it.
 */
export function classifyRollupsFailure(err: unknown): RollupsFailure {
  if (isZodError(err)) return { kind: "bad_request", status: 400 };
  const sqlState = pgSqlState(err);
  if (sqlState === undefined) return { kind: "aggregation", status: 500 };
  return {
    kind: SCHEMA_STATES.has(sqlState) ? "schema" : "db",
    status: 500,
    sqlState,
  };
}
