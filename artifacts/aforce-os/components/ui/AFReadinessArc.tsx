/**
 * AFReadinessArc — the "thin arc" behind a dominant readiness value (spec §5,
 * §8.2 Home). A partial arc (default 270°, gap centered at the bottom) with a
 * track + a progress stroke; center content is supplied as `children` (the
 * score, state, freshness). Static by default — a static arc IS the
 * reduced-motion presentation (spec §11).
 *
 * Opt-in `animate` (E1, elevated Home): the progress stroke *reveals* (draws in
 * from empty to `fraction`) once on mount. This is a ring reveal, not a score
 * animation — the number never counts from zero (that decision lives in the
 * caller / `homePresentation.ts`). Reduced-motion collapses it to the static
 * render, so the default (non-animated) output is byte-for-byte unchanged.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { af } from '@/theme';
import { arcGeometry, clampProgress } from './afPrimitives.logic';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface AFReadinessArcProps {
  /** 0…1 fill fraction. Prefer this, or pass score+max. */
  progress?: number;
  score?: number | null;
  max?: number;
  size?: number;
  stroke?: number;
  sweepDeg?: number;
  color?: string;
  trackColor?: string;
  /** Reveal the progress stroke on mount (E1). Ignored under reduced-motion. */
  animate?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AFReadinessArc({
  progress,
  score,
  max = 100,
  size = 220,
  stroke = 6,
  sweepDeg = 270,
  color = af.red,
  trackColor = af.divider,
  animate = false,
  children,
  style,
  testID,
}: AFReadinessArcProps) {
  const fraction =
    progress != null ? progress : score != null && max > 0 ? score / max : 0;
  const geo = arcGeometry(size, stroke, fraction, sweepDeg);
  const center = size / 2;
  // Rotate so the unpainted gap sits centered at the bottom.
  const rotation = 90 + (360 - sweepDeg) / 2;
  const pct = Math.round(clampProgress(fraction) * 100);

  const reducedMotion = useReducedMotion();
  const shouldReveal = animate && !reducedMotion;
  // Shared value tracks the *displayed* fill fraction. Static default = fraction.
  const fill = useSharedValue(shouldReveal ? 0 : clampProgress(fraction));

  React.useEffect(() => {
    if (shouldReveal) {
      fill.value = 0;
      fill.value = withTiming(clampProgress(fraction), {
        duration: 750,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      fill.value = clampProgress(fraction);
    }
    // `fill` is a stable shared value; re-run when the target or motion mode changes.
  }, [fraction, shouldReveal, fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: geo.arcLength * (1 - fill.value),
  }));

  return (
    <View
      style={[{ width: size, height: size }, style]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <G rotation={rotation} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={geo.radius}
            stroke={trackColor}
            strokeWidth={stroke}
            strokeDasharray={geo.dashArray}
            strokeLinecap="round"
            fill="none"
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={geo.radius}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={geo.dashArray}
            animatedProps={animatedProps}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
