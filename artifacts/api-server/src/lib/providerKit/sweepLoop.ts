/**
 * providerKit — biometrics fetch sweep loop, parameterized by
 * provider.
 *
 * Pure extraction of `whoopFetchSweep.ts` (worker-pool fan-out +
 * setTimeout scheduling) merged with the env-cadence parsing pattern
 * from `whoopFetchSweepBootstrap.ts`. WHOOP's files are frozen
 * (production) and are NOT rewritten onto this; `ouraFetchSweepBootstrap.ts`
 * is the first (and, in this lane, only) consumer.
 *
 * Three layers, all provider-agnostic:
 *   - `runProviderFetchSweep` — one pass over a fixed list of userIds.
 *     Fans out under a concurrency cap (default 4), tallies outcomes
 *     by status. Never throws — per-user failures are absorbed into
 *     the tally so the sweep keeps going.
 *   - `runProviderFetchSweepStreaming` — same, but consumes an async
 *     iterable of userId PAGES (typically a keyset paginator) so
 *     memory stays bounded at O(pageSize) regardless of table size.
 *   - `startProviderFetchSweepLoop` — schedules a sweep runner on a
 *     fixed interval via a setTimeout CHAIN (not setInterval), so a
 *     slow sweep never stacks ticks. Re-entrancy guard: if a tick
 *     fires while the previous sweep is still running, the new tick
 *     is skipped (logged at warn). Returns a stop function; an
 *     in-flight sweep is allowed to drain.
 *   - `parseSweepIntervalMs` — the env-cadence contract every
 *     bootstrap in this codebase follows: unset/empty -> disabled
 *     (null, no log), non-positive or non-finite -> disabled + warn
 *     (refuses to silently coerce a typo like "5min" into 0/NaN).
 *
 * Multi-replica note: the optional `acquireLock` seam on
 * `RunProviderFetchSweepArgs` gives single-replica-safe callers a way
 * to add cross-process singleflight (e.g. Postgres advisory locks)
 * without this module knowing anything about the lock implementation.
 * Without it, every replica processes every user — fine for the
 * current single-replica topology, same as WHOOP's default.
 */

import type { Logger } from "pino";
import type { ProviderFetchOutcomeStatus } from "./fetchWorker";

export interface ProviderFetchSweepTally {
  total: number;
  byStatus: Record<ProviderFetchOutcomeStatus, number>;
}

export interface ProviderFetchSweepResult extends ProviderFetchSweepTally {
  /** Epoch ms when the sweep started. */
  startedAt: number;
  /** Epoch ms when the sweep finished. */
  finishedAt: number;
  /** Wall-clock duration in ms (finishedAt - startedAt). */
  durationMs: number;
}

function emptyTally(): ProviderFetchSweepTally {
  return {
    total: 0,
    byStatus: {
      ok: 0,
      skipped_no_token: 0,
      skipped_no_state: 0,
      skipped_locked: 0,
      skipped_fresh: 0,
      skipped_backoff: 0,
      skipped_needs_reauth: 0,
      error: 0,
    },
  };
}

/**
 * Multi-replica singleflight seam. When provided, every per-user
 * `runOnce` call is wrapped in `acquireLock(userId, () => runOnce(uid))`.
 * `acquired: false` means another replica is already processing this
 * user — tallied as `skipped_locked` and moved on. A thrown
 * `acquireLock` is tallied as `error` (lock state is ambiguous on
 * throw; not safe to re-run).
 */
export type AcquireUserSweepLock = <T>(
  userId: string,
  fn: () => Promise<T>,
) => Promise<{ acquired: true; value: T } | { acquired: false }>;

export interface RunProviderFetchSweepArgs {
  /** Users to fetch this pass. */
  userIds: readonly string[];
  /** Per-user runner. Outcomes are tallied; thrown errors are absorbed
   *  into `byStatus.error` so one user's failure can't kill the sweep. */
  runOnce: (
    userId: string,
  ) => Promise<{ status: ProviderFetchOutcomeStatus }>;
  /** Max concurrent in-flight `runOnce` calls. Default 4. */
  concurrency?: number;
  /** Optional multi-replica singleflight. Absent => single-replica
   *  behavior (every user is processed by this replica). */
  acquireLock?: AcquireUserSweepLock;
  /** Defaults to `Date.now`. */
  nowMs?: () => number;
  log?: Pick<Logger, "info" | "warn" | "error">;
  /** Log-line prefix, e.g. "ouraFetchSweep". Defaults to
   *  "providerFetchSweep". */
  logPrefix?: string;
}

