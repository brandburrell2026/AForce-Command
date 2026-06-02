/**
 * useSmartModes — Priority #7 wiring.
 *
 * Maps the live store slices into the PURE Smart Modes context and returns
 * the derived result. The same hook feeds both the additive home surface
 * (SmartModesBanner) and the adaptive reminder gate, so context detection
 * lives in exactly one place. No UI, no navigation, no Date.now in the
 * pure engine — only the slice → primitive mapping happens here.
 *
 * Travel is intentionally dormant (`isTravelDay: false`): the engine
 * supports it, but no time-zone / travel-day signal is wired yet.
 */
import React from 'react';

import { useUserSlice, useEngineSlice } from '@/store/slices';
import { computeHeatIndexC } from '@/utils/reminders/adaptivePolicy';
import { deriveActiveModes, type SmartModeResult } from '@/utils/modes/smartModes';

/** Freshest workout-minutes across all linked biometric providers. */
function maxWorkoutMinutes(
  biometrics: ReturnType<typeof useUserSlice>['biometrics'],
): number {
  if (!biometrics) return 0;
  let max = 0;
  for (const snap of Object.values(biometrics)) {
    const m = snap?.workoutMinutesToday;
    if (typeof m === 'number' && m > max) max = m;
  }
  return max;
}

export function useSmartModes(): SmartModeResult {
  const user = useUserSlice();
  const engine = useEngineSlice();

  return React.useMemo(
    () =>
      deriveActiveModes({
        heatIndexC: computeHeatIndexC(
          user.weatherTempC ?? null,
          user.weatherHumidity ?? null,
        ),
        workoutMinutesToday: maxWorkoutMinutes(user.biometrics),
        hydrationScore: typeof engine.score === 'number' ? engine.score : null,
        goalProgress:
          user.dailyTarget > 0 ? user.unitsConsumedToday / user.dailyTarget : 0,
        isTravelDay: false,
      }),
    [
      user.weatherTempC,
      user.weatherHumidity,
      user.biometrics,
      user.dailyTarget,
      user.unitsConsumedToday,
      engine.score,
    ],
  );
}
