/**
 * PhantomSignal — Mock contextual data strip showing environmental signals.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { phantomSignalData } from '../data/mockData';

export function PhantomSignal() {
  const { estimatedCoreTemp, activityLabel, hrv, vo2Estimate } = phantomSignalData;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PHANTOM SIGNAL</Text>
      <View style={styles.grid}>
        <SignalItem icon="thermometer" label="CORE TEMP" value={`${estimatedCoreTemp.toFixed(1)}°F`} />
        <SignalItem icon="wind" label="HRV" value={`${hrv} ms`} />
        <SignalItem icon="activity" label="VO₂ EST" value={`${vo2Estimate}`} />
        <SignalItem icon="zap" label="MODE" value={activityLabel} />
      </View>
    </View>
  );
}

function SignalItem({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.item}>
      <Feather name={icon} size={12} color={Colors.text.muted} />
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: Colors.fill.light,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  title: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    gap: 4,
  },
  itemLabel: {
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 1.5,
  },
  itemValue: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
  },
});
