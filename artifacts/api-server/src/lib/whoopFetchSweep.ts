/**
 * WHOOP biometrics fetch sweep — runs `runWhoopFetchOnce` for every
 * user with stored WHOOP tokens at a configured interval.
 *
 * Thin wrapper over `providerKit/sweepLoop.ts` — the worker-pool
 * fan-out, streaming/paginated variant, and setTimeout-chain interval
 * scheduling are all shared implementation now (see that module for
 * the full contract doc, which is itself a pure extraction of THIS
 * file's pre-W3 shape merged with `whoopFetchSweepBootstrap.ts`'s
 * env-cadence parsing pattern). This file exists to keep WHOOP's
 * public API — every exported name, type, and default — byte-identical
 * to what it was before the extraction, so `whoopFetchSweepBootstrap.ts`
 * and every existing WHOOP test keep passing unchanged.
 *
 * Two exports:
 *   - `runWhoopFetchSweep` — one pass. Takes the userId list and a
 *     per-user runner, fans out under a concurrency cap, returns a
 *     status-tallied result. Never throws — per-user failures are
 *     absorbed into the tally so the sweep keeps going.
 *   - `startWhoopFetchSweepLoop` — schedules `runWhoopFetchSweep` on
 *     a fixed interval. Uses a setTimeout chain (NOT setInterval) so
 *     a slow sweep does not stack ticks. Re-entrancy guard: if a tick
 *     fires while the previous sweep is still running, the new tick
 *     is skipped (logged at warn) — overlap would defeat the singleflight
 *     registry's purpose by doubling fetcher load, not just refresh
 *     load. Returns a stop function that prevents further ticks; an
 *     in-flight sweep is allowed to drain.
 *
 * Log-line prefix is pinned to "whoopFetchSweep" (via `logPrefix`) so
 * every log line this module emits — including the streaming variant's
 * `whoopFetchSweepStreaming:done` — reads byte-identical to the
 * pre-extraction implementation.
 *
 * Architecture lock: hidden-infra. This module is NOT wired into
 * server boot in this PR. A follow-up will gate startup on a
 * `WHOOP_FETCH_SWEEP_INTERVAL_MS` env var; until then the code path
 * exists only for unit tests and the future admin trigger surface.
 *
 * Scope of the singleflight registry — see `whoopRefreshRegistry.ts`.
 * In short: single-replica process safety only. Multi-replica
 * deployments need a distributed lock (Postgres advisory locks keyed
 * on userId hash), tracked as a follow-up.
 */

import type { Logger } from "pino";
import type { WhoopFetchOutcomeStatus } from "./whoopFetchWorker";
import {
  runProviderFetchSweep,
  runProviderFetchSweepStreaming,
  startProviderFetchSweepLoop,
  type AcquireUserSweepLock as ProviderAcquireUserSweepLock,
  type ProviderFetchSweepResult,
  type ProviderFetchSweepTally,
  type RunProviderFetchSweepArgs,
  type RunProviderFetchSweepStreamingArgs,
  type StartProviderFetchSweepLoopArgs,
} from "./providerKit/sweepLoop";

const LOG_PREFIX = "whoopFetchSweep";

export type WhoopFetchSweepTally = ProviderFetchSweepTally;
export type WhoopFetchSweepResult = ProviderFetchSweepResult;

/**
 * Multi-replica singleflight seam. When provided, every per-user
 * `runOnce` call is wrapped in `acquireLock(userId, () => runOnce(uid))`.
 * The lock is expected to be non-blocking — `acquired: false` means
 * another replica is already processing this user, so we tally the
 * outcome as `skipped_locked` and move on (we'll catch the user next
 * sweep). When the lock function itself throws (DB error, connection
 * timeout, etc.), we tally as `error` — same path as a fn-throw,
 * since lock state is ambiguous and we can't safely re-run.
 *
 * Structural shape (not an import from `whoopAdvisoryLock`) so the
 * sweep stays decoupled from the lock implementation — the bootstrap
 * does the actual wiring. Any non-blocking distributed lock satisfying
 * this shape works (Redis SETNX, etcd, etc.) if WHOOP ever migrates.
 */
export type AcquireUserSweepLock = ProviderAcquireUserSweepLock;

