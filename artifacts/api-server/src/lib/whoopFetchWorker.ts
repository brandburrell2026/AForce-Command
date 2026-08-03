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
 * are thin wrappers over `./providerKit/tokenUserIds` (table-parameterized
 * keyset paginator, extracted from this file's + `ouraTokenUserIds.ts`'s
 * previously-duplicated copies) — every exported name, type, and
 * default stays byte-identical, still consumed unchanged by
 * `whoopFetchSweepBootstrap.ts`.
 *
 * Architecture lock: hidden-infra. Phase 1: no HTTP route invokes
 * this yet. A cron sweep + an admin trigger land in follow-up PRs.
 *
 * Injectability: token manager, fetcher, state reader/writer are
 * all dependency-injected so the orchestration is unit-testable
 * without Postgres or HTTP. The default builder wires Drizzle +
 * the real WhoopTokenManager.
 */

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
import {
  PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE,
  getDbNow as getProviderDbNow,
  iterProviderTokenUserIds,
  iterProviderTokenUserIdsForSweep,
  listProviderTokenUserIds,
} from "./providerKit/tokenUserIds";

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
 * fits in memory even at 50M users. Sourced from
 * `providerKit/tokenUserIds.ts` — same value as before extraction.
 */
export const WHOOP_TOKEN_USERS_DEFAULT_PAGE_SIZE =
  PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE;

/**
 * Streaming iteration over every userId with stored WHOOP tokens, in
 * stable `(updated_at ASC, user_id ASC)` order. Thin wrapper over
 * `providerKit/tokenUserIds.ts`'s `iterProviderTokenUserIds`, bound to
 * `aforceWhoopTokens` — see that module for the full keyset/cutoff
 * rationale (tuple-comparison boundary correctness, mid-sweep
 * `updated_at` bump handling). Requires the composite index
 * `aforce_whoop_tokens_updated_user_idx` on `(updated_at, user_id)`.
 *
 * Yields one page (string[]) at a time so callers can fan out work
 * per-page with bounded memory. The current sweep bootstrap drains
 * the iterator via `listWhoopTokenUserIds` (still O(N) memory) — a
 * later PR will rewire the sweep to consume the iterator directly
 * for true bounded memory across the full table.
 */
export function iterWhoopTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): AsyncGenerator<string[], void, void> {
  return iterProviderTokenUserIds(db, aforceWhoopTokens, opts);
}

/**
 * Sweep-mode iterator: same semantics as `iterWhoopTokenUserIds` but
 * the snapshot `cutoff` is REQUIRED (not optional). Thin wrapper over
 * `providerKit/tokenUserIds.ts`'s `iterProviderTokenUserIdsForSweep` —
 * see that module for the full rationale (the round-1 PR-21 regression
 * this guard exists to prevent) and the runtime cutoff-validation
 * contract (rejects missing / non-Date / invalid-Date cutoffs before
 * any query runs).
 */
export function iterWhoopTokenUserIdsForSweep(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { cutoff: Date; pageSize?: number },
): AsyncGenerator<string[], void, void> {
  return iterProviderTokenUserIdsForSweep(db, aforceWhoopTokens, opts);
}

/**
 * Return the DB's current `now()`. Thin re-export of
 * `providerKit/tokenUserIds.ts`'s `getDbNow` (provider-agnostic — no
 * table parameter needed). See that module for the clock-skew
 * rationale.
 */
export const getDbNow = getProviderDbNow;

/**
 * Backwards-compat drain of `iterWhoopTokenUserIds` to one array. Thin
 * wrapper over `providerKit/tokenUserIds.ts`'s
 * `listProviderTokenUserIds`. Convenient for tests and ad-hoc tooling,
 * but NOT for the sweep hot path — at scale this re-materializes the
 * cliff the iterator was built to remove. Use `iterWhoopTokenUserIds`
 * directly in production code that streams.
 */
export function listWhoopTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): Promise<string[]> {
  return listProviderTokenUserIds(db, aforceWhoopTokens, opts);
}
