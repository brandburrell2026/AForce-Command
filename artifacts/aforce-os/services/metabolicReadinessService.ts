/**
 * Metabolic Readiness service — the raw → normalized adapter layer.
 *
 * This is the ONLY place the raw health signals get turned into the
 * already-normalized 0–100 scalars that the pure math in
 * `utils/metabolicScore.ts` expects. Keeping the normalization here (and
 * out of the pure module) is deliberate: the locked formulas + unit tests
 * never have to change when a normalization curve is tuned.
 *
 * SCORE PROTECTION: this module is a strict READ-ONLY downstream of the
 * hydration + recovery engines. It imports their READ outputs and the
 * biometrics types only — it never imports a store dispatch/mutator and
 * never writes anything back. Metabolic Readiness can only ever be a
 * projection of signals those engines already produced; it cannot move a
 * hydration point, performance band, or recovery score.
 *
 * Raw signal sources (all already present in the app — reused, not
 * duplicated): live hydration score (engine slice), recovery capacity
 * (recoveryEngine), and sleep / HRV / workout from the multi-provider
 * HealthKit path (`ProviderBiometrics`).
 */

import type { ProviderBiometrics } from '../types/biometrics';
import {
  computeMuscleReadiness,
  computeCognitiveReadiness,
  type MetabolicReadiness,
} from '../utils/metabolicScore';

// ─── Public shapes ────────────────────────────────────────────────────

/** Raw (un-normalized) signals read from the engines + biometrics path. */
export interface MetabolicRawSignals {
  /** Live hydration engine score, 0–100 (or null when unavailable). */
  hydrationScore: number | null;
  /** Recovery engine capacity, 0–100 (or null when unavailable). */
  recoveryCapacity: number | null;
  /** Freshest sleep duration last night, hours (or null). */
  sleepHours: number | null;
  /** Freshest HRV (SDNN), milliseconds (or null). */
  hrvMs: number | null;
  /** Max workout/exercise minutes today across providers (or null). */
  workoutMinutes: number | null;
  /** Max WHOOP-style strain (0–21) across providers (or null). */
  strain: number | null;
  /** Epoch ms the snapshot was derived (supplied by the caller — keeps this pure). */
  nowMs: number;
}

export interface MetabolicReadinessSnapshot {
  muscleReadiness: MetabolicReadiness;
  cognitiveReadiness: MetabolicReadiness;
  /** True when AT LEAST one metric had enough data to produce a score. */
  hasEnoughData: boolean;
  /** Epoch ms this projection was computed. */
  lastUpdated: number;
}

// ─── Normalizers (raw → 0–100) ────────────────────────────────────────

/**
 * HRV (SDNN ms) → 0–100.
 *
 * PROVISIONAL fixed curve, anchored so it lines up with the HRV bands
 * already used in `biometricsAggregator` (<30ms = low, ≥60ms = high):
 * a linear ramp from 20ms → 0 to 70ms → 100, clamped. Returns
 * `undefined` when no HRV reading exists so the cognitive math drops the
 * term and renormalizes (the user is never penalized for a missing sensor).
 *
 * TODO(metabolic): replace this fixed curve with a PER-USER ROLLING HRV
 * BASELINE (personal mean / SD over a trailing window) once enough
 * per-user history exists. A population-fixed curve over- or under-rates
 * athletes whose true baseline sits far from 20–70ms.
 */
export function normalizeHrvMs(hrvMs: number | null | undefined): number | undefined {
  if (typeof hrvMs !== 'number' || !Number.isFinite(hrvMs)) return undefined;
  const pct = ((hrvMs - 20) / (70 - 20)) * 100;
  return clamp(pct, 0, 100);
}

/**
 * Sleep duration (hours) → 0–100. Piecewise curve aligned to the sleep
 * bands in `biometricsAggregator` (4h short, 6h decent, 7–9h optimal):
 * climbs to a 100 plateau across the 7–9h optimal window, then eases off
 * for oversleep. Returns `undefined` when no sleep reading exists (a
 * REQUIRED input for cognitive readiness → "needs more data").
 */
export function normalizeSleepHours(hours: number | null | undefined): number | undefined {
  if (typeof hours !== 'number' || !Number.isFinite(hours)) return undefined;
  let score: number;
  if (hours <= 0) score = 0;
  else if (hours < 4) score = (hours / 4) * 30;                 // 0→0,  4→30
  else if (hours < 6) score = 30 + ((hours - 4) / 2) * 40;      // 4→30, 6→70
  else if (hours < 7) score = 70 + (hours - 6) * 30;            // 6→70, 7→100
  else if (hours <= 9) score = 100;                            // 7–9 optimal
  else if (hours <= 11) score = 100 - ((hours - 9) / 2) * 20;   // 9→100, 11→80
  else score = 80;                                            // heavy oversleep
  return clamp(score, 0, 100);
}

