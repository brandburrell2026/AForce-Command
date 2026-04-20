/**
 * StatusPulseOrb — Signature animated orb that reacts to performance state.
 * Uses React Native Reanimated for smooth 60fps animations.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface Props {
  performanceState: PerformanceState;
  score: number;
}

const ORB_SIZE = 180;
const GLOW_SIZE = 260;

export function StatusPulseOrb({ performanceState, score }: Props) {
  const { level, color, glowColor, animationStyle, pulseSpeed } = performanceState;

  const pulseAnim = useSharedValue(0);
  const glowAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);
  const rotateAnim = useSharedValue(0);

  const getDuration = () => {
    switch (pulseSpeed) {
      case 'slow': return 3200;
      case 'medium': return 2200;
      case 'fast': return 1400;
      case 'rapid': return 900;
      default: return 2200;
    }
  };

  useEffect(() => {
    cancelAnimation(pulseAnim);
    cancelAnimation(glowAnim);
    cancelAnimation(scaleAnim);
    cancelAnimation(rotateAnim);

    const dur = getDuration();

    if (animationStyle === 'breathe' || animationStyle === 'energize') {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: dur, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: dur * 1.2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: dur * 1.2, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );

      if (animationStyle === 'energize') {
        // PEAK state: more dynamic scale
        scaleAnim.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: dur * 0.6, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: dur * 0.6, easing: Easing.in(Easing.ease) }),
            withTiming(1.04, { duration: dur * 0.4, easing: Easing.out(Easing.ease) }),
            withTiming(1.0, { duration: dur * 0.4, easing: Easing.in(Easing.ease) })
          ),
          -1,
          false
        );
      }
    } else if (animationStyle === 'pulse') {
      // RECOVERING: quick sharp pulses
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: dur * 0.3, easing: Easing.out(Easing.quad) }),
          withTiming(0.3, { duration: dur * 0.7, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: dur * 0.3, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: dur * 0.7, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      );
      scaleAnim.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: dur * 0.3 }),
          withTiming(1.0, { duration: dur * 0.7 })
        ),
        -1,
        false
      );
    } else if (animationStyle === 'tension') {
      // DEPLETED: tight, urgent micro-oscillation
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: dur * 0.4, easing: Easing.out(Easing.quad) }),
          withTiming(0.5, { duration: dur * 0.2 }),
          withTiming(0.9, { duration: dur * 0.2 }),
          withTiming(0.3, { duration: dur * 0.2 })
        ),
        -1,
        false
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: dur * 0.5 }),
          withTiming(0.4, { duration: dur * 0.5 })
        ),
        -1,
        false
      );
      scaleAnim.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: dur * 0.25 }),
          withTiming(0.98, { duration: dur * 0.25 }),
          withTiming(1.01, { duration: dur * 0.25 }),
          withTiming(1.0, { duration: dur * 0.25 })
        ),
        -1,
        false
      );
    }
  }, [level, pulseSpeed, animationStyle]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.15, 0.45]),
    transform: [{ scale: interpolate(glowAnim.value, [0, 1], [0.95, 1.1]) }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.25, 0.65]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [0.9, 1.05]) }],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.4, 0.85]),
  }));

  return (
    <View style={styles.container}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.outerGlow,
          { backgroundColor: glowColor, width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2 },
          outerGlowStyle,
        ]}
      />

      {/* Inner glow */}
      <Animated.View
        style={[
          styles.innerGlow,
          { backgroundColor: glowColor, width: GLOW_SIZE * 0.7, height: GLOW_SIZE * 0.7, borderRadius: GLOW_SIZE / 2 },
          innerGlowStyle,
        ]}
      />

      {/* Orb body */}
      <Animated.View style={[styles.orbWrapper, orbStyle]}>
        {/* Outer ring */}
        <Animated.View
          style={[
            styles.ring,
            { borderColor: color, width: ORB_SIZE + 20, height: ORB_SIZE + 20, borderRadius: (ORB_SIZE + 20) / 2 },
            ringStyle,
          ]}
        />

        {/* Core orb */}
        <View
          style={[
            styles.orb,
            {
              width: ORB_SIZE,
              height: ORB_SIZE,
              borderRadius: ORB_SIZE / 2,
              borderColor: color,
              backgroundColor: Colors.background.secondary,
            },
          ]}
        >
          {/* Score */}
          <Text style={[styles.scoreText, { color }]}>{score}</Text>
          <Text style={styles.scoreLabel}>{level}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: GLOW_SIZE + 40,
    height: GLOW_SIZE + 40,
  },
  outerGlow: {
    position: 'absolute',
  },
  innerGlow: {
    position: 'absolute',
  },
  orbWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  scoreText: {
    fontSize: 52,
    fontFamily: 'Inter_700Bold',
    lineHeight: 56,
    letterSpacing: -2,
  },
  scoreLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2.5,
    marginTop: 2,
  },
});
