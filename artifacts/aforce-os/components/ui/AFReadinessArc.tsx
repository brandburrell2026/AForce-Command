/**
 * AFReadinessArc — the "thin arc" behind a dominant readiness value (spec §5,
 * §8.2 Home). A partial arc (default 270°, gap centered at the bottom) with a
 * track + a progress stroke; center content is supplied as `children` (the
 * score, state, freshness). Static by default — a static arc IS the
 * reduced-motion presentation (spec §11).
 *
 * Opt-in `animate` — this component carries TWO of the four Wave-5 signature
 * moments, and they are the same gesture at two speeds:
 *
 *   HYDROSTATE REVEAL (Home)      — first paint draws the stroke in from empty.
 *   RITUAL PROGRESSION (Protocol) — a later change animates from WHERE THE ARC
 *                                   ALREADY IS to the new fraction.
 *
 * The second half is why the effect below tracks whether it has drawn once.
 * Re-running the reveal on every `fraction` change (the previous behavior) made
 * a completed Protocol step read as "the ring restarted" instead of "the ring
 * advanced" — the opposite of progression. Reduced-motion collapses both to the
 * static render, so a non-animated caller is byte-for-byte unchanged.
 *
 * Wave-5 removal: the opt-in "alive" breathing halo is gone. It was an
 * unbounded `withRepeat` glow behind the stroke — a decorative loop competing
 * with the number it framed, and per the founder's brief constant pulsing is
 * removed rather than tuned down.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  cancelAnimation,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { af, afMotion } from '@/theme';
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
  /**
   * Draw the progress stroke: reveal from empty on first paint, then animate
   * from the current fill to any later `fraction`. Ignored under reduced-motion.
   */
  animate?: boolean;
  /**
   * Hide the arc AND its centered children from assistive tech. Set this when an
   * accessible ancestor already announces the same reading — Home wraps the arc
   * in a labelled `Pressable` ("Readiness 76, PEAK"), so without this the hero
   * announces twice: once as that button, once as this progressbar. Default false
   * keeps every other caller's output unchanged.
   */
  a11yHidden?: boolean;
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
  a11yHidden = false,
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
  const shouldDraw = animate && !reducedMotion;
  // Shared value tracks the *displayed* fill fraction. Static default = fraction.
  const fill = useSharedValue(shouldDraw ? 0 : clampProgress(fraction));
  // Has this arc already drawn itself in? The first pass is the REVEAL (from
  // empty); every pass after it is PROGRESSION (from wherever the stroke
  // currently sits). A ref, not state — flipping it must not re-render.
  const hasRevealed = React.useRef(!shouldDraw);

  React.useEffect(() => {
    const target = clampProgress(fraction);
    if (!shouldDraw) {
      // Static alternative: the arc simply IS its value. Cancel first so a
      // mid-flight draw can't keep writing after reduced-motion turns on.
      cancelAnimation(fill);
      fill.value = target;
      hasRevealed.current = true;
      return;
    }
    // Reveal: start from empty. Progression: start from the current fill, which
    // is what `fill.value` already holds — so we simply do not reset it.
    if (!hasRevealed.current) fill.value = 0;
    hasRevealed.current = true;
    fill.value = withTiming(target, {
      duration: afMotion.durations.cinematic,
      easing: Easing.out(Easing.cubic),
    });
    // `fill` is a stable shared value; re-run when the target or motion mode changes.
  }, [fraction, shouldDraw, fill]);

  // Nothing here loops, but a finite tween can still be in flight at unmount —
  // cancel so no animation outlives the component (Wave-4 rule).
  React.useEffect(() => () => cancelAnimation(fill), [fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: geo.arcLength * (1 - fill.value),
  }));

  return (
    <View
      style={[{ width: size, height: size }, style]}
      testID={testID}
      accessibilityRole={a11yHidden ? undefined : 'progressbar'}
      accessibilityValue={a11yHidden ? undefined : { min: 0, max: 100, now: pct }}
      accessibilityElementsHidden={a11yHidden}
      importantForAccessibility={a11yHidden ? 'no-hide-descendants' : undefined}
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
