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
import { isMixedModelDay, spansModelBoundary } from '@/utils/scoring/modelBoundary';
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
import { hasHydroStateObservation, observedCount, observedRows } from '@/utils/scoring/boundarySeries';

export interface WeeklyV3Inputs {
  nowISO: string;
  analyticsEvents: AnalyticsEvent[];
  rollups: JournalRollup[];
  paSnapshots: PerformanceAgeDailySnapshot[];
  paResult: PerformanceAgeResult | null;
  /** Engine canonical streak (S2-15) — see WeeklyReportInput.current. */
  complianceStreak?: number | null;
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
  /**
   * NULL when HydroState did not observe this day.
   *
   * The rollups wire is DENSE — one row per calendar day of the member's
   * eligible window — so a day with no observation is PRESENT and carries the
   * server's sentinel `avgScore: 0`. Typing this `number` and filling it from
   * that sentinel would paint an unobserved day as a real DEPLETED zero: a
   * full-height Signal-Red bar on a day the member was simply never measured.
   * The null is what makes the renderer's "no reading" branch reachable.
   */
  score: number | null;
  /** NULL alongside a null score — an unmeasured day has no band to tint. */
  accent: string | null;
}

export interface WeeklyV3ModelBoundary {
  /** Any day in the window whose own rollup mixes versions. */
  containsMixedDay: boolean;
  /** The window as a whole spans more than one model version. */
  crossesBoundary: boolean;
  /** Distinct versions present, in the order first seen. */
  versions: (string | null)[];
  /**
   * True when a week-over-week comparison would compare across the boundary,
   * and has therefore been suppressed. Consumers must not compute their own
   * delta when this is set.
   */
  weekOverWeekSuppressed: boolean;
}

