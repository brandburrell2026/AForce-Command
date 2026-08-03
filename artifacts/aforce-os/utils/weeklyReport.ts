/**
 * WEEKLY PERFORMANCE REPORT™ — pure derivation layer.
 *
 * Builds the once-a-week shareable report model from signals the engine and
 * analytics layer already produce. Like every AForce read-only projection it:
 *   • imports NOTHING from services, stores, React, or I/O;
 *   • takes `nowISO` + explicit week boundaries from the caller, so it is
 *     fully deterministic and unit-testable (no Date.now, no storage);
 *   • NEVER fabricates a trend. Any section without a real basis returns an
 *     explicit `collecting` (a data source exists but there is not enough
 *     history yet) or `awaiting` (no instrumentation exists yet) status —
 *     never an invented number (Score-Protection).
 *
 * Display copy is intentionally NOT in this module: each section carries a
 * status, a locale-neutral headline `value` (digits / signed ints) and
 * interpolation `params` / coded `findings` that the screen renders through
 * i18n (en/es/fr/de/pt/it + hidden resource-only locales). The Water-First
 * lead for "Next week focus" is expressed as a focus *code*; the actual
 * "Start with water…" wording lives in the locale resources.
 */

import {
  computeAnalyticsMetrics,
  type AnalyticsEvent,
} from './analytics/metrics';
import {
  computePerformanceAgeTrend,
  WEEKLY_TREND_DAYS,
  type PerformanceAgeDailySnapshot,
  type PerformanceAgeResult,
} from './performanceAge';
// TYPE-ONLY import (erased at compile time — zero runtime dependency, so the
// "imports nothing from services" purity guarantee above still holds for the
// actual bundle). W3.4: `health` is a pass-through field only — this module
// never computes an aggregate itself, never reads a clock/store to build
// one, and never renders it. The caller (screen) builds the aggregate via
// `services/health/weeklyHealthAggregates.ts` behind `health_canonical_
// consumers` and hands it in; when omitted, `report.health` is `null` and
// every existing section/behavior is unchanged (Score-Protection: read-only
// signal passthrough, never a score).
import type { WeeklyHealthAggregates } from '../services/health/weeklyHealthAggregates';

const MS_PER_DAY = 86_400_000;

// ─── Public types ─────────────────────────────────────────────────────

export type WeeklyReportStatus =
  | 'improved' // real data, positive movement / win
  | 'attention' // real data, needs attention
  | 'steady' // real data, holding steady (neutral — never claims a win)
  | 'collecting' // data source exists, not enough history yet
  | 'awaiting'; // no instrumentation for this signal yet

export type WeeklyReportSectionKey =
  | 'improved'
  | 'attention'
  | 'performanceAge'
  | 'habitVelocity'
  | 'recovery'
  | 'topCommand'
  | 'nextWeekFocus';

export interface WeeklyReportFinding {
  /** Stable code the screen maps to a localized one-liner. */
  code: string;
  params: Record<string, string | number>;
}

export interface WeeklyReportSection {
  key: WeeklyReportSectionKey;
  status: WeeklyReportStatus;
  /** Locale-neutral headline (digits / signed int / label), or null. */
  value: string | null;
  /** Interpolation params the screen feeds into i18n copy. */
  params: Record<string, string | number>;
  /** Coded evidence lines for the narrative sections (improved/attention). */
  findings?: WeeklyReportFinding[];
}

export interface DailyValueSnapshot {
  /** UTC day index: Math.floor(epochMs / 86_400_000) — timezone-free. */
  dayIndex: number;
  value: number;
}

export interface WeeklyCommandUsage {
  commandId: string;
  label: string;
  count: number;
}

export interface WeeklyReportInput {
  /** Deterministic "now" anchor (ISO 8601). Echoed as generatedAtISO. */
  nowISO: string;
  /** Inclusive ISO timestamp of the report week's Sunday 00:00. */
  weekStartISO: string;
  /** Inclusive ISO timestamp of the report week's Saturday 23:59:59.999. */
  weekEndISO: string;
  /** Full analytics event log — windowed to the report week internally. */
  analyticsEvents: AnalyticsEvent[];
  /** Optional prior-week window enabling week-over-week habit comparison. */
  priorWeekStartISO?: string;
  priorWeekEndISO?: string;
  /** Current snapshot values computed live elsewhere (reference only). */
  current?: {
    performanceAge?: PerformanceAgeResult | null;
    recoveryScore?: number | null;
    readinessScore?: number | null;
  };
  /** Persisted daily history (empty until snapshot persistence ships). */
  history?: {
    performanceAgeSnapshots?: PerformanceAgeDailySnapshot[];
    recoverySnapshots?: DailyValueSnapshot[];
  };
  /** This-week command usage (empty until command metadata is logged). */
  commandUsage?: WeeklyCommandUsage[];
  /**
   * Canonical weekly health aggregates (ADDITIVE, W3.4). `undefined`/omitted
   * ⇒ `WeeklyReport.health` is `null` and nothing else changes — no existing
   * section reads this field. Gated by the caller behind
   * `health_canonical_consumers`; see file header.
   */
  health?: WeeklyHealthAggregates | null;
}

