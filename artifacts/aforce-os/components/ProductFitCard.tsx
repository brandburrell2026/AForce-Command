/**
 * Product Fit card — axis-by-axis breakdown of the scanned product.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  /** hydroScan2.cards.* key suffix for the axis label (translated at render). */
  labelKey: string;
  /** hydroScan2.cards.* key suffix for the axis hint. */
  hintKey: string;
  /** 0–100, higher = better. `null` = UNKNOWN — renders a dash, not a bar. */
  value: number | null;
}

function axesFor(result: ScanResult): Axis[] {
  const p = result.product;
  // An UNKNOWN attribute carries `null` and renders no bar (D5). Previously a
  // missing value arrived here as 0, so an absent sugar reading drew the bar
  // at 100 — the best possible score — and absence was indistinguishable from
  // a measured zero.
  return [
    { labelKey: 'axis_hydration_speed', hintKey: 'axis_hydration_speed_hint', value: p.hydrationSpeed },
    { labelKey: 'axis_electrolyte',     hintKey: 'axis_electrolyte_hint',     value: p.electrolyteDensity },
    { labelKey: 'axis_sugar',           hintKey: 'axis_sugar_hint',           value: p.sugarLevel == null ? null : 100 - p.sugarLevel },
    { labelKey: 'axis_recovery',        hintKey: 'axis_recovery_hint',        value: p.recoveryFit },
    { labelKey: 'axis_performance',     hintKey: 'axis_performance_hint',     value: p.performanceFit },
  ];
}

function colorFor(v: number): string {
  if (v >= 85) return Colors.states.PEAK.primary;
  if (v >= 65) return Colors.states.BALANCED.primary;
  if (v >= 45) return Colors.states.RECOVERING.primary;
  return Colors.states.DEPLETED.primary;
}

export function ProductFitCard({ result, onConfidencePress }: Props) {
  const { t } = useTranslation();
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
        <Text style={styles.title}>{t('hydroScan2.cards.product_profile')}</Text>
        {showConfidence ? (
          confidenceTappable ? (
            <Pressable
              onPress={onConfidencePress}
              // Chip is ~16px tall; expand the touch box to ~44pt (iOS HIG) via
              // hitSlop without shifting the header layout. Dim on press so the
              // tap has affordance/confirmation (matches the primary CTA pattern).
              hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityHint={t('hydroScan2.cards.confidence_hint')}
              style={({ pressed }) => (pressed ? styles.confidencePressed : undefined)}
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
          // UNKNOWN renders the honest-absence dash and NO bar — a bar drawn
          // at any width would be a measurement we do not have (D5).
          const unknown = a.value == null;
          const color = unknown ? Colors.text.muted : colorFor(a.value as number);
          return (
            <View key={a.labelKey} style={styles.axisRow}>
              <View style={styles.axisHead}>
                <Text style={styles.axisLabel}>{t(`hydroScan2.cards.${a.labelKey}`)}</Text>
                <Text style={[styles.axisValue, { color }]}>{unknown ? '—' : a.value}</Text>
              </View>
              <View style={styles.barTrack}>
                {unknown ? null : (
                  <View style={[styles.barFill, { width: `${Math.max(2, a.value as number)}%`, backgroundColor: color }]} />
                )}
              </View>
              <Text style={styles.axisHint}>{t(`hydroScan2.cards.${a.hintKey}`)}</Text>
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
  confidencePressed: { opacity: 0.6 },
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
