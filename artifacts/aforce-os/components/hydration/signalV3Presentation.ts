/**
 * signalV3Presentation — pure presentation decisions for the flag-gated
 * Performance Signal screen (`signal_v3_dashboard_enabled`, founder comps
 * 2026-08-11). Honest-data contract as Home/Protocol V3: everything renders
 * from the server's real per-day `JournalRollup`s; nothing here reads the
 * store or the clock (callers pass dates), and no chip is emitted for a
 * metric the rollup does not carry.
 *
 * Band mapping: the SHIPPED day-card thresholds (components/journal/
 * JournalDayCard avgColor: ≥85 / ≥65 / ≥40) mapped to PerformanceLevel, then
 * tinted via the same homePresentation accents Home and Protocol use — the
 * founder's "lights match across screens" ruling (PR #707) generalized.
 */

import type { JournalRollup, PerformanceLevel } from '@/types';
import { resolveHomePresentation } from '@/components/home/homePresentation';

/** Shipped day-card thresholds (JournalDayCard.avgColor), as a band. */
export function bandForScore(avgScore: number): PerformanceLevel {
  if (avgScore >= 85) return 'PEAK';
  if (avgScore >= 65) return 'BALANCED';
  if (avgScore >= 40) return 'RECOVERING';
  return 'DEPLETED';
}

/** Band accent — same af.* accent module as the Home arc / Protocol ring. */
export function accentForScore(avgScore: number): string {
  return resolveHomePresentation(bandForScore(avgScore)).accent;
}

/** i18n key suffix for the band pill (component translates). */
export function bandKeyForScore(avgScore: number): 'peak' | 'balanced' | 'recovering' | 'depleted' {
  return bandForScore(avgScore).toLowerCase() as
    | 'peak'
    | 'balanced'
    | 'recovering'
    | 'depleted';
}

export interface SignalDayView {
  date: string;
  /** 'today' | 'yesterday' | weekday index 0-6 (component maps to copy). */
  dayLabel: { kind: 'today' } | { kind: 'yesterday' } | { kind: 'weekday'; weekday: number };
  /** "Aug 7" style short date pieces left to the component's locale formatter. */
  score: number;
  bandKey: 'peak' | 'balanced' | 'recovering' | 'depleted';
  accent: string;
  oz: number;
  /** Whole-% of the day spent Peak+Balanced — the rollup's own band clock. */
  inBandPct: number;
  /** Engine snapshots recorded that day (honest label: checks, not commands). */
  checks: number;
}

/**
 * Rollups → newest-first day rows. `todayIso` is the caller's YYYY-MM-DD (the
 * component passes its own clock; keeps this module deterministic).
 */
export function buildDayViews(rollups: readonly JournalRollup[], todayIso: string): SignalDayView[] {
  const sorted = [...rollups].sort((a, b) => (a.date < b.date ? 1 : -1));
  const yesterdayIso = shiftIsoDay(todayIso, -1);
  return sorted.map((r) => {
    const score = Math.round(r.avgScore);
    return {
      date: r.date,
      dayLabel:
        r.date === todayIso
          ? { kind: 'today' }
          : r.date === yesterdayIso
            ? { kind: 'yesterday' }
            : { kind: 'weekday', weekday: isoWeekday(r.date) },
      score,
      bandKey: bandKeyForScore(score),
      accent: accentForScore(score),
      oz: Math.max(0, Math.round(r.endOzConsumed)),
      inBandPct: Math.max(
        0,
        Math.min(100, Math.round(r.pctTimePeak + r.pctTimeBalanced)),
      ),
      checks: Math.max(0, r.snapshotsCount | 0),
    };
  });
}

/** Chart bars, oldest-first (the comp reads left→right in time order). */
export function buildBars(days: readonly SignalDayView[]): { height: number; accent: string; date: string }[] {
  return [...days]
    .reverse()
    .map((d) => ({ height: Math.max(0.08, Math.min(1, d.score / 100)), accent: d.accent, date: d.date }));
}

/** YYYY-MM-DD ± n days, calendar-safe (UTC arithmetic on the date parts). */
export function shiftIsoDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y!, (m! - 1), d! + delta);
  const dt = new Date(t);
  const mm = `${dt.getUTCMonth() + 1}`.padStart(2, '0');
  const dd = `${dt.getUTCDate()}`.padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** 0 = Sunday … 6 = Saturday, from the ISO date's calendar day (UTC). */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}
