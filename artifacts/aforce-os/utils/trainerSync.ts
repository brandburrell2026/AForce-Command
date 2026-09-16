/**
 * The flush loop.
 *
 * Phase 7 built `selectDue`, `markSyncing`, `markSynced`, `markFailed` and
 * `markConflicted`, proved every one of them, and then nothing in production
 * called any of them. The queue accumulated and never drained, which is why
 * the cap was not a cap and why the conflict path could not fire.
 *
 * NO TIMERS, NO NETWORK, NO REACT IN HERE. `flushOnce` takes a queue, a
 * transport and a clock and returns the next queue. The caller decides when
 * to run it. That is what makes every rule below testable without a fake
 * server, and it is the same shape the rest of `trainerOutbox` already has.
 *
 * FOUR RULES.
 *
 *   1. SEQUENTIAL, OLDEST FIRST. Availability edits for one athlete are a
 *      sequence, not a set: "out" then "available" means something different
 *      from the reverse, and a parallel flush would let the network decide
 *      which arrived last. The cost is throughput on a queue nobody is
 *      watching, which is the right thing to trade.
 *
 *   2. ONE ATHLETE'S CONFLICT DOES NOT BLOCK ANOTHER'S. A conflicted item
 *      stops that ATHLETE's chain — later edits to the same athlete would be
 *      built on a version a person has not yet chosen — and everyone else
 *      keeps flushing.
 *
 *   3. NOTHING IS DISCARDED. A permanent rejection still keeps the item, in
 *      `failed`, with the reason on it. The trainer's entry is evidence of a
 *      clinical decision even when the server will not take it, and a queue
 *      that quietly drops one is worse than a queue that will not drain.
 *
 *   4. A FLUSH NEVER THROWS. A transport that rejects with anything at all is
 *      a retry, because the alternative is one bad response taking down a
 *      sideline.
 */
import {
  markConflicted,
  markFailed,
  markSynced,
  markSyncing,
  selectDue,
  type OutboxItem,
} from "./trainerOutbox";

/** What the server said. Every branch is a decision the queue must encode. */
export type SendResult =
  | { ok: true }
  /** 409 — the server moved. Both values are kept for a person to choose. */
  | { ok: false; kind: "conflict"; serverVersion: number; serverValue: Record<string, unknown> }
  /** 5xx, timeout, offline. Retried with backoff, forever. */
  | { ok: false; kind: "retry"; message?: string }
  /**
   * 4xx that retrying cannot fix — malformed, no longer permitted, athlete no
   * longer a member. Kept, not dropped, so the entry is still visible and
   * still answerable.
   */
  | { ok: false; kind: "permanent"; message?: string };

export interface SyncTransport {
  send(item: OutboxItem): Promise<SendResult>;
}

export interface FlushOutcome {
  queue: OutboxItem[];
  sent: number;
  conflicted: number;
  failed: number;
  /** Items that were due but skipped because their athlete is blocked. */
  blocked: number;
  /** Items past the automatic-retry threshold. Kept, not sent, not dropped. */
  parked: number;
}

export interface FlushOptions {
  /** Cap per pass, so one flush cannot hold the loop indefinitely. */
  limit?: number;
  /**
   * Attempts after which an item stops being retried AUTOMATICALLY.
   *
   * Retry has to be bounded or a permanently unacceptable entry is retried
   * until the heat death of the phone battery. It must NOT be bounded by
   * dropping the entry: a trainer's entry is evidence of a clinical decision,
   * and losing it silently is the worse failure. So an item over the
   * threshold is PARKED — left in the queue, still visible, still countable,
   * still resolvable by a person — and simply not sent again on its own.
   */
  maxAutoAttempts?: number;
}

export const DEFAULT_FLUSH_LIMIT = 25;

/** ~17 minutes of backoff before a human is the right next step. */
export const DEFAULT_MAX_AUTO_ATTEMPTS = 10;

