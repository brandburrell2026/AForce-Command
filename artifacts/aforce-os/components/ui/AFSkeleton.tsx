/**
 * AFSkeleton (E3) — a branded loading placeholder.
 *
 * A subtle opacity shimmer on a rounded surface block, replacing bare
 * `ActivityIndicator`s. Reduced-motion aware (shared `useReducedMotion`): when
 * motion is off it renders a static muted block — the reduced-motion
 * alternative — and the repeating animation is cancelled on unmount (no
 * lingering timers). Presentation-only; carries an accessible "Loading" label.
 */
import React from 'react';
import {
  type ViewStyle,
  type StyleProp,
  type DimensionValue,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { af } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { shimmerEnabled } from './motionLogic';

export interface AFSkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  /** Master switch (usually a feature flag). Default true. */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AFSkeleton({
  width = '100%',
  height = 16,
  radius = 8,
  enabled = true,
  style,
  testID,
}: AFSkeletonProps) {
  const reducedMotion = useReducedMotion();
  const animate = shimmerEnabled({ enabled, reducedMotion });
  const opacity = useSharedValue(0.5);

  React.useEffect(() => {
    if (animate) {
      opacity.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(opacity);
      opacity.value = 0.5;
    }
    return () => cancelAnimation(opacity);
  }, [animate, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        { width, height, borderRadius: radius, backgroundColor: af.surfaceRaised },
        animatedStyle,
        style,
      ]}
    />
  );
}