export interface RunWhoopFetchSweepArgs {
  /** Users to fetch this pass — produced by `listWhoopTokenUserIds`. */
  userIds: readonly string[];
  /** Per-user runner. Outcomes are tallied; thrown errors are absorbed
   *  into `byStatus.error` so one user's failure can't kill the sweep. */
  runOnce: (
    userId: string,
  ) => Promise<{ status: WhoopFetchOutcomeStatus }>;
  /** Max concurrent in-flight `runOnce` calls. Default 4. The
   *  singleflight registry ensures concurrent calls for the SAME user
   *  collapse to one POST, but unrelated users can run in parallel
   *  up to this cap. */
  concurrency?: number;
  /** Optional multi-replica singleflight. See `AcquireUserSweepLock`.
   *  Absent => single-replica behavior (no cross-process safety) —
   *  every user is processed by this replica. */
  acquireLock?: AcquireUserSweepLock;
  /** Defaults to `Date.now`. */
  nowMs?: () => number;
  log?: Pick<Logger, "info" | "warn" | "error">;
}

/**
 * Fan out `runOnce` across `userIds` under a fixed concurrency cap and
 * return a status tally. Bounded concurrency is implemented as a
 * worker-pool (N workers pulling from a shared cursor) rather than a
 * promise-pool, because it gives us back-pressure for free and keeps
 * the implementation under 20 lines.
 */
export async function runWhoopFetchSweep(
  args: RunWhoopFetchSweepArgs,
): Promise<WhoopFetchSweepResult> {
  return runProviderFetchSweep({
    ...(args as RunProviderFetchSweepArgs),
    logPrefix: LOG_PREFIX,
  });
}

export interface RunWhoopFetchSweepStreamingArgs {
  /** Source of pages — typically `iterWhoopTokenUserIds(db)`. Each page
   *  is processed by a fresh `runWhoopFetchSweep` call under the same
   *  concurrency cap, then dropped from memory before the next page is
   *  fetched. Memory stays bounded at O(pageSize) regardless of how
   *  many users have stored WHOOP tokens. */
  pages: AsyncIterable<readonly string[]>;
  /** Per-user runner. Same contract as `runWhoopFetchSweep` — outcomes
   *  tallied, thrown errors absorbed into `byStatus.error`. */
  runOnce: RunWhoopFetchSweepArgs["runOnce"];
  /** Forwarded to per-page `runWhoopFetchSweep`. Default 4. */
  concurrency?: number;
  /** Forwarded to per-page `runWhoopFetchSweep`. See `AcquireUserSweepLock`. */
  acquireLock?: AcquireUserSweepLock;
  /** Defaults to `Date.now`. */
  nowMs?: () => number;
  log?: Pick<Logger, "info" | "warn" | "error">;
}

/**
 * Streaming variant of `runWhoopFetchSweep`. Consumes an async iterable
 * of userId pages (typically the keyset paginator), runs the in-page
 * worker pool to completion, accumulates the cross-page tally, and
 * moves to the next page only after the current page drains.
 *
 * Why per-page sequential (not page-parallel): the page boundary IS
 * the back-pressure. Running pages concurrently would balloon memory
 * back to O(N) and defeat the streaming wrapper's purpose. Per-page
 * worker-pool concurrency still gives intra-page parallelism, which
 * is where the real fetch latency lives.
 *
 * The per-page `runWhoopFetchSweep` still emits its own `done` log —
 * useful telemetry at high page counts so you can watch progress mid-
 * sweep. The streaming wrapper adds one final aggregate `done` log on
 * top (`whoopFetchSweepStreaming:done`).
 */
export async function runWhoopFetchSweepStreaming(
  args: RunWhoopFetchSweepStreamingArgs,
): Promise<WhoopFetchSweepResult> {
  return runProviderFetchSweepStreaming({
    ...(args as RunProviderFetchSweepStreamingArgs),
    logPrefix: LOG_PREFIX,
  });
}

export interface StartWhoopFetchSweepLoopArgs {
  /** Interval between sweep starts, in ms. Must be > 0. The interval
   *  is measured from the END of one sweep to the START of the next
   *  (setTimeout chain), so a slow sweep delays — never overlaps —
   *  the following tick. */
  intervalMs: number;
  /** Sweep runner. Typically `() => runWhoopFetchSweep({...})` with
   *  the deps bound. */
  runSweep: () => Promise<WhoopFetchSweepResult>;
  log?: Pick<Logger, "info" | "warn" | "error">;
  /** Defaults to globalThis.setTimeout / clearTimeout. Override for
   *  fake-timer tests. */
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

/**
 * Schedule sweep ticks at a fixed interval. Returns a `stop` function
 * that prevents further ticks; an in-flight sweep is allowed to
 * drain. The first tick is scheduled at `intervalMs` after the call —
 * we do NOT run a sweep synchronously at startup, so a flapping
 * server can't hammer WHOOP on every restart.
 */
export function startWhoopFetchSweepLoop(
  args: StartWhoopFetchSweepLoopArgs,
): () => void {
  return startProviderFetchSweepLoop({
    ...(args as StartProviderFetchSweepLoopArgs),
    logPrefix: LOG_PREFIX,
  });
}