export interface WeeklyV3Model {
  week: WeekWindow;
  report: WeeklyReport;
  performanceAge: WeeklyV3PerformanceAgeView;
  /** Real 'win' events inside the completed report week. */
  weeklyWins: number;
  /** Rollup days with any logged intake (endUnitsConsumed > 0). */
  hydrationDays: number;
  /**
   * Days HydroState actually OBSERVED — never `rollups.length`.
   *
   * The wire is dense, so `rollups.length` is the width of the eligible
   * window, not a count of measurements. Reading it as "days tracked" told a
   * member with a silent week they had 7 tracked days and lit all seven
   * progress dots.
   */
  daysTracked: number;
  timeline: WeeklyV3TimelineDay[];
  /**
   * Model-boundary state for this window. A week that crosses a recalibration
   * cannot be compared with the week before it, and a day inside it that mixes
   * versions is not a like-for-like day.
   */
  modelBoundary: WeeklyV3ModelBoundary;
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
    current: { performanceAge: input.paResult, complianceStreak: input.complianceStreak ?? null },
    // The one wiring fix this screen exists to make: hand the builder the
    // ledger's REAL daily Performance Age series so movement can be honest.
    history: { performanceAgeSnapshots: input.paSnapshots },
  });

  // ── model boundary ───────────────────────────────────────────────────────
  // A week-over-week delta whose two sides were produced by different models
  // reports a recalibration as if the member had changed. Detect it from the
  // rollups' own version stamps and suppress the comparison rather than
  // rendering a number that means nothing.
  // OBSERVED days only. An unobserved day carries `modelVersions: []` because
  // nothing was measured to stamp — not because its provenance is unknown. On
  // the dense wire those days are always present, so including them here would
  // let a silent stretch masquerade as version evidence and suppress a
  // perfectly valid week-over-week comparison. A day with no observation has
  // no provenance to contribute.
  const dayVersionLists = observedRows(input.rollups).map((r) => r.modelVersions ?? []);
  const allVersions: (string | null)[] = [];
  for (const list of dayVersionLists) {
    for (const v of list) if (!allVersions.includes(v)) allVersions.push(v);
  }
  // `containsMixedDay` was previously OR-ed into the suppression decision and is
  // now REPORTING ONLY. The earlier justification here claimed the term was
  // "provably redundant" because a mixed day always forces `spansModelBoundary`
  // true. THAT PROOF WAS WRONG, and the corrected reasoning matters more than
  // the conclusion:
  //
  //   `allVersions` is DEDUPED before the boundary question is asked, while
  //   `isMixedModelDay` is not. So `[null, null]` and `['x', 'x']` are "mixed"
  //   by the day predicate yet collapse to a single entry in `allVersions` —
  //   two fixtures that DO isolate the term. The redundancy is not a theorem.
  //
  // The conclusion still holds, but for a narrower reason: the only producer of
  // this field accumulates into a `Set<string | null>` and emits `[...set]`
  // (api-server/src/routes/aforce/journal.ts), so a duplicate-bearing list
  // cannot reach us. The term is redundant UNDER THAT INVARIANT, not in general.
  // If the server ever emits a non-deduped list, restore the OR.
  const containsMixedDay = dayVersionLists.some((l) => isMixedModelDay(l));
  const crossesBoundary = spansModelBoundary(allVersions);
  const weekOverWeekSuppressed = crossesBoundary;
  const modelBoundary: WeeklyV3ModelBoundary = {
    containsMixedDay, crossesBoundary, versions: allVersions, weekOverWeekSuppressed,
  };

  // SUPPRESS AT THE SOURCE. The previous fix gated only `previousAge`, and the
  // trend object itself was returned intact — so both live consumers
  // (`WeeklyReportV3.tsx` and `EditorialWeeklyScreen.tsx`, each doing
  // `trend.available ? trend.deltaYears : null`) still rendered a "▼ 3 years"
  // pill on a boundary-crossing week. The member was told their Performance Age
  // improved by three years when only the model had changed. Gating the trend
  // here means every consumer of `trend` inherits the suppression without edits,
  // including consumers that do not exist yet. (See the `report` debt above for
  // the one path this does NOT cover.)
  // KNOWN DEBT (audited 2026-09-01, deliberately NOT fixed here): `report` is
  // built by `buildWeeklyReport` above, BEFORE the boundary is known, and its
  // `performanceAge` section still carries a raw `deltaYears` plus
  // `performance_age_younger` findings. It is LATENT — an exhaustive search
  // found no consumer reading it: `WeeklyReportV3` and `EditorialWeeklyScreen`
  // request only habitVelocity / recovery / topCommand / nextWeekFocus. Gating
  // it would mean changing shared `buildWeeklyReport` output that other
  // surfaces also consume, which is out of scope for this remediation. The
  // guarantee below is therefore precise: every consumer of `trend` inherits
  // the suppression. A future consumer of `report.performanceAge` would not.
  const rawTrend = computePerformanceAgeTrend(input.paSnapshots, WEEKLY_TREND_DAYS);
  const trend: PerformanceAgeTrend = weekOverWeekSuppressed
    ? { available: false, deltaYears: null, direction: null,
        daysOfHistory: rawTrend.daysOfHistory }
    : rawTrend;
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

  // Every calendar day in the window still gets a COLUMN — the timeline is a
  // calendar, and dropping unobserved days would silently reshape the week.
  // But only an OBSERVED day gets a score and a band tint; an unobserved day
  // carries nulls so the renderer shows it as unmeasured rather than as a
  // measured zero.
  const sortedRollups = [...input.rollups].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-7);
  const timeline: WeeklyV3TimelineDay[] = sortedRollups.map((r) => {
    if (!hasHydroStateObservation(r)) {
      return { date: r.date, weekday: isoWeekdayUTC(r.date), score: null, accent: null };
    }
    const score = Math.round(r.avgScore);
    return { date: r.date, weekday: isoWeekdayUTC(r.date), score, accent: accentForScore(score) };
  });

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
    // The observation gate its two siblings gained in this same change
    // (CircleScreenV3, homeBaselineState). `endUnitsConsumed > 0` implies a
    // snapshot only by an invariant of the server aggregation two packages
    // away; stating it here means a wire change cannot silently turn
    // synthetic days into hydration days.
    hydrationDays: input.rollups.filter(
      (r) => hasHydroStateObservation(r) && r.endUnitsConsumed > 0,
    ).length,
    daysTracked: observedCount(input.rollups),
    timeline,
    modelBoundary,
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
