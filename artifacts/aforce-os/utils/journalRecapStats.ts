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