/**
 * Workout signals → workout FATIGUE 0–100 (higher = more recent load).
 *
 * Buckets mirror the workout-minute anchors (15/30/60/90) and WHOOP
 * strain bands (10/14/18) already used by `biometricsAggregator`, mapped
 * to none/light/moderate/hard/extreme = 0/25/50/75/100; the larger of the
 * two signals wins. Returns `undefined` when there is NO workout signal at
 * all, so the muscle math DROPS the fatigue term and renormalizes the
 * remaining required weights (never fabricating a full-freshness boost for
 * an un-tracked day — see `computeMuscleReadiness`).
 */
export function deriveWorkoutFatigue(
  workoutMinutes: number | null | undefined,
  strain: number | null | undefined,
): number | undefined {
  const fromMinutes = fatigueFromWorkoutMinutes(workoutMinutes);
  const fromStrain = fatigueFromStrain(strain);
  if (fromMinutes === undefined && fromStrain === undefined) return undefined;
  return Math.max(fromMinutes ?? 0, fromStrain ?? 0);
}

function fatigueFromWorkoutMinutes(min: number | null | undefined): number | undefined {
  if (typeof min !== 'number' || !Number.isFinite(min) || min <= 0) return undefined;
  if (min >= 90) return 100; // extreme
  if (min >= 60) return 75;  // hard
  if (min >= 30) return 50;  // moderate
  return 25;                 // light (0 < min < 30)
}

function fatigueFromStrain(strain: number | null | undefined): number | undefined {
  if (typeof strain !== 'number' || !Number.isFinite(strain) || strain <= 0) return undefined;
  if (strain >= 18) return 100; // all-out → extreme
  if (strain >= 14) return 75;  // strenuous → hard
  if (strain >= 10) return 50;  // moderate
  return 25;                    // 0–9 light
}

// ─── Biometrics selectors (freshest / max wins) ───────────────────────

/** Freshest non-null HRV (SDNN ms) across all linked providers, or null. */
export function selectFreshestHrvMs(biometrics: ProviderBiometrics | undefined): number | null {
  if (!biometrics) return null;
  let best: { value: number; fetchedAt: number } | null = null;
  for (const snap of Object.values(biometrics)) {
    if (!snap) continue;
    const v = snap.hrvSdnn;
    if (v == null) continue;
    if (best === null || snap.fetchedAt > best.fetchedAt) best = { value: v, fetchedAt: snap.fetchedAt };
  }
  return best ? best.value : null;
}

/** Max workout minutes today across providers (best capture wins), or null. */
export function selectMaxWorkoutMinutes(biometrics: ProviderBiometrics | undefined): number | null {
  return selectMaxField(biometrics, 'workoutMinutesToday');
}

/** Max strain (0–21) across providers, or null. */
export function selectMaxStrain(biometrics: ProviderBiometrics | undefined): number | null {
  return selectMaxField(biometrics, 'strain');
}

function selectMaxField(
  biometrics: ProviderBiometrics | undefined,
  field: 'workoutMinutesToday' | 'strain',
): number | null {
  if (!biometrics) return null;
  let max: number | null = null;
  for (const snap of Object.values(biometrics)) {
    const v = snap?.[field];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (max === null || v > max) max = v;
  }
  return max;
}

// ─── Derivation ───────────────────────────────────────────────────────

/**
 * Project the raw signals into the two readiness estimates. Pure +
 * deterministic — no store reads, no clock (caller supplies `nowMs`), no
 * writes. The React-facing wiring lives in `hooks/useMetabolicReadiness`.
 */
export function deriveMetabolicReadiness(signals: MetabolicRawSignals): MetabolicReadinessSnapshot {
  const hydrationScore = finiteOrUndefined(signals.hydrationScore);
  const recoveryCapacity = finiteOrUndefined(signals.recoveryCapacity);
  const sleepScore = normalizeSleepHours(signals.sleepHours);
  const hrvNormalized = normalizeHrvMs(signals.hrvMs);
  const workoutFatigue = deriveWorkoutFatigue(signals.workoutMinutes, signals.strain);

  const muscleReadiness = computeMuscleReadiness({ hydrationScore, recoveryCapacity, workoutFatigue });
  const cognitiveReadiness = computeCognitiveReadiness({ hydrationScore, sleepScore, hrvNormalized });

  return {
    muscleReadiness,
    cognitiveReadiness,
    hasEnoughData: muscleReadiness.hasEnoughData || cognitiveReadiness.hasEnoughData,
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
