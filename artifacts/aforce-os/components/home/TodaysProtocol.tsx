/**
 * TodaysProtocol — three time-of-day protocol blocks (Morning / Midday
 * / Evening) tied to real intake progression toward the daily target
 * (see deriveTodaysProtocol in utils/homeDashboard). A block checks off
 * only when the underlying intake is on record — nothing is fabricated.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import type { ProtocolBlockView, ProtocolBlockId } from '@/utils/homeDashboard';

const BRAND = Colors.accent.brand;

const PERIOD_ICON: Record<ProtocolBlockId, IconName> = {
  morning: 'sunrise',
  midday: 'sun',
  evening: 'moon',
};

interface Props {
  blocks: ProtocolBlockView[];
}

export function TodaysProtocol({ blocks }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>TODAY&apos;S PROTOCOL</Text>
      <View style={styles.list}>
        {blocks.map((b) => (
          <View key={b.id} style={styles.row}>
            <View style={styles.iconWrap}>
              <Icon name={PERIOD_ICON[b.id]} size={16} color={Colors.text.secondary} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.period}>{b.period}</Text>
              <Text style={styles.label}>{b.label}</Text>
            </View>
            <View style={[styles.check, b.complete && styles.checkOn]}>
              {b.complete && <Icon name="check" size={13} color="#000000" />}
            </View>
          </View>
        ))}
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
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: BRAND,
    marginBottom: 6,
  },
  list: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 14,
  },
  meta: { flex: 1 },
  period: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.6,
    color: Colors.text.muted,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.text.primary,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  checkOn: { backgroundColor: BRAND, borderColor: BRAND },
});
