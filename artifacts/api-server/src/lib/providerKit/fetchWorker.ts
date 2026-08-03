/**
 * providerKit — biometrics fetch worker orchestration, parameterized
 * by provider.
 *
 * Pure extraction from `whoopFetchWorker.ts`'s `runWhoopFetchOnce`
 * pattern. WHOOP's file is frozen (production) and keeps its own
 * standalone implementation; only Oura's `runOuraFetchOnce` becomes a
 * thin wrapper over `createProviderFetchWorker` in this lane.
 *
 * Flow for one user (identical across every provider migrated onto
 * this kit):
 *   1. Resolve a valid access token via the token manager. Returns
 *      null when no tokens stored OR refresh failed -> result
 *      `{status: 'skipped_no_token'}`. No throw.
 *   2. Fetch the provider snapshot via the injected fetcher.
 *      Per-endpoint failures are the fetcher's problem to encode as
 *      null fields; a THROW here becomes `{status: 'error'}`.
 *   3. Merge the entry into the user's biometrics blob via the
 *      provider-agnostic `UserStateRepo` (jsonb_set on a single key),
 *      preserving every other provider's entry. UPDATE only — never
 *      creates a state row (the worker must not fabricate users).
 *   4. Result describes what happened, suitable for sweep-job logs /
 *      admin endpoints.
 *
 * `UserStateRepo` / `createDrizzleUserStateRepo` are RE-EXPORTED (not
 * duplicated) from `./userStateRepo`, whose own doc comment explains
 * why the source of truth is still `whoopFetchWorker.ts` until the
 * WHOOP cutover.
 *
 * Never throws — every failure path returns a structured outcome so a
 * sweep loop can keep going across users.
 */

import type { Logger } from "pino";
import type { UserStateRepo } from "./userStateRepo";

// `UserStateRepo` / `createDrizzleUserStateRepo` are exported from the
// package barrel via `export * from "./userStateRepo"` in `index.ts` —
// not re-exported here too, to avoid a duplicate-export collision.
// Import them from `./userStateRepo` (or the barrel) directly.

/**
 * Full outcome vocabulary across the fetch-worker + sweep layer.
 * `skipped_locked` is never returned by `runOnce` itself — it is
 * applied by a sweep's multi-replica advisory-lock seam (see
 * `sweepLoop.ts`) when a lock acquisition fails. It lives in this
 * union so a single status type threads through both layers.
 */
export type ProviderFetchOutcomeStatus =
  | "ok"
  | "skipped_no_token"
  | "skipped_no_state"
  | "skipped_locked"
  | "error";

export interface ProviderFetchOutcome<TSnapshot> {
  userId: string;
  status: ProviderFetchOutcomeStatus;
  /** Present when status === 'ok'. */
  snapshot?: TSnapshot;
  /** Present when status === 'ok'. Epoch ms used for the blob entry. */
  fetchedAt?: number;
  /** Present when status === 'error'. Sanitized message — no token
   *  leakage. */
  error?: string;
}

/** Minimal token-manager surface the worker needs. Any provider's
 *  token manager (Whoop/Oura/Garmin/Strava) satisfies this. */
export interface ProviderTokenManagerLike {
  getValidAccessToken(): Promise<string | null>;
}

export interface RunProviderFetchOnceDeps<TSnapshot> {
  /** Per-user token manager. The worker calls only
   *  `getValidAccessToken`. */
  tokenManager: ProviderTokenManagerLike;
  /** State repo binding (already scoped to the same DB the manager
   *  uses). */
  stateRepo: UserStateRepo;
  /** Pluggable snapshot fetcher — every provider supplies its own
   *  real HTTP fetcher as the default at the call site; this module
   *  has no default because it has no provider-specific HTTP code. */
  snapshotFetcher: (accessToken: string) => Promise<TSnapshot>;
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

export interface CreateProviderFetchWorkerOptions<TSnapshot> {
  /** Provider name — used only for the `providerKey` written into the
   *  biometrics blob (e.g. "oura") and for log-line prefixes. */
  provider: string;
  /** Maps a fetched snapshot + fetchedAt into the JSON blob persisted
   *  under `biometrics[provider]`. Each provider owns its own shape
   *  (e.g. `ouraSnapshotToProviderBlob`). */
  toBlob: (snapshot: TSnapshot, fetchedAt: number) => Record<string, unknown>;
}

export interface ProviderFetchWorker<TSnapshot> {
  runOnce(
    userId: string,
    deps: RunProviderFetchOnceDeps<TSnapshot>,
  ): Promise<ProviderFetchOutcome<TSnapshot>>;
}

/**
 * Build a fetch-worker bound to one provider. Returns an object (not a
 * bare function) so future providers can attach provider-specific
 * helpers alongside `runOnce` without changing the call shape at every
 * call site.
 */
export function createProviderFetchWorker<TSnapshot>(
  opts: CreateProviderFetchWorkerOptions<TSnapshot>,
): ProviderFetchWorker<TSnapshot> {
  const provider = opts.provider;
  const providerKey = provider.toLowerCase();

  return {
    async runOnce(userId, deps) {
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
          `${providerKey}FetchWorker:token resolution threw`,
        );
        return { userId, status: "skipped_no_token" };
      }
      if (!accessToken) {
        log?.info({ userId }, `${providerKey}FetchWorker:skipped_no_token`);
        return { userId, status: "skipped_no_token" };
      }

      let snapshot: TSnapshot;
      try {
        snapshot = await deps.snapshotFetcher(accessToken);
      } catch (err) {
        log?.error(
          { userId, err: errMessage(err) },
          `${providerKey}FetchWorker:fetch threw`,
        );
        return { userId, status: "error", error: errMessage(err) };
      }

      const fetchedAt = now();
      const blob = opts.toBlob(snapshot, fetchedAt);

      try {
        const updated = await deps.stateRepo.writeProviderEntry(
          userId,
          providerKey,
          blob,
        );
        if (!updated) {
          // No state row for this user — never fabricate.
          log?.info({ userId }, `${providerKey}FetchWorker:skipped_no_state`);
          return { userId, status: "skipped_no_state" };
        }
      } catch (err) {
        log?.error(
          { userId, err: errMessage(err) },
          `${providerKey}FetchWorker:state write threw`,
        );
        return { userId, status: "error", error: errMessage(err) };
      }

      log?.info({ userId, fetchedAt }, `${providerKey}FetchWorker:ok`);
      return { userId, status: "ok", snapshot, fetchedAt };
    },
  };
}
