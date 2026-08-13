/**
 * StreakHero — top-of-Timeline card with a lime glow. Single hero metric:
 * current streak. Calm, not gamified.
 *
 * Wave-5 REMOVAL — the glow no longer breathes. It was a `withRepeat(..., -1)`
 * loop with NO reduced-motion gate at all (it had unmount cleanup, which is why
 * earlier sweeps read it as clean): a card whose whole claim is "calm, not
 * gamified" pulsed at every member forever, including the ones who asked the OS
 * to stop. Per the founder's motion brief, constant pulsing is removed rather
 * than tuned down — the glow is now painted once, at the midpoint of the range
 * it used to travel, so the card looks the same at rest and nothing animates.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { af, afType, afAlpha, withAlpha } from '@/theme';
import { streakHeroHeadline, streakHeroSub } from '@/utils/streak/streakCopy';

// PEAK accent (byte-identical: af.green === Colors.states.PEAK.primary).
const LIME = af.green;

interface Props {
  streakDays: number;
}

export default function StreakHero({ streakDays }: Props) {
  const headline = streakHeroHeadline(streakDays);
  const sub = streakHeroSub(streakDays);

  return (
    <View style={styles.card}>
      <View style={styles.halo} />
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
  // Painted once. The removed loop travelled opacity 0.10→0.24 and scale
  // 1→1.12; 0.17 / 1.06 is the midpoint of that range, so the resting card is
  // the same glow the pulse spent most of its cycle showing.
  halo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: LIME,
    opacity: 0.17,
    left: -120,
    top: -150,
    transform: [{ scale: 1.06 }],
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
