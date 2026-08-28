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

/** Honest-data glyph for a reading nobody took (Home/Protocol convention). */
export const EM_DASH = '—';
import { resolveHomePresentation } from '@/components/home/homePresentation';
import {
  PARTIAL_MIN_RATIO,
  RICH_MIN_RATIO,
  type ProfileCompletenessLevel,
} from '@/utils/profile/profileCompleteness';

/** Shipped day-card thresholds (JournalDayCard.avgColor), as a band. */
export function bandForScore(avgScore: number): PerformanceLevel {
  if (avgScore >= 85) return 'PEAK';
  if (avgScore >= 65) return 'BALANCED';
  if (avgScore >= 40) return 'RECOVERING';
  return 'DEPLETED';
}

/** Band accent for FILLS/strokes — same af.* accent module as the Home arc /
 *  Protocol ring. */
export function accentForScore(avgScore: number): string {
  return resolveHomePresentation(bandForScore(avgScore)).accent;
}

/**
 * Band accent for anything drawn as TEXT.
 *
 * The two largest numerals on this screen — the week average and each day's
 * score — took `accentForScore`, so a DEPLETED week rendered them in Signal Red
 * (`af.red`), which measures ~3.1:1 on the dark canvas and fails WCAG AA. The
 * text-safe twin is the one homePresentation already resolves for exactly this
 * (`accentText`, the same fix Home's arc took in Wave 5); the other three bands
 * are their own text variant, so only DEPLETED changes. Bars, the day's accent
 * rail and any dot keep `accentForScore` — a fill has no contrast floor.
 */
export function accentTextForScore(avgScore: number): string {
  return resolveHomePresentation(bandForScore(avgScore)).accentText;
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

/**
 * How much of the requested window actually has data, expressed in the EXISTING
 * §55 completeness vocabulary so the screen can wear the shipped
 * `completenessChip` / `ConfidenceChip` instead of a bespoke confidence widget.
 *
 * No new metric and no new thresholds: the cuts are §55's own RICH_MIN_RATIO /
 * PARTIAL_MIN_RATIO, applied to days-with-a-rollup instead of profile fields
 * (rollups omit days with no data, so `daysTracked` IS the coverage fact). This
 * reports COVERAGE — how much evidence is behind the average — and never grades
 * the score itself.
 */
export function historyCompletenessLevel(
  daysTracked: number,
  windowDays: number,
): ProfileCompletenessLevel {
  const ratio = windowDays > 0 ? Math.max(0, daysTracked) / windowDays : 0;
  if (ratio >= RICH_MIN_RATIO) return 'rich';
  if (ratio >= PARTIAL_MIN_RATIO) return 'partial';
  return 'sparse';
}

/**
 * Ounces actually logged across the window. `computeRecapStats.totalOunces` is
 * the LAST rollup's `endOzConsumed` — ONE day's end-of-day total. That is right
 * for the share card's single-day framing, but under a "Last 7 days" heading it
 * read as a weekly sum, i.e. a single measurement wearing a week's authority.
 * Summing the per-day values is what `services/performanceTimeline` already
 * does for the same window.
 */
export function weeklyTotalOz(days: readonly SignalDayView[]): number {
  return days.reduce((sum, d) => sum + d.oz, 0);
}

/**
 * Engine checks behind the whole window. Every averaged number on this screen
 * is interpolated across these, so the count is the honest basis to state next
 * to them.
 */
export function weeklyChecks(days: readonly SignalDayView[]): number {
  return days.reduce((sum, d) => sum + d.checks, 0);
}

/** Whole-% average of the days' in-band time (0 when no days). */
export function weeklyInBandAvg(days: readonly SignalDayView[]): number {
  if (days.length === 0) return 0;
  return Math.round(days.reduce((sum, d) => sum + d.inBandPct, 0) / days.length);
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
