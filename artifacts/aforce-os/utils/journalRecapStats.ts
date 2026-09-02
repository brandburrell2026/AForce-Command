/**
 * Pure-math helpers for the journal-recap share card.
 *
 * Lives outside the React component so it can be unit-tested without
 * the RN renderer and reused elsewhere if we ever surface the same
 * "best streak" / "peak" numbers in a non-share context (e.g. an
 * end-of-week summary email).
 */

import type { JournalRollup } from '../types';

export interface RecapStats {
  /** Mean of avgScore across the rollup window (rounded). */
  avgScore: number;
  /** Highest avgScore observed in the window. */
  peakScore: number;
  /** Count of rollup days actually present (not the calendar window). */
  daysTracked: number;
  /** Longest run of consecutive *calendar* days at avgScore >= BALANCED. */
  bestStreak: number;
  /** End-of-window cumulative ounces consumed (rounded). */
  totalOunces: number;
  /** End-of-window AForce sticks consumed. */
  totalSticks: number;
}

export const BALANCED_THRESHOLD = 70;

export function computeRecapStats(rollups: readonly JournalRollup[]): RecapStats {
  if (rollups.length === 0) {
    return {
      avgScore: 0,
      peakScore: 0,
      daysTracked: 0,
      bestStreak: 0,
      totalOunces: 0,
      totalSticks: 0,
    };
  }
  const avgScore = Math.round(
    rollups.reduce((acc, r) => acc + r.avgScore, 0) / rollups.length,
  );
  const peakScore = Math.max(...rollups.map((r) => r.avgScore));
  const daysTracked = rollups.length;

  // Longest consecutive-calendar-days streak at >= threshold. Walks
  // chronologically and breaks the run on either a sub-threshold day
  // or a calendar gap (rollups omit days with no data).
  let bestStreak = 0;
  let current = 0;
  let prev: Date | null = null;
  for (const r of rollups) {
    const d = parseDateUTC(r.date);
    if (!d) {
      current = 0;
      prev = null;
      continue;
    }
    if (r.avgScore < BALANCED_THRESHOLD) {
      current = 0;
      prev = d;
      continue;
    }
    if (prev && diffInDaysUTC(d, prev) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > bestStreak) bestStreak = current;
    prev = d;
  }

  const last = rollups[rollups.length - 1];
  return {
    avgScore,
    peakScore,
    daysTracked,
    bestStreak,
    totalOunces: Math.round(last.endOzConsumed),
    totalSticks: last.endAforceUnits,
  };
}

function parseDateUTC(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

function diffInDaysUTC(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

/**
 * What the share card may honestly display.
 *
 * Deliberately a DIFFERENT shape from `RecapStats`: three of its fields can be
 * unavailable, and the type says so rather than letting a component decide.
 *
 *   SCORE-DERIVED (`avgScore`, `peakScore`) — computed only over rows whose
 *   model version is comparable, so a headline never blends two different
 *   measurements. `comparableDays` reports how many rows that was, because a
 *   smaller scoring population may not be silent.
 *
 *   `bestStreak` — NULL whenever the range spans incomparable model semantics.
 *   The metric is a run of days above a HydroState threshold, and that
 *   threshold's meaning changed at v1.0. Narrowing it collapsed a genuine
 *   30-day narrative to "STREAK 1" on rollout day; keeping it whole would count
 *   a v0 crossing and a v1 crossing as the same event. Neither is true, so the
 *   card says nothing instead.
 *
 *   ACTIVITY TOTALS (`totalOunces`, `totalSticks`) — currently ALWAYS null.
 *   See `activityTotalsUnavailable` below.
 */
export interface RecapCardStats {
  avgScore: number;
  peakScore: number;
  /** Days contributing to the score figures; may be fewer than the range. */
  comparableDays: number;
  /** Days in the whole reporting range — the number the label describes. */
  daysTracked: number;
  /** NULL when the range spans incomparable model semantics. */
  bestStreak: number | null;
  /** NULL until authoritative per-day intake totals exist server-side. */
  totalOunces: number | null;
  /** NULL until authoritative per-day intake totals exist server-side. */
  totalSticks: number | null;
}

/**
 * WHY ACTIVITY TOTALS ARE SUPPRESSED (founder ruling, 2026-09-01).
 *
 * `endOzConsumed` / `endAforceUnits` are NOT window cumulatives. Each is
 * `ozConsumedToday` / `aforceUnitsToday` captured at whatever moment the client
 * last POSTed a snapshot that day, and `applyDayRollover` zeroes both every UTC
 * midnight. Three ways to derive a "30-day total" from them, all dishonest:
 *
 *   - read the last row  -> ONE day's figure under a 30-day label
 *   - sum the rows       -> a LOWER BOUND: every ounce logged after a day's
 *                           final sync is dropped, and a day with intakes but
 *                           no snapshot contributes zero
 *   - read the last row after narrowing -> a stale older day's figure
 *
 * The 30-day card must not present a number it cannot support, so it presents
 * none. The authoritative source is `aforceIntakeLogs.ozAmount`, already
 * queried by the rollups route and currently discarded; surfacing it is a
 * separate, bounded api-server change. When it lands, these two fields become
 * real sums over the full reporting range and this constant goes away.
 */
export const ACTIVITY_TOTALS_UNAVAILABLE = null;

export function computeRecapCardStats(
  fullRange: readonly JournalRollup[],
  scorePopulation: readonly JournalRollup[],
  opts: { streakComparable: boolean },
): RecapCardStats {
  const whole = computeRecapStats(fullRange);
  const scored = computeRecapStats(scorePopulation);
  return {
    avgScore: scored.avgScore,
    peakScore: scored.peakScore,
    comparableDays: scorePopulation.length,
    daysTracked: whole.daysTracked,
    bestStreak: opts.streakComparable ? scored.bestStreak : null,
    totalOunces: ACTIVITY_TOTALS_UNAVAILABLE,
    totalSticks: ACTIVITY_TOTALS_UNAVAILABLE,
  };
}
