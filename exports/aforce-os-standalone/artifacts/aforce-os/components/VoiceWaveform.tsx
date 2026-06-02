/**
 * Animated waveform — five vertical bars that pulse while listening.
 *
 * Uses Animated.loop with sequenced timings rather than a continuous driver
 * so it stays cheap on the JS bridge. Bars are seeded with phase offsets so
 * they never line up.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface Props {
  active: boolean;
  color: string;
  height?: number;
  barCount?: number;
}

export function VoiceWaveform({ active, color, height = 36, barCount = 5 }: Props) {
  const bars = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.25)),
  ).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((b) => {
        b.stopAnimation();
        Animated.timing(b, { toValue: 0.25, duration: 150, useNativeDriver: false }).start();
      });
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, {
            toValue: 1,
            duration: 320 + i * 90,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(b, {
            toValue: 0.3,
            duration: 280 + i * 70,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    // Track the staggered start handles so cleanup can cancel pending starts —
    // otherwise loops can begin AFTER `active` flips false.
    const starters = loops.map((l, i) => setTimeout(() => l.start(), i * 80));
    return () => {
      starters.forEach((t) => clearTimeout(t));
      loops.forEach((l) => l.stop());
    };
  }, [active, bars]);

  return (
    <View style={[styles.row, { height }]} accessibilityElementsHidden>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: 4,
            marginHorizontal: 3,
            borderRadius: 2,
            backgroundColor: color,
            height: b.interpolate({ inputRange: [0, 1], outputRange: [height * 0.18, height] }),
            opacity: b.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