/** Is this item past the point of automatic retry? */
export function isParked(item: OutboxItem, maxAutoAttempts = DEFAULT_MAX_AUTO_ATTEMPTS): boolean {
  return item.state === "failed" && item.attempts >= maxAutoAttempts;
}

/**
 * Attempt one pass over the due items.
 *
 * Returns a NEW queue. The caller persists it — `flushOnce` does not write to
 * storage, because a function that both talks to the network and owns the
 * file is one that cannot be tested for either.
 */
export async function flushOnce(
  queue: readonly OutboxItem[],
  transport: SyncTransport,
  nowMs: number,
  options: FlushOptions = {},
): Promise<FlushOutcome> {
  const limit = options.limit ?? DEFAULT_FLUSH_LIMIT;
  const maxAutoAttempts = options.maxAutoAttempts ?? DEFAULT_MAX_AUTO_ATTEMPTS;

  let working: OutboxItem[] = [...queue];
  let sent = 0;
  let conflicted = 0;
  let failed = 0;
  let blocked = 0;
  let parked = 0;

  /**
   * Athletes whose chain is stopped for this pass.
   *
   * Seeded from items ALREADY conflicted, not just ones that conflict during
   * this run: an entry waiting on a human decision must not be overtaken by
   * a later edit to the same athlete built on the version they are still
   * deciding about.
   */
  const blockedAthletes = new Set(
    working.filter((i) => i.state === "conflicted").map((i) => i.athleteUserId),
  );

  const due = selectDue(working, nowMs)
    .filter((item) => {
      if (!isParked(item, maxAutoAttempts)) return true;
      parked += 1;
      return false;
    })
    .slice(0, limit);

  for (const item of due) {
    if (blockedAthletes.has(item.athleteUserId)) {
      blocked += 1;
      continue;
    }

    working = markSyncing(working, item.id);

    let result: SendResult;
    try {
      result = await transport.send(item);
    } catch (err) {
      // Rule 4. Offline, DNS, a thrown parse error — all the same answer.
      result = {
        ok: false,
        kind: "retry",
        message: err instanceof Error ? err.message : "send failed",
      };
    }

    if (result.ok) {
      working = markSynced(working, item.id);
      sent += 1;
      continue;
    }

    if (result.kind === "conflict") {
      working = markConflicted(working, item.id, {
        serverVersion: result.serverVersion,
        serverValue: result.serverValue,
      });
      blockedAthletes.add(item.athleteUserId);
      conflicted += 1;
      continue;
    }

    working = markFailed(
      working,
      item.id,
      result.message ?? (result.kind === "permanent" ? "rejected" : "retry"),
      nowMs,
    );
    failed += 1;

    if (result.kind === "permanent") {
      // Rule 3: kept, and its athlete's chain stops. A later edit built on a
      // state the server refused would be built on sand.
      blockedAthletes.add(item.athleteUserId);
    }
  }

  return { queue: working, sent, conflicted, failed, blocked, parked };
}

/** Is there anything a flush could usefully do right now? */
export function hasWork(
  queue: readonly OutboxItem[],
  nowMs: number,
  maxAutoAttempts = DEFAULT_MAX_AUTO_ATTEMPTS,
): boolean {
  return selectDue(queue, nowMs).some((i) => !isParked(i, maxAutoAttempts));
}

/**
 * When the next item becomes due, or null if none will.
 *
 * Lets a caller sleep until there is something to do instead of waking on a
 * fixed interval to find an empty queue — which on a phone is battery a
 * trainer notices.
 */
export function nextDueAtMs(
  queue: readonly OutboxItem[],
  maxAutoAttempts = DEFAULT_MAX_AUTO_ATTEMPTS,
): number | null {
  const waiting = queue.filter(
    (q) => (q.state === "pending" || q.state === "failed") && !isParked(q, maxAutoAttempts),
  );
  if (waiting.length === 0) return null;
  return waiting.reduce((min, q) => Math.min(min, q.nextAttemptAtMs), Number.POSITIVE_INFINITY);
}
