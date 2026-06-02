/**
 * AICommandCard — Performance Decision Engine output.
 * Format: WHAT to do + WHEN/HOW MUCH + OUTCOME. Command authority. No chatbot phrasing.
 *
 * NOTE: AI coaching voice (auto-speak + HEAR IT button) was removed
 * per user request. The textToSpeech service module is preserved for
 * any future re-enablement, but is no longer invoked from this card.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import type { Command, PerformanceState } from '../types';
import { Colors } from '../theme/colors';

interface Props {
  command: Command;
  performanceState: PerformanceState;
  /**
   * Optional accent override. When the home screen is tweening the
   * displayed score through bands, the parent passes the displayed
   * (in-flight) accent here so this card recolours on the same frame
   * the orb digit changes — instead of flipping instantly to the
   * engine's target band while the score is still rolling.
   */
  accentOverride?: string;
  /**
   * When true, the card renders without its own outer chrome (no
   * margin, no border, no background) so it can sit inside a parent
   * card. Used by CommandConsole to fuse the AI Coach + Voice Engine
   * into a single visual block.
   */
  embedded?: boolean;
}

const URGENCY_ICONS: Record<string, IconName> = {
  low: 'check-circle',
  medium: 'zap',
  high: 'alert-triangle',
  critical: 'alert-octagon',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'HOLD THE LINE',
  medium: 'ACT NOW',
  high: 'HIGH PRIORITY',
  critical: 'CRITICAL',
};

export function AICommandCard({ command, performanceState, accentOverride, embedded = false }: Props) {
  const color = accentOverride ?? performanceState.color;
  const icon = URGENCY_ICONS[command.urgencyLevel] ?? 'zap';
  const label = URGENCY_LABELS[command.urgencyLevel] ?? 'ACT NOW';

  return (
    <View
      style={[
        embedded ? styles.containerEmbedded : styles.container,
        !embedded && { borderColor: `${color}30` },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>AFORCE COMMAND</Text>
        <View style={styles.headerRight}>
          <View style={[styles.urgencyBadge, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
            <Icon name={icon} size={10} color={color} />
            <Text style={[styles.urgencyLabel, { color }]}>{label}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.commandText, { color: Colors.text.primary }]}>
        {command.action}
      </Text>

      <Text style={styles.explanation}>{command.explanation}</Text>

      <View style={[styles.impactRow, { borderTopColor: Colors.border.subtle }]}>
        <Icon name="trending-up" size={12} color={color} />
        <Text style={[styles.impactText, { color }]}>Projected: {command.estimatedImpact}</Text>
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
  containerEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    lineHeight: 25,
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
  },
  impactText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
});
