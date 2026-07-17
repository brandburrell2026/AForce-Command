/**
 * Section 64 — Conversational Intelligence Architecture™ (Step 3 signals).
 *
 * Pure derivations of the behavioral signals the proactive coach needs but the
 * engine snapshot does not carry. No new data architecture (spec §64) — these
 * read already-recorded history only.
 *
 * Score-Protection: read-only, mutates nothing, never touches score.
 */
import type { HistoryEntry } from '../../types';
import { localDayKey } from '../voiceCheckIn';

/**
 * Whether the user has logged any real hydration intake today — the signal that
 * suppresses the urgent proactive nag (§64: never nag once the person has
 * acted). "Real" excludes the synthetic baseline entry and any zero-unit row;
 * "today" is the local calendar day of `now`.
 */
export function intakeLoggedToday(history: readonly HistoryEntry[], now: Date): boolean {
  const today = localDayKey(now);
  return history.some(
    (e) => !e.isSynthetic && e.unitsTaken > 0 && localDayKey(e.timestamp) === today,
  );
}
