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
 * Recap statistics with the two populations kept SEPARATE.
 *
 * A recap mixes two different kinds of number and they do not share a
 * population:
 *
 *   SCORE-DERIVED — `avgScore`, `peakScore`, and `bestStreak` (a run of days at
 *   or above a HydroState threshold, so it depends on the score too). These may
 *   only be computed over rows whose model version is comparable, or the
 *   headline blends two different measurements.
 *
 *   ACTIVITY TOTALS — `daysTracked`, `totalOunces`, `totalSticks`. These are not
 *   HydroState measurements at all. A recalibration of the scoring model says
 *   nothing about how many days a member showed up or how many ounces they
 *   drank, so narrowing them discards true participation for no reason.
 *
 * Collapsing both onto one narrowed population is what made a 30-day card read
 * "DAYS 1" on the first day of the v1.0 rollout: 29 unstamped days plus one
 * stamped day left a single comparable row, and every tile inherited it.
 */
export function computeRecapStatsSplit(
  fullRange: readonly JournalRollup[],
  scorePopulation: readonly JournalRollup[],
): RecapStats {
  const whole = computeRecapStats(fullRange);
  const scored = computeRecapStats(scorePopulation);
  return {
    // score-derived → comparable rows only
    avgScore: scored.avgScore,
    peakScore: scored.peakScore,
    bestStreak: scored.bestStreak,
    // activity totals → the whole reporting range, so the label stays true.
    // `totalOunces`/`totalSticks` read the END-OF-WINDOW cumulative row, so
    // narrowing the array would silently report a stale older row's totals.
    daysTracked: whole.daysTracked,
    totalOunces: whole.totalOunces,
    totalSticks: whole.totalSticks,
  };
}
