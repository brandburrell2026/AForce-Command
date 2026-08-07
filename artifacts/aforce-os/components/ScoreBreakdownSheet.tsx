/**
 * ScoreBreakdownSheet — Drill-in modal showing the full formula contributions
 * to the current hydration score. Triggered from "Why This Score" or the orb.
 *
 * VS 3.0 P2: presentation-only migration onto the af.* system (was legacy
 * Colors.* + hardcoded Inter_* strings + magic sizes + `${color}NN` opacity
 * hacks + a raw rgba scrim), plus the previously-missing empty state. The score,
 * contributions, performanceState (incl. its color), the buildScoreDrivers
 * derivation, the magnitude-bar math, the analytics emit, the motion, and ALL
 * wording (including the FORMULA text) are unchanged — same data, same layout.
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

import { af, afType, afAlpha, afMotion, withAlpha, Typography } from '../theme';
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
      // ENTER (afMotion pattern #1): durations.standard + easing.standardOut.
      opacity.value = withTiming(1, { duration: afMotion.durations.standard, easing: Easing.bezier(...afMotion.easing.standardOut) });
      translateY.value = withSpring(0, afMotion.springs.standard);
      // Internal analytics pipeline (Task #39) — the explainability / impact
      // surface was shown. Key it by the most impactful driver being explained.
      // Consent-gated; one emit per open.
      const top = contributions.reduce<ScoreContribution | null>(
        (best, c) => (!best || Math.abs(c.delta) > Math.abs(best.delta) ? c : best),
        null,
      );
      void emit('impact_shown', { impactKey: top?.id ?? 'score_breakdown' });
    } else {
      // EXIT (afMotion pattern #2): durations.selection.
      opacity.value = withTiming(0, { duration: afMotion.durations.selection });
      translateY.value = withTiming(60, { duration: afMotion.durations.selection });
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
  const isEmpty = contributions.length === 0;

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <Animated.View style={[styles.sheet, sheetStyle, { borderColor: withAlpha(stateColor, afAlpha.a24) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>SCORE BREAKDOWN</Text>
            <View style={styles.scoreLine}>
              <Text style={[styles.score, { color: stateColor }]}>{score}</Text>
              <View style={[styles.statePill, { borderColor: withAlpha(stateColor, afAlpha.a34), backgroundColor: withAlpha(stateColor, afAlpha.a12) }]}>
                <Text style={[styles.stateText, { color: stateColor }]}>{performanceState.level}</Text>
              </View>
            </View>
          </View>
          <Pressable hitSlop={12} onPress={onDismiss} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={18} color={af.textSecondary} />
          </Pressable>
        </View>

        {isEmpty ? (
          <View style={styles.empty} accessibilityRole="text">
            <Text style={styles.emptyText}>Not enough signal yet to break this down.</Text>
            <Text style={styles.emptyHint}>Log a drink or connect a health source and your score&apos;s drivers will appear here.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <SummaryPill label="BOOST" value={`+${totalPositive}`} color={af.green} />
              <SummaryPill label="DRAG" value={`${totalNegative}`} color={af.redText} />
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
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.summaryPill, { borderColor: withAlpha(color, afAlpha.a24), backgroundColor: withAlpha(color, afAlpha.a06) }]}>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function ContributionRow({ c }: { c: ScoreContribution }) {
  const isPos = c.delta > 0;
  const isNeg = c.delta < 0;
  const color = isPos ? af.green : isNeg ? af.redText : af.textTertiary;
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
    backgroundColor: withAlpha(af.canvas, 0.82),
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  sheet: {
    backgroundColor: af.canvasElevated,
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
    backgroundColor: af.divider,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 16,
  },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  scoreLine: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4,
  },
  score: {
    // Score typeface doctrine: numerals are a metric role (IBM Plex Mono), never
    // Inter — matches HomeScreenV2's afType.displayScore family. 44pt is on the
    // type scale; this stays the sheet's own hero size.
    fontSize: 44, fontFamily: Typography.roles.metric, letterSpacing: -2, lineHeight: 50,
  },
  statePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1,
  },
  stateText: { ...afType.eyebrow },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: af.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  emptyText: { ...afType.bodyStrong, color: af.textPrimary, textAlign: 'center' },
  emptyHint: { ...afType.caption, color: af.textTertiary, textAlign: 'center', maxWidth: 320 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryPill: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryLabel: { ...afType.eyebrow },
  summaryValue: { ...afType.bodyStrong, fontVariant: ['tabular-nums'] },
  list: { },
  listContent: { paddingBottom: 16 },
  detailsLabel: { ...afType.eyebrow, color: af.textTertiary, marginBottom: 12 },
  row: { marginBottom: 14 },
  rowHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowLabel: { ...afType.secondary, color: af.textPrimary, flex: 1 },
  rowDelta: { ...afType.secondary, fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'right' },
  barTrack: {
    height: 6, borderRadius: 3, backgroundColor: af.divider, overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: { height: '100%', borderRadius: 3 },
  rowHint: { ...afType.caption, color: af.textTertiary },
  formulaCard: {
    marginTop: 8, padding: 14, borderRadius: 12,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    gap: 6,
  },
  formulaLabel: { ...afType.eyebrow, color: af.textTertiary },
  formulaText: { ...afType.caption, color: af.textSecondary },
});