export interface WeeklyReport {
  weekStartISO: string;
  weekEndISO: string;
  generatedAtISO: string;
  sections: WeeklyReportSection[];
  /** Pass-through of `WeeklyReportInput.health` — `null` when not supplied. Additive, W3.4; see that field's doc. */
  health: WeeklyHealthAggregates | null;
}

export interface WeekWindow {
  weekStartISO: string;
  weekEndISO: string;
  priorWeekStartISO: string;
  priorWeekEndISO: string;
}

// ─── Week boundaries (pure; no Date.now) ──────────────────────────────

/**
 * Resolve the most recently *completed* Sunday–Saturday week relative to
 * `nowISO`. Delivered on a Sunday this returns the week that just ended;
 * opened mid-week (internal preview) it still returns the last full week,
 * never a partial week-to-date. UTC throughout to match the analytics
 * layer's timezone-free day buckets.
 */
export function lastCompletedWeek(nowISO: string): WeekWindow {
  const nowMs = parseMs(nowISO) ?? 0;
  const epochDay = Math.floor(nowMs / MS_PER_DAY);
  const dayStartMs = epochDay * MS_PER_DAY;
  // 1970-01-01 (epoch day 0) was a Thursday → (epochDay + 4) % 7, 0 = Sun.
  const dow = (((epochDay + 4) % 7) + 7) % 7;
  const thisWeekStartMs = dayStartMs - dow * MS_PER_DAY; // Sunday 00:00 UTC
  const weekEndMs = thisWeekStartMs - 1; // last Saturday 23:59:59.999
  const weekStartMs = thisWeekStartMs - 7 * MS_PER_DAY; // last Sunday 00:00
  const priorWeekEndMs = weekStartMs - 1;
  const priorWeekStartMs = weekStartMs - 7 * MS_PER_DAY;
  return {
    weekStartISO: new Date(weekStartMs).toISOString(),
    weekEndISO: new Date(weekEndMs).toISOString(),
    priorWeekStartISO: new Date(priorWeekStartMs).toISOString(),
    priorWeekEndISO: new Date(priorWeekEndMs).toISOString(),
  };
}

// ─── Builder ──────────────────────────────────────────────────────────

