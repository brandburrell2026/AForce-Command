/**
 * Intake failure classification — tell the truth about WHOSE fault it was.
 *
 * `POST /aforce/intake` used to answer `400 intake_failed` for every throw:
 * a malformed body, a missing user-state row, a dead database, all one status.
 * That is what let a production schema fault masquerade as a client-invalid
 * request. `aforce_intake_logs` was missing four columns, every query against it
 * threw, and the member was told "Not saved — entry rejected. The server
 * wouldn't accept this entry … update AForce if it keeps happening" — advice
 * that was actively wrong, since nothing about the entry was invalid and no
 * client update could have helped. It cost a full device-QA cycle to attribute.
 *
 * The client already classifies honestly from the status alone
 * (`store/app/writeFailure.ts`): >=500 reads as "Something broke on our end",
 * 4xx reads as "entry rejected". Returning the right status is therefore the
 * whole fix — the member-facing copy follows automatically.
 *
 * PRIVACY. The classification is derived from the error, but nothing derived
 * FROM the error text is ever returned. Callers send only the stable code below.
 * Postgres errors carry table names, column names and full SQL including bound
 * parameters — that is operator diagnostics, and it belongs in the log, not in a
 * response body.
 */

/** Stable, member-safe failure codes. Never interpolate error text into these. */
export type IntakeFailureKind = "invalid" | "conflict" | "internal";

export interface IntakeFailure {
  readonly kind: IntakeFailureKind;
  readonly status: 400 | 409 | 500;
}

/** Thrown by the transaction when the pre-seeded state row is not there. */
export const USER_STATE_MISSING = "user_state_missing";

function isZodError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; issues?: unknown };
  // Structural rather than `instanceof`: zod may be duplicated in the tree, and
  // a failed instanceof here would silently misreport a bad body as a 500.
  return e.name === "ZodError" || Array.isArray(e.issues);
}

/**
 * Classify a thrown value from the intake write path.
 *
 * - `invalid`  (400) the request body did not satisfy the schema. The member's
 *   entry genuinely was not acceptable; retrying unchanged will not help.
 * - `conflict` (409) the user-state row the write depends on was not present.
 *   Not a malformed request and not a dead database — a state condition that a
 *   retry can legitimately resolve, since the route pre-seeds state.
 * - `internal` (500) anything else: a failed query, a missing column, a dropped
 *   connection, a bug. NEVER 4xx. Blaming the member's entry for a fault on our
 *   side is the specific failure this module exists to prevent.
 */
export function classifyIntakeFailure(err: unknown): IntakeFailure {
  if (isZodError(err)) return { kind: "invalid", status: 400 };
  const message = err instanceof Error ? err.message : "";
  if (message === USER_STATE_MISSING) return { kind: "conflict", status: 409 };
  return { kind: "internal", status: 500 };
}
