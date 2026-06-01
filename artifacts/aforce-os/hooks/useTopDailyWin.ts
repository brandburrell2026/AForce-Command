/**
 * useTopDailyWin — shared derivation of the single most meaningful
 * Daily Win from live store state.
 *
 * Extracted so both the visible surface (DailyWinBanner) and the
 * internal analytics recorder read the SAME win from one place — the
 * win the user sees is exactly the win analytics records.
 */
import React from 'react';

import { useEngineSlice, useUserSlice } from '@/store/slices';
import { topDailyWin, type DailyWin } from '@/utils/dailyWins';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';

/** Engine ignores ±3 correction confirmations older than 30 minutes. */
const CORRECTION_FRESH_MS = 30 * 60 * 1000;

export function useTopDailyWin(): DailyWin | null {
  const engine = useEngineSlice();
  const userState = useUserSlice();

  return React.useMemo(() => {
    const snapshot = deriveRecoverySnapshot(
      recoveryInputsFromState(userState, engine),
    );

    const setAt = userState.confirmationDeltaSetAt;
    const setMs =
      setAt instanceof Date
        ? setAt.getTime()
        : setAt
          ? new Date(setAt as unknown as string).getTime()
          : NaN;
    const correctionCompleted =
      (userState.confirmationDelta ?? 0) > 0 &&
      Number.isFinite(setMs) &&
      Date.now() - setMs <= CORRECTION_FRESH_MS;

    return topDailyWin({
      complianceStreak: userState.complianceStreak,
      unitsConsumedToday: userState.unitsConsumedToday,
      dailyTarget: userState.dailyTarget,
      ozConsumedToday: userState.ozConsumedToday,
      ozTarget: userState.ozTarget,
      correctionCompleted,
      recoveryTrend: snapshot.trend,
      recovery: snapshot.recovery,
    });
  }, [userState, engine]);
}
