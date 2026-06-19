/**
 * usePerformanceAge — the single hook-friendly selector for the
 * Performance Age surface.
 *
 * Reads ONLY already-derived engine outputs, the biometrics path, the
 * profile identity, and the internal analytics metrics, then folds them
 * through `derivePerformanceAge`. It dispatches nothing and persists
 * nothing, so consuming it can never affect a hydration point, performance
 * band, or recovery score (Score Protection).
 *
 * The analytics-derived signals (compliance streak + active days) load
 * asynchronously from storage with safe defaults (streak unknown, 0 active
 * days), so a brand-new session simply reads "provisional" until they land
 * — never a wrong number. The daily snapshot history is empty for now, so
 * the weekly/monthly trends report "collecting…" rather than a fabricated
 * slope (a persisted snapshot series is a follow-up).
 */
import React from 'react';

import { useEngineSlice, useUserSlice, useProfileIdentitySlice } from '@/store/slices';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';
import { selectFreshestSleepHours } from '@/services/profileBodyModel';
import {
  selectMaxWorkoutMinutes,
  selectMaxStrain,
} from '@/services/metabolicReadinessService';
import { ageFromBirthYear } from '@/utils/profileIdentity';
import { getAnalyticsMetrics } from '@/services/analytics';
import {
  derivePerformanceAge,
  type PerformanceAgeSnapshot,
} from '@/services/performanceAgeService';

export function usePerformanceAge(): PerformanceAgeSnapshot {
  const user = useUserSlice();
  const engine = useEngineSlice();
  const profile = useProfileIdentitySlice();

  const [activeDays, setActiveDays] = React.useState(0);
  const [complianceStreak, setComplianceStreak] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getAnalyticsMetrics().then((m) => {
      if (cancelled) return;
      setActiveDays(m.retention.activeDays);
      setComplianceStreak(m.streak.current);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return React.useMemo(() => {
    const recovery = deriveRecoverySnapshot(
      recoveryInputsFromState(user, engine),
    ).recovery;
    const sleep = selectFreshestSleepHours(user.biometrics);

    return derivePerformanceAge({
      actualAge: ageFromBirthYear(profile.birthYear),
      recoveryCapacity: typeof recovery === 'number' ? recovery : null,
      sleepHours: sleep ? sleep.hours : null,
      workoutMinutes: selectMaxWorkoutMinutes(user.biometrics),
      strain: selectMaxStrain(user.biometrics),
      activityLevel: profile.activityLevel,
      complianceStreak,
      activeDays,
      dailySnapshots: [],
      nowMs: Date.now(),
    });
  }, [user, engine, profile, activeDays, complianceStreak]);
}
