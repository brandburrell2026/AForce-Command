/**
 * Lock In window — when a sealed Moment can be locked in.
 *
 * One Breath Final Build Spec (2026-11-20): Lock In happens "only when the
 * Moment begins"; a future Moment never triggers Lock In or "Go perform" at
 * sealing time. The window opens `MOMENT_LOCK_IN_BEFORE_MIN` before the start,
 * the same lead the LOCK IN ritual stage already uses, so there is one number.
 *
 * Pure: it reads a start time and a clock and nothing else. It never guesses
 * how long a Moment lasts, so it does not close the window on its own.
 */
import { MOMENT_LOCK_IN_BEFORE_MIN } from '@/config/hydroStateModel';

export type LockInWindow = 'before' | 'open';

const LEAD_MS = MOMENT_LOCK_IN_BEFORE_MIN * 60_000;

/** Milliseconds until Lock In opens; 0 once it is open. An unreadable start is treated as open, never as a block. */
export function lockInOpensInMs(startAtIso: string | undefined, nowMs: number): number {
  const start = Date.parse(startAtIso ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, start - LEAD_MS - nowMs);
}

export function lockInWindow(startAtIso: string | undefined, nowMs: number): LockInWindow {
  return lockInOpensInMs(startAtIso, nowMs) > 0 ? 'before' : 'open';
}

/** What the sealed screen says while Lock In is not open yet. */
export const LOCK_IN_NOT_YET = `Lock In opens ${MOMENT_LOCK_IN_BEFORE_MIN} minutes before it starts.`;
