/**
 * What decides WHEN to flush. The last piece of the Phase 7 design.
 *
 * `flushOnce` knows how to drain a queue and nothing about time;
 * `trainerOutboxStore` knows how to persist one. Neither ever ran on its own,
 * so queued entries sat on disk until a screen happened to be open and
 * something happened to call the loop. This is the piece that makes "Saved
 * locally · 3 pending" resolve itself.
 *
 * NOT A NEW SYNC SUBSYSTEM. It composes the two modules that already exist
 * and adds scheduling: no second queue, no second transport, no second set of
 * state transitions.
 *
 * EVERY SOURCE OF TIME AND CONCURRENCY IS INJECTED — the clock, the timer,
 * the queue accessors, the transport. That is what lets the tests drive
 * backoff, foreground transitions and overlapping flushes deterministically,
 * with no fake timers and no sleeping.
 *
 * THE FIVE RULES:
 *
 *   1. NO BUSY LOOP. Exactly one timer is ever outstanding, set for when the
 *      next item actually becomes due. An empty queue schedules NOTHING —
 *      not a poll that wakes every few seconds to find nothing, which on a
 *      phone is battery a trainer notices.
 *
 *   2. NO OVERLAPPING FLUSHES. One in flight at a time. A request that
 *      arrives mid-flight is remembered and runs once, after — it does not
 *      queue up N more passes, and it does not get dropped.
 *
 *   3. BACKGROUND MEANS STOPPED. Timers are cleared when the app backgrounds
 *      and a flush runs immediately on return, because the interesting moment
 *      is a trainer walking back into signal.
 *
 *   4. NOTHING IS DROPPED, EVER. Parked items (past the automatic-retry
 *      threshold) stay in the queue and stay visible. The scheduler stops
 *      retrying them; it never removes them.
 *
 *   5. A FAILURE TO FLUSH IS NOT A CRASH. Any throw is reported and the next
 *      wake is still scheduled, or a single bad response would stop the loop
 *      forever.
 */
import type { OutboxItem } from "./trainerOutbox";
import {
  DEFAULT_FLUSH_LIMIT,
  DEFAULT_MAX_AUTO_ATTEMPTS,
  flushOnce,
  hasWork,
  nextDueAtMs,
  type FlushOutcome,
  type SyncTransport,
} from "./trainerSync";

export type TimerHandle = unknown;

export interface SchedulerDeps {
  now(): number;
  setTimer(fn: () => void, ms: number): TimerHandle;
  clearTimer(handle: TimerHandle): void;
  /** The current queue. Read fresh each pass — the screen may have enqueued. */
  getQueue(): readonly OutboxItem[];
  /** Persist and publish the next queue. Awaited before the pass completes. */
  setQueue(next: OutboxItem[]): void | Promise<void>;
  transport: SyncTransport;
  /** Reported, never thrown. */
  onError?(err: unknown): void;
  onFlush?(outcome: FlushOutcome): void;
}

export interface SchedulerOptions {
  limit?: number;
  maxAutoAttempts?: number;
  /**
   * Floor on the gap between passes.
   *
   * An item whose backoff has already elapsed is due "now", and flushing it
   * the instant a pass ends would spin. This is the smallest wait the
   * scheduler will ever set.
   */
  minDelayMs?: number;
  /**
   * Ceiling on how long the scheduler will sleep with work outstanding.
   *
   * Not a poll: with an empty queue nothing is scheduled at all. This only
   * caps a very distant backoff, so returning to signal after a long wait
   * does not mean waiting out the rest of it.
   */
  maxDelayMs?: number;
}

export const DEFAULT_MIN_DELAY_MS = 1_000;
export const DEFAULT_MAX_DELAY_MS = 60_000;

export interface Scheduler {
  /** Begin. Idempotent. */
  start(): void;
  /** Stop and clear any pending timer. Idempotent. Drops nothing. */
  stop(): void;
  /** The app came to the foreground: flush now. */
  onForeground(): void;
  /** The app went to the background: stop waking up. */
  onBackground(): void;
  /** Something was just enqueued: consider flushing. */
  onEnqueued(): void;
  /** Force a pass. Resolves when it has finished (or was coalesced). */
  flushNow(): Promise<void>;
  /** For tests and the indicator. */
  inspect(): { running: boolean; inFlight: boolean; wakeAtMs: number | null };
}

export function createOutboxScheduler(
  deps: SchedulerDeps,
  options: SchedulerOptions = {},
): Scheduler {
  const limit = options.limit ?? DEFAULT_FLUSH_LIMIT;
  const maxAutoAttempts = options.maxAutoAttempts ?? DEFAULT_MAX_AUTO_ATTEMPTS;
  const minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let running = false;
  let inFlight = false;
  /** A flush was requested while one was running. Rule 2. */
  let again = false;
  let timer: TimerHandle | null = null;
  let wakeAtMs: number | null = null;

  function clearPending(): void {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
    wakeAtMs = null;
  }

  /** Rule 1: one timer, set for when something is actually due. */
  function schedule(): void {
    clearPending();
    if (!running) return;

    const queue = deps.getQueue();
    const dueAt = nextDueAtMs(queue, maxAutoAttempts);
    if (dueAt === null) return; // nothing waiting — schedule nothing at all

    const now = deps.now();
    const delay = Math.min(maxDelayMs, Math.max(minDelayMs, dueAt - now));
    wakeAtMs = now + delay;
    timer = deps.setTimer(() => {
      timer = null;
      wakeAtMs = null;
      void runPass();
    }, delay);
  }

  async function runPass(): Promise<void> {
    if (!running) return;

    // Rule 2. Remember the request rather than running a second pass or
    // discarding it.
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;

    try {
      do {
        again = false;
        const queue = deps.getQueue();
        if (!hasWork(queue, deps.now(), maxAutoAttempts)) break;

        const outcome = await flushOnce(queue, deps.transport, deps.now(), {
          limit,
          maxAutoAttempts,
        });

        // MERGE, DO NOT REPLACE. A trainer can enqueue while a flush is in
        // flight — that is the normal case on a sideline, not an edge one —
        // and writing the outcome back wholesale would silently drop
        // everything added since the snapshot was taken. Items the flush
        // touched take its version; items that appeared meanwhile are kept
        // as they are.
        const touched = new Map(outcome.queue.map((i) => [i.id, i]));
        const merged = deps.getQueue().map((i) => touched.get(i.id) ?? i);
        const known = new Set(merged.map((i) => i.id));
        for (const i of outcome.queue) if (!known.has(i.id)) merged.push(i);
        await deps.setQueue(merged);
        deps.onFlush?.(outcome);

        // A pass that hit its per-pass limit leaves work behind; loop rather
        // than waiting a full timer interval to continue draining.
        if (outcome.sent + outcome.failed + outcome.conflicted >= limit) again = true;
      } while (again && running);
    } catch (err) {
      // Rule 5. A single bad response must not stop the loop forever.
      deps.onError?.(err);
    } finally {
      inFlight = false;
      schedule();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      void runPass();
    },

    stop() {
      running = false;
      clearPending();
      // An in-flight pass is allowed to finish: its result is already
      // partly durable on the server, and abandoning it would lose the
      // record of what was sent.
    },

    onForeground() {
      if (!running) return;
      void runPass();
    },

    onBackground() {
      // Rule 3. Stop waking up. `running` stays true so a return to the
      // foreground resumes without a restart.
      clearPending();
    },

    onEnqueued() {
      if (!running) return;
      void runPass();
    },

    async flushNow() {
      await runPass();
    },

    inspect() {
      return { running, inFlight, wakeAtMs };
    },
  };
}
