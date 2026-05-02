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
  /**
   * Diameter of the orb in px. Defaults to 200 (the original design
   * size) so existing call sites are unaffected. Pass a larger value
   * on wide layouts (Fold open, tablets) via useResponsiveLayout.
   */
  size?: number;
  /**
   * Optional Social Mode overlay. When present, renders a subtle
   * outer ring whose intensity tracks `alcoholLoad` (0..1) and whose
   * color flips to crimson when `unstable` (HIGH/CRITICAL impairment).
   * Purely additive — the normal hydration animation continues
   * underneath.
   */
  socialOverlay?: { alcoholLoad: number; unstable: boolean };
  /**
   * Optional accent override that drives the orb's digit colour, ring
   * colours, and glow. When the home screen tweens the score, it also
   * tweens the displayed band — passing it here keeps the orb's colour
   * locked to the visible number, instead of flipping instantly to the
   * engine's target band. The pulse motion (waveBehavior, flare,
   * collapse) still comes from `pulseConfig` since that reflects the
   * actual physiological state, not the visible score readout.
   */
  displayedAccent?: { primary: string; glow: string };
  /**
   * Optional externally-driven displayed score. When provided, the
   * inner `<AnimatedScore/>` skips its own tween and renders this
   * value verbatim — kept in step with `displayedAccent` so the digit
   * and the colour change on the same frame.
   */
  displayedScore?: number;
}

const DEFAULT_ORB_SIZE = 200;
const GLOW_RATIO = 1.85; // dramatic dominant halo

const COLOR_MAP: Record<PulseConfig['colorMode'], { primary: string; glow: string }> = {
  lime:  { primary: Colors.states.PEAK.primary,       glow: Colors.states.PEAK.glow },
  teal:  { primary: Colors.states.BALANCED.primary,   glow: Colors.states.BALANCED.glow },
  amber: { primary: Colors.states.RECOVERING.primary, glow: Colors.states.RECOVERING.glow },
  red:   { primary: Colors.states.DEPLETED.primary,   glow: Colors.states.DEPLETED.glow },
};

export function StatusPulseOrb({ pulseConfig, score, burstAt = 0, onTap, size, socialOverlay, displayedAccent, displayedScore }: Props) {
  const { pulseSpeed, glowStrength, pulseIntensity, waveBehavior, colorMode, animations } = pulseConfig;
  const baseColors = COLOR_MAP[colorMode];
  // Override colour ONLY — kinetic behaviour (waveBehavior, flare,
  // collapse) still tracks the engine's actual band so the motion
  // matches the user's true physiological state.
  const colors = displayedAccent
    ? { primary: displayedAccent.primary, glow: displayedAccent.glow }
    : baseColors;
  const ORB_SIZE = size ?? DEFAULT_ORB_SIZE;
  const GLOW_SIZE = Math.round(ORB_SIZE * GLOW_RATIO);
  const containerSize = GLOW_SIZE + 50;

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
    opacity: interpolate(glowAnim.value, [0, 1], [0.28, 0.55 + glowStrength * 0.45]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.98, 1.18]) }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.45, 0.75 + pulseIntensity * 0.25]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [0.95, 1.08]) }],
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

  // Social Mode overlay ring — slow purple pulse, faster crimson when unstable.
  const socialPulse = useSharedValue(0);
  useEffect(() => {
    if (!socialOverlay) {
      cancelAnimation(socialPulse);
      socialPulse.value = 0;
      return;
    }
    const period = socialOverlay.unstable ? 1100 : 2200;
    socialPulse.value = 0;
    socialPulse.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(socialPulse);
  }, [socialOverlay?.unstable, socialOverlay?.alcoholLoad]);

  const socialOverlayStyle = useAnimatedStyle(() => {
    const load = Math.min(1, Math.max(0, socialOverlay?.alcoholLoad ?? 0));
    const baseOpacity = 0.18 + 0.32 * load;
    const opacity = baseOpacity * (0.65 + 0.35 * socialPulse.value);
    const scale = 1 + 0.04 * socialPulse.value;
    return { opacity, transform: [{ scale }] };
  });

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }]}>
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

      {/* Social Mode outer ring overlay — purple at low load, crimson when unstable. */}
      {socialOverlay && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderColor: socialOverlay.unstable ? '#FB7C7C' : '#9D7CFB',
              borderWidth: socialOverlay.unstable ? 2 : 1.5,
              width: ORB_SIZE + 44,
              height: ORB_SIZE + 44,
              borderRadius: (ORB_SIZE + 44) / 2,
            },
            socialOverlayStyle,
          ]}
        />
      )}

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
          <AnimatedScore value={score} color={colors.primary} displayValue={displayedScore} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: { position: 'absolute' },
  innerGlow: { position: 'absolute' },
  orbWrapper: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  orb: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
});
