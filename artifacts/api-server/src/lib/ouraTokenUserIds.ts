/**
 * Keyset-paginated iteration over `aforce_oura_tokens` userIds.
 *
 * Faithful mirror of the WHOOP iterator section of `whoopFetchWorker.ts`
 * (`iterWhoopTokenUserIds` / `iterWhoopTokenUserIdsForSweep` /
 * `getDbNow` / `listWhoopTokenUserIds`), retargeted at
 * `aforce_oura_tokens`. Deliberately NOT imported from
 * `whoopFetchWorker.ts` — Oura's provider modules stay decoupled from
 * WHOOP's (only `providerKit/*` is shared infrastructure; WHOOP's own
 * files are frozen/production per `ouraFetchSweepBootstrap.ts`'s
 * module doc). The SQL shape below is intentionally byte-for-byte
 * identical in structure to WHOOP's proven implementation.
 *
 * Requires the composite index `aforce_oura_tokens_updated_user_idx`
 * on `(updated_at, user_id)` — CONFIRMED present in
 * `lib/db/src/schema/aforce.ts` (added alongside the table, same as
 * Garmin's). No schema change needed here.
 *
 * Why the tuple keyset: `updated_at` can repeat across rows (DEFAULT
 * NOW() at ms resolution, especially after bulk imports). A simple
 * `WHERE updated_at > $1` boundary would either skip rows sharing the
 * cursor's timestamp or re-yield them depending on `>` vs `>=`. The
 * row-value comparison `(updated_at, user_id) > ($t, $u)` matches the
 * lexicographic order of the ORDER BY exactly, so the boundary is
 * always correct. See `whoopFetchWorker.ts`'s iterator doc for the
 * full rationale — unchanged here.
 */

import { and, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceOuraTokens } from "@workspace/db";

/**
 * Default keyset page size for `iterOuraTokenUserIds`. Matches WHOOP's
 * default (500) — same reasoning: large enough that per-page
 * round-trip overhead is negligible vs. fetch work, small enough that
 * one page comfortably fits in memory regardless of table size.
 */
export const OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE = 500;

/**
 * Streaming iteration over every userId with stored Oura tokens, in
 * stable `(updated_at ASC, user_id ASC)` order. Keyset pagination —
 * NOT OFFSET — so cost is O(pageSize · log N) per page regardless of
 * how deep we've iterated.
 *
 * `updatedAtMax` (the sweep cutoff), when supplied, is threaded into
 * EVERY page's WHERE clause (not just the first) — the cutoff must
 * survive for the entire drain, or a token refreshed mid-sweep (which
 * bumps `updated_at` to now) could re-enter a later page under the
 * plain cursor condition and get double-processed within one pass.
 *
 * Yields one page (string[]) at a time so callers can fan out work
 * per-page with bounded memory.
 */
export async function* iterOuraTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): AsyncGenerator<string[], void, void> {
  const pageSize = Math.max(
    1,
    opts.pageSize ?? OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE,
  );
  // Snapshot cutoff — see module doc. Callers running a sweep MUST
  // pass `updatedAtMax` captured BEFORE the iterator is created so the
  // page set is fixed for the lifetime of the sweep.
  const cutoff = opts.updatedAtMax;
  let cursor: { updatedAt: Date; userId: string } | null = null;
  for (;;) {
    // Explicit `SQL[]` annotation — without it, the mixed
    // `sql<unknown> | SQL | undefined` array entries widen `conditions`
    // to `any[]` under strict-noImplicitAny (mirrors the WHOOP
    // iterator's identical annotation and the identical reason).
    const conditions: SQL[] = [];
    if (cursor) {
      conditions.push(
        sql`(${aforceOuraTokens.updatedAt}, ${aforceOuraTokens.userId}) > (${cursor.updatedAt}, ${cursor.userId})`,
      );
    }
    if (cutoff) {
      conditions.push(lte(aforceOuraTokens.updatedAt, cutoff));
    }
    const where: SQL | undefined =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);
    const rows = await db
      .select({
        userId: aforceOuraTokens.userId,
        updatedAt: aforceOuraTokens.updatedAt,
      })
      .from(aforceOuraTokens)
      .where(where)
      .orderBy(aforceOuraTokens.updatedAt, aforceOuraTokens.userId)
      .limit(pageSize);
    if (rows.length === 0) return;
    yield rows.map((r) => r.userId);
    if (rows.length < pageSize) return;
    const last = rows[rows.length - 1]!;
    cursor = { updatedAt: last.updatedAt, userId: last.userId };
  }
}

