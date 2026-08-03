/**
 * providerKit — keyset-paginated token-table userId iteration,
 * parameterized by table.
 *
 * Pure extraction. `whoopFetchWorker.ts`'s pagination section
 * (`iterWhoopTokenUserIds` / `iterWhoopTokenUserIdsForSweep` /
 * `getDbNow` / `listWhoopTokenUserIds`) and `ouraTokenUserIds.ts` were
 * byte-identical after s/Whoop/Oura/ + s/aforceWhoopTokens/
 * aforceOuraTokens/ renames — this module is the shared shape both now
 * wrap. Both providers are retargeted onto it in this lane via thin
 * wrappers that preserve every exported name, type, and default.
 *
 * Table-parameterized (not provider-name-parameterized): callers pass
 * their own Drizzle table object, typed against the minimal structural
 * shape `TokenUserIdsTable` (a `(user_id, updated_at)` composite-index
 * candidate). Generic over the concrete table type `T` — same fix
 * pattern as `oauthStateStore.ts`'s `ProviderAuthStateTable` generic —
 * so passing a table missing either column is a compile error, not a
 * runtime surprise, with NO cast required at any call site.
 *
 * Streaming iteration over every userId with stored tokens, in stable
 * `(updated_at ASC, user_id ASC)` order. Keyset pagination — NOT
 * OFFSET — so cost is O(pageSize · log N) per page regardless of how
 * deep we've iterated. Requires a composite index on
 * `(updated_at, user_id)` on the caller's table (confirmed present for
 * both `aforce_whoop_tokens` and `aforce_oura_tokens` in
 * `lib/db/src/schema/aforce.ts`).
 *
 * Why the tuple keyset: `updated_at` can repeat across rows (DEFAULT
 * NOW() at ms resolution, especially after bulk imports). A simple
 * `WHERE updated_at > $1` boundary would either skip rows sharing the
 * cursor's timestamp or re-yield them depending on `>` vs `>=`. The
 * row-value comparison `(updated_at, user_id) > ($t, $u)` matches the
 * lexicographic order of the ORDER BY exactly, so the boundary is
 * always correct.
 *
 * Why the sweep-mode cutoff is REQUIRED (not optional) on the
 * `...ForSweep` variant: any code path that processes users while ALSO
 * writing to the same table (e.g. a fetch sweep that refreshes tokens
 * and bumps `updated_at`) needs the cutoff, or the keyset cursor
 * re-promotes mutated rows and the same user gets re-processed within
 * a single pass — the round-1 PR-21 regression this guard exists to
 * prevent. The base iterator stays cutoff-OPTIONAL for ad-hoc tools
 * and read-only queries that don't mutate the row's `updated_at`.
 */

