/**
 * AForce Metabolic Readiness — pure derivation layer.
 *
 * Two display-only wellness ESTIMATES on a 0–100 scale, derived entirely
 * from signals the hydration + recovery engines already produce. This
 * module is a READ-ONLY downstream of those engines:
 *
 *   • It imports NOTHING from services, stores, React, or I/O.
 *   • Its outputs are estimates for display only — never medical
 *     measurements, and never fed back into any score. Nothing here can
 *     mutate a hydration point, performance band, or recovery score; the
 *     dependency is strictly one-directional.
 *
 * Bands reuse the engine's PEAK / BALANCED / RECOVERING / DEPLETED
 * convention at the exact thresholds in `utils/scoreBand.ts`
 * (90 / 75 / 60 / 0) so the metabolic tiles read in the same language as
 * the orb. (Only the `ScoreLevel` *type* is imported — a type-only import
 * is erased at runtime, keeping this module dependency-free.)
 *
 * Inputs are already-normalized 0–100 scalars. The raw → normalized
 * mapping (HRV ms, sleep hours, workout-load enum → 0–100) lives in the
 * service layer (`services/metabolicReadinessService.ts`), never here, so
 * the locked math + unit tests stay stable.
 *
 * Missing data is handled explicitly: a required input that is absent (or
 * non-finite) yields `{ hasEnoughData: false, score: null, band: null }`
 * — never NaN, and never a fabricated default.
 */

import type { ScoreLevel } from './scoreBand';

// ─── Types ────────────────────────────────────────────────────────────

/** Metabolic bands mirror the engine's 4-band performance convention. */
export type MetabolicBand = ScoreLevel; // 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED'

export interface MuscleReadinessInputs {
  /** Live hydration engine score, 0–100. REQUIRED. */
  hydrationScore?: number;
  /** Recovery engine capacity, 0–100. REQUIRED. */
  recoveryCapacity?: number;
  /** Normalized recent training fatigue, 0–100. Optional — absent ⇒ weights renormalize. */
  workoutFatigue?: number;
}

export interface CognitiveReadinessInputs {
  /** Live hydration engine score, 0–100. REQUIRED. */
  hydrationScore?: number;
  /** Normalized sleep quality, 0–100. REQUIRED. */
  sleepScore?: number;
  /** Normalized HRV vs baseline, 0–100. Optional — absent ⇒ weights renormalize. */
  hrvNormalized?: number;
}

/**
 * Display-only readiness result. `score` / `band` are null whenever
 * `hasEnoughData` is false — callers must render the "needs more data"
 * state instead of a number.
 */
export interface MetabolicReadiness {
  /** True only when every REQUIRED input was present + finite. */
  hasEnoughData: boolean;
  /** Rounded 0–100 estimate, or null when `hasEnoughData` is false. */
  score: number | null;
  /** Band label, or null when `hasEnoughData` is false. */
  band: MetabolicBand | null;
}

// ─── Band mapping ─────────────────────────────────────────────────────

/**
 * Map a 0–100 score to its band. Thresholds mirror `BAND_THRESHOLDS` in
 * scoreBand.ts exactly (highest first): PEAK ≥ 90, BALANCED ≥ 75,
 * RECOVERING ≥ 60, else DEPLETED. Kept inline so this module carries no
 * runtime dependency and stays trivially unit-testable.
 */
export function bandForScore(score: number): MetabolicBand {
  const s = clamp(score, 0, 100);
  if (s >= 90) return 'PEAK';
  if (s >= 75) return 'BALANCED';
  if (s >= 60) return 'RECOVERING';
  return 'DEPLETED';
}

// ─── Muscle Readiness ─────────────────────────────────────────────────