export function buildWeeklyReport(input: WeeklyReportInput): WeeklyReport {
  const weekStartMs = parseMs(input.weekStartISO);
  const weekEndMs = parseMs(input.weekEndISO);
  const weekValid =
    weekStartMs !== null && weekEndMs !== null && weekStartMs <= weekEndMs;
  const weekEvents = weekValid
    ? windowEvents(input.analyticsEvents, weekStartMs as number, weekEndMs as number)
    : [];
  const weekMetrics = computeAnalyticsMetrics(weekEvents);

  const priorStartMs = parseMs(input.priorWeekStartISO);
  const priorEndMs = parseMs(input.priorWeekEndISO);
  const priorValid =
    priorStartMs !== null && priorEndMs !== null && priorStartMs <= priorEndMs;
  const priorMetrics = priorValid
    ? computeAnalyticsMetrics(
        windowEvents(input.analyticsEvents, priorStartMs as number, priorEndMs as number),
      )
    : null;

  // Streak spans week boundaries, so it is read from the full log.
  const fullMetrics = computeAnalyticsMetrics(input.analyticsEvents);

  const activeDays = weekMetrics.retention.activeDays;
  const logCount = weekMetrics.logging.count;
  const streak = fullMetrics.retention.currentDayStreak;
  const priorActiveDays = priorMetrics ? priorMetrics.retention.activeDays : null;
  const activeDaysDelta = priorActiveDays !== null ? activeDays - priorActiveDays : null;
  const noWeekData = activeDays === 0 && logCount === 0;

  // ── Habit Velocity (the one genuinely real weekly signal today) ──────
  let habitStatus: WeeklyReportStatus;
  let habitValue: string | null;
  if (noWeekData) {
    habitStatus = 'collecting';
    habitValue = null;
  } else {
    habitValue = String(activeDays);
    if (activeDaysDelta !== null && activeDaysDelta > 0) habitStatus = 'improved';
    else if (activeDaysDelta !== null && activeDaysDelta < 0) habitStatus = 'attention';
    else habitStatus = 'steady';
  }
  const habitParams: Record<string, string | number> = { activeDays, logCount, streak };
  if (activeDaysDelta !== null) {
    habitParams.deltaActiveDays = activeDaysDelta;
    habitParams.deltaActiveDaysAbs = Math.abs(activeDaysDelta);
  }
  if (priorActiveDays !== null) habitParams.priorActiveDays = priorActiveDays;

  // ── Performance Age movement (collecting until ≥1 week of snapshots) ─
  const paTrend = computePerformanceAgeTrend(
    input.history?.performanceAgeSnapshots ?? [],
    WEEKLY_TREND_DAYS,
  );
  const currentPA = input.current?.performanceAge?.performanceAge ?? null;
  let paStatus: WeeklyReportStatus;
  let paValue: string | null;
  const paParams: Record<string, string | number> = { daysOfHistory: paTrend.daysOfHistory };
  if (paTrend.available && paTrend.deltaYears !== null && paTrend.direction) {
    paParams.deltaYears = paTrend.deltaYears;
    paParams.deltaYearsAbs = Math.abs(paTrend.deltaYears);
    paParams.direction = paTrend.direction;
    if (currentPA !== null) paParams.currentPerformanceAge = currentPA;
    paValue = formatSignedInt(paTrend.deltaYears);
    paStatus =
      paTrend.direction === 'younger'
        ? 'improved'
        : paTrend.direction === 'older'
          ? 'attention'
          : 'steady';
  } else {
    paStatus = 'collecting';
    paValue = currentPA !== null ? String(currentPA) : null;
    if (currentPA !== null) paParams.currentPerformanceAge = currentPA;
  }

  // ── Recovery trend (collecting until ≥1 week of snapshots) ───────────
  const recTrend = valueTrend(input.history?.recoverySnapshots, WEEKLY_TREND_DAYS);
  const currentRec = input.current?.recoveryScore ?? null;
  let recStatus: WeeklyReportStatus;
  let recValue: string | null;
  const recParams: Record<string, string | number> = { daysOfHistory: recTrend.daysOfHistory };
  if (recTrend.available && recTrend.delta !== null) {
    const d = Math.round(recTrend.delta);
    recParams.delta = d;
    recParams.deltaAbs = Math.abs(d);
    recParams.direction = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    if (currentRec !== null) recParams.current = Math.round(currentRec);
    recValue = formatSignedInt(d);
    recStatus = d > 0 ? 'improved' : d < 0 ? 'attention' : 'steady';
  } else {
    recStatus = 'collecting';
    recValue = currentRec !== null ? String(Math.round(currentRec)) : null;
    if (currentRec !== null) recParams.current = Math.round(currentRec);
  }

  // ── Top command this week (awaiting command-usage instrumentation) ───
  const usage = (input.commandUsage ?? []).filter(
    (c) => Number.isFinite(c.count) && c.count > 0,
  );
  let topStatus: WeeklyReportStatus;
  let topValue: string | null;
  const topParams: Record<string, string | number> = {};
  if (usage.length === 0) {
    topStatus = 'awaiting';
    topValue = null;
  } else {
    const top = usage.reduce((a, b) => (b.count > a.count ? b : a));
    topStatus = 'steady';
    topValue = top.label;
    topParams.label = top.label;
    topParams.count = top.count;
    topParams.commandId = top.commandId;
  }

  // ── Narrative roll-ups (real-data findings only) ─────────────────────
  const improvedFindings: WeeklyReportFinding[] = [];
  const attentionFindings: WeeklyReportFinding[] = [];

  // The streak is read from the full log (it spans week boundaries), so it
  // is only a *report-week* win when the report week actually had activity.
  // Without this guard an empty report week could still show "N-day streak"
  // sourced from a later partial week (e.g. opened mid-week in internal
  // preview) — a fabricated improvement (Score-Protection violation).
  if (!noWeekData && streak >= 3) {
    improvedFindings.push({ code: 'streak', params: { streak } });
  }
  if (activeDaysDelta !== null && activeDaysDelta > 0) {
    improvedFindings.push({ code: 'active_days_up', params: { delta: activeDaysDelta, activeDays } });
  } else if (activeDays >= 5) {
    improvedFindings.push({ code: 'active_days_strong', params: { activeDays } });
  }
  if (paStatus === 'improved') {
    improvedFindings.push({
      code: 'performance_age_younger',
      params: { deltaYears: Math.abs(Number(paParams.deltaYears)) },
    });
  }
  if (recStatus === 'improved') {
    improvedFindings.push({ code: 'recovery_up', params: { delta: Math.abs(Number(recParams.delta)) } });
  }

  if (activeDaysDelta !== null && activeDaysDelta < 0) {
    attentionFindings.push({
      code: 'active_days_down',
      params: { delta: Math.abs(activeDaysDelta), activeDays },
    });
  } else if (activeDays <= 1 && !noWeekData) {
    attentionFindings.push({ code: 'low_activity', params: { activeDays } });
  }
  if (paStatus === 'attention') {
    attentionFindings.push({
      code: 'performance_age_older',
      params: { deltaYears: Math.abs(Number(paParams.deltaYears)) },
    });
  }
  if (recStatus === 'attention') {
    attentionFindings.push({ code: 'recovery_down', params: { delta: Math.abs(Number(recParams.delta)) } });
  }

  const improvedStatus: WeeklyReportStatus =
    improvedFindings.length > 0 ? 'improved' : 'collecting';
  const attentionStatus: WeeklyReportStatus =
    attentionFindings.length > 0 ? 'attention' : noWeekData ? 'collecting' : 'steady';

  // ── Next week focus (Water-First; code only — copy lives in locales) ─
  let focus: string;
  if (recStatus === 'attention') focus = 'recovery';
  else if (activeDays <= 2) focus = 'consistency';
  else focus = 'maintain';

  const sections: WeeklyReportSection[] = [
    {
      key: 'improved',
      status: improvedStatus,
      value: null,
      params: { count: improvedFindings.length },
      findings: improvedFindings,
    },
    {
      key: 'attention',
      status: attentionStatus,
      value: null,
      params: { count: attentionFindings.length },
      findings: attentionFindings,
    },
    { key: 'performanceAge', status: paStatus, value: paValue, params: paParams },
    { key: 'habitVelocity', status: habitStatus, value: habitValue, params: habitParams },
    { key: 'recovery', status: recStatus, value: recValue, params: recParams },
    { key: 'topCommand', status: topStatus, value: topValue, params: topParams },
    {
      key: 'nextWeekFocus',
      status: 'steady',
      value: null,
      params: { focus, streak, activeDays },
    },
  ];

  return {
    weekStartISO: input.weekStartISO,
    weekEndISO: input.weekEndISO,
    generatedAtISO: input.nowISO,
    sections,
    health: input.health ?? null,
  };
}