import { and, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * Structural shape every provider's token table satisfies
 * (`aforceWhoopTokens`, `aforceOuraTokens`, ...). Callers pass the real
 * Drizzle table object for their provider; this module only ever
 * references these two columns. Generic-over-`T` call sites (below)
 * mean a column rename that breaks this shape is a compile-time
 * "argument does not satisfy constraint" error, not a silently
 * bypassed cast.
 */
export type TokenUserIdsTable = PgTable & {
  userId: AnyPgColumn;
  updatedAt: AnyPgColumn;
};

/**
 * Default keyset page size. 500 is a compromise: large enough that the
 * per-page round-trip overhead is negligible vs. fetch work, small
 * enough that one page comfortably fits in memory even at 50M users.
 */
export const PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE = 500;

export interface IterProviderTokenUserIdsOpts {
  pageSize?: number;
  updatedAtMax?: Date;
}

/**
 * Streaming iteration over every userId in `table`, in stable
 * `(updated_at ASC, user_id ASC)` order. Yields one page (string[]) at
 * a time so callers can fan out work per-page with bounded memory.
 *
 * `updatedAtMax` (the sweep cutoff), when supplied, is threaded into
 * EVERY page's WHERE clause (not just the first) — the cutoff must
 * survive for the entire drain, or a token refreshed mid-sweep (which
 * bumps `updated_at` to now) could re-enter a later page under the
 * plain cursor condition and get double-processed within one pass.
 */
export async function* iterProviderTokenUserIds<T extends TokenUserIdsTable>(
  db: NodePgDatabase<Record<string, unknown>>,
  table: T,
  opts: IterProviderTokenUserIdsOpts = {},
): AsyncGenerator<string[], void, void> {
  const pageSize = Math.max(
    1,
    opts.pageSize ?? PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE,
  );
  // Snapshot cutoff. Callers running a sweep MUST pass `updatedAtMax`
  // captured BEFORE the iterator is created so the page set is fixed
  // for the lifetime of the sweep — see module doc.
  const cutoff = opts.updatedAtMax;
  let cursor: { updatedAt: Date; userId: string } | null = null;
  for (;;) {
    // Explicit `SQL[]` annotation: without it, the mixed
    // `sql<unknown> | SQL | undefined` array entries combined with the
    // type-guard `.filter` widen `conditions` to `any[]` under
    // strict-noImplicitAny (TS7022 cascade onto `where`, `rows`,
    // `last`). Annotating the seed type pins the inference.
    const conditions: SQL[] = [];
    if (cursor) {
      conditions.push(
        sql`(${table.updatedAt}, ${table.userId}) > (${cursor.updatedAt}, ${cursor.userId})`,
      );
    }
    if (cutoff) {
      conditions.push(lte(table.updatedAt, cutoff));
    }
    const where: SQL | undefined =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);
    const rows = await db
      .select({
        userId: table.userId,
        updatedAt: table.updatedAt,
      })
      // `.from()`'s overload resolves a data-modifying-subquery check
      // (`TableLikeHasEmptySelection<T>`) that doesn't evaluate cleanly
      // against a bare generic `T` — widening to the `PgTable` base
      // type here is a safe upcast (T already extends PgTable via the
      // `TokenUserIdsTable` constraint), not an escape hatch: unlike
      // the oauthStateStore double-cast this fixes, there's no
      // structural-shape check being bypassed, just a generic-vs-
      // concrete inference limitation in drizzle's `.from()` typing.
      .from(table as PgTable)
      .where(where)
      .orderBy(table.updatedAt, table.userId)
      .limit(pageSize);
    if (rows.length === 0) return;
    yield rows.map((r) => r.userId as string);
    if (rows.length < pageSize) return;
    const last = rows[rows.length - 1]!;
    cursor = {
      updatedAt: last.updatedAt as Date,
      userId: last.userId as string,
    };
  }
}

/**
 * Sweep-mode iterator: same semantics as `iterProviderTokenUserIds` but
 * the snapshot `cutoff` is REQUIRED (not optional). See module doc for
 * the full rationale (the round-1 PR-21 regression this guard exists
 * to prevent).
 *
 * Runtime guard: rejects missing / non-Date / invalid-Date cutoffs at
 * call time (before any query runs) so a future refactor can't
 * silently drop it and re-introduce the bug.
 */
export function iterProviderTokenUserIdsForSweep<T extends TokenUserIdsTable>(
  db: NodePgDatabase<Record<string, unknown>>,
  table: T,
  opts: { cutoff: Date; pageSize?: number },
): AsyncGenerator<string[], void, void> {
  if (
    !opts ||
    !(opts.cutoff instanceof Date) ||
    Number.isNaN(opts.cutoff.getTime())
  ) {
    throw new Error(
      "iterProviderTokenUserIdsForSweep: `cutoff` must be a valid Date — " +
        "the sweep path requires a snapshot cutoff to prevent same-user " +
        "re-processing when token refreshes bump updated_at past the cursor.",
    );
  }
  return iterProviderTokenUserIds(db, table, {
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
 * Comparing cutoff to writes that share the same clock source closes
 * that window. Provider-agnostic — no table parameter needed.
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
 * Backwards-compat drain of `iterProviderTokenUserIds` to one array.
 * Convenient for tests and ad-hoc tooling, but NOT for the sweep hot
 * path — at scale this re-materializes the memory cliff the iterator
 * was built to remove. Use `iterProviderTokenUserIds` directly in
 * production code that streams.
 */
export async function listProviderTokenUserIds<T extends TokenUserIdsTable>(
  db: NodePgDatabase<Record<string, unknown>>,
  table: T,
  opts: IterProviderTokenUserIdsOpts = {},
): Promise<string[]> {
  const out: string[] = [];
  for await (const page of iterProviderTokenUserIds(db, table, opts)) {
    out.push(...page);
  }
  return out;
}
