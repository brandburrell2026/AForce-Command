/**
 * AForce Performance Age™ — pure derivation layer.
 *
 * Performance Age is a display-only HEADLINE ESTIMATE (in years) of how a
 * member's recent performance BEHAVIOUR compares to their actual age. It is
 * derived entirely from signals the hydration + recovery engines and the
 * analytics layer already produce, so this module is a strictly READ-ONLY
 * downstream:
 *
 *   • It imports NOTHING from services, stores, React, or I/O.
 *   • Its output is an estimate for display only — never a medical
 *     measurement, never a biological-age assessment, and never fed back
 *     into any score. Nothing here can mutate a hydration point,
 *     performance band, or recovery score; the dependency is one-way.
 *
 * Formula V1 (weighted blend of already-normalized 0–100 behaviour
 * sub-scores; the raw → normalized mapping lives in
 * `services/performanceAgeService.ts`, never here, so the locked math +
 * unit tests stay stable):
 *
 *   Hydration Consistency  35%
 *   Recovery Trend         30%
 *   Sleep Quality          20%
 *   Activity Consistency   15%
 *
 * (Command/engagement completion is deliberately EXCLUDED — it is
 * engagement analytics, not a performance behaviour.)
 *
 * The 0–100 composite is mapped to a years-delta from actual age and added
 * to it, bounded to AT MOST 15 years younger and AT MOST 10 years older,
 * with a display floor so a young adult never sees an absurd value.
 *
 * Missing data is handled explicitly and conservatively, protecting the
 * metric's credibility:
 *   • actual age unknown                  → `status: 'missing-age'`,
 *                                           performanceAge null.
 *   • no behaviour sub-scores yet          → `status: 'provisional'`,
 *                                           performanceAge null.
 *   • thin history (new user)              → `status: 'provisional'`,
 *                                           number shown but tagged.
 *   • ≥7 active days AND ≥3/4 sub-scores    → `status: 'established'`.
 *
 * Absent OPTIONAL sub-scores are DROPPED and the remaining weights
 * renormalized — never substituted with a favourable default, which would
 * fabricate an unearned "younger" result.
 */

import type { ScoreLevel } from './scoreBand';

// ─── Constants (the locked V1 contract) ───────────────────────────────

/**
 * Required disclaimer — MUST be rendered on every Performance Age surface.
 * Performance Age is a behavioural estimate, not a medical or biological
 * measurement.
 */
export const PERFORMANCE_AGE_DISCLAIMER =
  'Performance Age reflects recent performance behaviors and trends. It is not a medical measurement or biological age assessment.';

/** Formula weights — sum to 1.0. Command completion is intentionally absent. */
export const PERFORMANCE_AGE_WEIGHTS = {
  hydrationConsistency: 0.35,
  recoveryTrend: 0.3,
  sleepQuality: 0.2,
  activityConsistency: 0.15,
} as const;

/** Best case: at most this many years BELOW actual age. */
export const MAX_YEARS_BELOW = 15;
/** Worst case: at most this many years ABOVE actual age. */
export const MAX_YEARS_ABOVE = 10;

/**
 * Composite at which Performance Age equals actual age (delta 0). Anchored
 * at 75 — the engine's BALANCED threshold — so ordinary balanced behaviour
 * reads as "on par", not unrealistically "younger". Only genuinely strong
 * behaviour (composite > 75) earns a younger Performance Age.
 */
export const NEUTRAL_COMPOSITE = 75;

/**
 * Absolute display floor so an exceptional young adult never sees an absurd
 * Performance Age (e.g. "3"). The effective floor never rises above the
 * member's own actual age, so a genuine youth athlete is never reported as
 * OLDER purely because of this clamp.
 */
export const MIN_PERFORMANCE_AGE = 18;

/** A baseline is "established" only at/after this many distinct active days. */
export const ESTABLISHED_MIN_ACTIVE_DAYS = 7;
/** …and only once at least this many of the 4 sub-scores are available. */
export const ESTABLISHED_MIN_SUBSCORES = 3;

/** Trailing windows for the rolling trend helper. */
export const WEEKLY_TREND_DAYS = 7;
export const MONTHLY_TREND_DAYS = 30;

// ─── Types ────────────────────────────────────────────────────────────

/** Bands mirror the engine's 4-band performance convention (tint only). */
export type PerformanceBand = ScoreLevel; // 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED'

export interface PerformanceAgeInputs {
  /** Actual age in whole years, or null when birth year is unknown. */
  actualAge: number | null;
  /** Already-normalized 0–100. Optional — absent ⇒ weight renormalizes. */
  hydrationConsistency?: number;
  /** Already-normalized 0–100. Optional — absent ⇒ weight renormalizes. */
  recoveryTrend?: number;
  /** Already-normalized 0–100. Optional — absent ⇒ weight renormalizes. */
  sleepQuality?: number;
  /** Already-normalized 0–100. Optional — absent ⇒ weight renormalizes. */
  activityConsistency?: number;
  /** Distinct active days observed so far (history depth for sufficiency). */
  activeDays: number;
}