/** Find a section by key (throws if absent — the builder always emits all 7). */
export function getWeeklyReportSection(
  report: WeeklyReport,
  key: WeeklyReportSectionKey,
): WeeklyReportSection {
  const found = report.sections.find((s) => s.key === key);
  if (!found) throw new Error(`weeklyReport: missing section "${key}"`);
  return found;
}

// ─── Internals ────────────────────────────────────────────────────────

function parseMs(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function windowEvents(
  events: AnalyticsEvent[],
  startMs: number,
  endMs: number,
): AnalyticsEvent[] {
  return events.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

function formatSignedInt(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : `${r}`;
}

/**
 * Recovery trend over persisted daily snapshots, mirroring
 * `computePerformanceAgeTrend` semantics exactly: needs ≥2 distinct days
 * AND a baseline at/before `latest − windowDays`. Until that history
 * exists it returns `available: false` so the caller reads "collecting…",
 * never a fabricated trend.
 */
function valueTrend(
  snapshots: DailyValueSnapshot[] | undefined,
  windowDays: number,
): { available: boolean; delta: number | null; daysOfHistory: number } {
  const byDay = new Map<number, number>();
  for (const s of snapshots ?? []) {
    if (!Number.isFinite(s.dayIndex) || !Number.isFinite(s.value)) continue;
    byDay.set(s.dayIndex, s.value);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const daysOfHistory = days.length;
  if (daysOfHistory < 2) return { available: false, delta: null, daysOfHistory };

  const latestDay = days[days.length - 1];
  const targetDay = latestDay - windowDays;
  let baselineDay: number | null = null;
  for (const d of days) {
    if (d <= targetDay) baselineDay = d;
    else break;
  }
  if (baselineDay === null) return { available: false, delta: null, daysOfHistory };

  const delta = (byDay.get(latestDay) as number) - (byDay.get(baselineDay) as number);
  return { available: true, delta, daysOfHistory };
}
