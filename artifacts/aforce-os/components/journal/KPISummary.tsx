/**
 * KPISummary — three glassmorphism metric cards rendered side-by-side.
 *
 * Each card shows a label, a large value, and a tiny trend chip
 * (▲ / ▼ / —) when a delta is provided. Subtle gradient border + soft
 * glow color tuned to the metric.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { af, afType, afAlpha, withAlpha, Typography } from '@/theme';

interface KPI {
  label: string;
  value: string;
  /** Color used for value + glow border. */
  accent: string;
  /** Optional trend delta — positive shows ▲, negative ▼, omit for —. */
  delta?: number | null;
  /** Custom suffix on the delta (e.g. "%", "d"). */
  deltaSuffix?: string;
}

interface Props {
  kpis: [KPI, KPI, KPI];
}

export default function KPISummary({ kpis }: Props) {
  return (
    <View style={styles.row}>
      {kpis.map((k) => (
        <KPICard key={k.label} kpi={k} />
      ))}
    </View>
  );
}

function KPICard({ kpi }: { kpi: KPI }) {
  const { label, value, accent, delta, deltaSuffix = '' } = kpi;
  const trend = delta == null || delta === 0 ? null : delta > 0 ? 'up' : 'down';
  const trendColor =
    trend === 'up'
      ? af.green // byte-identical: af.green === Colors.states.PEAK.primary
      : trend === 'down'
        ? af.amber // byte-identical: af.amber === Colors.states.RECOVERING.primary
        : af.textTertiary;
  return (
    <View style={[styles.card, { borderColor: withAlpha(accent, 0.03) }]}>
      <View style={[styles.glow, { backgroundColor: withAlpha(accent, 0.012) }]} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accent }]}>{value}</Text>
        {trend && delta != null && (
          <View style={[styles.trendChip, { borderColor: withAlpha(trendColor, afAlpha.a24) }]}>
            <Icon
              name={trend === 'up' ? 'trending-up' : 'trending-down'}
              size={10}
              color={trendColor}
            />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {trend === 'up' ? '+' : ''}{delta}{deltaSuffix}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(af.textPrimary, 0.012),
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    left: -50,
    top: -60,
  },
  label: {
    ...afType.tab,
    color: af.textTertiary,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  value: {
    ...afType.title3,
    fontFamily: Typography.fonts.bold,
    letterSpacing: -0.6,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
  },
  trendText: {
    ...afType.tab,
    letterSpacing: -0.1,
  },
});