export type PerformanceAgeStatus = 'missing-age' | 'provisional' | 'established';

export interface PerformanceAgeResult {
  /** Lifecycle of the estimate — drives which UI state renders. */
  status: PerformanceAgeStatus;
  /** True ONLY for an established (non-provisional) baseline. */
  hasEnoughData: boolean;
  /** True while the estimate is still provisional (show the badge). */
  provisional: boolean;
  /** Performance Age in whole years, or null (missing age / no signals). */
  performanceAge: number | null;
  /** Actual age echoed back, or null when unknown. */
  actualAge: number | null;
  /** performanceAge − actualAge (negative = younger), or null. */
  yearsDelta: number | null;
  /** 0–100 behaviour composite, or null when no sub-score is available. */
  composite: number | null;
  /** Band for the composite (tint), or null. */
  band: PerformanceBand | null;
  /** How many of the 4 sub-scores were available (0–4). */
  availableSignals: number;
}

/** One persisted daily Performance Age value (powers the trend helper). */
export interface PerformanceAgeDailySnapshot {
  /** UTC day index: Math.floor(epochMs / 86_400_000) — timezone-free. */
  dayIndex: number;
  /** Performance Age recorded that day. */
  performanceAge: number;
}

export type TrendDirection = 'younger' | 'older' | 'steady';

export interface PerformanceAgeTrend {
  /** True only when enough history spans the requested window. */
  available: boolean;
  /** current − past performance age (negative = improved / younger), or null. */
  deltaYears: number | null;
  /** Direction of change, or null when unavailable. */
  direction: TrendDirection | null;
  /** Distinct days of history available (regardless of window). */
  daysOfHistory: number;
}

// ─── Band mapping ─────────────────────────────────────────────────────

/**
 * Map a 0–100 composite to its band. Thresholds mirror `BAND_THRESHOLDS`
 * in scoreBand.ts exactly (PEAK ≥ 90, BALANCED ≥ 75, RECOVERING ≥ 60, else
 * DEPLETED). Kept inline so this module carries no runtime dependency.
 */
export function bandForComposite(composite: number): PerformanceBand {
  const s = clamp(composite, 0, 100);
  if (s >= 90) return 'PEAK';
  if (s >= 75) return 'BALANCED';
  if (s >= 60) return 'RECOVERING';
  return 'DEPLETED';
}

// ─── Composite → years delta ──────────────────────────────────────────

/**
 * Map a 0–100 composite to a years delta from actual age, anchored at
 * NEUTRAL_COMPOSITE (delta 0) and clamped to [−MAX_YEARS_BELOW,
 * +MAX_YEARS_ABOVE]:
 *
 *   composite = 75 → 0
 *   composite = 100 → −15 (best)
 *   composite = 0   → +10 (worst)
 */
export function deltaFromComposite(composite: number): number {
  const c = clamp(composite, 0, 100);
  let delta: number;
  if (c >= NEUTRAL_COMPOSITE) {
    delta = -((c - NEUTRAL_COMPOSITE) / (100 - NEUTRAL_COMPOSITE)) * MAX_YEARS_BELOW;
  } else {
    delta = ((NEUTRAL_COMPOSITE - c) / NEUTRAL_COMPOSITE) * MAX_YEARS_ABOVE;
  }
  return clamp(delta, -MAX_YEARS_BELOW, MAX_YEARS_ABOVE);
}

// ─── Performance Age ──────────────────────────────────────────────────

/**
 * Compute the display-only Performance Age estimate. Pure + deterministic.
 *
 * The composite is a weighted blend of the AVAILABLE sub-scores: absent
 * optional sub-scores are dropped and the remaining weights renormalized
 * (never replaced with a favourable default). The result is conservative
 * about credibility — it withholds the number entirely when actual age or
 * all behaviour signals are missing, and tags a thin-history estimate as
 * provisional rather than presenting an unearned precise number.
 */
