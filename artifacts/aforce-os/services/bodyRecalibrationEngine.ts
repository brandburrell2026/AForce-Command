/**
 * Body Recalibration Engine™ (Section 20) — pure recalc math.
 *
 * On a major profile change, recomputes the FIVE go-forward targets from the
 * user's §19 Performance Profile inputs. Every coefficient is read from
 * `../config/hydroStateModel`; this module is arithmetic + clamps only, with
 * no literal thresholds (brief #4).
 *
 * Boundaries (Section 20 review):
 *   • FUTURE-ONLY: this engine produces a `RecalibrationTargets` bundle that
 *     gets stored on the NEW baseline version (see profileSyncService +
 *     profileRepo). It never reads or rewrites historical score snapshots.
 *   • It does NOT import scoringEngine.ts or statusColor.ts — the targets are
 *     stored on the baseline and surfaced in the recalibration confirmation;
 *     they do not enter the 0–100 score formula. (Live-consumer routing into
 *     the demand engine / Today's Command is deferred to Part B.)
 *
 * Missing-input policy (no hidden assumptions): a target whose anchoring input
 * is absent is returned as `null` rather than invented. Optional adjustment
 * terms are simply skipped when their input is unset (the term contributes
 * nothing — no neutral magic number is asserted as a fact).
 */

import {
  HYDRATION_BASE_OZ_PER_LB,
  TRAINING_LEVEL_HYDRATION_MULTIPLIER,
  SWEAT_LEVEL_HYDRATION_ADDER_OZ,
  GOAL_HYDRATION_MODIFIER_OZ,
  HYDRATION_TARGET_FLOOR_OZ,
  HYDRATION_TARGET_CEILING_OZ,
  SODIUM_BASE_MG,
  SODIUM_MG_PER_WORKOUT_MIN_BY_SWEAT,
  RECOVERY_WINDOW_MIN_BY_TRAINING,
  GOAL_RECOVERY_WINDOW_MODIFIER_MIN,
  RECHECK_INTERVAL_BASE_MIN,
  RECHECK_INTERVAL_SWEAT_FACTOR,
  RECHECK_INTERVAL_FLOOR_MIN,
  ENV_PRESSURE_SENSITIVITY_BY_SWEAT,
} from '../config/hydroStateModel';
import type { ProfileIdentity } from '../utils/profileIdentity';
import type {
  TrainingLevel,
  PrimaryGoal,
  SweatClassification,
} from '../utils/profileIdentity';

/** The §19 baseline inputs the recalc consumes. */
export interface RecalibrationInputs {
  bodyWeightLbs: number | null;
  trainingLevel: TrainingLevel | null;
  sweatClassification: SweatClassification | null;
  primaryGoal: PrimaryGoal | null;
  typicalWorkoutDurationMin: number | null;
}

/** The five recalibrated, go-forward targets. Null = not computable yet. */
export interface RecalibrationTargets {
  /** (1) Daily hydration target in oz. Null when body weight is unset. */
  dailyHydrationTargetOz: number | null;
  /** (2) Daily electrolyte (sodium) recommendation in mg. Always ≥ base. */
  electrolyteSodiumMg: number;
  /** (3) Post-session recovery rehydration window in min. Null without training level. */
  recoveryWindowMin: number | null;
  /** (4) Minutes between HydroState rechecks. Always computable (base, floored). */
  recheckIntervalMin: number;
  /** (5) Environmental Pressure™ sensitivity multiplier. Null without a sweat profile. */
  envPressureSensitivity: number | null;
}

const round = (n: number): number => Math.round(n);
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** Extract the recalc inputs from the editable identity. */
export function recalibrationInputsFromIdentity(
  identity: ProfileIdentity,
): RecalibrationInputs {
  return {
    bodyWeightLbs: identity.bodyWeightLbs,
    trainingLevel: identity.trainingLevel,
    sweatClassification: identity.sweatClassification,
    primaryGoal: identity.primaryGoal,
    typicalWorkoutDurationMin: identity.typicalWorkoutDurationMin,
  };
}

function dailyHydrationTargetOz(i: RecalibrationInputs): number | null {
  // Weight anchors the target. Guard non-finite (incl. NaN) so a corrupt
  // input becomes an explicit null, never a NaN that clamps into a "real" target.
  if (i.bodyWeightLbs == null || !Number.isFinite(i.bodyWeightLbs)) return null;
  let oz = i.bodyWeightLbs * HYDRATION_BASE_OZ_PER_LB;
  if (i.trainingLevel) oz *= TRAINING_LEVEL_HYDRATION_MULTIPLIER[i.trainingLevel];
  if (i.sweatClassification) oz += SWEAT_LEVEL_HYDRATION_ADDER_OZ[i.sweatClassification];
  if (i.primaryGoal) oz += GOAL_HYDRATION_MODIFIER_OZ[i.primaryGoal];
  return clamp(round(oz), HYDRATION_TARGET_FLOOR_OZ, HYDRATION_TARGET_CEILING_OZ);
}

function electrolyteSodiumMg(i: RecalibrationInputs): number {
  let mg = SODIUM_BASE_MG;
  // Workout-driven sodium needs both a sweat profile and a finite session
  // length; a non-finite duration is skipped (base only), never added as NaN.
  if (
    i.sweatClassification &&
    i.typicalWorkoutDurationMin != null &&
    Number.isFinite(i.typicalWorkoutDurationMin)
  ) {
    mg += SODIUM_MG_PER_WORKOUT_MIN_BY_SWEAT[i.sweatClassification] *
      i.typicalWorkoutDurationMin;
  }
  return round(mg);
}

function recoveryWindowMin(i: RecalibrationInputs): number | null {
  if (!i.trainingLevel) return null; // training level anchors the window
  let min = RECOVERY_WINDOW_MIN_BY_TRAINING[i.trainingLevel];
  // Some goals lengthen the window; goals without an entry contribute nothing.
  if (i.primaryGoal) min += GOAL_RECOVERY_WINDOW_MODIFIER_MIN[i.primaryGoal] ?? 0;
  return round(min);
}

function recheckIntervalMin(i: RecalibrationInputs): number {
  let min = RECHECK_INTERVAL_BASE_MIN;
  if (i.sweatClassification) min *= RECHECK_INTERVAL_SWEAT_FACTOR[i.sweatClassification];
  return Math.max(RECHECK_INTERVAL_FLOOR_MIN, round(min));
}

function envPressureSensitivity(i: RecalibrationInputs): number | null {
  if (!i.sweatClassification) return null; // sweat profile anchors sensitivity
  return ENV_PRESSURE_SENSITIVITY_BY_SWEAT[i.sweatClassification];
}

/**
 * Recompute the five go-forward targets. Pure: identical inputs always yield
 * identical targets; no clock, no I/O, no snapshot access.
 */
export function recalibrateTargets(i: RecalibrationInputs): RecalibrationTargets {
  return {
    dailyHydrationTargetOz: dailyHydrationTargetOz(i),
    electrolyteSodiumMg: electrolyteSodiumMg(i),
    recoveryWindowMin: recoveryWindowMin(i),
    recheckIntervalMin: recheckIntervalMin(i),
    envPressureSensitivity: envPressureSensitivity(i),
  };
}
