/**
 * WHOOP biometrics fetch worker — closes the loop between PR #14
 * (token storage + manager) and PR #13 (multi-provider biometrics
 * column on `aforce_user_state`).
 *
 * Flow for one user:
 *   1. Resolve a valid access token via the token manager. Returns
 *      null when no tokens stored OR refresh failed -> result
 *      `{status: 'skipped_no_token'}`. No throw.
 *   2. Fetch the WHOOP snapshot. Per-endpoint failures fall through
 *      to null fields (handled inside the fetcher).
 *   3. Merge the WHOOP entry into the user's biometrics blob,
 *      preserving every other provider. UPDATE only — does NOT
 *      create a state row, because the worker shouldn't fabricate
 *      users.
 *   4. Result describes what happened, suitable for sweep-job logs
 *      / admin endpoints.
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
  aforceUserState,
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
  type WhoopProviderBlob,
  type WhoopSnapshot,
} from "./whoopSnapshot";

/** Pluggable HTTP fetcher seam — keeps tests offline. */
export type WhoopSnapshotFetcher = (
  accessToken: string,
) => Promise<WhoopSnapshot>;

/** Subset of the state-row write surface the worker needs.
 *
 *  The interface deliberately operates on a single provider key
 *  rather than a full biometrics blob. The Drizzle implementation
 *  uses `jsonb_set` so two providers writing concurrently cannot
 *  lose-update each other — only the targeted key is touched. The
 *  read-merge-write shape the worker used previously had a classic
 *  lost-update window between read and write; this surface
 *  eliminates that window at the DB level. */
export interface UserStateRepo {
  /**
   * UPDATE-only: writes a single provider's entry into the
   * `biometrics` JSONB column. Returns true when a row was updated,
   * false when no row existed (worker treats this as a skip — never
   * fabricates users). */
  writeProviderEntry(
    userId: string,
    providerKey: string,
    entry: Record<string, unknown>,
  ): Promise<boolean>;
}

export type WhoopFetchOutcomeStatus =
  | "ok"
  | "skipped_no_token"
  | "skipped_no_state"
  | "skipped_locked"
  | "error";

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

/**
 * Run one WHOOP biometrics fetch + persist for a single user. Never
 * throws — every failure path returns a structured outcome so a
 * sweep loop can keep going across users.
 */
export async function runWhoopFetchOnce(
  userId: string,
  deps: RunWhoopFetchOnceDeps,
): Promise<WhoopFetchOutcome> {
  const now = deps.nowMs ?? ((): number => Date.now());
  const log = deps.log;
  if (!userId) {
    return { userId, status: "error", error: "empty userId" };
  }

  let accessToken: string | null;
  try {
    accessToken = await deps.tokenManager.getValidAccessToken();
  } catch (err) {
    // `getValidAccessToken` is contractually `null`-on-failure, but
    // defend against an unexpected throw so the sweep keeps moving.
    log?.warn(
      { userId, err: errMessage(err) },
      "whoopFetchWorker:token resolution threw",
    );
    return { userId, status: "skipped_no_token" };
  }
  if (!accessToken) {
    log?.info({ userId }, "whoopFetchWorker:skipped_no_token");
    return { userId, status: "skipped_no_token" };
  }

  let snapshot: WhoopSnapshot;
  try {
    const fetcher: WhoopSnapshotFetcher =
      deps.snapshotFetcher ??
      ((token) => fetchWhoopSnapshot({ accessToken: token, log }));
    snapshot = await fetcher(accessToken);
  } catch (err) {
    log?.error(
      { userId, err: errMessage(err) },
      "whoopFetchWorker:fetch threw",
    );
    return { userId, status: "error", error: errMessage(err) };
  }

  const fetchedAt = now();
  const blob: WhoopProviderBlob = whoopSnapshotToProviderBlob(
    snapshot,
    fetchedAt,
  );

  try {
    const updated = await deps.stateRepo.writeProviderEntry(
      userId,
      "whoop",
      blob as unknown as Record<string, unknown>,
    );
    if (!updated) {
      // No state row for this user — never fabricate.
      log?.info({ userId }, "whoopFetchWorker:skipped_no_state");
      return { userId, status: "skipped_no_state" };
    }
  } catch (err) {
    log?.error(
      { userId, err: errMessage(err) },
      "whoopFetchWorker:state write threw",
    );
    return { userId, status: "error", error: errMessage(err) };
  }

  log?.info({ userId, fetchedAt }, "whoopFetchWorker:ok");
  return { userId, status: "ok", snapshot, fetchedAt };
}

/** Defensive: never let an Error containing token-ish strings leak. */
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.name;
  return "unknown_error";
}

/** Default Drizzle-backed UserStateRepo: writes a single provider
 *  key via `jsonb_set` so concurrent writers for different providers
 *  cannot clobber each other. `COALESCE(biometrics, '{}'::jsonb)`
 *  handles the row-exists-but-biometrics-is-null case. The
 *  `create_missing` flag (4th arg) is true — creates the provider
 *  key if absent. */
export function createDrizzleUserStateRepo(
  db: NodePgDatabase<Record<string, unknown>>,
): UserStateRepo {
  return {
    async writeProviderEntry(userId, providerKey, entry) {
      // Path is built as a parameterized text[] so unusual key
      // characters (commas, braces) cannot alter PG path semantics —
      // the providerKey lives in its own SQL parameter, not in a
      // string-built `{...}` literal.
      const updated = await db
        .update(aforceUserState)
        .set({
          biometrics: sql`jsonb_set(
            COALESCE(${aforceUserState.biometrics}, '{}'::jsonb),
            ARRAY[${providerKey}]::text[],
            ${JSON.stringify(entry)}::jsonb,
            true
          )` as never,
        })
        .where(eq(aforceUserState.userId, userId))
        .returning({ id: aforceUserState.userId });
      return updated.length > 0;
    },
  };
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