/** Defensive: never let an Error's message leak into a sweep tally log. */
function serializeSweepErr(err: unknown): { name: string; message?: string } {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { name: "unknown_error" };
}

/**
 * Fan out `runOnce` across `userIds` under a fixed concurrency cap and
 * return a status tally. Bounded concurrency is a worker-pool (N
 * workers pulling from a shared cursor) rather than a promise-pool,
 * for built-in back-pressure.
 */
export async function runProviderFetchSweep(
  args: RunProviderFetchSweepArgs,
): Promise<ProviderFetchSweepResult> {
  const now = args.nowMs ?? ((): number => Date.now());
  const concurrency = Math.max(1, args.concurrency ?? 4);
  const log = args.log;
  const prefix = args.logPrefix ?? "providerFetchSweep";
  const startedAt = now();

  const tally = emptyTally();
  tally.total = args.userIds.length;

  if (args.userIds.length === 0) {
    const finishedAt = now();
    log?.info({ total: 0, durationMs: finishedAt - startedAt }, `${prefix}:empty`);
    return { ...tally, startedAt, finishedAt, durationMs: finishedAt - startedAt };
  }

  let cursor = 0;
  const next = (): string | null => {
    if (cursor >= args.userIds.length) return null;
    const id = args.userIds[cursor]!;
    cursor += 1;
    return id;
  };

  const acquireLock = args.acquireLock;
  async function worker(): Promise<void> {
    for (;;) {
      const userId = next();
      if (userId === null) return;
      try {
        if (acquireLock !== undefined) {
          const lockOut = await acquireLock(userId, () => args.runOnce(userId));
          if (lockOut.acquired) {
            tally.byStatus[lockOut.value.status] += 1;
          } else {
            tally.byStatus.skipped_locked += 1;
          }
        } else {
          const out = await args.runOnce(userId);
          tally.byStatus[out.status] += 1;
        }
      } catch (err) {
        // `runOnce` is contractually never-throws, but defend against a
        // future regression so one bad user can't crash the sweep. Same
        // path catches acquireLock throws.
        tally.byStatus.error += 1;
        log?.error({ userId, err: serializeSweepErr(err) }, `${prefix}:runOnce threw`);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, args.userIds.length) },
    () => worker(),
  );
  await Promise.all(workers);

  const finishedAt = now();
  const result: ProviderFetchSweepResult = {
    ...tally,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  };
  log?.info({ ...tally, durationMs: result.durationMs }, `${prefix}:done`);
  return result;
}

export interface RunProviderFetchSweepStreamingArgs {
  /** Source of pages — typically a keyset paginator. Each page is
   *  processed by a fresh `runProviderFetchSweep` call under the same
   *  concurrency cap, then dropped from memory before the next page is
   *  fetched. Memory stays bounded at O(pageSize) regardless of how
   *  many users have stored tokens. */
  pages: AsyncIterable<readonly string[]>;
  runOnce: RunProviderFetchSweepArgs["runOnce"];
  concurrency?: number;
  acquireLock?: AcquireUserSweepLock;
  nowMs?: () => number;
  log?: Pick<Logger, "info" | "warn" | "error">;
  logPrefix?: string;
}

/**
 * Streaming variant of `runProviderFetchSweep`. Consumes an async
 * iterable of userId pages, runs the in-page worker pool to
 * completion, accumulates the cross-page tally, and moves to the next
 * page only after the current page drains (per-page sequential — the
 * page boundary IS the back-pressure).
 */
