/**
 * Oura biometrics fetch worker.
 *
 * Thin wrapper over `providerKit/fetchWorker.ts` — the
 * resolve-token / fetch-snapshot / merge-into-biometrics-blob
 * orchestration is shared implementation now (see that module for the
 * full contract doc). This file exists to keep Oura's public API —
 * every exported name, type, and default — byte-identical to what it
 * was before the extraction, so `routes/ouraOAuth.ts` and every
 * existing Oura test keep passing unchanged.
 *
 * `UserStateRepo` / `createDrizzleUserStateRepo` are imported (not
 * duplicated) — now via `providerKit/userStateRepo` instead of
 * `./whoopFetchWorker` directly, whose doc comment explains why the
 * source of truth is still `whoopFetchWorker.ts` until the WHOOP
 * cutover. Not re-exported from this file, matching the pre-extraction
 * shape (Oura's public API never exported these names either).
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
  type OuraSnapshot,
} from "./ouraSnapshot";
import {
  createProviderFetchWorker,
  type ProviderFetchOutcome,
} from "./providerKit/fetchWorker";
import {
  type UserStateRepo,
  createDrizzleUserStateRepo,
} from "./providerKit/userStateRepo";

/** Pluggable HTTP fetcher seam — keeps tests offline. */
export type OuraSnapshotFetcher = (accessToken: string) => Promise<OuraSnapshot>;

// Narrower than providerKit's `ProviderFetchOutcomeStatus` (which also
// carries `skipped_locked` for sweep-layer consumers with a
// multi-replica lock — Oura has no such lock today). `runOraFetchOnce`
// below never produces `skipped_locked` at runtime, so this narrowing
// is safe and keeps the public type identical to pre-extraction Oura.
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

const ouraWorker = createProviderFetchWorker<OuraSnapshot>({
  provider: "Oura",
  // `OuraProviderBlob` is a specific shape (no index signature), same
  // as the pre-extraction worker's `blob as unknown as Record<string,
  // unknown>` cast at the `writeProviderEntry` call site.
  toBlob: (snapshot, fetchedAt): Record<string, unknown> =>
    ouraSnapshotToProviderBlob(snapshot, fetchedAt) as unknown as Record<
      string,
      unknown
    >,
});

/**
 * Run one Oura biometrics fetch + persist for a single user. Never
 * throws — every failure path returns a structured outcome.
 */
export async function runOuraFetchOnce(
  userId: string,
  deps: RunOuraFetchOnceDeps,
): Promise<OuraFetchOutcome> {
  const outcome: ProviderFetchOutcome<OuraSnapshot> = await ouraWorker.runOnce(
    userId,
    {
      tokenManager: deps.tokenManager,
      stateRepo: deps.stateRepo,
      snapshotFetcher:
        deps.snapshotFetcher ??
        ((token) => fetchOuraSnapshot({ accessToken: token, log: deps.log })),
      nowMs: deps.nowMs,
      log: deps.log,
    },
  );
  // `status` is never `skipped_locked` in practice (see the type note
  // above) — Oura's fetch worker has no multi-replica lock seam.
  return outcome as OuraFetchOutcome;
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
