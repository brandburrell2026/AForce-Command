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
import type { Command, PerformanceState, CommandConfidenceLevel } from '../types';
import { Colors } from '../theme/colors';
import i18n from '../services/i18nService';

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

// Command Confidence™ — localized label + a monochrome opacity ramp so the
// chip reads as "how sure the system is" without colliding with the urgency
// band colour or the WHOOP recovery palette.
const CONFIDENCE_LABEL_KEYS: Record<CommandConfidenceLevel, string> = {
  high: 'coach.confidence_high',
  medium: 'coach.confidence_medium',
  low: 'coach.confidence_low',
};

const CONFIDENCE_OPACITY: Record<CommandConfidenceLevel, number> = {
  high: 1,
  medium: 0.7,
  low: 0.45,
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
        <View style={styles.headerLeft}>
          <Text style={styles.sectionLabel}>AFORCE COMMAND</Text>
          {command.confidence ? (
            <View
              style={styles.confidenceRow}
              accessibilityLabel={i18n.t(CONFIDENCE_LABEL_KEYS[command.confidence])}
            >
              <View style={[styles.confidenceDot, { opacity: CONFIDENCE_OPACITY[command.confidence] }]} />
              <Text style={[styles.confidenceLabel, { opacity: CONFIDENCE_OPACITY[command.confidence] }]}>
                {i18n.t(CONFIDENCE_LABEL_KEYS[command.confidence])}
              </Text>
            </View>
          ) : null}
        </View>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexShrink: 1,
    gap: 6,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  confidenceDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: Colors.text.secondary,
  },
  confidenceLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
    letterSpacing: 1.2,
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
