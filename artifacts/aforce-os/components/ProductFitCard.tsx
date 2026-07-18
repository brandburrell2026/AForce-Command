/**
 * Product Fit card — axis-by-axis breakdown of the scanned product.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@/theme/colors';
import type { ScanResult } from '@/types/scan';
import { CommandConfidenceBadge } from '@/components/CommandConfidenceBadge';
import { useCommandConfidence } from '@/hooks/useCommandConfidence';
import { useFlagsSlice } from '@/store/slices';

interface Props {
  result: ScanResult;
  /**
   * Show-10: when provided, the Command Confidence badge becomes tappable and
   * calls this to open the DATA BEHIND THIS sheet. The parent passes it only when
   * `spec_confidenceDetailSheet` is on; its presence also makes the badge show
   * here (so the HydroScan Fit chip can go live without flipping the shared
   * `spec_commandConfidenceDisplay`, which would also light Social/Cruise).
   */
  onConfidencePress?: () => void;
}

interface Axis {
  label: string;
  /** 0–100, higher = better. */
  value: number;
  hint: string;
}

function axesFor(result: ScanResult): Axis[] {
  const p = result.product;
  return [
    { label: 'Hydration speed',     value: p.hydrationSpeed,        hint: 'How fast the product reaches the bloodstream.' },
    { label: 'Electrolyte density', value: p.electrolyteDensity,    hint: 'Sodium / potassium concentration per serving.' },
    { label: 'Sugar load',          value: 100 - p.sugarLevel,      hint: 'Lower sugar = higher score.' },
    { label: 'Recovery fit',        value: p.recoveryFit,           hint: 'Effectiveness for closing a deficit.' },
    { label: 'Performance fit',     value: p.performanceFit,        hint: 'Effectiveness for sustaining output.' },
  ];
}

function colorFor(v: number): string {
  if (v >= 85) return Colors.states.PEAK.primary;
  if (v >= 65) return Colors.states.BALANCED.primary;
  if (v >= 45) return Colors.states.RECOVERING.primary;
  return Colors.states.DEPLETED.primary;
}

export function ProductFitCard({ result, onConfidencePress }: Props) {
  const axes = axesFor(result);
  // Section 58 — surface the already-computed Command Confidence on the
  // HydroScan Performance Fit surface. Shows when the shared §58 display flag is
  // on, OR when the parent wired the tap-through (Show-10 slice): the latter lets
  // the HydroScan Fit chip go live on its own without lighting Social/Cruise.
  const showConfidence = useFlagsSlice().spec_commandConfidenceDisplay || !!onConfidencePress;
  const confidence = useCommandConfidence();
  // Tappable only when a handler is wired AND there's a read to explain.
  const confidenceTappable = !!onConfidencePress && !!confidence;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Product Profile</Text>
        {showConfidence ? (
          confidenceTappable ? (
            <Pressable
              onPress={onConfidencePress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityHint="Shows the data behind this confidence read"
            >
              <CommandConfidenceBadge level={confidence} />
            </Pressable>
          ) : (
            <CommandConfidenceBadge level={confidence} />
          )
        ) : null}
      </View>
      <Text style={styles.subtitle}>{result.recommendation.detail}</Text>

      <View style={styles.axes}>
        {axes.map((a) => {
          const color = colorFor(a.value);
          return (
            <View key={a.label} style={styles.axisRow}>
              <View style={styles.axisHead}>
                <Text style={styles.axisLabel}>{a.label}</Text>
                <Text style={[styles.axisValue, { color }]}>{a.value}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(2, a.value)}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.axisHint}>{a.hint}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 14, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, lineHeight: 17,
  },
  axes: { gap: 10, marginTop: 4 },
  axisRow: { gap: 4 },
  axisHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  axisLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  axisValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  barTrack: {
    height: 5, borderRadius: 3,
    backgroundColor: Colors.fill.medium, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  axisHint: {
    fontSize: 10, fontFamily: 'Inter_400Regular',
    color: Colors.text.muted, marginTop: 2,
  },
});
