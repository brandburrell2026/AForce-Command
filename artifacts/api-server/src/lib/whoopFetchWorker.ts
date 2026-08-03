/**
 * WHOOP biometrics fetch worker — closes the loop between PR #14
 * (token storage + manager) and PR #13 (multi-provider biometrics
 * column on `aforce_user_state`).
 *
 * `runWhoopFetchOnce` is a thin wrapper over
 * `providerKit/fetchWorker.ts`'s `createProviderFetchWorker` — the
 * resolve-token / fetch-snapshot / merge-into-biometrics-blob
 * orchestration is shared implementation now (see that module for the
 * full contract doc). This file exists to keep WHOOP's public API —
 * every exported name, type, and default — byte-identical to what it
 * was before the extraction, so `routes/whoopAdmin.ts`,
 * `whoopFetchSweepBootstrap.ts`, `routes/index.ts`, and every existing
 * WHOOP test keep passing unchanged.
 *
 * `UserStateRepo` / `createDrizzleUserStateRepo` are RE-EXPORTED (not
 * duplicated) from `./providerKit/userStateRepo` — that module is now
 * the source of truth (moved there as part of this W3 cutover; see its
 * doc comment for the before/after). `garminFetchWorker.ts` and
 * `stravaFetchWorker.ts` both import these two names from
 * `"./whoopFetchWorker"` directly — this re-export keeps both working
 * unchanged.
 *
 * The keyset-pagination helpers below (`iterWhoopTokenUserIds`,
 * `iterWhoopTokenUserIdsForSweep`, `getDbNow`, `listWhoopTokenUserIds`)
 * and `buildDefaultWhoopFetchDeps` have no providerKit equivalent (no
 * other provider's sweep needs DB-clock-cutoff keyset iteration yet)
 * and are NOT part of this wrapper-ization — they stay exactly as they
 * were, still consumed unchanged by `whoopFetchSweepBootstrap.ts`.
 *
 * Architecture lock: hidden-infra. Phase 1: no HTTP route invokes
 * this yet. A cron sweep + an admin trigger land in follow-up PRs.
 *
 * Injectability: token manager, fetcher, state reader/writer are
 * all dependency-injected so the orchestration is unit-testable
 * without Postgres or HTTP. The default builder wires Drizzle +
 * the real WhoopTokenManager.
 */

import { and, eq, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  aforceWhoopTokens,
  createDrizzleWhoopTokenStoreForUser,
  type WhoopTokenStore,
} from "@workspace/db";
import type { Logger } from "pino";
import {
  createWhoopTokenManager,
  getWhoopOAuthConfigFromEnv,
  type WhoopTokenManager,
} from "./whoopTokenManager";
import type { WhoopRefreshRegistry } from "./whoopRefreshRegistry";
import {
  fetchWhoopSnapshot,
  whoopSnapshotToProviderBlob,
  type WhoopSnapshot,
} from "./whoopSnapshot";
import {
  createProviderFetchWorker,
  type ProviderFetchOutcome,
  type ProviderFetchOutcomeStatus,
} from "./providerKit/fetchWorker";
import {
  type UserStateRepo,
  createDrizzleUserStateRepo,
} from "./providerKit/userStateRepo";

// Re-exported for back-compat: `garminFetchWorker.ts` and
// `stravaFetchWorker.ts` import these two names from this module's
// specifier. See the module doc for why the source of truth moved.
export { type UserStateRepo, createDrizzleUserStateRepo };

/** Pluggable HTTP fetcher seam — keeps tests offline. */
export type WhoopSnapshotFetcher = (
  accessToken: string,
) => Promise<WhoopSnapshot>;

export type WhoopFetchOutcomeStatus = ProviderFetchOutcomeStatus;

export interface WhoopFetchOutcome {
  userId: string;
  status: WhoopFetchOutcomeStatus;
  /** Present when status === 'ok'. */
  snapshot?: WhoopSnapshot;
  /** Present when status === 'ok'. Epoch ms used for the blob entry. */
  fetchedAt?: number;
  /** Present when status === 'error'. Sanitized message — no token leakage. */
  error?: string;
}

export interface RunWhoopFetchOnceDeps {
  /** Per-user token manager. The worker calls only `getValidAccessToken`. */
  tokenManager: Pick<WhoopTokenManager, "getValidAccessToken">;
  /** State repo binding (already scoped to the same DB the manager uses). */
  stateRepo: UserStateRepo;
  /** Pluggable snapshot fetcher (defaults to real WHOOP HTTP fetcher). */
  snapshotFetcher?: WhoopSnapshotFetcher;
  /** Defaults to `Date.now`. */
  nowMs?: () => number;
  /** Optional pino logger for structured per-user log lines. */
  log?: Pick<Logger, "info" | "warn" | "error">;
}

