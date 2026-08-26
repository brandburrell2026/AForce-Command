/**
 * DataBehindThisSheet — the Show-10 "DATA BEHIND THIS" tap-through (slice ①).
 *
 * Opened by tapping Today's Command's confidence badge. Same modal family as
 * ScoreBreakdownSheet (bottom sheet, drag handle, spring-in). Body is a plain
 * vertical list — one row per signal behind the read: name (left) + its ONE
 * composed §54⊓§53 chip (right), per Design Decision 2. NO chart, ring, bar, or
 * percentage anywhere (Design Decision 4). NO §56 personalization rows (CR-1-gated).
 *
 * Copy-independence (Design Decision 5): every row renders complete as name +
 * chip. The optional explanatory line (`explain`) is CR-1-pending and NOT passed
 * yet — so today every row is deliberately the badge-alone final design, not a
 * degraded state. The layout reserves no space for the missing sentence.
 *
 * Presentational only — the score/band/confidence are computed elsewhere and
 * passed in. `buildDataBehindThis` is pure; the one impurity (a `now` for
 * freshness) is captured ONCE per open so chips don't flicker as the sheet lives.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { hapticSelection } from '@/services/haptics';

import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import { afMotion } from '../theme/afTokens';
import { ConfidenceChip } from './ConfidenceChip';
import { CommandConfidenceBadge } from './CommandConfidenceBadge';
import { buildDataBehindThis, type DataBehindSignal } from '../utils/confidence/dataBehindThis';
import type { CommandConfidenceLevel } from '../types';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** §58 Command Confidence level for the header. Null → header shows no badge. */
  confidence: CommandConfidenceLevel | null;
  /** Signals behind the current read (from gatherDataBehindSignals). */
  signals: readonly DataBehindSignal[];
}

export function DataBehindThisSheet({ visible, onDismiss, confidence, signals }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(60);
  // Capture `now` ONCE per open so freshness is evaluated at open-time and stays
  // stable while the sheet is up (re-evaluating every render would flicker chips).
  // MUST capture at the visible edge DURING render — the model is built below in
  // this same render, before any effect fires. Capturing in the effect would leave
  // now = 0 on the first visible frame, and assessFreshness reads ageMs <= 0 as
  // `fresh`, so every signal would falsely read fresh and the §53 ceiling would
  // never cap. Reset to 0 on hide so the next open re-captures.
  const nowRef = useRef(0);
  if (visible && nowRef.current === 0) nowRef.current = Date.now();

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== 'web') hapticSelection();
      // ENTER (afMotion pattern #1): durations.standard + easing.standardOut,
      // was 220ms/Easing.out(quad) — exact duration match, token easing curve.
      opacity.value = withTiming(1, { duration: afMotion.durations.standard, easing: Easing.bezier(...afMotion.easing.standardOut) });
      translateY.value = withSpring(0, afMotion.springs.standard);
      // was { damping: 18, stiffness: 220 } — the dominant sheet spring, token match.
    } else {
      nowRef.current = 0;
      // EXIT (afMotion pattern #2): durations.selection, was 180ms — diff 30ms.
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

  const { rows } = buildDataBehindThis({ confidence, signals, now: nowRef.current });

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>DATA BEHIND THIS</Text>
            {/* Header carries the already-shipped §58 badge — the same read the
                tapped chip showed, now with its supporting signals below. */}
            <View style={styles.headerBadge}>
              <CommandConfidenceBadge level={confidence} />
            </View>
          </View>
          <Pressable hitSlop={12} onPress={onDismiss} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={18} color={Colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              {/* One composed chip per row (§54 quality capped by §53 freshness).
                  No `explain` yet — the row is the badge-alone final design. */}
              <ConfidenceChip label={row.chip.label} opacity={row.chip.opacity} a11yContext="signal quality" />
            </View>
          ))}

          {rows.length === 0 ? (
            // Honest empty state: no connected signals → header stands alone, one
            // neutral structural line. No fabricated rows, no meter, no nagging.
            <Text style={styles.emptyLine}>No connected signals yet.</Text>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Animated.View>
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
    borderColor: Colors.border.subtle,
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
  headerBadge: { marginTop: 8 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.background.card,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { },
  listContent: { paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
    gap: 12,
  },
  rowLabel: {
    fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary, flexShrink: 1,
  },
  emptyLine: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    paddingVertical: 12,
  },
});
