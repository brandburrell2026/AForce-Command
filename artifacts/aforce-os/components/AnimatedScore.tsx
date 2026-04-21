/**
 * AnimatedScore — Score must NEVER just appear.
 * Per spec: always count up (or down) from previous to current value.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

interface Props {
  value: number;
  color: string;
  label?: string;
  size?: number;
}

export function AnimatedScore({ value, color, label, size = 56 }: Props) {
  const previousRef = useRef(0);
  const animated = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const from = previousRef.current;
    animated.value = from;
    animated.value = withTiming(value, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    previousRef.current = value;
  }, [value]);

  useAnimatedReaction(
    () => animated.value,
    (v) => runOnJS(setDisplay)(Math.round(v)),
  );

  return (
    <>
      <Text style={[styles.score, { color, fontSize: size, lineHeight: size + 6 }]}>{display}</Text>
      {label !== undefined && <Text style={styles.label}>{label}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  score: {
    fontFamily: 'Inter_700Bold',
    letterSpacing: -2,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2.5,
    marginTop: 2,
  },
});
