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
import { Colors } from '@/theme/colors';

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
      ? Colors.states.PEAK.primary
      : trend === 'down'
        ? Colors.states.RECOVERING.primary
        : Colors.text.muted;
  return (
    <View style={[styles.card, { borderColor: `${accent}14` }]}>
      <View style={[styles.glow, { backgroundColor: `${accent}05` }]} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accent }]}>{value}</Text>
        {trend && delta != null && (
          <View style={[styles.trendChip, { borderColor: `${trendColor}40` }]}>
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
    gap: 10,
    marginBottom: 18,
  },
  card: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
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
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
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
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
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
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    letterSpacing: -0.1,
  },
});
