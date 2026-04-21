/**
 * StatusPulseOrb — Signature animated orb.
 *
 * Pulse is fully driven by `pulseConfig` from the service layer.
 * On top of the four `waveBehavior` modes, this build also implements:
 *   - `flareOnPeak` — rhythmic accent ring radiating outward at PEAK
 *   - `collapseOnDepletion` — tense inward squeeze pulses at DEPLETED
 *   - `burstOnIntake` — outward shockwave on every successful intake
 *   - secondary "ripple" ring continuously emitted in BALANCED/PEAK
 *
 * Tappable: invokes `onTap` (used to open the Score Breakdown sheet).
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import type { PulseConfig } from '../types';
import { Colors } from '../theme/colors';
import { AnimatedScore } from './AnimatedScore';

interface Props {
  pulseConfig: PulseConfig;
  score: number;
  burstAt?: number; // timestamp — when changed, fire burst
  onTap?: () => void;
}

const ORB_SIZE = 200;
const GLOW_SIZE = 290;

const COLOR_MAP: Record<PulseConfig['colorMode'], { primary: string; glow: string }> = {
  lime:  { primary: Colors.states.PEAK.primary,       glow: Colors.states.PEAK.glow },
  teal:  { primary: Colors.states.BALANCED.primary,   glow: Colors.states.BALANCED.glow },
  amber: { primary: Colors.states.RECOVERING.primary, glow: Colors.states.RECOVERING.glow },
  red:   { primary: Colors.states.DEPLETED.primary,   glow: Colors.states.DEPLETED.glow },
};

export function StatusPulseOrb({ pulseConfig, score, burstAt = 0, onTap }: Props) {
  const { pulseSpeed, glowStrength, pulseIntensity, waveBehavior, colorMode, animations } = pulseConfig;
  const colors = COLOR_MAP[colorMode];

  const cycleMs = Math.round(3400 - pulseSpeed * 2400); // 1000ms..3400ms

  const pulseAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  // Burst-on-intake
  const burstScale = useSharedValue(1);
  const burstOpacity = useSharedValue(0);

  // Continuous ripple (PEAK + BALANCED + RECOVERING — small)
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);

  // Flare ring (PEAK only)
  const flareScale = useSharedValue(1);
  const flareOpacity = useSharedValue(0);

  // Inward collapse ring (DEPLETED only)
  const collapseScale = useSharedValue(1.4);
  const collapseOpacity = useSharedValue(0);

  // Tap press feedback
  const tapScale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(pulseAnim);
    cancelAnimation(glowAnim);
    cancelAnimation(scaleAnim);
    cancelAnimation(rippleScale);
    cancelAnimation(rippleOpacity);
    cancelAnimation(flareScale);
    cancelAnimation(flareOpacity);
    cancelAnimation(collapseScale);
    cancelAnimation(collapseOpacity);

    if (waveBehavior === 'sharp_outward') {
      // PEAK
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: cycleMs * 0.45, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: cycleMs * 0.55, easing: Easing.in(Easing.cubic) }),
        ), -1, false,
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: cycleMs * 0.45 }),
          withTiming(0.4, { duration: cycleMs * 0.55 }),
        ), -1, false,
      );
      scaleAnim.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: cycleMs * 0.45, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: cycleMs * 0.55, easing: Easing.in(Easing.ease) }),
        ), -1, false,
      );
    } else if (waveBehavior === 'steady_outward') {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: cycleMs, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: cycleMs, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: cycleMs * 1.1, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: cycleMs * 1.1, easing: Easing.inOut(Easing.sin) }),
        ), -1, false,
      );
    } else if (waveBehavior === 'uneven_outward') {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: cycleMs * 0.3, easing: Easing.out(Easing.quad) }),
          withTiming(0.45, { duration: cycleMs * 0.2 }),
          withTiming(0.85, { duration: cycleMs * 0.2 }),
          withTiming(0.2, { duration: cycleMs * 0.3 }),
        ), -1, false,
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: cycleMs * 0.3 }),
          withTiming(0.3, { duration: cycleMs * 0.7 }),
        ), -1, false,
      );
      scaleAnim.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: cycleMs * 0.3 }),
          withTiming(1.0, { duration: cycleMs * 0.7 }),
        ), -1, false,
      );
    } else {
      // collapsing — DEPLETED
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: cycleMs * 0.4, easing: Easing.out(Easing.quad) }),
          withTiming(0.2, { duration: cycleMs * 0.6, easing: Easing.in(Easing.quad) }),
        ), -1, false,
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: cycleMs * 0.4 }),
          withTiming(0.15, { duration: cycleMs * 0.6 }),
        ), -1, false,
      );
      scaleAnim.value = withRepeat(
        withSequence(
          withTiming(0.97, { duration: cycleMs * 0.5 }),
          withTiming(1.02, { duration: cycleMs * 0.5 }),
        ), -1, false,
      );
    }

    // Continuous outward ripple — present in PEAK / BALANCED / RECOVERING.
    if (waveBehavior !== 'collapsing') {
      const rippleMs = Math.max(1400, cycleMs * 1.4);
      rippleScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.6, { duration: rippleMs, easing: Easing.out(Easing.quad) }),
        ), -1, false,
      );
      rippleOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55 * pulseIntensity, { duration: 80 }),
          withTiming(0, { duration: rippleMs, easing: Easing.out(Easing.quad) }),
        ), -1, false,
      );
    } else {
      rippleOpacity.value = 0;
    }

    // Flare on PEAK — secondary fast accent ring shooting out twice per cycle.
    if (animations.flareOnPeak) {
      const flareMs = Math.max(800, cycleMs * 0.55);
      flareScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.9, { duration: flareMs, easing: Easing.out(Easing.cubic) }),
        ), -1, false,
      );
      flareOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 60 }),
          withTiming(0, { duration: flareMs, easing: Easing.out(Easing.cubic) }),
          withDelay(flareMs * 0.15, withTiming(0, { duration: 0 })),
        ), -1, false,
      );
    } else {
      flareOpacity.value = 0;
    }

    // Collapse on DEPLETED — tense inward squeeze ring that contracts toward orb.
    if (animations.collapseOnDepletion) {
      const collapseMs = Math.max(1200, cycleMs * 0.85);
      collapseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 0 }),
          withTiming(1.02, { duration: collapseMs, easing: Easing.in(Easing.quad) }),
        ), -1, false,
      );
      collapseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 100 }),
          withTiming(0, { duration: collapseMs, easing: Easing.in(Easing.quad) }),
        ), -1, false,
      );
    } else {
      collapseOpacity.value = 0;
    }
  }, [waveBehavior, cycleMs, animations.flareOnPeak, animations.collapseOnDepletion, pulseIntensity]);

  // Burst-on-intake animation
  useEffect(() => {
    if (!burstAt || !animations.burstOnIntake) return;
    burstOpacity.value = 0;
    burstScale.value = 1;
    burstOpacity.value = withSequence(
      withTiming(0.85, { duration: 120 }),
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    burstScale.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(1.55, { duration: 820, easing: Easing.out(Easing.cubic) }),
    );
  }, [burstAt]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.10, 0.20 + glowStrength * 0.45]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.95, 1.12]) }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.20, 0.35 + pulseIntensity * 0.45]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [0.92, 1.05]) }],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value * tapScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.35, 0.45 + pulseIntensity * 0.4]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1.0, 1.08]) }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  const flareStyle = useAnimatedStyle(() => ({
    opacity: flareOpacity.value,
    transform: [{ scale: flareScale.value }],
  }));

  const collapseStyle = useAnimatedStyle(() => ({
    opacity: collapseOpacity.value,
    transform: [{ scale: collapseScale.value }],
  }));

  const handlePressIn = () => { tapScale.value = withTiming(0.96, { duration: 80 }); };
  const handlePressOut = () => { tapScale.value = withTiming(1, { duration: 140 }); };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.outerGlow,
          { backgroundColor: colors.glow, width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2 },
          outerGlowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.innerGlow,
          { backgroundColor: colors.glow, width: GLOW_SIZE * 0.7, height: GLOW_SIZE * 0.7, borderRadius: GLOW_SIZE / 2 },
          innerGlowStyle,
        ]}
      />

      {/* Continuous outward ripple (PEAK / BALANCED / RECOVERING) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: colors.primary, width: ORB_SIZE + 24, height: ORB_SIZE + 24, borderRadius: (ORB_SIZE + 24) / 2 },
          rippleStyle,
        ]}
      />

      {/* Flare on PEAK */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            borderColor: colors.primary,
            borderWidth: 2,
            width: ORB_SIZE + 24, height: ORB_SIZE + 24, borderRadius: (ORB_SIZE + 24) / 2,
          },
          flareStyle,
        ]}
      />

      {/* Inward collapse ring on DEPLETED */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            borderColor: colors.primary,
            borderStyle: 'dashed',
            width: ORB_SIZE + 24, height: ORB_SIZE + 24, borderRadius: (ORB_SIZE + 24) / 2,
          },
          collapseStyle,
        ]}
      />

      {/* Burst ring on intake */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: colors.primary, width: ORB_SIZE + 30, height: ORB_SIZE + 30, borderRadius: (ORB_SIZE + 30) / 2 },
          burstStyle,
        ]}
      />

      <Animated.View style={[styles.orbWrapper, orbStyle]}>
        <Animated.View
          style={[
            styles.ring,
            { borderColor: colors.primary, width: ORB_SIZE + 24, height: ORB_SIZE + 24, borderRadius: (ORB_SIZE + 24) / 2 },
            ringStyle,
          ]}
        />
        <Pressable
          onPress={onTap}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={null}
          style={[
            styles.orb,
            {
              width: ORB_SIZE,
              height: ORB_SIZE,
              borderRadius: ORB_SIZE / 2,
              borderColor: colors.primary,
              backgroundColor: Colors.background.secondary,
            },
          ]}
        >
          <AnimatedScore value={score} color={colors.primary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: GLOW_SIZE + 50,
    height: GLOW_SIZE + 50,
  },
  outerGlow: { position: 'absolute' },
  innerGlow: { position: 'absolute' },
  orbWrapper: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5 },
  orb: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
