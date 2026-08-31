/**
 * CycleSuccessOverlay — Hero confirmation moment after a successful cycle.
 *
 * Premium signature beats:
 *   - Three radiating ripple rings outward from the check icon
 *   - Animated count-up from `scoreBefore` to `scoreAfter`
 *   - Tier ribbon, gain delta, identity message, next cycle hint
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
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Icon } from './Icon';
import { hapticNotify } from '@/services/haptics';

import type { CycleResult } from '../types';
import { Colors, getStateColors } from '../theme/colors';
import { afMotion } from '../theme/afTokens';

interface Props {
  result: CycleResult;
  onDismiss: () => void;
}

export function CycleSuccessOverlay({ result, onDismiss }: Props) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const gainScale = useSharedValue(0);

  // Three radiating ripple rings
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  // Count-up score
  const counter = useSharedValue(result.scoreBefore);
  const [displayScore, setDisplayScore] = useState(result.scoreBefore);

  const stateColors = getStateColors(result.state);
  const color = stateColors.primary;
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

    // Gain pop
    gainScale.value = withDelay(180, withSequence(
      withSpring(1.25, { damping: 8, stiffness: 260 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    ));

    // Ripples — staggered (CELEBRATE, pattern #6 — see the ENTER comment above)
    ring1.value = withDelay(60,  withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    ring2.value = withDelay(260, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    ring3.value = withDelay(460, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));

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
  const gainStyle = useAnimatedStyle(() => ({ transform: [{ scale: gainScale.value }] }));
  const r1 = useAnimatedStyle(() => ({
    opacity: 0.7 - ring1.value * 0.7,
    transform: [{ scale: 1 + ring1.value * 2.6 }],
  }));
  const r2 = useAnimatedStyle(() => ({
    opacity: 0.7 - ring2.value * 0.7,
    transform: [{ scale: 1 + ring2.value * 2.6 }],
  }));
  const r3 = useAnimatedStyle(() => ({
    opacity: 0.7 - ring3.value * 0.7,
    transform: [{ scale: 1 + ring3.value * 2.6 }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.card, cardStyle, { borderColor: `${color}40` }]}>
        {/* Soft glow */}
        <View style={[styles.glow, { backgroundColor: `${color}1A` }]} />

        {/* Tier ribbon */}
        <View style={[styles.ribbon, { borderColor: `${color}55`, backgroundColor: `${color}14` }]}>
          <View style={[styles.ribbonDot, { backgroundColor: color }]} />
          <Text style={[styles.ribbonText, { color }]}>{result.state}</Text>
        </View>

        {/* Ripples + Check */}
        <View style={styles.checkContainer}>
          <Animated.View pointerEvents="none" style={[styles.rippleRing, { borderColor: color }, r1]} />
          <Animated.View pointerEvents="none" style={[styles.rippleRing, { borderColor: color }, r2]} />
          <Animated.View pointerEvents="none" style={[styles.rippleRing, { borderColor: color }, r3]} />
          <View style={[styles.iconCircle, { backgroundColor: `${color}20`, borderColor: `${color}66` }]}>
            <Icon name={positive ? 'check' : 'arrow-down'} size={32} color={color} />
          </View>
        </View>

        {/* Animated count-up score (BEFORE → AFTER) */}
        <View style={styles.scoreLine}>
          <Text style={[styles.scoreNum, { color }]}>{displayScore}</Text>
          <Animated.View style={[styles.gainPill, { borderColor: `${color}55`, backgroundColor: `${color}1A` }, gainStyle]}>
            <Icon
              name={positive ? 'trending-up' : 'trending-down'}
              size={12}
              color={color}
            />
            <Text style={[styles.gainText, { color }]}>{result.gainDisplay}</Text>
          </Animated.View>
        </View>

        {/* DURABLE CONFIRMATION — what was actually recorded.
            Deliberately stated independently of the score. When HydroState is
            already capped every score-framed cue above reads "+0 · was 100 →
            now 100", which is indistinguishable from nothing having happened
            and is what invites a second, duplicate log. This line is the one
            piece of the overlay that says what landed. */}
        <View style={[styles.recordedRow, { borderColor: `${color}55` }]}>
          <Icon name="check-circle" size={14} color={color} />
          <Text style={[styles.recordedText, { color }]} testID="cycle-success-recorded">
            {`RECORDED · ${result.recordedLabel}`}
          </Text>
        </View>

        {/* Identity message */}
        <Text style={styles.identityText}>{result.identityMessage}</Text>

        {/* Score path (from / arrow / to) */}
        <View style={styles.deltaRow}>
          <Text style={styles.deltaFrom}>was {result.scoreBefore}</Text>
          <Icon name="arrow-right" size={12} color={Colors.text.muted} />
          <Text style={[styles.deltaTo, { color }]}>now {result.scoreAfter}</Text>
        </View>

        {/* Next check — the LIVE riskTimer minutes of the same adapted engine
            output that seeded the countdown (ruling R2: one clock). Never a
            pre-rendered static string. */}
        <View style={[styles.hintRow, { borderColor: Colors.border.subtle }]}>
          <Icon name="clock" size={12} color={Colors.text.muted} />
          <Text style={styles.hintText}>{t('coach.next_check', { minutes: result.nextCheckMinutes })}</Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} activeOpacity={0.7}>
          <Text style={styles.dismissText}>CONTINUE</Text>
          <Icon name="arrow-right" size={12} color={Colors.text.muted} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,2,8,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.background.elevated,
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -80,
    left: -60,
    right: -60,
    height: 240,
    borderRadius: 120,
  },
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
    marginBottom: 22,
  },
  ribbonDot: { width: 6, height: 6, borderRadius: 3 },
  ribbonText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  checkContainer: {
    width: 120, height: 120,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  rippleRing: {
    position: 'absolute',
    width: 70, height: 70, borderRadius: 35, borderWidth: 1.5,
  },
  iconCircle: {
    width: 70, height: 70, borderRadius: 35, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreLine: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 8,
  },
  scoreNum: {
    fontSize: 64, fontFamily: 'Inter_700Bold', letterSpacing: -3, lineHeight: 70,
  },
  gainPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
  },
  gainText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  recordedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  recordedText: {
    fontSize: 12,
    letterSpacing: 0.8,
  },
  identityText: {
    fontSize: 18, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, textAlign: 'center',
    marginBottom: 12, marginTop: 6, letterSpacing: -0.3,
  },
  deltaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
  },
  deltaFrom: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
  },
  deltaTo: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
  },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 14, paddingBottom: 12,
    borderTopWidth: 1, width: '100%', justifyContent: 'center',
  },
  hintText: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.secondary,
  },
  dismissBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, marginTop: 4,
  },
  dismissText: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2,
  },
});
