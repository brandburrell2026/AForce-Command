/**
 * AthleteModeCard — progress toward the next consistency milestone,
 * derived purely from the real compliance streak (see deriveAthleteMode
 * in utils/homeDashboard). The bar reflects actual streak days against
 * the active milestone tier; it cannot be advanced without real days.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import type { AthleteModeView } from '@/utils/homeDashboard';

const BRAND = Colors.accent.brand;

interface Props {
  mode: AthleteModeView;
}

export function AthleteModeCard({ mode }: Props) {
  const pct = Math.round(mode.progress * 100);
  const remaining = mode.achievedTop
    ? 'Top milestone reached'
    : `${mode.daysRemaining} ${mode.daysRemaining === 1 ? 'day' : 'days'} remaining`;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Icon name="activity" size={15} color={BRAND} />
          <Text style={styles.title}>ATHLETE MODE</Text>
        </View>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.foot}>
        <Text style={styles.sub}>
          {mode.streakDays}-day streak · target {mode.milestoneDays}
        </Text>
        <Text style={styles.remaining}>{remaining}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: BRAND,
  },
  pct: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: BRAND,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.text.muted,
  },
  remaining: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.text.secondary,
  },
});
