/**
 * WHOOP biometrics fetch sweep — runs `runWhoopFetchOnce` for every
 * user with stored WHOOP tokens at a configured interval.
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

export interface WhoopFetchSweepTally {
  total: number;
  byStatus: Record<WhoopFetchOutcomeStatus, number>;
}

export interface WhoopFetchSweepResult extends WhoopFetchSweepTally {
  /** Epoch ms when the sweep started. */
  startedAt: number;
  /** Epoch ms when the sweep finished. */
  finishedAt: number;
  /** Wall-clock duration in ms (finishedAt - startedAt). */
  durationMs: number;
}

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
  const now = args.nowMs ?? ((): number => Date.now());
  const concurrency = Math.max(1, args.concurrency ?? 4);
  const log = args.log;
  const startedAt = now();

  const tally: WhoopFetchSweepTally = {
    total: args.userIds.length,
    byStatus: { ok: 0, skipped_no_token: 0, skipped_no_state: 0, error: 0 },
  };

  if (args.userIds.length === 0) {
    const finishedAt = now();
    log?.info(
      { total: 0, durationMs: finishedAt - startedAt },
      "whoopFetchSweep:empty",
    );
    return {
      ...tally,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
    };
  }

  let cursor = 0;
  const next = (): string | null => {
    if (cursor >= args.userIds.length) return null;
    const id = args.userIds[cursor]!;
    cursor += 1;
    return id;
  };

  async function worker(): Promise<void> {
    for (;;) {
      const userId = next();
      if (userId === null) return;
      try {
        const out = await args.runOnce(userId);
        tally.byStatus[out.status] += 1;
      } catch (err) {
        // `runWhoopFetchOnce` is contractually never-throws, but
        // defend against a future regression so one bad user can't
        // crash the sweep.
        tally.byStatus.error += 1;
        log?.error(
          { userId, err: err instanceof Error ? err.name : "unknown_error" },
          "whoopFetchSweep:runOnce threw",
        );
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, args.userIds.length) },
    () => worker(),
  );
  await Promise.all(workers);

  const finishedAt = now();
  const result: WhoopFetchSweepResult = {
    ...tally,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  };
  log?.info({ ...tally, durationMs: result.durationMs }, "whoopFetchSweep:done");
  return result;
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
  if (!Number.isFinite(args.intervalMs) || args.intervalMs <= 0) {
    throw new Error(
      `startWhoopFetchSweepLoop: intervalMs must be > 0, got ${args.intervalMs}`,
    );
  }
  const setT = args.setTimeoutImpl ?? setTimeout;
  const clearT = args.clearTimeoutImpl ?? clearTimeout;
  const log = args.log;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const schedule = (): void => {
    if (stopped) return;
    timer = setT(() => {
      timer = null;
      void tick();
    }, args.intervalMs);
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;
    if (running) {
      // Re-entrancy guard — should be impossible with a setTimeout
      // chain (we don't schedule until the previous tick finishes),
      // but pin the invariant in case someone later moves to setInterval.
      log?.warn("whoopFetchSweep:tick skipped — previous sweep still running");
      schedule();
      return;
    }
    running = true;
    try {
      await args.runSweep();
    } catch (err) {
      // runSweep itself shouldn't throw (it absorbs per-user errors),
      // but if it does, log and keep the loop alive.
      log?.error(
        { err: err instanceof Error ? err.name : "unknown_error" },
        "whoopFetchSweep:runSweep threw",
      );
    } finally {
      running = false;
      schedule();
    }
  };

  schedule();

  return function stop(): void {
    stopped = true;
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
  };
}