/**
 * Sweep-mode iterator: same semantics as `iterOuraTokenUserIds` but
 * the snapshot `cutoff` is REQUIRED (not optional). Use this from any
 * code path that processes users while ALSO writing to
 * `aforce_oura_tokens` (e.g. a fetch sweep that refreshes tokens and
 * bumps `updated_at`) — without the cutoff, the keyset cursor
 * re-promotes mutated rows and the same user gets re-processed within
 * a single pass. See `iterOuraTokenUserIds`'s doc for the full
 * rationale (mirrors WHOOP's `iterWhoopTokenUserIdsForSweep`,
 * including the round-1 PR-21 regression this guard exists to
 * prevent).
 *
 * Runtime guard: rejects missing / non-Date / invalid-Date cutoffs at
 * call time (before any query runs) so a future refactor can't
 * silently drop it.
 */
export function iterOuraTokenUserIdsForSweep(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { cutoff: Date; pageSize?: number },
): AsyncGenerator<string[], void, void> {
  if (
    !opts ||
    !(opts.cutoff instanceof Date) ||
    Number.isNaN(opts.cutoff.getTime())
  ) {
    throw new Error(
      "iterOuraTokenUserIdsForSweep: `cutoff` must be a valid Date — " +
        "the sweep path requires a snapshot cutoff to prevent same-user " +
        "re-processing when token refreshes bump updated_at past the cursor.",
    );
  }
  return iterOuraTokenUserIds(db, {
    pageSize: opts.pageSize,
    updatedAtMax: opts.cutoff,
  });
}

/**
 * Return the DB's current `now()`. Using DB-clock instead of the Node
 * process clock removes a small but real correctness risk: the
 * sweep's snapshot cutoff is compared against `updated_at` values that
 * the token store writes via DB `now()`. If the app clock is skewed
 * behind the DB clock, a row written by an in-sweep refresh could land
 * at a timestamp <= an app-derived cutoff and still be eligible —
 * re-introducing the same-user-reprocessed bug under clock skew.
 * Mirrors `whoopFetchWorker.ts`'s `getDbNow` — duplicated rather than
 * imported to keep Oura decoupled from WHOOP's files (see module doc).
 */
export async function getDbNow(
  db: NodePgDatabase<Record<string, unknown>>,
): Promise<Date> {
  const result = await db.execute(sql`SELECT now() AS now`);
  const row = result.rows?.[0] as { now?: Date | string } | undefined;
  // node-postgres usually parses timestamptz (OID 1184) into a Date,
  // but a project that customizes type parsers (or routes the query
  // through a driver layer that doesn't) can return an ISO string.
  // Normalize both shapes rather than depending on type-parser config.
  const raw = row?.now;
  const dt = raw instanceof Date ? raw : raw != null ? new Date(raw) : null;
  if (!dt || Number.isNaN(dt.getTime())) {
    throw new Error("getDbNow: SELECT now() returned no usable row");
  }
  return dt;
}

/**
 * Backwards-compat drain of `iterOuraTokenUserIds` to one array.
 * Convenient for tests and ad-hoc tooling, but NOT for the sweep hot
 * path — at scale this re-materializes the memory cliff the iterator
 * was built to remove. Use `iterOuraTokenUserIds` directly in
 * production code that streams.
 */
export async function listOuraTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): Promise<string[]> {
  const out: string[] = [];
  for await (const page of iterOuraTokenUserIds(db, opts)) {
    out.push(...page);
  }
  return out;
}
