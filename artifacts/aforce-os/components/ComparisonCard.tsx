/**
 * ComparisonCard — single product result row.
 * Animated fit-score bar, color-coded verdict, expandable axis breakdown.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

import type { CompareResult } from '../types/comparison';
import { Colors } from '../theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  result: CompareResult;
  isWinner: boolean;
  delayMs?: number;
}

function verdictColor(v: CompareResult['verdict']): string {
  switch (v) {
    case 'optimal':    return Colors.states.PEAK.primary;
    case 'strong':     return Colors.states.BALANCED.primary;
    case 'acceptable': return Colors.states.RECOVERING.primary;
    case 'suboptimal': return Colors.states.RECOVERING.primary;
    case 'avoid':      return Colors.states.DEPLETED.primary;
  }
}

function verdictLabel(v: CompareResult['verdict']): string {
  return v.toUpperCase();
}

export function ComparisonCard({ result, isWinner, delayMs = 0 }: Props) {
  const accent = verdictColor(result.verdict);
  const [expanded, setExpanded] = React.useState(false);

  const fill = useSharedValue(0);
  React.useEffect(() => {
    fill.value = 0;
    fill.value = withTiming(result.fitScore / 100, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [result.fitScore]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(2, fill.value * 100)}%`,
  }));

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  };

  return (
    <Pressable
      onPress={toggleExpand}
      style={({ pressed }) => [
        styles.card,
        { borderColor: isWinner ? accent : Colors.border.subtle },
        isWinner && { backgroundColor: `${accent}0E` },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.rankPill}>
          <Text style={styles.rankText}>#{result.rank}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name} numberOfLines={1}>{result.product.name}</Text>
          <Text style={styles.brand}>{result.product.brand}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreNum, { color: accent }]}>{result.fitScore}</Text>
          <Text style={styles.scoreLabel}>FIT</Text>
        </View>
      </View>

      {/* Bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: accent }, fillStyle]} />
      </View>

      {/* Verdict + winner ribbon */}
      <View style={styles.metaRow}>
        <View style={[styles.verdictPill, { borderColor: `${accent}55`, backgroundColor: `${accent}15` }]}>
          <Text style={[styles.verdictText, { color: accent }]}>{verdictLabel(result.verdict)}</Text>
        </View>
        {isWinner && (
          <View style={[styles.bestPill, { backgroundColor: accent }]}>
            <Feather name="zap" size={10} color={Colors.text.inverse} />
            <Text style={styles.bestText}>BEST RIGHT NOW</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.text.muted} />
      </View>

      {/* Why */}
      <Text style={styles.why}>{result.whyItFits}</Text>

      {/* Expanded axes */}
      {expanded && (
        <View style={styles.axes}>
          <AxisRow label="Hydration speed"     value={result.axes.speed} accent={accent} />
          <AxisRow label="Electrolyte balance" value={result.axes.electrolyteBalance} accent={accent} />
          <AxisRow label="Sugar impact"        value={result.axes.sugarImpact} accent={accent} hint="100 = ideal (low sugar)" />
          <AxisRow label="Absorption"          value={result.axes.absorption} accent={accent} />
          <AxisRow label="Recovery efficiency" value={result.axes.recovery} accent={accent} />
          <Text style={styles.factual}>{result.product.factualNote}</Text>
        </View>
      )}
    </Pressable>
  );
}

function AxisRow({ label, value, accent, hint }: { label: string; value: number; accent: string; hint?: string }) {
  const w = useSharedValue(0);
  React.useEffect(() => {
    w.value = 0;
    w.value = withTiming(value / 100, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [value]);
  const wStyle = useAnimatedStyle(() => ({ width: `${Math.max(2, w.value * 100)}%` }));
  return (
    <View style={styles.axisRow}>
      <View style={styles.axisLabelRow}>
        <Text style={styles.axisLabel}>{label}</Text>
        <Text style={styles.axisValue}>{value}</Text>
      </View>
      <View style={styles.axisTrack}>
        <Animated.View style={[styles.axisFill, { backgroundColor: accent }, wStyle]} />
      </View>
      {hint && <Text style={styles.axisHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.95 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rankPill: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.fill.medium,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.primary },
  name: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.2 },
  brand: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 1 },
  scoreBlock: { alignItems: 'flex-end' },
  scoreNum: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  scoreLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5, marginTop: -3 },

  barTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10,
  },
  barFill: { height: '100%', borderRadius: 3 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  verdictPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  verdictText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  bestPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  bestText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.inverse, letterSpacing: 1.2 },

  why: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 17 },

  axes: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.subtle, gap: 10 },
  axisRow: {},
  axisLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  axisLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  axisValue: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.primary },
  axisTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' },
  axisFill: { height: '100%', borderRadius: 2 },
  axisHint: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 3 },
  factual: { marginTop: 6, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, fontStyle: 'italic' },
});
