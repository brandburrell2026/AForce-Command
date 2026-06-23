/**
 * Offline intake outbox — shared types (pure, RN-free).
 *
 * An "outbox" item is a single intake the user completed while the device
 * could not reach the server. It freezes EVERYTHING needed to replay that
 * one log byte-identically later: the explicit idempotency key, the frozen
 * scoreBefore/scoreAfter (computed from the completed action at log time —
 * NEVER recomputed by the outbox, per Score-Protection), and the
 * wire-serialized event.
 *
 * This file declares only types; it carries no runtime behaviour and imports
 * `IntakeEvent` as a type-only import so it stays free of React Native.
 */
import type { IntakeEvent } from '@/types';

export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'synced';

/** Wire-serialized IntakeEvent — `loggedAt` is an ISO string, matching the POST body. */
export type IntakeEventWire = Omit<IntakeEvent, 'loggedAt'> & { loggedAt: string };

/**
 * The frozen, replay-safe intake payload. Captured ONCE at log time so a
 * queued item replays verbatim — same `clientEventId`, same `event.id`, same
 * frozen scores. The outbox never recomputes a score (Score-Protection): the
 * numbers here are derived from the user's completed action at the moment they
 * logged it, and are merely carried across the network gap.
 */
export interface PreparedIntake {
  /**
   * Idempotency key for the server's NULLS-DISTINCT unique index. Explicit
   * and distinct from `event.id` (architect decision) so the dedupe contract
   * is independent of the event payload's own id.
   */
  clientEventId: string;
  fluidType: string;
  ozAmount: number;
  /** Frozen at log time — replayed verbatim, never recomputed. */
  scoreBefore: number;
  scoreAfter: number;
  event: IntakeEventWire;
}

export interface OutboxItem {
  prepared: PreparedIntake;
  status: OutboxStatus;
  /** Number of FAILED send attempts so far (drives the backoff schedule). */
  attempts: number;
  /** ms epoch when the item was first enqueued. */
  createdAtMs: number;
  /** Earliest ms epoch at which this item should next be (re)sent. */
  nextAttemptAtMs: number;
  /** ms epoch of the last failure, if any. */
  lastErrorAtMs?: number;
}

/**
 * The optimistic projection added on top of authoritative server state so the
 * UI doesn't appear to "drop" intakes the server hasn't confirmed yet.
 *
 *  - `count` includes EVERY unsynced item (badge), even stale ones, because
 *    they are still queued and will still be sent.
 *  - the numeric deltas EXCLUDE stale (>24h) items: the server applies a stale
 *    replay as a historical log only and never inflates today's counters, so
 *    the overlay must match it (Score-Protection — no fabricated "today" math).
 */
export interface PendingOverlay {
  count: number;
  unitsPending: number;
  ozPending: number;
  aforceUnitsPending: number;
}