const whoopWorker = createProviderFetchWorker<WhoopSnapshot>({
  provider: "Whoop",
  // `WhoopProviderBlob` is a specific shape (no index signature), same
  // as the pre-extraction worker's `blob as unknown as Record<string,
  // unknown>` cast at the `writeProviderEntry` call site.
  toBlob: (snapshot, fetchedAt): Record<string, unknown> =>
    whoopSnapshotToProviderBlob(snapshot, fetchedAt) as unknown as Record<
      string,
      unknown
    >,
});

/**
 * Run one WHOOP biometrics fetch + persist for a single user. Never
 * throws — every failure path returns a structured outcome so a
 * sweep loop can keep going across users.
 */
export async function runWhoopFetchOnce(
  userId: string,
  deps: RunWhoopFetchOnceDeps,
): Promise<WhoopFetchOutcome> {
  const outcome: ProviderFetchOutcome<WhoopSnapshot> = await whoopWorker.runOnce(
    userId,
    {
      tokenManager: deps.tokenManager,
      stateRepo: deps.stateRepo,
      snapshotFetcher:
        deps.snapshotFetcher ??
        ((token) => fetchWhoopSnapshot({ accessToken: token, log: deps.log })),
      nowMs: deps.nowMs,
      log: deps.log,
    },
  );
  return outcome as WhoopFetchOutcome;
}

/**
 * Convenience wiring for the default deps: builds a per-user token
 * manager backed by Postgres + the env-config'd OAuth client.
 * Throws if WHOOP env vars are missing (loud failure, hidden-infra
 * worker shouldn't silently no-op the entire fleet).
 */
export function buildDefaultWhoopFetchDeps(
  db: NodePgDatabase<Record<string, unknown>>,
  userId: string,
  opts: {
    log?: Pick<Logger, "info" | "warn" | "error">;
    /** Process-level singleflight registry. When provided, the manager
     *  shares an inflight slot with every other manager built for the
     *  same userId through the same registry. Required for the cron
     *  sweep + admin trigger to coexist without racing refresh
     *  tokens. */
    refreshRegistry?: WhoopRefreshRegistry;
  } = {},
): RunWhoopFetchOnceDeps {
  const config = getWhoopOAuthConfigFromEnv();
  const store: WhoopTokenStore = createDrizzleWhoopTokenStoreForUser(
    db,
    userId,
    {
      // Same env opt-in used by the OAuth callback wiring (see
      // `routes/index.ts`); fetch sweep + admin trigger must see the
      // same enc state to avoid plaintext-only writes overwriting
      // dual-written rows when the key is configured.
      encryptionKey: process.env["WHOOP_TOKEN_ENCRYPTION_KEY"] ?? null,
      log: opts.log,
    },
  );
  const tokenManager = createWhoopTokenManager({
    store,
    config,
    refreshCoordinator: opts.refreshRegistry?.coordinatorFor(userId),
    log: opts.log,
  });
  return {
    tokenManager,
    stateRepo: createDrizzleUserStateRepo(db),
    log: opts.log,
  };
}

/**
 * Default keyset page size for `iterWhoopTokenUserIds`. 500 is a
 * compromise: large enough that the per-page round-trip overhead is
 * negligible vs. fetch work, small enough that one page comfortably
 * fits in memory even at 50M users.
 */
export const WHOOP_TOKEN_USERS_DEFAULT_PAGE_SIZE = 500;

/**
 * Streaming iteration over every userId with stored WHOOP tokens, in
 * stable `(updated_at ASC, user_id ASC)` order. Keyset pagination — NOT
 * OFFSET — so cost is O(pageSize · log N) per page regardless of how
 * deep we've iterated. Requires the composite index
 * `aforce_whoop_tokens_updated_user_idx` on `(updated_at, user_id)`.
 *
 * Why the tuple keyset: `updated_at` can repeat across rows (DEFAULT
 * NOW() at ms resolution, especially after bulk imports). A simple
 * `WHERE updated_at > $1` boundary would either skip rows sharing the
 * cursor's timestamp or re-yield them depending on `>` vs `>=`. The
 * row-value comparison `(updated_at, user_id) > ($t, $u)` matches the
 * lexicographic order of the ORDER BY exactly, so the boundary is
 * always correct.
 *
 * Yields one page (string[]) at a time so callers can fan out work
 * per-page with bounded memory. The current sweep bootstrap drains
 * the iterator via `listWhoopTokenUserIds` (still O(N) memory) — a
 * later PR will rewire the sweep to consume the iterator directly
 * for true bounded memory across the full table.
 */
