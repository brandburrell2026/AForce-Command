/**
 * CycleSuccessOverlay — the confirmation after a drink is logged.
 *
 * Drawn in the app's own look (ink surface, warm-white type, the same
 * HydroState ring Home uses) and laid out as the prototype's "logged"
 * confirmation: the ring, what was recorded, one line, a warm-white button.
 *
 * Presentation only. It shows the numbers it is given and computes none:
 *   - the ring counts from `scoreBefore` up (or down) to `scoreAfter`;
 *   - "was N → now N" and the gain are the real before and after;
 *   - the status word is the engine's, with its colour kept to one small dot.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Icon } from './Icon';
import { hapticNotify } from '@/services/haptics';

import type { CycleResult } from '../types';
import { getStateColors } from '../theme/colors';
import { afMotion } from '../theme/afTokens';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { HomeHydroRing } from './home/cinematic/HomeHydroRing';

interface Props {
  result: CycleResult;
  onDismiss: () => void;
  /** Actions owned by the calling screen, kept inside the modal's accessible surface. */
  children?: React.ReactNode;
}

export function CycleSuccessOverlay({ result, onDismiss, children }: Props) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  // Count-up score
  const counter = useSharedValue(result.scoreBefore);
  const [displayScore, setDisplayScore] = useState(result.scoreBefore);

  const stateColors = getStateColors(result.state);
  // The engine's status colour, unchanged, used for one small dot only.
  const statusDot = stateColors.primary;
  const delta = result.scoreAfter - result.scoreBefore;
  const positive = delta >= 0;

  useEffect(() => {
    // Haptic celebration cascade
    if (Platform.OS !== 'web') {
      hapticNotify('success');
    }

    // ENTER (afMotion pattern #1, opacity beat): durations.standard +
    // easing.standardOut, was 240ms/Easing.out(quad) — diff 20ms. The ripple
    // + count-up below are this overlay's CELEBRATE (pattern #6) beat —
    // afTokens.ts's own pattern-#6 reference cites this exact file for that.
    opacity.value = withTiming(1, { duration: afMotion.durations.standard, easing: Easing.bezier(...afMotion.easing.standardOut) });
    // Card pop spring is a bespoke celebration tune (damping:14, stiffness:180)
    // — not the dominant sheet spring; left as-is (see PR body holdout list).
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });

    // Animated count-up (CELEBRATE, pattern #6 — see the ENTER comment above)
    counter.value = withDelay(220, withTiming(result.scoreAfter, {
      duration: 900, easing: Easing.out(Easing.cubic),
    }));
  }, []);

  useAnimatedReaction(
    () => Math.round(counter.value),
    (current, prev) => {
      if (prev !== current) runOnJS(setDisplayScore)(current);
    },
    [],
  );

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal testID="cycle-success-card">
        <Text style={styles.eyebrow}>LOGGED</Text>

        {/* The same ring as Home, counting from the score before to the score after. */}
        <HomeHydroRing
          size={132}
          progress={Math.max(0, Math.min(100, displayScore)) / 100}
          value={String(displayScore)}
          label="HydroState"
          accessibilityLabel={`HydroState ${result.scoreAfter} out of 100`}
        />

        {/* DURABLE CONFIRMATION — what was actually recorded.
            Deliberately stated independently of the score. When HydroState is
            already capped every score-framed cue reads "+0 · was 100 → now
            100", which is indistinguishable from nothing having happened and
            is what invites a second, duplicate log. This line is the one
            piece of the overlay that says what landed. */}
        <View style={styles.recordedRow}>
          <Icon name="check" size={14} color={af.textPrimary} />
          <Text style={styles.recordedText} testID="cycle-success-recorded">
            {`RECORDED · ${result.recordedLabel}`}
          </Text>
        </View>

        {/* Identity message */}
        <Text style={styles.identityText} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
          {result.identityMessage}
        </Text>

        {/* Status word, then the real before and after, then the change. */}
        <View
          style={styles.deltaRow}
          accessible
          accessibilityLabel={`${result.state}. Was ${result.scoreBefore}, now ${result.scoreAfter}. ${result.gainDisplay}.`}
        >
          <View style={[styles.statusDot, { backgroundColor: statusDot }]} />
          <Text style={styles.deltaText}>{result.state}</Text>
          <Text style={styles.deltaSep}>·</Text>
          <Text style={styles.deltaText}>was {result.scoreBefore}</Text>
          <Icon name="arrow-right" size={12} color={af.textSecondary} />
          <Text style={[styles.deltaText, styles.deltaNow]}>now {result.scoreAfter}</Text>
          <View style={styles.gainPill}>
            <Icon name={positive ? 'trending-up' : 'trending-down'} size={12} color={af.textPrimary} />
            <Text style={styles.gainText}>{result.gainDisplay}</Text>
          </View>
        </View>

        {/* Next check — the LIVE riskTimer minutes of the same adapted engine
            output that seeded the countdown (ruling R2: one clock). Never a
            pre-rendered static string. */}
        <View style={styles.hintRow}>
          <Icon name="clock" size={12} color={af.textSecondary} />
          <Text style={styles.hintText}>{t('coach.next_check', { minutes: result.nextCheckMinutes })}</Text>
        </View>

        {children}

        {/* Dismiss */}
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.dismissBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Done"
          testID="cycle-success-done"
        >
          <Text style={styles.dismissText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,2,8,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    backgroundColor: af.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: af.border,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  recordedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  recordedText: { fontFamily: MONO, fontSize: 12, letterSpacing: 1.2, color: af.textPrimary },
  identityText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.4,
    color: af.textPrimary,
    textAlign: 'center',
  },
  deltaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  deltaText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.textSecondary },
  deltaSep: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.textTertiary },
  deltaNow: { fontFamily: 'Inter_500Medium', color: af.textPrimary },
  gainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: af.border,
  },
  gainText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: af.divider,
  },
  hintText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.textSecondary },
  dismissBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: af.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dismissText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: af.onPrimaryFill },
});
