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
 *
 * Founder Ruling C (RC-2 arbitration freshness, 2026-08-06): "A
 * provider should not regain priority just because the server polled
 * and re-stamped unchanged data." Every freshest-wins reader of
 * `fetchedAt` (the mobile aggregator, and server-side
 * `hydrationDemandStateAdapter.ts`) treats a higher `fetchedAt` as
 * newer DATA — so restamping on every poll, even when the provider
 * returned byte-identical content, let a frequently-polled provider
 * permanently outvote a less-frequently-polled one on every field it
 * carries. `runOnce` now reads the stored entry for this provider key
 * BEFORE writing, and preserves its `fetchedAt` when the new content is
 * unchanged (see `resolveProviderFetchedAt` below). `latestObservedAtMs`
 * (Founder Ruling I, #562) is untouched by this — it always reflects
 * whatever the current snapshot derived, in both branches.
 */

import { isDeepStrictEqual } from "node:util";
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
  // WHOOP sweep redesign (2026-08-19): scheduling suppressions. A suppressed
  // user costs zero provider calls and zero fetch work — the sweep only
  // tallies why it did nothing.
  | "skipped_fresh"
  | "skipped_backoff"
  | "skipped_needs_reauth"
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

/** Every provider blob shape (`WhoopProviderBlob`, `OuraProviderBlob`,
 *  `GarminProviderBlob`, `StravaProviderBlob`) carries exactly one
 *  volatile bookkeeping field alongside `providerId` + real metric
 *  data: `fetchedAt`. Stripping it here, once, keeps every provider's
 *  `toBlob` free of restamp-awareness — this module owns the decision,
 *  not the callers. */
function withoutFetchedAt(
  entry: Record<string, unknown>,
): Record<string, unknown> {
  const { fetchedAt: _fetchedAt, ...rest } = entry;
  return rest;
}

/**
 * Founder Ruling C (RC-2 arbitration freshness, 2026-08-06) — the
 * shared decision every provider's `runOnce` applies before writing.
 *
 * Compares the newly built blob's content (everything except
 * `fetchedAt`) against the STORED blob's content (same exclusion).
 * Equal -> the data hasn't changed since the last write; preserve the
 * stored `fetchedAt` so a frequently-polled-but-unchanged provider
 * can't outrank a less-frequently-polled one that actually has fresher
 * data. Different, or nothing stored yet, or the stored `fetchedAt` is
 * malformed -> stamp `candidateFetchedAt` (now()).
 *
 * `candidateBlob` must be the SAME object that will be written when
 * this returns `candidateFetchedAt` unchanged — callers only need to
 * patch the `fetchedAt` key when the return value differs from
 * `candidateFetchedAt`.
 */
export function resolveProviderFetchedAt(
  existingEntry: Record<string, unknown> | null,
  candidateBlob: Record<string, unknown>,
  candidateFetchedAt: number,
): number {
  if (existingEntry === null) return candidateFetchedAt;
  const storedFetchedAt = existingEntry["fetchedAt"];
  if (typeof storedFetchedAt !== "number" || !Number.isFinite(storedFetchedAt)) {
    // Malformed/legacy stored entry — never propagate garbage forward.
    return candidateFetchedAt;
  }
  const unchanged = isDeepStrictEqual(
    withoutFetchedAt(existingEntry),
    withoutFetchedAt(candidateBlob),
  );
  return unchanged ? storedFetchedAt : candidateFetchedAt;
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

      const candidateFetchedAt = now();
      const candidateBlob = opts.toBlob(snapshot, candidateFetchedAt);

      // Founder Ruling C: read the stored entry BEFORE deciding
      // fetchedAt. A read failure fails OPEN to a fresh timestamp
      // (never silently freezes fetchedAt) — a stuck stale reading is
      // worse than an occasional over-eager restamp.
      let existingEntry: Record<string, unknown> | null = null;
      try {
        existingEntry = await deps.stateRepo.readProviderEntry(
          userId,
          providerKey,
        );
      } catch (err) {
        log?.warn(
          { userId, err: errMessage(err) },
          `${providerKey}FetchWorker:read-before-write threw — restamping`,
        );
      }

      const fetchedAt = resolveProviderFetchedAt(
        existingEntry,
        candidateBlob,
        candidateFetchedAt,
      );
      const restamped = fetchedAt === candidateFetchedAt;
      const blob = restamped
        ? candidateBlob
        : { ...candidateBlob, fetchedAt };

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

      log?.info(
        { userId, fetchedAt, restamped },
        `${providerKey}FetchWorker:ok`,
      );
      return { userId, status: "ok", snapshot, fetchedAt };
    },
  };
}