/**
 * Muscle Readiness — a display-only 0–100 ESTIMATE of how prepared the
 * body's muscular system is to perform, blending hydration, recovery
 * capacity, and recent training fatigue:
 *
 *   round( 0.40·hydrationScore + 0.40·recoveryCapacity
 *        + 0.20·(100 − workoutFatigue) )
 *
 * Inputs (all 0–100):
 *   • hydrationScore  — REQUIRED.
 *   • recoveryCapacity — REQUIRED.
 *   • workoutFatigue  — optional; when absent the fatigue term is DROPPED
 *     and the two required weights are renormalized to sum to 1.0 (each
 *     0.40/0.80 = 0.50). It is NOT treated as 0 fatigue — that would
 *     fabricate a full-freshness boost for users who simply have no
 *     workout source connected, inflating the estimate (mirrors how HRV
 *     absence is handled for Cognitive).
 *
 * Returns `{ hasEnoughData:false, score:null, band:null }` when a required
 * input is missing or non-finite (never NaN, never a default number).
 * Output range is 0–100. This is a wellness estimate, not a measurement.
 */
export function computeMuscleReadiness(inputs: MuscleReadinessInputs): MetabolicReadiness {
  const hydration = inputs.hydrationScore;
  const recovery = inputs.recoveryCapacity;
  if (!isFiniteNumber(hydration) || !isFiniteNumber(recovery)) {
    return insufficient();
  }
  const fatigue = inputs.workoutFatigue;
  let raw: number;
  if (isFiniteNumber(fatigue)) {
    raw = 0.4 * hydration + 0.4 * recovery + 0.2 * (100 - fatigue);
  } else {
    // Workout fatigue absent → drop the term and renormalize the two
    // required weights to sum to 1.0 (each 0.40/0.80 = 0.50). NOT treated
    // as zero fatigue, which would fabricate a full-freshness boost.
    raw = 0.5 * hydration + 0.5 * recovery;
  }
  return finalize(raw);
}

// ─── Cognitive Readiness ──────────────────────────────────────────────

/**
 * Cognitive Readiness — a display-only 0–100 ESTIMATE of mental
 * readiness, blending hydration, sleep, and HRV:
 *
 *   round( 0.35·hydrationScore + 0.40·sleepScore + 0.25·hrvNormalized )
 *
 * Inputs (all 0–100):
 *   • hydrationScore — REQUIRED.
 *   • sleepScore     — REQUIRED.
 *   • hrvNormalized  — optional; when absent the HRV term is DROPPED and
 *     the remaining weights are renormalized to sum to 1.0
 *     (hydration 0.35/0.75, sleep 0.40/0.75) so a user without an HRV
 *     source is never penalized for the missing signal.
 *
 * Returns `{ hasEnoughData:false, score:null, band:null }` when a required
 * input is missing or non-finite (never NaN, never a default number).
 * Output range is 0–100. This is a wellness estimate, not a measurement.
 */
export function computeCognitiveReadiness(inputs: CognitiveReadinessInputs): MetabolicReadiness {
  const hydration = inputs.hydrationScore;
  const sleep = inputs.sleepScore;
  if (!isFiniteNumber(hydration) || !isFiniteNumber(sleep)) {
    return insufficient();
  }
  const hrv = inputs.hrvNormalized;
  let raw: number;
  if (isFiniteNumber(hrv)) {
    raw = 0.35 * hydration + 0.4 * sleep + 0.25 * hrv;
  } else {
    // HRV absent → drop the term and renormalize the remaining weights
    // to sum to 1.0. NOT treated as 0, which would unfairly penalize
    // users with no HRV source.
    const wHydration = 0.35 / 0.75;
    const wSleep = 0.4 / 0.75;
    raw = wHydration * hydration + wSleep * sleep;
  }
  return finalize(raw);
}

// ─── Internals ────────────────────────────────────────────────────────

/** Fresh "needs more data" sentinel (new object each call → safe to read). */
function insufficient(): MetabolicReadiness {
  return { hasEnoughData: false, score: null, band: null };
}

/** Round + clamp ONCE at the boundary (never mid-calc), then resolve band. */
function finalize(raw: number): MetabolicReadiness {
  const score = clamp(Math.round(raw), 0, 100);
  return { hasEnoughData: true, score, band: bandForScore(score) };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
