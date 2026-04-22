/**
 * Scan Result card.
 * Premium identification + verdict surface that flips into view after a scan.
 *
 * Pure presentational — driven entirely by ScanResult.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { Colors } from '@/theme/colors';
import type { ScanResult } from '@/types/scan';

const VERDICT_COLOR: Record<ScanResult['verdict'], string> = {
  optimal:    Colors.states.PEAK.primary,
  strong:     Colors.states.PEAK.primary,
  acceptable: Colors.states.BALANCED.primary,
  suboptimal: Colors.states.RECOVERING.primary,
  avoid:      Colors.states.DEPLETED.primary,
};

const VERDICT_LABEL: Record<ScanResult['verdict'], string> = {
  optimal:    'OPTIMAL',
  strong:     'STRONG FIT',
  acceptable: 'ACCEPTABLE',
  suboptimal: 'SUBOPTIMAL',
  avoid:      'AVOID',
};

interface Props {
  result: ScanResult;
}

export function ScanResultCard({ result }: Props) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(8);

  useEffect(() => {
    opacity.value = 0;
    ty.value = 10;
    opacity.value = withDelay(40, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(40, withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }));
    // Re-run on every new scan
  }, [result.scannedAt, opacity, ty]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  const color = VERDICT_COLOR[result.verdict];
  const verdictLabel = VERDICT_LABEL[result.verdict];

  return (
    <Animated.View style={[styles.card, { borderColor: `${color}55` }, animStyle]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
          <Feather
            name={result.product.isAForce ? 'check-circle' : 'box'}
            size={16}
            color={color}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>SCAN IDENTIFIED</Text>
          <Text style={styles.name} numberOfLines={1}>{result.product.productName}</Text>
          <Text style={styles.brand}>{result.product.brand}</Text>
        </View>
        <View style={[styles.verdictPill, { backgroundColor: `${color}14`, borderColor: `${color}55` }]}>
          <Text style={[styles.verdictText, { color }]}>{verdictLabel}</Text>
        </View>
      </View>

      <View style={styles.fitRow}>
        <Text style={[styles.fitScore, { color }]}>{result.currentFitScore}</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.fitLabel}>FIT SCORE — {result.evaluatedAgainstState}</Text>
          <Text style={styles.fitHeadline}>{result.recommendation.headline}</Text>
        </View>
      </View>

      <View style={styles.efficiencyRow} testID="scan-efficiency-row">
        <Text style={styles.fitLabel}>EFFICIENCY</Text>
        <Text style={[styles.efficiencyText, { color }]}>{result.efficiencyLabel}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 9, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 2, marginBottom: 2,
  },
  name: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.2 },
  brand: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 1 },
  verdictPill: {
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
  },
  verdictText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },

  fitRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.subtle,
  },
  fitScore: { fontSize: 44, fontFamily: 'Inter_700Bold', letterSpacing: -1.5, lineHeight: 48 },
  efficiencyRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    gap: 4,
  },
  efficiencyText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
  },
  fitLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 1.5, marginBottom: 4,
  },
  fitHeadline: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary, lineHeight: 18,
  },
});
