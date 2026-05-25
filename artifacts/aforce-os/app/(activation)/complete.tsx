/**
 * Activation — "Complete" screen (Return stage).
 *
 * Spec Rule #9:
 *   Completion: Water Cycle Complete → Signal Unlocked
 *   Unlock:     Timeline / Journal / Protocol / HydroScan
 *
 * Lands after First Command is marked complete. Auto-advances to
 * the dashboard after 2.6s; the user can also tap-to-continue.
 * Once this screen routes out, the activation funnel is done for
 * good — `isStageReached(state, 'return')` is now true, so
 * future cold starts skip the funnel.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ACTIVATION_COPY } from '@/services/activationFlow';
import { Colors } from '../../theme/colors';

const LIME = '#B6FF00';
const AUTO_ADVANCE_MS = 2600;

export default function ActivationComplete() {
  const cycle = useSharedValue(0);
  const unlocked = useSharedValue(0);
  const hint = useSharedValue(0);
  const handedOff = useRef(false);

  const handoff = useCallback(() => {
    if (handedOff.current) return;
    handedOff.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.replace('/(tabs)');
  }, []);

  useEffect(() => {
    cycle.value = withTiming(1, {
      duration: 460,
      easing: Easing.out(Easing.cubic),
    });
    unlocked.value = withDelay(
      640,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    hint.value = withDelay(
      1500,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );

    const timer = setTimeout(handoff, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [cycle, unlocked, hint, handoff]);

  const cycleStyle = useAnimatedStyle(() => ({
    opacity: cycle.value,
    transform: [{ translateY: (1 - cycle.value) * 12 }],
  }));
  const unlockedStyle = useAnimatedStyle(() => ({
    opacity: unlocked.value,
    transform: [{ translateY: (1 - unlocked.value) * 12 }],
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.value }));

  return (
    <Pressable
      onPress={handoff}
      accessibilityRole="button"
      accessibilityLabel="Continue"
      style={styles.root}
    >
      <View style={styles.stack}>
        <Animated.Text style={[styles.cycle, cycleStyle]}>
          {ACTIVATION_COPY.completion}
        </Animated.Text>

        <View style={styles.divider} />

        <Animated.Text style={[styles.unlocked, unlockedStyle]}>
          {ACTIVATION_COPY.unlocked}
        </Animated.Text>
      </View>

      <Animated.Text style={[styles.hint, hintStyle]}>
        TAP TO CONTINUE
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 28,
    paddingBottom: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  cycle: {
    color: Colors.text.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: 1.6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  divider: {
    width: 36,
    height: 1,
    backgroundColor: 'rgba(182,255,0,0.35)',
  },
  unlocked: {
    color: LIME,
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 30,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: LIME,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  hint: {
    color: Colors.text.muted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 2,
  },
});
