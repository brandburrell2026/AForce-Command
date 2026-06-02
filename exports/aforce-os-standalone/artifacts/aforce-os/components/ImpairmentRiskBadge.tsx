/**
 * ImpairmentRiskBadge — 5-level impairment pill (LOW / ELEVATED /
 * MODERATE / HIGH / CRITICAL). Mirrors the HangoverRiskBadge pattern
 * but with the 5 safety states from the Social Mode spec.
 *
 * Color escalates from teal → amber → crimson so a glance maps cleanly
 * to "is this worse than last time".
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ImpairmentRiskLevel, ImpairmentRiskState } from '../types';

interface Props {
  impairment: ImpairmentRiskState;
  showBac?: boolean;
}

const COLOR: Record<ImpairmentRiskLevel, string> = {
  LOW:      '#7CFB9D',
  ELEVATED: '#9DD6FB',
  MODERATE: '#F4B23F',
  HIGH:     '#FB7C7C',
  CRITICAL: '#E63946',
};

export function ImpairmentRiskBadge({ impairment, showBac = false }: Props) {
  const { t } = useTranslation();
  const color = COLOR[impairment.level];
  const label = t(`social.impairment_${impairment.level.toLowerCase()}`);

  return (
    <View
      style={[styles.badge, { borderColor: `${color}66`, backgroundColor: `${color}1A` }]}
      accessibilityRole="text"
      accessibilityLabel={`${t('social.impairment_label')}: ${label}`}
      testID="impairment-risk-badge"
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
      {showBac && impairment.bacMidpoint > 0 && (
        <Text style={[styles.bac, { color }]}>{impairment.bacMidpoint.toFixed(2)}</Text>
      )}
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
  bac: { fontSize: 11, fontFamily: 'Inter_700Bold', opacity: 0.7, marginLeft: 2 },
});
