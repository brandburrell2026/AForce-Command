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
