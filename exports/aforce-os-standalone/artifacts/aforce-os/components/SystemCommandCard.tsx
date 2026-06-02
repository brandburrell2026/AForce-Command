/**
 * SystemCommandCard — The primary behavior driver.
 * Shows one decisive command with urgency indicator.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import type { Command, PerformanceState } from '../types';
import { Colors } from '../theme/colors';

interface Props {
  command: Command;
  performanceState: PerformanceState;
}

const URGENCY_ICONS: Record<string, IconName> = {
  low: 'check-circle',
  medium: 'zap',
  high: 'alert-triangle',
  critical: 'alert-octagon',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'ON TRACK',
  medium: 'ACT NOW',
  high: 'HIGH PRIORITY',
  critical: 'CRITICAL',
};

export function SystemCommandCard({ command, performanceState }: Props) {
  const { color } = performanceState;
  const urgencyIcon = URGENCY_ICONS[command.urgencyLevel] ?? 'zap';
  const urgencyLabel = URGENCY_LABELS[command.urgencyLevel] ?? 'ACT NOW';

  return (
    <View style={[
      styles.container,
      { borderColor: `${color}30` },
    ]}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionLabel}>SYSTEM COMMAND</Text>
        </View>
        <View style={[styles.urgencyBadge, { backgroundColor: `${color}20`, borderColor: `${color}44` }]}>
          <Icon name={urgencyIcon} size={10} color={color} />
          <Text style={[styles.urgencyLabel, { color }]}>{urgencyLabel}</Text>
        </View>
      </View>

      {/* Command action */}
      <Text style={[styles.commandText, { color: Colors.text.primary }]}>
        {command.action}
      </Text>

      {/* Explanation */}
      <Text style={styles.explanation}>{command.explanation}</Text>

      {/* Impact */}
      <View style={styles.impactRow}>
        <Icon name="trending-up" size={12} color={color} />
        <Text style={[styles.impactText, { color }]}>Projected impact: {command.estimatedImpact}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  urgencyLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  commandText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    lineHeight: 24,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  explanation: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  impactText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
});
