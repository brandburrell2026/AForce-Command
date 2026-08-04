/**
 * PulseRing — soft repeating glow ring, used behind live-timer pills
 * (Cruise / Voyage Shield in SocialModeSheet). ~1.8s loop.
 *
 * Extracted from SocialModeSheet.tsx (RC-1 Wave-2A motion-token adoption) so
 * this small animated primitive can be unit-tested in isolation — the sheet
 * it lives in pulls in the app store, the subscription gate, i18n, and
 * safe-area context, none of which this component needs.
 *
 * RC-1 Wave-2A gating fix: this was an ungated `withRepeat(..., -1)` with no
 * reduced-motion check and no unmount cleanup — it ran forever, including
 * for users with motion reduction on. Pattern mirrors
 * components/WhoopSnapshotCard.tsx:126-168 — gate on the shared
 * `useReducedMotion` hook, hold the static frame when reduced, and
 * `cancelAnimation` on unmount either way.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing, interpolate, cancelAnimation,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function PulseRing({ color }: { color: string }) {
  const t = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(t);
      t.value = 0.5; // static mid-frame — no loop, no jump to an extreme
      return () => cancelAnimation(t);
    }
    t.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1, true,
    );
    return () => cancelAnimation(t);
  }, [t, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.35, 0.85]),
    transform: [{ scale: interpolate(t.value, [0, 1], [1, 1.06]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: 100,
          borderWidth: 1,
          borderColor: `${color}AA`,
          backgroundColor: `${color}10`,
        },
        style,
      ]}
    />
  );
}
