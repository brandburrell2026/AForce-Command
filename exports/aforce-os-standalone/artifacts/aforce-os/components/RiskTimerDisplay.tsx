/**
 * RiskTimerDisplay — Live countdown showing urgency and time to next action.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';

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

  return (
    <View style={[styles.container, { borderColor: `${color}22` }]}>
      <Text style={[styles.label, { color: Colors.text.muted }]}>
        {urgencyLabels[level] ?? 'NEXT CHECK'}
      </Text>
      <Text style={[
        styles.timerText,
        { color: isUrgent ? color : Colors.text.primary },
      ]}>
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
