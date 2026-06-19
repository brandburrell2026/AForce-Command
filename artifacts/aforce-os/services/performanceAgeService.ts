/**
 * Performance Age service — the raw → normalized adapter layer.
 *
 * This is the ONLY place raw health/behaviour signals get turned into the
 * already-normalized 0–100 sub-scores that the pure math in
 * `utils/performanceAge.ts` expects. Keeping normalization here (and out of
 * the pure module) is deliberate: the locked formula + unit tests never
 * have to change when a normalization curve is tuned.
 *
 * SCORE PROTECTION: this module is a strict READ-ONLY downstream of the
 * hydration + recovery engines and the analytics layer. It imports their
 * READ outputs only — never a store dispatch/mutator — and writes nothing
 * back. Performance Age can only ever be a projection of signals those
 * systems already produced; it cannot move a hydration point, performance
 * band, or recovery score.
 *
 * V1 sub-score sourcing (each documented as honest / provisional given the
 * data actually available today — there is no persisted daily SCORE series
 * yet, so true multi-day "consistency"/"trend" is approximated):
 *   • Hydration Consistency ← compliance day-streak vs a 7-day target.
 *   • Recovery Trend        ← current recovery-engine capacity (proxy).
 *   • Sleep Quality         ← freshest sleep duration (shared normalizer).
 *   • Activity Consistency  ← profile activity level, else workout load.
 */

import {
  normalizeSleepHours,
  deriveWorkoutFatigue,
} from './metabolicReadinessService';
import {
  computePerformanceAge,
  computePerformanceAgeTrend,
  WEEKLY_TREND_DAYS,
  MONTHLY_TREND_DAYS,
  type PerformanceAgeResult,
  type PerformanceAgeTrend,
  type PerformanceAgeDailySnapshot,
} from '../utils/performanceAge';

// ─── Tuning ───────────────────────────────────────────────────────────

/**
 * Day-streak that scores a full hydration-consistency signal. Mirrors the
 * 7-day window the Friction Score already uses for daily-active-usage, so
 * "consistent" means the same thing across the app.
 */
export const HYDRATION_CONSISTENCY_TARGET_DAYS = 7;

// ─── Public shapes ────────────────────────────────────────────────────

/** Raw (un-normalized) signals read from the engines + analytics + profile. */
export interface PerformanceAgeRawSignals {
  /** Actual age in whole years (or null when birth year unknown). */
  actualAge: number | null;
  /** Recovery engine capacity, 0–100 (or null) — the recovery-trend proxy. */
  recoveryCapacity: number | null;
  /** Freshest sleep duration last night, hours (or null). */
  sleepHours: number | null;
  /** Max workout/exercise minutes today across providers (or null). */
  workoutMinutes: number | null;
  /** Max WHOOP-style strain (0–21) across providers (or null). */
  strain: number | null;
  /** Self-reported activity level, 0–10 (or null) — primary activity signal. */
  activityLevel: number | null;
  /** Latest compliance day-streak (or null) — the hydration-consistency signal. */
  complianceStreak: number | null;
  /** Distinct active days so far (history depth for the sufficiency gate). */
  activeDays: number;
  /**
   * Persisted daily Performance Age history for the trend helper. Empty
   * until a snapshot series exists — the trends then report "collecting…"
   * rather than fabricating a slope.
   */
  dailySnapshots?: PerformanceAgeDailySnapshot[];
  /** Epoch ms the snapshot was derived (supplied by the caller — keeps this pure). */
  nowMs: number;
}

export interface PerformanceAgeSnapshot {
  result: PerformanceAgeResult;
  weeklyTrend: PerformanceAgeTrend;
  monthlyTrend: PerformanceAgeTrend;
  /** Epoch ms this projection was computed. */
  lastUpdated: number;
}

// ─── Normalizers (raw → 0–100) ────────────────────────────────────────

/**
 * Compliance day-streak → hydration consistency 0–100. A linear ramp to a
 * 100 plateau at HYDRATION_CONSISTENCY_TARGET_DAYS. Returns `undefined`
 * when no streak has ever been recorded (null), so the math drops the term
 * and renormalizes rather than penalizing a user with no streak history. A
 * recorded streak of 0 is a REAL signal (broken streak) and maps to 0.
 */
export function normalizeStreakConsistency(
  streak: number | null | undefined,
): number | undefined {
  if (typeof streak !== 'number' || !Number.isFinite(streak) || streak < 0) {
    return undefined;
  }
  return clamp((streak / HYDRATION_CONSISTENCY_TARGET_DAYS) * 100, 0, 100);
}

/**
 * Activity consistency 0–100. Prefers the self-reported activity level
 * (0–10 → 0–100), the steadiest "how active is this person" signal. Falls
 * back to recent workout LOAD only when no activity level is set, so a user
 * with a connected wearable still contributes a (weak, documented) signal.
 * Returns `undefined` when neither exists — never a fabricated default.
 *
 * TODO(performance-age): replace the workout-load fallback with a true
 * multi-day activity-frequency series once one is persisted; a single
 * intense day is load, not consistency.
 */
export function deriveActivityConsistency(
  activityLevel: number | null | undefined,
  workoutMinutes: number | null | undefined,
  strain: number | null | undefined,
): number | undefined {
  if (typeof activityLevel === 'number' && Number.isFinite(activityLevel)) {
    return clamp(activityLevel * 10, 0, 100);
  }
  return deriveWorkoutFatigue(workoutMinutes, strain);
}

// ─── Derivation ───────────────────────────────────────────────────────

/**
 * Project the raw signals into the Performance Age estimate + trends. Pure
 * + deterministic — no store reads, no clock (caller supplies `nowMs`), no
 * writes. The React-facing wiring lives in `hooks/usePerformanceAge`.
 */
export function derivePerformanceAge(
  signals: PerformanceAgeRawSignals,
): PerformanceAgeSnapshot {
  const hydrationConsistency = normalizeStreakConsistency(signals.complianceStreak);
  const recoveryTrend = finiteOrUndefined(signals.recoveryCapacity);
  const sleepQuality = normalizeSleepHours(signals.sleepHours);
  const activityConsistency = deriveActivityConsistency(
    signals.activityLevel,
    signals.workoutMinutes,
    signals.strain,
  );

  const result = computePerformanceAge({
    actualAge: signals.actualAge,
    hydrationConsistency,
    recoveryTrend,
    sleepQuality,
    activityConsistency,
    activeDays: signals.activeDays,
  });

  const snaps = signals.dailySnapshots ?? [];
  return {
    result,
    weeklyTrend: computePerformanceAgeTrend(snaps, WEEKLY_TREND_DAYS),
    monthlyTrend: computePerformanceAgeTrend(snaps, MONTHLY_TREND_DAYS),
    lastUpdated: signals.nowMs,
  };
}

// ─── Internals ────────────────────────────────────────────────────────

function finiteOrUndefined(n: number | null | undefined): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
