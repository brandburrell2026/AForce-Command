/**
 * Body Recalibration Engine™ (Section 20) tests.
 *
 * Each assertion derives its expected value FROM the config constants (not a
 * hardcoded number), so the test proves the engine reads config and stays
 * green if the constants are tuned. Also pins the missing-input policy
 * (anchoring input absent → target is null, not invented) and the clamps.
 */

import { describe, it, expect } from 'vitest';
import {
  recalibrateTargets,
  recalibrationInputsFromIdentity,
  type RecalibrationInputs,
} from '../bodyRecalibrationEngine';
import {
  HYDRATION_BASE_OZ_PER_LB,
  TRAINING_LEVEL_HYDRATION_MULTIPLIER,
  SWEAT_LEVEL_HYDRATION_ADDER_OZ,
  GOAL_HYDRATION_MODIFIER_OZ,
  HYDRATION_TARGET_FLOOR_OZ,
  HYDRATION_TARGET_CEILING_OZ,
  SODIUM_BASE_MG,
  SODIUM_MG_PER_WORKOUT_MIN_BY_SWEAT,
  SODIUM_CEILING_MG,
  RECOVERY_WINDOW_MIN_BY_TRAINING,
  GOAL_RECOVERY_WINDOW_MODIFIER_MIN,
  RECHECK_INTERVAL_BASE_MIN,
  RECHECK_INTERVAL_SWEAT_FACTOR,
  RECHECK_INTERVAL_FLOOR_MIN,
  ENV_PRESSURE_SENSITIVITY_BY_SWEAT,
} from '../../config/hydroStateModel';
import { DEFAULT_PROFILE_IDENTITY } from '../../utils/profileIdentity';

function inputs(over: Partial<RecalibrationInputs> = {}): RecalibrationInputs {
  return {
    bodyWeightLbs: null,
    trainingLevel: null,
    sweatClassification: null,
    primaryGoal: null,
    typicalWorkoutDurationMin: null,
    ...over,
  };
}

describe('daily hydration target', () => {
  it('is null when body weight is unset (no anchor, no invention)', () => {
    expect(recalibrateTargets(inputs()).dailyHydrationTargetOz).toBeNull();
  });

  it('weight only = round(weight × oz/lb), clamped', () => {
    const out = recalibrateTargets(inputs({ bodyWeightLbs: 200 }));
    expect(out.dailyHydrationTargetOz).toBe(Math.round(200 * HYDRATION_BASE_OZ_PER_LB));
  });

  it('composes training × multiplier, then sweat + goal adders', () => {
    const out = recalibrateTargets(
      inputs({
        bodyWeightLbs: 200,
        trainingLevel: 'Advanced',
        sweatClassification: 'heavy',
        primaryGoal: 'Endurance',
      }),
    );
    const expected = Math.round(
      200 * HYDRATION_BASE_OZ_PER_LB * TRAINING_LEVEL_HYDRATION_MULTIPLIER.Advanced +
        SWEAT_LEVEL_HYDRATION_ADDER_OZ.heavy +
        GOAL_HYDRATION_MODIFIER_OZ.Endurance,
    );
    expect(out.dailyHydrationTargetOz).toBe(expected);
  });

  it('returns null (never NaN) for a non-finite weight, so nothing bad clamps in', () => {
    const out = recalibrateTargets(inputs({ bodyWeightLbs: NaN }));
    expect(out.dailyHydrationTargetOz).toBeNull();
    expect(Number.isNaN(out.dailyHydrationTargetOz as number)).toBe(false);
  });

  it('clamps to the configured ceiling and floor', () => {
    expect(recalibrateTargets(inputs({ bodyWeightLbs: 500 })).dailyHydrationTargetOz)
      .toBe(HYDRATION_TARGET_CEILING_OZ); // 500 × 0.5 = 250 → ceiling
    expect(recalibrateTargets(inputs({ bodyWeightLbs: 90 })).dailyHydrationTargetOz)
      .toBe(HYDRATION_TARGET_FLOOR_OZ); // 90 × 0.5 = 45 → floor
  });
});

describe('electrolyte (sodium mg)', () => {
  it('is the base alone without a sweat profile + workout duration', () => {
    expect(recalibrateTargets(inputs()).electrolyteSodiumMg).toBe(SODIUM_BASE_MG);
    // sweat set but no duration → still base only
    expect(
      recalibrateTargets(inputs({ sweatClassification: 'heavy' })).electrolyteSodiumMg,
    ).toBe(SODIUM_BASE_MG);
  });

  it('skips the workout term (base only) for a non-finite duration — never NaN', () => {
    const out = recalibrateTargets(
      inputs({ sweatClassification: 'heavy', typicalWorkoutDurationMin: NaN }),
    );
    expect(out.electrolyteSodiumMg).toBe(SODIUM_BASE_MG);
  });

  it('adds the per-workout-minute rate scaled by sweat volume', () => {
    const out = recalibrateTargets(
      inputs({ sweatClassification: 'heavy', typicalWorkoutDurationMin: 60 }),
    );
    expect(out.electrolyteSodiumMg).toBe(
      SODIUM_BASE_MG + SODIUM_MG_PER_WORKOUT_MIN_BY_SWEAT.heavy * 60,
    );
  });
});

