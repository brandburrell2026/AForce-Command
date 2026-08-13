/**
 * AFProgressRing — a determinate full-circle ring with an accessible percentage
 * (spec §5). Center content (e.g. "38%") is supplied as `children`. Static;
 * consumers animate the fill if desired (reduced-motion default is static).
 *
 * A11y (Wave-5 Phase-1 pass — chart/visualisation text alternative): the ring
 * declared `accessibilityRole="progressbar"` + `accessibilityValue` on a bare
 * `View` and unconditionally hid its centered children. A View is NOT an
 * accessibility element on iOS unless `accessible` is set (the same fact that
 * broke AFCard's composed labels), so the role/value were never exposed there
 * — and the `{pct}%` Text the caller put in the middle was the only remaining
 * text alternative, explicitly hidden. Net result on Hydration: the intake ring
 * was unreachable by VoiceOver, and on Android it announced a nameless bar.
 *
 * The rule now is that the ring can never end up with NEITHER: pass
 * `accessibilityLabel` and the ring becomes one named progressbar (children
 * hidden, because they only repeat it visually); omit it and the children stay
 * in the accessibility tree as the text alternative. Callers that had no label
 * therefore keep a readable percentage instead of silence.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { af } from '@/theme';
import { ringGeometry, clampProgress } from './afPrimitives.logic';

export interface AFProgressRingProps {
  progress: number; // 0…1
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  /**
   * Names the ring for assistive tech (e.g. "Hydration, 38% of today's
   * target"). When present the ring becomes ONE progressbar element and the
   * centered children are hidden as a visual duplicate; when absent the
   * children stay readable so the reading is never lost entirely.
   */
  accessibilityLabel?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AFProgressRing({
  progress,
  size = 96,
  stroke = 8,
  color = af.red,
  trackColor = af.divider,
  accessibilityLabel,
  children,
  style,
  testID,
}: AFProgressRingProps) {
  const geo = ringGeometry(size, stroke, progress);
  const center = size / 2;
  const pct = Math.round(clampProgress(progress) * 100);
  const named = accessibilityLabel != null && accessibilityLabel !== '';

  return (
    <View
      style={[{ width: size, height: size }, style]}
      testID={testID}
      accessible={named}
      accessibilityRole="progressbar"
      accessibilityLabel={named ? accessibilityLabel : undefined}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Start at 12 o'clock: rotate the drawing -90°. */}
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={geo.radius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={geo.radius}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={geo.circumference}
            strokeDashoffset={geo.dashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      {children != null && (
        <View
          style={styles.center}
          // Hidden ONLY when the ring names itself — otherwise this centered
          // reading is the ring's only text alternative.
          accessibilityElementsHidden={named}
          importantForAccessibility={named ? 'no-hide-descendants' : undefined}
        >
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
