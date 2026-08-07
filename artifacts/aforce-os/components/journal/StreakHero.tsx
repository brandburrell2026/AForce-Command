/**
 * StreakHero — top-of-Timeline glassmorphism card with a slowly
 * pulsing lime glow. Single hero metric: current streak. Calm, not
 * gamified.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { af, afType, afAlpha, withAlpha } from '@/theme';
import { streakHeroHeadline, streakHeroSub } from '@/utils/streak/streakCopy';

// PEAK accent (byte-identical: af.green === Colors.states.PEAK.primary).
const LIME = af.green;

interface Props {
  streakDays: number;
}

export default function StreakHero({ streakDays }: Props) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.10 + pulse.value * 0.14,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));

  const headline = streakHeroHeadline(streakDays);
  const sub = streakHeroSub(streakDays);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.halo, haloStyle]} />
      <View style={styles.iconWrap}>
        <Icon name="zap" size={20} color={LIME} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(LIME, afAlpha.a16),
    backgroundColor: withAlpha(af.red, afAlpha.a06),
    overflow: 'hidden',
    marginBottom: 16,
  },
  halo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: LIME,
    opacity: 0.10,
    left: -120,
    top: -150,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(LIME, afAlpha.a12),
    borderWidth: 1,
    borderColor: withAlpha(LIME, afAlpha.a24),
  },
  headline: {
    ...afType.bodyStrong,
    color: af.textPrimary,
    letterSpacing: -0.2,
  },
  sub: {
    ...afType.caption,
    color: af.textTertiary,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