describe('recovery window (min)', () => {
  it('is null without a training level (the anchor)', () => {
    expect(recalibrateTargets(inputs()).recoveryWindowMin).toBeNull();
  });

  it('uses the training-level window plus an optional goal modifier', () => {
    const noMod = recalibrateTargets(inputs({ trainingLevel: 'Elite', primaryGoal: 'Fat Loss' }));
    expect(noMod.recoveryWindowMin).toBe(RECOVERY_WINDOW_MIN_BY_TRAINING.Elite);

    const withMod = recalibrateTargets(
      inputs({ trainingLevel: 'Elite', primaryGoal: 'Recovery Optimization' }),
    );
    expect(withMod.recoveryWindowMin).toBe(
      RECOVERY_WINDOW_MIN_BY_TRAINING.Elite +
        (GOAL_RECOVERY_WINDOW_MODIFIER_MIN['Recovery Optimization'] ?? 0),
    );
  });
});

describe('recheck interval (min)', () => {
  it('scales the base down by sweat volume, never below the floor', () => {
    const out = recalibrateTargets(inputs({ sweatClassification: 'very_heavy' }));
    expect(out.recheckIntervalMin).toBe(
      Math.max(
        RECHECK_INTERVAL_FLOOR_MIN,
        Math.round(RECHECK_INTERVAL_BASE_MIN * RECHECK_INTERVAL_SWEAT_FACTOR.very_heavy),
      ),
    );
    expect(out.recheckIntervalMin).toBeGreaterThanOrEqual(RECHECK_INTERVAL_FLOOR_MIN);
  });

  it('is the base when sweat is unset', () => {
    expect(recalibrateTargets(inputs()).recheckIntervalMin).toBe(RECHECK_INTERVAL_BASE_MIN);
  });
});

describe('environmental sensitivity', () => {
  it('is null without a sweat profile, else the configured multiplier', () => {
    expect(recalibrateTargets(inputs()).envPressureSensitivity).toBeNull();
    expect(
      recalibrateTargets(inputs({ sweatClassification: 'heavy' })).envPressureSensitivity,
    ).toBe(ENV_PRESSURE_SENSITIVITY_BY_SWEAT.heavy);
  });
});

describe('purity + identity extraction', () => {
  it('is deterministic for identical inputs', () => {
    const i = inputs({ bodyWeightLbs: 185, trainingLevel: 'Active', sweatClassification: 'moderate' });
    expect(recalibrateTargets(i)).toEqual(recalibrateTargets(i));
  });

  it('extracts the recalc inputs from a ProfileIdentity', () => {
    const i = recalibrationInputsFromIdentity({
      ...DEFAULT_PROFILE_IDENTITY,
      bodyWeightLbs: 175,
      trainingLevel: 'Advanced',
      sweatClassification: 'heavy',
      primaryGoal: 'Strength & Muscle',
      typicalWorkoutDurationMin: 75,
    });
    expect(i).toEqual({
      bodyWeightLbs: 175,
      trainingLevel: 'Advanced',
      sweatClassification: 'heavy',
      primaryGoal: 'Strength & Muscle',
      typicalWorkoutDurationMin: 75,
    });
  });

  it('clamps the surfaced sodium figure to SODIUM_CEILING_MG (BLOCK 1)', () => {
    // 500 base + 14 mg/min × 360 min (upstream input cap) = 5540 → clamped.
    const t = recalibrateTargets(inputs({
      bodyWeightLbs: 200, trainingLevel: 'Elite',
      sweatClassification: 'very_heavy', primaryGoal: 'Endurance',
      typicalWorkoutDurationMin: 360,
    }));
    expect(t.electrolyteSodiumMg).toBe(SODIUM_CEILING_MG);
  });

  it('leaves a normal sodium figure unclamped', () => {
    const t = recalibrateTargets(inputs({
      sweatClassification: 'moderate', typicalWorkoutDurationMin: 60,
    }));
    expect(t.electrolyteSodiumMg).toBe(
      SODIUM_BASE_MG + SODIUM_MG_PER_WORKOUT_MIN_BY_SWEAT.moderate * 60,
    );
    expect(t.electrolyteSodiumMg).toBeLessThan(SODIUM_CEILING_MG);
  });
});
