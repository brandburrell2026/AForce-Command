/**
 * useMetabolicReadiness — the single hook-friendly selector for the
 * Metabolic Readiness surface.
 *
 * Reads ONLY already-derived engine outputs + the biometrics path and
 * folds them through `deriveMetabolicReadiness`. It dispatches nothing and
 * persists nothing, so consuming it can never affect a hydration point,
 * performance band, or recovery score (Score Protection).
 *
 * `health_canonical_consumers` (W3.2): when ON, sleep/HRV/workout minutes
 * are read via `services/health/healthSignalsFromStore` (the frozen
 * `resolveHealthSignals` contract — priority-ladder + freshness, method-
 * preserved HRV, never a raw provider read) instead of the legacy
 * freshest-wins selectors. When OFF, behavior is byte-identical to before
 * this flag existed: the legacy selectors run unchanged. `strain` has no
 * canonical general equivalent (WHOOP strain is provider-attributed only,
 * see `healthSignalsFromStore`'s doc) and stays on the legacy selector in
 * BOTH flag states.
 */
import React from 'react';

import { useEngineSlice, useUserSlice, useFlagsSlice } from '@/store/slices';
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
import {
  healthSignalsFromStore,
  canonicalReadinessSignals,
} from '@/services/health/healthSignalsFromStore';

export function useMetabolicReadiness(): MetabolicReadinessSnapshot {
  const user = useUserSlice();
  const engine = useEngineSlice();
  const flags = useFlagsSlice();

  return React.useMemo(() => {
    const recovery = deriveRecoverySnapshot(
      recoveryInputsFromState(user, engine),
    ).recovery;
    const nowMs = Date.now();

    let sleepHours: number | null;
    let hrvMs: number | null;
    let workoutMinutes: number | null;
    if (flags.health_canonical_consumers) {
      const canonical = canonicalReadinessSignals(
        healthSignalsFromStore({ biometrics: user.biometrics, nowMs }),
      );
      sleepHours = canonical.sleepHours;
      hrvMs = canonical.hrvMs;
      workoutMinutes = canonical.workoutMinutes;
    } else {
      const sleep = selectFreshestSleepHours(user.biometrics);
      sleepHours = sleep ? sleep.hours : null;
      hrvMs = selectFreshestHrvMs(user.biometrics);
      workoutMinutes = selectMaxWorkoutMinutes(user.biometrics);
    }

    return deriveMetabolicReadiness({
      hydrationScore: typeof engine.score === 'number' ? engine.score : null,
      recoveryCapacity: typeof recovery === 'number' ? recovery : null,
      sleepHours,
      hrvMs,
      workoutMinutes,
      // No canonical general equivalent — always legacy (see file header).
      strain: selectMaxStrain(user.biometrics),
      nowMs,
    });
  }, [user, engine, flags.health_canonical_consumers]);
}
