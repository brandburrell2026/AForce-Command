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
import { Colors } from '@/theme/colors';

const LIME = Colors.states.PEAK.primary;

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

  const headline =
    streakDays > 0
      ? `${streakDays}-day momentum`
      : 'Begin your first cycle';
  const sub =
    streakDays > 0
      ? 'Recovery rhythm holding. Stay consistent.'
      : 'Log an intake to start the streak.';

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
    borderColor: `${LIME}26`,
    backgroundColor: 'rgba(182,255,0,0.04)',
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
    backgroundColor: `${LIME}1A`,
    borderWidth: 1,
    borderColor: `${LIME}33`,
  },
  headline: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