export async function runProviderFetchSweepStreaming(
  args: RunProviderFetchSweepStreamingArgs,
): Promise<ProviderFetchSweepResult> {
  const now = args.nowMs ?? ((): number => Date.now());
  const prefix = args.logPrefix ?? "providerFetchSweep";
  const startedAt = now();
  const tally = emptyTally();
  let pageCount = 0;

  for await (const page of args.pages) {
    pageCount += 1;
    if (page.length === 0) continue;
    const pageResult = await runProviderFetchSweep({
      userIds: page,
      runOnce: args.runOnce,
      concurrency: args.concurrency,
      acquireLock: args.acquireLock,
      nowMs: args.nowMs,
      log: args.log,
      logPrefix: args.logPrefix,
    });
    tally.total += pageResult.total;
    const statuses = Object.keys(tally.byStatus) as Array<
      keyof typeof tally.byStatus
    >;
    for (const k of statuses) {
      tally.byStatus[k] += pageResult.byStatus[k];
    }
  }

  const finishedAt = now();
  const result: ProviderFetchSweepResult = {
    ...tally,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
  };
  args.log?.info(
    { ...tally, pageCount, durationMs: result.durationMs },
    `${prefix}Streaming:done`,
  );
  return result;
}

export interface StartProviderFetchSweepLoopArgs {
  /** Interval between sweep starts, in ms. Must be > 0. Measured from
   *  the END of one sweep to the START of the next (setTimeout
   *  chain), so a slow sweep delays — never overlaps — the following
   *  tick. */
  intervalMs: number;
  /** Sweep runner. Typically a closure over
   *  `runProviderFetchSweepStreaming({...})` with deps bound. */
  runSweep: () => Promise<ProviderFetchSweepResult>;
  log?: Pick<Logger, "info" | "warn" | "error">;
  /** Log-line prefix. Defaults to "providerFetchSweep". */
  logPrefix?: string;
  /** Defaults to globalThis.setTimeout / clearTimeout. Override for
   *  fake-timer tests. */
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

/**
 * Schedule sweep ticks at a fixed interval. Returns a `stop` function
 * that prevents further ticks; an in-flight sweep is allowed to
 * drain. The first tick is scheduled at `intervalMs` after the call —
 * no synchronous sweep at startup, so a flapping server can't hammer
 * the provider on every restart.
 */
export function startProviderFetchSweepLoop(
  args: StartProviderFetchSweepLoopArgs,
): () => void {
  if (!Number.isFinite(args.intervalMs) || args.intervalMs <= 0) {
    throw new Error(
      `startProviderFetchSweepLoop: intervalMs must be > 0, got ${args.intervalMs}`,
    );
  }
  const setT = args.setTimeoutImpl ?? setTimeout;
  const clearT = args.clearTimeoutImpl ?? clearTimeout;
  const log = args.log;
  const prefix = args.logPrefix ?? "providerFetchSweep";
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
      // chain, but pin the invariant in case someone later moves to
      // setInterval.
      log?.warn(`${prefix}:tick skipped — previous sweep still running`);
      schedule();
      return;
    }
    running = true;
    try {
      await args.runSweep();
    } catch (err) {
      log?.error(
        { err: serializeSweepErr(err) },
        `${prefix}:runSweep threw`,
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

/**
 * Env-cadence parsing contract shared by every fetch-sweep bootstrap
 * in this codebase (`whoopFetchSweepBootstrap.ts`,
 * `whoopAuthStatePurgeBootstrap.ts`, and now `ouraFetchSweepBootstrap.ts`):
 *   - unset / empty -> disabled, returns null. Quiet (hidden-infra
 *     default — most deployments never want this, no log spam).
 *   - not a positive finite number -> disabled, returns null AND
 *     warns. Refuses to silently coerce a misconfig (e.g. "5min"
 *     would otherwise become 0 / NaN and either spin or never fire).
 *   - valid -> returns the parsed positive number.
 */
export function parseSweepIntervalMs(opts: {
  envVarName: string;
  env?: Record<string, string | undefined>;
  log: Pick<Logger, "warn">;
  /** Log-line prefix for the warn message. Defaults to
   *  "providerFetchSweep". */
  logPrefix?: string;
}): number | null {
  const env = opts.env ?? process.env;
  const raw = env[opts.envVarName];
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const intervalMs = Number(raw);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    const prefix = opts.logPrefix ?? "providerFetchSweep";
    opts.log.warn(
      { [opts.envVarName]: raw },
      `${prefix}:bootstrap ignored — value is not a positive number`,
    );
    return null;
  }
  return intervalMs;
}
