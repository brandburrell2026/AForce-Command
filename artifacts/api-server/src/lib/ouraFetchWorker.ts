/**
 * Oura biometrics fetch worker.
 *
 * Faithful mirror of `garminFetchWorker`'s `runGarminFetchOnce` (which
 * itself mirrors `whoopFetchWorker`'s `runWhoopFetchOnce`). Flow for
 * one user:
 *   1. Resolve a valid access token via the token manager. Null when no
 *      tokens stored OR refresh failed -> `{status:'skipped_no_token'}`.
 *      No throw.
 *   2. Fetch the Oura snapshot. Per-endpoint failures fall through to
 *      null fields (handled inside the fetcher).
 *   3. Merge the Oura entry into the user's biometrics blob via the
 *      provider-agnostic `UserStateRepo` (jsonb_set on a single key),
 *      preserving every other provider. UPDATE only — never creates a
 *      state row (the worker must not fabricate users).
 *   4. Result describes what happened, suitable for logs / admin.
 *
 * Architecture lock: hidden-infra. The only caller is the
 * `POST /oura/sync` route, which itself only exists when OURA_* env
 * vars are configured.
 *
 * Score-Protection: this worker only PERSISTS measured provider data
 * into the biometrics blob. It never awards, mutates, or fabricates a
 * performance score.
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  createDrizzleOuraTokenStoreForUser,
  type OuraTokenStore,
} from "@workspace/db";
import type { Logger } from "pino";
import {
  createOuraTokenManager,
  getOuraOAuthConfigFromEnv,
  type OuraTokenManager,
} from "./ouraTokenManager";
import type { OuraRefreshRegistry } from "./ouraRefreshRegistry";
import {
  fetchOuraSnapshot,
  ouraSnapshotToProviderBlob,
  type OuraProviderBlob,
  type OuraSnapshot,
} from "./ouraSnapshot";
import {
  createDrizzleUserStateRepo,
  type UserStateRepo,
} from "./whoopFetchWorker";

/** Pluggable HTTP fetcher seam — keeps tests offline. */
export type OuraSnapshotFetcher = (accessToken: string) => Promise<OuraSnapshot>;

export type OuraFetchOutcomeStatus =
  | "ok"
  | "skipped_no_token"
  | "skipped_no_state"
  | "error";

export interface OuraFetchOutcome {
  userId: string;
  status: OuraFetchOutcomeStatus;
  /** Present when status === 'ok'. */
  snapshot?: OuraSnapshot;
  /** Present when status === 'ok'. Epoch ms used for the blob entry. */
  fetchedAt?: number;
  /** Present when status === 'error'. Sanitized — no token leakage. */
  error?: string;
}

export interface RunOuraFetchOnceDeps {
  /** Per-user token manager. Worker calls only `getValidAccessToken`. */
  tokenManager: Pick<OuraTokenManager, "getValidAccessToken">;
  /** State repo binding (already scoped to the same DB). */
  stateRepo: UserStateRepo;
  /** Pluggable snapshot fetcher (defaults to real Oura HTTP fetcher). */
  snapshotFetcher?: OuraSnapshotFetcher;
  /** Defaults to `Date.now`. */
  nowMs?: () => number;
  /** Optional pino logger for structured per-user log lines. */
  log?: Pick<Logger, "info" | "warn" | "error">;
}

/** Defensive: never let an Error containing token-ish strings leak. */
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.name;
  return "unknown_error";
}

/**
 * Run one Oura biometrics fetch + persist for a single user. Never
 * throws — every failure path returns a structured outcome.
 */
export async function runOuraFetchOnce(
  userId: string,
  deps: RunOuraFetchOnceDeps,
): Promise<OuraFetchOutcome> {
  const now = deps.nowMs ?? ((): number => Date.now());
  const log = deps.log;
  if (!userId) {
    return { userId, status: "error", error: "empty userId" };
  }

  let accessToken: string | null;
  try {
    accessToken = await deps.tokenManager.getValidAccessToken();
  } catch (err) {
    log?.warn(
      { userId, err: errMessage(err) },
      "ouraFetchWorker:token resolution threw",
    );
    return { userId, status: "skipped_no_token" };
  }
  if (!accessToken) {
    log?.info({ userId }, "ouraFetchWorker:skipped_no_token");
    return { userId, status: "skipped_no_token" };
  }

  let snapshot: OuraSnapshot;
  try {
    const fetcher: OuraSnapshotFetcher =
      deps.snapshotFetcher ??
      ((token) => fetchOuraSnapshot({ accessToken: token, log }));
    snapshot = await fetcher(accessToken);
  } catch (err) {
    log?.error({ userId, err: errMessage(err) }, "ouraFetchWorker:fetch threw");
    return { userId, status: "error", error: errMessage(err) };
  }

  const fetchedAt = now();
  const blob: OuraProviderBlob = ouraSnapshotToProviderBlob(snapshot, fetchedAt);

  try {
    const updated = await deps.stateRepo.writeProviderEntry(
      userId,
      "oura",
      blob as unknown as Record<string, unknown>,
    );
    if (!updated) {
      // No state row for this user — never fabricate.
      log?.info({ userId }, "ouraFetchWorker:skipped_no_state");
      return { userId, status: "skipped_no_state" };
    }
  } catch (err) {
    log?.error(
      { userId, err: errMessage(err) },
      "ouraFetchWorker:state write threw",
    );
    return { userId, status: "error", error: errMessage(err) };
  }

  log?.info({ userId, fetchedAt }, "ouraFetchWorker:ok");
  return { userId, status: "ok", snapshot, fetchedAt };
}

/**
 * Convenience wiring for the default deps: builds a per-user token
 * manager backed by Postgres + the env-config'd OAuth client. Throws if
 * Oura env vars are missing (loud failure — the caller route only runs
 * when the gate is satisfied anyway).
 */
export function buildDefaultOuraFetchDeps(
  db: NodePgDatabase<Record<string, unknown>>,
  userId: string,
  opts: {
    log?: Pick<Logger, "info" | "warn" | "error">;
    /** Process-level singleflight registry. Shares an inflight slot
     *  with every other manager built for the same userId through the
     *  same registry. */
    refreshRegistry?: OuraRefreshRegistry;
  } = {},
): RunOuraFetchOnceDeps {
  const config = getOuraOAuthConfigFromEnv();
  const store: OuraTokenStore = createDrizzleOuraTokenStoreForUser(db, userId, {
    encryptionKey: process.env["OURA_TOKEN_ENCRYPTION_KEY"] ?? null,
    log: opts.log,
  });
  const tokenManager = createOuraTokenManager({
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
