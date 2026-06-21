/**
 * useSmartModes — Priority #7 wiring.
 *
 * Maps the live store slices into the PURE Smart Modes context and returns
 * the derived result. The same hook feeds both the additive home surface
 * (SmartModesBanner) and the adaptive reminder gate, so context detection
 * lives in exactly one place. No UI, no navigation, no Date.now in the
 * pure engine — only the slice → primitive mapping happens here.
 *
 * Travel is wired through Location Intelligence™: when
 * `location_intelligence_enabled` is OFF the travel signal is inert
 * (`isTravelDay: false`) so behavior is byte-identical; when ON, a real
 * distance / time-zone change (e.g. Miami → NYC) flips it on, lighting up
 * Travel Mode.
 */
import React from 'react';

import { useUserSlice, useEngineSlice } from '@/store/slices';
import { computeHeatIndexC } from '@/utils/reminders/adaptivePolicy';
import { deriveActiveModes, type SmartModeResult } from '@/utils/modes/smartModes';
import { useLocationIntelligence } from '@/hooks/useLocationIntelligence';

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
  // Inert (isTraveling=false) until `location_intelligence_enabled` is ON.
  const location = useLocationIntelligence();
  // No-fabrication guard: only a LIVE snapshot may flip Travel Mode. The
  // service already returns an inert travel signal for mock snapshots, but
  // we re-assert `source === 'live'` here so a future service regression can
  // never silently let the synthetic, day-rotated mock light up the Travel
  // Protocol from movement the user never made (Score-Protection posture).
  const isTravelDay = location.source === 'live' && location.travel.isTraveling;

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
        isTravelDay,
      }),
    [
      user.weatherTempC,
      user.weatherHumidity,
      user.biometrics,
      user.dailyTarget,
      user.unitsConsumedToday,
      engine.score,
      isTravelDay,
    ],
  );
}
