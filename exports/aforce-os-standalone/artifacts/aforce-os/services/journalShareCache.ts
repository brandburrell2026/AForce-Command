/**
 * Journal → Share cache.
 *
 * The Share Preview screen needs the actual rollup series + range to
 * render the "Recap" format (mini chart + day-by-day stats). The
 * journal-derived summary (score / streak) is small enough to ride in
 * URL query params, but the full rollup window can be hundreds of
 * fields per day across the 90-day range — too large for params, and
 * stringifying it through the router would silently drop fidelity.
 *
 * Module-level cache keeps the data in memory. The Journal screen
 * publishes before navigating; the Share screen reads on mount; the
 * cache clears itself when consumed so a stale recap can't leak into
 * an unrelated share session (e.g. opening /share later from Home).
 *
 * Pure module — no React imports. Unit-testable in isolation.
 */

import type { JournalRollup } from '../types';

export interface JournalSharePayload {
  rollups: JournalRollup[];
  rangeDays: number;
  /** ms epoch when the payload was published; lets the reader detect stale data. */
  publishedAt: number;
}

let payload: JournalSharePayload | null = null;

/**
 * Time-to-live for a published payload. Long enough to comfortably
 * survive React 18 StrictMode dev double-mounts and the user reading
 * the share screen, short enough that a stale recap from a previous
 * session can't leak into an unrelated /share visit hours later.
 */
export const JOURNAL_SHARE_TTL_MS = 5 * 60 * 1000;

/** Publish a journal payload for the Share screen to consume. */
export function publishJournalShare(rollups: readonly JournalRollup[], rangeDays: number): void {
  payload = {
    // Defensive deep clone: rollup objects are plain data; cloning
    // each one prevents external mutation of either the array OR a
    // single rollup field from bleeding into the captured share image.
    rollups: rollups.map((r) => ({ ...r })),
    rangeDays,
    publishedAt: Date.now(),
  };
}

/**
 * Read the most recently published payload. Returns `null` when the
 * cache is empty OR when the payload is older than {@link JOURNAL_SHARE_TTL_MS}
 * (lets the cache self-expire so stale data can't leak across
 * unrelated /share visits, while still surviving a single share
 * session that includes a StrictMode unmount/remount cycle).
 */
export function readJournalShare(): JournalSharePayload | null {
  if (!payload) return null;
  if (Date.now() - payload.publishedAt > JOURNAL_SHARE_TTL_MS) {
    payload = null;
    return null;
  }
  return payload;
}

/** Explicitly drop the cached payload (e.g. on logout / language change). */
export function clearJournalShare(): void {
  payload = null;
}
