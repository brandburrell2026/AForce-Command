/**
 * ScoreBreakdownSheet — Drill-in modal showing the full formula contributions
 * to the current hydration score. Triggered from "Why This Score" or the orb.
 */

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView,
} from 'react-native';
import { Icon } from './Icon';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import type { ScoreContribution, PerformanceState } from '../types';
import { ScoreDrivers } from './ScoreDrivers';
import { buildScoreDrivers } from '../utils/scoring/drivers';
import { emit } from '../analytics/event_dispatcher';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  score: number;
  contributions: ScoreContribution[];
  performanceState: PerformanceState;
}

export function ScoreBreakdownSheet({ visible, onDismiss, score, contributions, performanceState }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(60);

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      // Internal analytics pipeline (Task #39) — the explainability /
      // impact surface was shown. Key it by the most impactful driver
      // being explained. Consent-gated; one emit per open.
      const top = contributions.reduce<ScoreContribution | null>(
        (best, c) => (!best || Math.abs(c.delta) > Math.abs(best.delta) ? c : best),
        null,
      );
      void emit('impact_shown', { impactKey: top?.id ?? 'score_breakdown' });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(60, { duration: 180 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const stateColor = performanceState.color;
  const positives = contributions.filter((c) => c.delta > 0);
  const negatives = contributions.filter((c) => c.delta < 0);
  const neutral = contributions.filter((c) => c.delta === 0);
  const totalPositive = positives.reduce((s, c) => s + c.delta, 0);
  const totalNegative = negatives.reduce((s, c) => s + c.delta, 0);
  const drivers = buildScoreDrivers(contributions);

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <Animated.View style={[styles.sheet, sheetStyle, { borderColor: `${stateColor}33` }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SCORE BREAKDOWN</Text>
            <View style={styles.scoreLine}>
              <Text style={[styles.score, { color: stateColor }]}>{score}</Text>
              <View style={[styles.statePill, { borderColor: `${stateColor}55`, backgroundColor: `${stateColor}1A` }]}>
                <Text style={[styles.stateText, { color: stateColor }]}>{performanceState.level}</Text>
              </View>
            </View>
          </View>
          <Pressable hitSlop={12} onPress={onDismiss} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={18} color={Colors.text.secondary} />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <SummaryPill label="BOOST" value={`+${totalPositive}`} color={Colors.states.PEAK.primary} />
          <SummaryPill label="DRAG" value={`${totalNegative}`} color={Colors.states.DEPLETED.primary} />
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <ScoreDrivers drivers={drivers} />

          <Text style={styles.detailsLabel}>DETAILS</Text>
          {[...positives, ...negatives, ...neutral].map((c) => (
            <ContributionRow key={c.id} c={c} />
          ))}

          <View style={styles.formulaCard}>
            <Text style={styles.formulaLabel}>FORMULA</Text>
            <Text style={styles.formulaText}>
              base + recency + streak + context + recovery − symptoms − urine − output − sleep
            </Text>
            <Text style={styles.formulaText}>
              clamped to 0–100. Re-evaluated every 30 seconds and on every event.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.summaryPill, { borderColor: `${color}33`, backgroundColor: `${color}10` }]}>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function ContributionRow({ c }: { c: ScoreContribution }) {
  const isPos = c.delta > 0;
  const isNeg = c.delta < 0;
  const color = isPos ? Colors.states.PEAK.primary : isNeg ? Colors.states.DEPLETED.primary : Colors.text.muted;
  const magnitude = Math.abs(c.delta);
  const widthPct = c.maxMagnitude > 0 ? Math.min(100, (magnitude / c.maxMagnitude) * 100) : 0;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{c.label}</Text>
        <Text style={[styles.rowDelta, { color }]}>
          {isPos ? '+' : ''}{c.delta}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: color, opacity: c.delta === 0 ? 0.15 : 0.85 }]} />
      </View>
      <Text style={styles.rowHint}>{c.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,2,8,0.78)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  sheet: {
    backgroundColor: Colors.background.elevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 48, height: 4, borderRadius: 2,
    backgroundColor: Colors.fill.medium,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5,
  },
  scoreLine: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4,
  },
  score: {
    // Score typeface doctrine: numerals are a metric role (IBM Plex Mono),
    // never Inter — matches HomeScreenV2's afType.displayScore font family
    // (Typography.roles.metric). Size/spacing/line-height stay this sheet's
    // own 44pt hero; this is a typeface-only fix, not a full af.* migration.
    fontSize: 44, fontFamily: Typography.roles.metric, letterSpacing: -2, lineHeight: 50,
  },
  statePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1,
  },
  stateText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryPill: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  summaryValue: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  list: { },
  listContent: { paddingBottom: 16 },
  detailsLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 2, marginBottom: 12,
  },
  row: { marginBottom: 14 },
  rowHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowLabel: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary, flex: 1,
  },
  rowDelta: { fontSize: 14, fontFamily: 'Inter_700Bold', minWidth: 36, textAlign: 'right' },
  barTrack: {
    height: 6, borderRadius: 3, backgroundColor: Colors.fill.medium, overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: { height: '100%', borderRadius: 3 },
  rowHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted },
  formulaCard: {
    marginTop: 8, padding: 14, borderRadius: 12,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
    gap: 6,
  },
  formulaLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2,
  },
  formulaText: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 16,
  },
});
