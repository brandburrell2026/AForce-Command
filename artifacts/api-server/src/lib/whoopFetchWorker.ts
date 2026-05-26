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

import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  aforceUserState,
  createDrizzleWhoopTokenStoreForUser,
  type WhoopTokenStore,
} from "@workspace/db";
import type { Logger } from "pino";
import {
  createWhoopTokenManager,
  getWhoopOAuthConfigFromEnv,
  type WhoopTokenManager,
} from "./whoopTokenManager";
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
  opts: { log?: Pick<Logger, "info" | "warn" | "error"> } = {},
): RunWhoopFetchOnceDeps {
  const config = getWhoopOAuthConfigFromEnv();
  const store: WhoopTokenStore = createDrizzleWhoopTokenStoreForUser(
    db,
    userId,
  );
  const tokenManager = createWhoopTokenManager({ store, config });
  return {
    tokenManager,
    stateRepo: createDrizzleUserStateRepo(db),
    log: opts.log,
  };
}

