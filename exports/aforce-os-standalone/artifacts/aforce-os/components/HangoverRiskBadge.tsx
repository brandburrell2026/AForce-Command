/**
 * HangoverRiskBadge — Pill showing the current Hangover Risk level.
 * Color is mapped from the engine band so the badge visually escalates
 * without the parent having to know the color rules.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/colors';
import type { HangoverRisk, HangoverRiskLevel } from '../types';

interface Props {
  risk: HangoverRisk;
  /** When true, render the numeric score next to the level label. */
  showScore?: boolean;
}

const COLOR_FOR_LEVEL: Record<HangoverRiskLevel, string> = {
  LOW: Colors.states.PEAK.primary,
  MODERATE: Colors.states.BALANCED.primary,
  HIGH: Colors.states.RECOVERING.primary,
  CRITICAL: Colors.states.DEPLETED.primary,
};

export function HangoverRiskBadge({ risk, showScore = false }: Props) {
  const { t } = useTranslation();
  const color = COLOR_FOR_LEVEL[risk.level];
  const label = t(`social.risk_${risk.level.toLowerCase()}`);
  return (
    <View
      style={[styles.badge, { borderColor: `${color}66`, backgroundColor: `${color}1A` }]}
      accessibilityRole="text"
      accessibilityLabel={`${t('social.hangover_risk')}: ${label}`}
      testID="hangover-risk-badge"
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
      {showScore && <Text style={[styles.score, { color }]}>{risk.score}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  score: { fontSize: 11, fontFamily: 'Inter_700Bold', opacity: 0.7, marginLeft: 2 },
});
