/**
 * StreakCard — the real compliance streak (userState.complianceStreak)
 * rendered as a single hero number. Pure presentation; the value is
 * passed in from the store, never computed or inflated here.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import { AFStatPair } from '@/components/ui/AFStatPair';

const BRAND = Colors.accent.brand;

interface Props {
  streakDays: number;
}

export function StreakCard({ streakDays }: Props) {
  const days = Math.max(0, Math.floor(streakDays));
  const caption =
    days > 0 ? 'Consistency creates performance' : 'Log an intake to start your streak';
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Icon name="zap" size={20} color={BRAND} />
      </View>
      <View style={styles.body}>
        <AFStatPair
          value={days}
          label="DAY STREAK"
          reverseOrder
          style={styles.numRow}
          valueStyle={styles.num}
          labelStyle={styles.unit}
          testID="streak-days"
        />
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.brandDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent.brandGlow,
    marginRight: 16,
  },
  body: { flex: 1 },
  numRow: { flexDirection: 'row', alignItems: 'baseline' },
  num: {
    fontFamily: 'Inter_700Bold',
    fontSize: 34,
    color: Colors.text.primary,
    letterSpacing: -1,
  },
  unit: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.text.muted,
    marginLeft: 10,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: Colors.text.secondary,
    marginTop: 2,
  },
});