export function computePerformanceAge(inputs: PerformanceAgeInputs): PerformanceAgeResult {
  const weighted = [
    { v: inputs.hydrationConsistency, w: PERFORMANCE_AGE_WEIGHTS.hydrationConsistency },
    { v: inputs.recoveryTrend, w: PERFORMANCE_AGE_WEIGHTS.recoveryTrend },
    { v: inputs.sleepQuality, w: PERFORMANCE_AGE_WEIGHTS.sleepQuality },
    { v: inputs.activityConsistency, w: PERFORMANCE_AGE_WEIGHTS.activityConsistency },
  ];
  const available = weighted.filter((s) => isFiniteNumber(s.v));
  const availableSignals = available.length;

  // Composite via drop-and-renormalize. Null when NO sub-score is present.
  let composite: number | null = null;
  let band: PerformanceBand | null = null;
  if (availableSignals > 0) {
    const totalWeight = available.reduce((acc, s) => acc + s.w, 0);
    const raw = available.reduce(
      (acc, s) => acc + (s.w / totalWeight) * clamp(s.v as number, 0, 100),
      0,
    );
    composite = clamp(Math.round(raw), 0, 100);
    band = bandForComposite(composite);
  }

  const actualAge = isFiniteNumber(inputs.actualAge) ? (inputs.actualAge as number) : null;

  // Actual age unknown → withhold the number; prompt the user for it.
  if (actualAge === null) {
    return {
      status: 'missing-age',
      hasEnoughData: false,
      provisional: false,
      performanceAge: null,
      actualAge: null,
      yearsDelta: null,
      composite,
      band,
      availableSignals,
    };
  }

  // Age known but no behaviour signal yet → provisional, still no number.
  if (composite === null) {
    return {
      status: 'provisional',
      hasEnoughData: false,
      provisional: true,
      performanceAge: null,
      actualAge,
      yearsDelta: null,
      composite: null,
      band: null,
      availableSignals: 0,
    };
  }

  const delta = deltaFromComposite(composite);
  // Floor never rises above the member's own age, so a youth athlete is
  // never reported as OLDER purely because of the absolute floor.
  const floor = Math.min(MIN_PERFORMANCE_AGE, actualAge);
  const performanceAge = Math.max(floor, Math.round(actualAge + delta));
  const yearsDelta = performanceAge - actualAge;

  const established =
    inputs.activeDays >= ESTABLISHED_MIN_ACTIVE_DAYS &&
    availableSignals >= ESTABLISHED_MIN_SUBSCORES;

  return {
    status: established ? 'established' : 'provisional',
    hasEnoughData: established,
    provisional: !established,
    performanceAge,
    actualAge,
    yearsDelta,
    composite,
    band,
    availableSignals,
  };
}

// ─── Trend (rolling, over persisted daily snapshots) ──────────────────

/**
 * Compute a Performance Age trend over a trailing window. Pure: it reads
 * only the snapshots handed in, so it is honest by construction — until a
 * real daily snapshot history exists the caller passes `[]` and this
 * returns `{ available: false }` ("collecting…"), never a fabricated trend.
 *
 * The trend compares the most recent snapshot against the most recent
 * snapshot at or before `latestDay − windowDays`. Negative `deltaYears`
 * means Performance Age dropped (improved / younger).
 */
export function computePerformanceAgeTrend(
  snapshots: PerformanceAgeDailySnapshot[],
  windowDays: number,
): PerformanceAgeTrend {
  const byDay = new Map<number, number>();
  for (const s of snapshots) {
    if (!isFiniteNumber(s.dayIndex) || !isFiniteNumber(s.performanceAge)) continue;
    byDay.set(s.dayIndex, s.performanceAge); // later entry for a day wins
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const daysOfHistory = days.length;
  if (daysOfHistory < 2) {
    return { available: false, deltaYears: null, direction: null, daysOfHistory };
  }

  const latestDay = days[days.length - 1];
  const targetDay = latestDay - windowDays;
  let baselineDay: number | null = null;
  for (const d of days) {
    if (d <= targetDay) baselineDay = d;
    else break;
  }
  if (baselineDay === null) {
    return { available: false, deltaYears: null, direction: null, daysOfHistory };
  }

  const current = byDay.get(latestDay) as number;
  const past = byDay.get(baselineDay) as number;
  const deltaYears = current - past;
  const direction: TrendDirection =
    deltaYears < 0 ? 'younger' : deltaYears > 0 ? 'older' : 'steady';
  return { available: true, deltaYears, direction, daysOfHistory };
}

// ─── Daily snapshot recording (pure decision; the persist lives in the hook) ──

/** Milliseconds in one UTC day — the timezone-free day-bucket size. */
const MS_PER_DAY = 86_400_000;

/**
 * The Performance Age daily snapshot to record at `nowMs`, or null when there
 * is no finite age to record yet (missing-age or provisional-without-number).
 *
 * Score-Protection / no-fabrication: a null / NaN / ±Infinity age records
 * NOTHING, so the trend honestly stays "collecting…" until real established
 * behaviour exists — a snapshot is only ever a read-out of an age the engines
 * already produced, never an invented one. The day index is the SAME UTC
 * bucket the trend helper and the ledger adapters use, so one snapshot per day
 * round-trips idempotently (the ledger keys a perf-age event by this index).
 */
export function dailySnapshotForRecording(
  performanceAge: number | null | undefined,
  nowMs: number,
): PerformanceAgeDailySnapshot | null {
  if (!isFiniteNumber(performanceAge) || !isFiniteNumber(nowMs)) return null;
  return { dayIndex: Math.floor(nowMs / MS_PER_DAY), performanceAge };
}

// ─── Internals ────────────────────────────────────────────────────────

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
