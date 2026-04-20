/**
 * LiveStatusStrip — Top status bar showing live contextual signals.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';
import { phantomSignalData } from '../data/mockData';

interface Props {
  performanceState: PerformanceState;
  unitsToday: number;
  dailyTarget: number;
}

export function LiveStatusStrip({ performanceState, unitsToday, dailyTarget }: Props) {
  const { color } = performanceState;
  const { heartRateBPM, ambientTempF, activityLabel, lastSyncLabel } = phantomSignalData;

  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>LIVE</Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Feather name="activity" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{heartRateBPM} bpm</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.metric}>
          <Feather name="thermometer" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{ambientTempF}°F</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.metric}>
          <Text style={styles.metricText}>{unitsToday}/{dailyTarget} units</Text>
        </View>
      </View>

      <Text style={styles.syncText}>{lastSyncLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.fill.light,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border.subtle,
  },
  syncText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
});
