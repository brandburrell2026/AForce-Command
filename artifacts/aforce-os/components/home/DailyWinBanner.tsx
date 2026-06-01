/**
 * DailyWinBanner — Priority #3 (Daily Wins Engine) surface.
 *
 * A single, quiet, one-line positive reinforcement at the top of the
 * home screen. It shows only the most meaningful win (`useTopDailyWin`).
 * When there is nothing to celebrate yet it renders nothing — never a
 * guilt or penalty message.
 *
 * No new screen, tab, or navigation: it slots in beside the existing
 * NotificationBanner. No feature flag — wins are part of the core
 * experience and self-hide when none are earned.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useTopDailyWin } from '@/hooks/useTopDailyWin';

export function DailyWinBanner() {
  const win = useTopDailyWin();

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
