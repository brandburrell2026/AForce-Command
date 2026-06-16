/**
 * useMetabolicReadiness — the single hook-friendly selector for the
 * Metabolic Readiness surface.
 *
 * Reads ONLY already-derived engine outputs + the biometrics path and
 * folds them through `deriveMetabolicReadiness`. It dispatches nothing and
 * persists nothing, so consuming it can never affect a hydration point,
 * performance band, or recovery score (Score Protection).
 */
import React from 'react';

import { useEngineSlice, useUserSlice } from '@/store/slices';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';
import { selectFreshestSleepHours } from '@/services/profileBodyModel';
import {
  deriveMetabolicReadiness,
  selectFreshestHrvMs,
  selectMaxWorkoutMinutes,
  selectMaxStrain,
  type MetabolicReadinessSnapshot,
} from '@/services/metabolicReadinessService';

export function useMetabolicReadiness(): MetabolicReadinessSnapshot {
  const user = useUserSlice();
  const engine = useEngineSlice();

  return React.useMemo(() => {
    const recovery = deriveRecoverySnapshot(
      recoveryInputsFromState(user, engine),
    ).recovery;
    const sleep = selectFreshestSleepHours(user.biometrics);

    return deriveMetabolicReadiness({
      hydrationScore: typeof engine.score === 'number' ? engine.score : null,
      recoveryCapacity: typeof recovery === 'number' ? recovery : null,
      sleepHours: sleep ? sleep.hours : null,
      hrvMs: selectFreshestHrvMs(user.biometrics),
      workoutMinutes: selectMaxWorkoutMinutes(user.biometrics),
      strain: selectMaxStrain(user.biometrics),
      nowMs: Date.now(),
    });
  }, [user, engine]);
}
