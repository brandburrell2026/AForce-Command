/**
 * DailyWinBanner — Priority #3 (Daily Wins Engine) surface.
 *
 * A single, quiet, one-line positive reinforcement at the top of the
 * home screen. It reads the live slices, derives the recovery snapshot,
 * and shows only the most meaningful win (`topDailyWin`). When there is
 * nothing to celebrate yet it renders nothing — never a guilt or
 * penalty message.
 *
 * No new screen, tab, or navigation: it slots in beside the existing
 * NotificationBanner. No feature flag — wins are part of the core
 * experience and self-hide when none are earned.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useEngineSlice, useUserSlice } from '@/store/slices';
import { topDailyWin } from '@/utils/dailyWins';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';

/** Engine ignores ±3 correction confirmations older than 30 minutes. */
const CORRECTION_FRESH_MS = 30 * 60 * 1000;

export function DailyWinBanner() {
  const engine = useEngineSlice();
  const userState = useUserSlice();

  const win = React.useMemo(() => {
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

  if (!win) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card} testID="daily-win-banner">
        <Icon name="check-circle" size={16} color={Colors.accent.primary} />
        <Text style={styles.text} numberOfLines={1}>
          {win.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.accent.primary}40`,
    backgroundColor: `${Colors.accent.primary}10`,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
});
