/**
 * HydrationStatusCard — a circular hydration-completion ring (percent
 * of daily target) paired with three live read-outs: Water intake,
 * Electrolytes logged, and engine-derived Recovery state. Every value
 * is a projection of real logged behaviour — the ring never advances on
 * its own (see hydrationPercent in utils/homeDashboard).
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';

const BRAND = Colors.accent.brand;

interface Props {
  percent: number;
  water: string;
  electrolytes: string;
  recovery: string;
  /** Opens the HydroScan flow. When omitted the button is hidden. */
  onScan?: () => void;
}

const SIZE = 88;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function HydrationStatusCard({ percent, water, electrolytes, recovery, onScan }: Props) {
  const pct = Math.min(100, Math.max(0, percent));
  const offset = CIRC * (1 - pct / 100);
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>HYDRATION STATUS</Text>
      <View style={styles.body}>
        <View style={styles.ringWrap}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={STROKE}
              fill="none"
            />
            <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={BRAND}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${CIRC}, ${CIRC}`}
                strokeDashoffset={offset}
                fill="none"
              />
            </G>
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringPct}>{pct}</Text>
            <Text style={styles.ringUnit}>%</Text>
          </View>
        </View>
        <View style={styles.stats}>
          <StatRow label="WATER" value={water} />
          <View style={styles.statDivider} />
          <StatRow label="ELECTROLYTES" value={electrolytes} />
          <View style={styles.statDivider} />
          <StatRow label="RECOVERY" value={recovery} />
        </View>
      </View>
      {onScan ? (
        <TouchableOpacity
          onPress={onScan}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open HydroScan to scan a drink"
          testID="home-hydroscan-button"
          style={styles.scanBtn}
        >
          <Icon name="camera" size={16} color={BRAND} />
          <Text style={styles.scanBtnText}>SCAN A DRINK</Text>
        </TouchableOpacity>
      ) : null}
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
    marginBottom: 16,
  },
  body: { flexDirection: 'row', alignItems: 'center' },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 22,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  ringPct: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.text.primary,
    letterSpacing: -0.8,
  },
  ringUnit: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.text.muted,
    marginLeft: 1,
  },
  stats: { flex: 1 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.6,
    color: Colors.text.muted,
  },
  statValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  statDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 11,
  },
  scanBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.accent.brandGlow,
    backgroundColor: Colors.accent.brandSubtle,
  },
  scanBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: BRAND,
  },
});
