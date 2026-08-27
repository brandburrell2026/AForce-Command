/**
 * SystemSignalLine — single condensed line of body + environment signals.
 *
 * Replaces the standalone PhantomSignal grid + LiveStatusStrip metrics. The
 * brief is "Core temp · HRV · Mode · Status" with one short interpretation
 * line beneath it. No card chrome — just two text lines.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { phantomSignalData } from '../data/mockData';
import type { PerformanceLevel } from '../types';

interface Props {
  performanceLevel: PerformanceLevel;
}

/** Map performance level → one-line interpretive verdict. */
function interpretation(level: PerformanceLevel): string {
  switch (level) {
    case 'PEAK':       return 'Stable for high-intensity training';
    case 'BALANCED':   return 'Stable for light training';
    case 'RECOVERING': return 'Hold pace — recovery in progress';
    case 'DEPLETED':   return 'Reduce load until hydration restores';
    default:           return 'Monitoring';
  }
}

export function SystemSignalLine({ performanceLevel }: Props) {
  const { estimatedCoreTemp, hrv, activityLabel } = phantomSignalData;
  const parts = [
    `${estimatedCoreTemp.toFixed(1)}°F`,
    `HRV ${hrv}`,
    activityLabel,
    performanceLevel,
  ];

  return (
    <View style={styles.container} testID="system-signal-line">
      <Text style={styles.line} numberOfLines={1}>
        {parts.join('  ·  ')}
      </Text>
      <Text style={styles.interpretation} numberOfLines={1}>
        {interpretation(performanceLevel)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  line: {
    color: Colors.text.secondary,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '600',
  },
  interpretation: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 0.4,
    fontStyle: 'italic',
  },
});

export default SystemSignalLine;
