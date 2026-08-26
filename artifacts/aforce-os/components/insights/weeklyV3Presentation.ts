/**
 * weeklyV3Presentation — pure view-model for the flag-gated Week in Review V3
 * (`weekly_v3_dashboard_enabled`, founder comps 2026-08-11). Deterministic:
 * callers pass `nowISO` and every input; no store reads, no I/O, no Date.now.
 *
 * HONEST-DATA CONTRACT (recon wf_a974ae77-1ca):
 *  - Performance Age movement is computed from the REAL per-day snapshots the
 *    Command-Event Ledger already persists (`ledgerToPerformanceAgeSnapshots`
 *    → `computePerformanceAgeTrend`) — the series today's weekly surfaces
 *    ignore. When the trend is not `available`, the card carries no movement.
 *  - Recovery trend has NO persisted series in the app → the tile renders the
 *    report's own 'collecting' posture, never a number.
 *  - Top command has NO command-usage metadata → the banner renders the
 *    report's 'awaiting' posture, never a fabricated command.
 *  - Weekly wins = real 'win' analytics events inside the completed week.
 *  - Hydration days / days tracked / timeline come from the server's real
 *    per-day JournalRollups; absent rollups → those pieces render nothing.
 */

import type { JournalRollup } from '@/types';
import type { AnalyticsEvent } from '@/utils/analytics/metrics';
import type {
  PerformanceAgeDailySnapshot,
  PerformanceAgeResult,
  PerformanceAgeTrend,
} from '@/utils/performanceAge';
import { computePerformanceAgeTrend, WEEKLY_TREND_DAYS } from '@/utils/performanceAge';
import {
  buildWeeklyReport,
  lastCompletedWeek,
  type WeeklyReport,
  type WeekWindow,
} from '@/utils/weeklyReport';
import { accentForScore } from '@/components/hydration/signalV3Presentation';

export interface WeeklyV3Inputs {
  nowISO: string;
  analyticsEvents: AnalyticsEvent[];
  rollups: JournalRollup[];
  paSnapshots: PerformanceAgeDailySnapshot[];
  paResult: PerformanceAgeResult | null;
}

export interface WeeklyV3PerformanceAgeView {
  /** Live current age (may be provisional); null → the card is omitted. */
  currentAge: number | null;
  provisional: boolean;
  trend: PerformanceAgeTrend;
  /** currentAge − deltaYears when the trend is available (the "47" in 47→44). */
  previousAge: number | null;
  /** Chronological ≤7-day snapshot series for the card's bars. */
  bars: { dayIndex: number; age: number }[];
}

export interface WeeklyV3TimelineDay {
  date: string;
  weekday: number; // 0=Sun…6=Sat
  score: number;
  accent: string;
}

export interface WeeklyV3Model {
  week: WeekWindow;
  report: WeeklyReport;
  performanceAge: WeeklyV3PerformanceAgeView;
  /** Real 'win' events inside the completed report week. */
  weeklyWins: number;
  /** Rollup days with any logged intake (endUnitsConsumed > 0). */
  hydrationDays: number;
  /** Rollup days present at all in the window. */
  daysTracked: number;
  timeline: WeeklyV3TimelineDay[];
}

function isoWeekdayUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export function buildWeeklyV3Model(input: WeeklyV3Inputs): WeeklyV3Model {
  const week = lastCompletedWeek(input.nowISO);
  const report = buildWeeklyReport({
    nowISO: input.nowISO,
    weekStartISO: week.weekStartISO,
    weekEndISO: week.weekEndISO,
    priorWeekStartISO: week.priorWeekStartISO,
    priorWeekEndISO: week.priorWeekEndISO,
    analyticsEvents: input.analyticsEvents,
    current: { performanceAge: input.paResult },
    // The one wiring fix this screen exists to make: hand the builder the
    // ledger's REAL daily Performance Age series so movement can be honest.
    history: { performanceAgeSnapshots: input.paSnapshots },
  });

  const trend = computePerformanceAgeTrend(input.paSnapshots, WEEKLY_TREND_DAYS);
  const currentAge = input.paResult?.performanceAge ?? null;
  const previousAge =
    trend.available && trend.deltaYears != null && currentAge != null
      ? currentAge - trend.deltaYears
      : null;
  const bars = [...input.paSnapshots]
    .filter((s) => Number.isFinite(s.performanceAge))
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .slice(-7)
    .map((s) => ({ dayIndex: s.dayIndex, age: s.performanceAge }));

  const weekStartMs = Date.parse(week.weekStartISO);
  const weekEndMs = Date.parse(week.weekEndISO);
  const weeklyWins = input.analyticsEvents.filter((e) => {
    if (e.type !== 'win') return false;
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= weekStartMs && t <= weekEndMs;
  }).length;

  const sortedRollups = [...input.rollups].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-7);
  const timeline: WeeklyV3TimelineDay[] = sortedRollups.map((r) => ({
    date: r.date,
    weekday: isoWeekdayUTC(r.date),
    score: Math.round(r.avgScore),
    accent: accentForScore(Math.round(r.avgScore)),
  }));

  return {
    week,
    report,
    performanceAge: {
      currentAge,
      provisional: input.paResult?.provisional ?? false,
      trend,
      previousAge,
      bars,
    },
    weeklyWins,
    hydrationDays: input.rollups.filter((r) => r.endUnitsConsumed > 0).length,
    daysTracked: input.rollups.length,
    timeline,
  };
}

// ─── Performance Age bar geometry (presentation only) ─────────────────────

/**
 * Smallest domain, in years, the Performance Age bars may be drawn over.
 *
 * `computePerformanceAge` rounds to a whole year, so ONE year is the smallest
 * movement the engine can express — and ranging the bars to the series' own
 * min/max drew that one-year step as the full height of the chart. Under a
 * health-adjacent number that read as a dramatic swing when almost nothing had
 * happened: the picture claimed more certainty than the data carried.
 *
 * Ten years is roughly the span a Performance Age can plausibly travel over a
 * life of behaviour change, so it is the scale a member should read a single
 * week against. At this domain a one-year week occupies ~10% of the sweep and
 * only a genuinely large move fills the chart. It is a deliberate literal, not
 * a reference to an engine bound, so the chart's look can never drift as a
 * side effect of a scoring change.
 */
export const PA_BAR_MIN_DOMAIN_YEARS = 10;

/** Height of the shortest (oldest) bar, so a bar is never a hairline. */
const PA_BAR_FLOOR = 0.25;

export interface PerformanceAgeBarAxis {
  /** Youngest age the rendered axis covers — the top of the sweep. */
  minAge: number;
  /** Oldest age the rendered axis covers — the bottom of the sweep. */
  maxAge: number;
  /** Height fraction (PA_BAR_FLOOR…1) per bar, in the order given. */
  fractions: number[];
}

/**
 * Bar heights over an EXPLICIT axis rather than the series' own extremes.
 *
 * The series is padded out symmetrically, in whole years, until it fills at
 * least `PA_BAR_MIN_DOMAIN_YEARS` — so the axis is exact enough to quote in a
 * caption, and a flat week sits mid-track instead of pinned to the floor. A
 * series that genuinely spans the minimum domain or more is left alone and
 * still uses the full sweep: this dampens noise, it does not flatten real
 * movement.
 *
 * Returns null for an empty series (the card renders its collecting posture).
 */
export function performanceAgeBarAxis(
  bars: readonly { age: number }[],
): PerformanceAgeBarAxis | null {
  if (bars.length === 0) return null;
  const ages = bars.map((b) => b.age);
  const lo = Math.min(...ages);
  const hi = Math.max(...ages);
  const pad = Math.ceil(Math.max(0, PA_BAR_MIN_DOMAIN_YEARS - (hi - lo)) / 2);
  const minAge = lo - pad;
  const maxAge = hi + pad;
  // span ≥ PA_BAR_MIN_DOMAIN_YEARS by construction, so it can never be 0.
  const span = maxAge - minAge;
  return {
    minAge,
    maxAge,
    // Younger = taller: invert the age within the rendered domain.
    fractions: ages.map(
      (age) => PA_BAR_FLOOR + (1 - PA_BAR_FLOOR) * ((maxAge - age) / span),
    ),
  };
}
