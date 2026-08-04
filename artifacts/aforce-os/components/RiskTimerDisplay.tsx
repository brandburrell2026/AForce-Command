/**
 * RiskTimerDisplay — Live countdown showing urgency and time to next action.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

interface Props {
  timerSeconds: number;
  performanceState: PerformanceState;
}

export function RiskTimerDisplay({ timerSeconds, performanceState }: Props) {
  const { color, level } = performanceState;

  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const urgencyLabels: Record<string, string> = {
    PEAK: 'NEXT CHECK',
    BALANCED: 'ACT WITHIN',
    RECOVERING: 'TIME REMAINING',
    DEPLETED: 'CRITICAL — ACT NOW',
  };

  const isUrgent = level === 'DEPLETED' || (level === 'RECOVERING' && minutes < 5);

  // RC-1 fix (P0 a11y, safety surface): this countdown had no accessible
  // grouping at all — a screen reader read the label, the digits, and the
  // "URGENT" badge as three disconnected fragments, and a live countdown
  // updating every second was never announced. Composed label + a polite
  // live region on the group (not assertive — a per-second announcement
  // would be unusable) let a screen-reader user hear the current state
  // without altering the visible timer logic or copy below.
  const timerLabel = urgencyLabels[level] ?? 'NEXT CHECK';
  const composedLabel = isUrgent
    ? `${timerLabel}. ${display}. URGENT.`
    : `${timerLabel}. ${display}.`;

  return (
    <View
      style={[styles.container, { borderColor: `${color}22` }]}
      accessible
      accessibilityLabel={composedLabel}
      accessibilityLiveRegion="polite"
      testID="risk-timer-display"
    >
      <Text style={[styles.label, { color: Colors.text.muted }]}>
        {urgencyLabels[level] ?? 'NEXT CHECK'}
      </Text>
      <Text
        style={[
          styles.timerText,
          { color: isUrgent ? color : Colors.text.primary },
        ]}
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
      >
        {display}
      </Text>
      {isUrgent && (
        <View style={[styles.urgentBadge, { backgroundColor: `${color}20`, borderColor: `${color}44` }]}>
          <Text style={[styles.urgentText, { color }]}>URGENT</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    marginHorizontal: 20,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  timerText: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  urgentBadge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  urgentText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});
