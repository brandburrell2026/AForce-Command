/**
 * StatusPulseOrb — Signature animated orb.
 *
 * Per spec: ZERO pulse logic is hardcoded inside this presentation component.
 * All breathe speed, glow strength, intensity, color mode, and wave behavior
 * are driven by `pulseConfig` returned from the mock service layer.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
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
}

const ORB_SIZE = 200;
const GLOW_SIZE = 290;

const COLOR_MAP: Record<PulseConfig['colorMode'], { primary: string; glow: string }> = {
  lime:  { primary: Colors.states.PEAK.primary,       glow: Colors.states.PEAK.glow },
  teal:  { primary: Colors.states.BALANCED.primary,   glow: Colors.states.BALANCED.glow },
  amber: { primary: Colors.states.RECOVERING.primary, glow: Colors.states.RECOVERING.glow },
  red:   { primary: Colors.states.DEPLETED.primary,   glow: Colors.states.DEPLETED.glow },
};

export function StatusPulseOrb({ pulseConfig, score, burstAt = 0 }: Props) {
  const { pulseSpeed, glowStrength, pulseIntensity, waveBehavior, colorMode, animations } = pulseConfig;
  const colors = COLOR_MAP[colorMode];

  // Convert pulseSpeed (0..1) into a millisecond cycle. Faster speed = shorter cycle.
  const cycleMs = Math.round(3400 - pulseSpeed * 2400); // 1000ms..3400ms

  const pulseAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);
  const burstScale = useSharedValue(1);
  const burstOpacity = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulseAnim);
    cancelAnimation(glowAnim);
    cancelAnimation(scaleAnim);

    if (waveBehavior === 'sharp_outward') {
      // PEAK: assertive expanding wave
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
      // BALANCED: smooth breathing
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
      // RECOVERING: choppy uneven pulse
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
      // collapsing — DEPLETED: tense, contracting
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
          withTiming(0.98, { duration: cycleMs * 0.5 }),
          withTiming(1.01, { duration: cycleMs * 0.5 }),
        ), -1, false,
      );
    }
  }, [waveBehavior, cycleMs]);

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
      withTiming(1.4, { duration: 820, easing: Easing.out(Easing.cubic) }),
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
    transform: [{ scale: scaleAnim.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.35, 0.45 + pulseIntensity * 0.4]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1.0, 1.08]) }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

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
        <View
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
        </View>
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