export async function* iterWhoopTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): AsyncGenerator<string[], void, void> {
  const pageSize = Math.max(1, opts.pageSize ?? WHOOP_TOKEN_USERS_DEFAULT_PAGE_SIZE);
  // Snapshot cutoff. The sweep itself UPDATES `updated_at` on every
  // successful token refresh (see WhoopTokenStore.write). Without a
  // cutoff, a row processed early in the sweep gets its updated_at
  // bumped past the cursor and reappears in a later page — the same
  // user gets re-processed within one sweep, inflating fetch load and
  // logs. The singleflight registry would deduplicate CONCURRENT
  // double-fetches but does nothing for sequential ones a page apart.
  // Callers running a sweep MUST pass `updatedAtMax = new Date()`
  // captured BEFORE the iterator is created so the page set is fixed
  // for the lifetime of the sweep.
  const cutoff = opts.updatedAtMax;
  let cursor: { updatedAt: Date; userId: string } | null = null;
  for (;;) {
    // Explicit `SQL[]` annotation: without it, the mixed
    // `sql<unknown> | SQL | undefined` array entries combined with
    // the type-guard `.filter` widen `conditions` to `any[]` under
    // strict-noImplicitAny (TS7022 cascade onto `where`, `rows`,
    // `last`). Annotating the seed type pins the inference.
    const conditions: SQL[] = [];
    if (cursor) {
      conditions.push(
        sql`(${aforceWhoopTokens.updatedAt}, ${aforceWhoopTokens.userId}) > (${cursor.updatedAt}, ${cursor.userId})`,
      );
    }
    if (cutoff) {
      conditions.push(lte(aforceWhoopTokens.updatedAt, cutoff));
    }
    const where: SQL | undefined =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);
    const rows = await db
      .select({
        userId: aforceWhoopTokens.userId,
        updatedAt: aforceWhoopTokens.updatedAt,
      })
      .from(aforceWhoopTokens)
      .where(where)
      .orderBy(aforceWhoopTokens.updatedAt, aforceWhoopTokens.userId)
      .limit(pageSize);
    if (rows.length === 0) return;
    yield rows.map((r) => r.userId);
    if (rows.length < pageSize) return;
    const last = rows[rows.length - 1]!;
    cursor = { updatedAt: last.updatedAt, userId: last.userId };
  }
}

/**
 * Sweep-mode iterator: same semantics as `iterWhoopTokenUserIds` but
 * the snapshot `cutoff` is REQUIRED (not optional). Use this from any
 * code path that processes users while ALSO writing to
 * `aforce_whoop_tokens` (e.g. the fetch sweep, which refreshes tokens
 * and bumps `updated_at`) — without the cutoff, the keyset cursor
 * re-promotes mutated rows and you'll re-process users within a
 * single pass. See the long comment on `iterWhoopTokenUserIds` for
 * the full rationale.
 *
 * Runtime guard: rejects missing / non-Date / invalid-Date cutoffs at
 * call time so a future refactor can't silently drop it and re-
 * introduce the round-1 PR-21 regression. The base iterator is left
 * cutoff-OPTIONAL for ad-hoc tools and read-only queries that don't
 * mutate the row's `updated_at`.
 */
export function iterWhoopTokenUserIdsForSweep(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { cutoff: Date; pageSize?: number },
): AsyncGenerator<string[], void, void> {
  if (
    !opts ||
    !(opts.cutoff instanceof Date) ||
    Number.isNaN(opts.cutoff.getTime())
  ) {
    throw new Error(
      "iterWhoopTokenUserIdsForSweep: `cutoff` must be a valid Date — " +
        "the sweep path requires a snapshot cutoff to prevent same-user " +
        "re-processing when token refreshes bump updated_at past the cursor.",
    );
  }
  return iterWhoopTokenUserIds(db, {
    pageSize: opts.pageSize,
    updatedAtMax: opts.cutoff,
  });
}

/**
 * Return the DB's current `now()`. Using DB-clock instead of the
 * Node process clock removes a small but real correctness risk: the
 * sweep's snapshot cutoff is compared against `updated_at` values
 * that the token store writes via DB `now()` (see
 * `WhoopTokenStore.write`). If the app clock is skewed behind the DB
 * clock, a row written by an in-sweep refresh could land at a
 * timestamp <= an app-derived cutoff and still be eligible — re-
 * introducing the round-1 PR-21 bug under clock skew. Comparing
 * cutoff to writes that share the same clock source closes that
 * window.
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
 * Backwards-compat drain of `iterWhoopTokenUserIds` to one array.
 * Convenient for tests and ad-hoc tooling, but NOT for the sweep hot
 * path — at scale this re-materializes the cliff the iterator was
 * built to remove. Use `iterWhoopTokenUserIds` directly in production
 * code that streams.
 */
export async function listWhoopTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): Promise<string[]> {
  const out: string[] = [];
  for await (const page of iterWhoopTokenUserIds(db, opts)) {
    out.push(...page);
  }
  return out;
}
