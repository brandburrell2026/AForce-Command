/**
 * MembershipCard — the user's real subscription tier (plan name +
 * status from the Stripe-backed entitlement store) with progress along
 * the tier ladder, plus their real community rank. Points / Challenges
 * / Referrals have no real data source yet, so they render as clearly
 * labelled "SOON" preview tiles rather than fabricated numbers.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';

const BRAND = Colors.accent.brand;

interface MembershipStat {
  label: string;
  value: string;
  preview?: boolean;
}

interface Props {
  planName: string;
  statusLabel: string;
  tierIndex: number;
  tierCount: number;
  communityRank: number | null;
}

export function MembershipCard({
  planName,
  statusLabel,
  tierIndex,
  tierCount,
  communityRank,
}: Props) {
  const pct = tierCount > 0 ? Math.round(((tierIndex + 1) / tierCount) * 100) : 0;
  const stats: MembershipStat[] = [
    {
      label: 'COMMUNITY RANK',
      value: communityRank != null ? `#${communityRank.toLocaleString()}` : '—',
    },
    { label: 'POINTS', value: 'SOON', preview: true },
    { label: 'CHALLENGES', value: 'SOON', preview: true },
    { label: 'REFERRALS', value: 'SOON', preview: true },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Icon name="crown" size={15} color={BRAND} />
          <Text style={styles.title}>MEMBERSHIP</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.plan}>{planName}</Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.tierMeta}>
        Tier {tierIndex + 1} of {tierCount}
      </Text>

      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCell}>
            <Text style={[styles.statValue, s.preview && styles.statValuePreview]}>
              {s.value}
            </Text>
            <Text style={styles.statLabel}>{s.label}</Text>
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: BRAND,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent.brandGlow,
    backgroundColor: Colors.accent.brandDim,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: Colors.text.primary,
  },
  plan: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.text.primary,
    letterSpacing: -0.4,
    marginTop: 12,
    marginBottom: 14,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: BRAND },
  tierMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginHorizontal: -6,
  },
  statCell: {
    width: '50%',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  statValuePreview: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.32)',
  },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.6,
    color: Colors.text.muted,
    marginTop: 4,
  },
});
