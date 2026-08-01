/**
 * AFMotionPressable (E3) — the premium press primitive.
 *
 * A Pressable that compresses slightly on press (tokenized `afMotion.scale`) and
 * can fire a meaningful haptic — the uniform "premium press feel". It is
 * reduced-motion aware (via the shared `useReducedMotion`): when motion is off
 * (flag off, reduced-motion, or disabled) it renders a plain Pressable with only
 * the opacity/tone `pressedStyle` — the static alternative — so callers get
 * byte-identical behavior to today when `motionEnabled` is false. Pure decisions
 * live in `motionLogic.ts`; the scale animation cleans itself up on unmount.
 */
import React from 'react';
import {
  Pressable,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { afMotion } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { shouldAnimate, pressScale, type HapticKind } from './motionLogic';
import { fireHaptic } from '@/services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface AFMotionPressableProps {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Applied while pressed (opacity/tone) — the reduced-motion fallback. */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Elite motion on/off (usually a feature flag). Default false → static. */
  motionEnabled?: boolean;
  /** Haptic to fire on press-in when motion is on. Default none. */
  haptic?: HapticKind | false;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  accessibilityState?: { disabled?: boolean; busy?: boolean };
  testID?: string;
  hitSlop?: number;
}

export function AFMotionPressable({
  onPress,
  disabled,
  style,
  pressedStyle,
  motionEnabled = false,
  haptic = false,
  children,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
  hitSlop,
}: AFMotionPressableProps) {
  const reducedMotion = useReducedMotion();
  const animate = shouldAnimate({ enabled: motionEnabled, reducedMotion }) && !disabled;
  const scale = useSharedValue<number>(afMotion.scale.rest);
  const [pressed, setPressed] = React.useState(false);

  React.useEffect(() => () => cancelAnimation(scale), [scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const toScale = (isDown: boolean) => {
    scale.value = withTiming(pressScale({ animate, pressed: isDown }), {
      duration: afMotion.durations.fast,
      easing: Easing.out(Easing.quad),
    });
  };

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      hitSlop={hitSlop}
      onPressIn={() => {
        setPressed(true);
        toScale(true);
        if (haptic) fireHaptic(haptic, { enabled: motionEnabled });
      }}
      onPressOut={() => {
        setPressed(false);
        toScale(false);
      }}
      style={[style, animatedStyle, pressed ? pressedStyle : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
