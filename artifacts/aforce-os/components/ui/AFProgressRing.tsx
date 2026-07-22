/**
 * AFProgressRing — a determinate full-circle ring with an accessible percentage
 * (spec §5). Center content (e.g. "38%") is supplied as `children`. Static;
 * consumers animate the fill if desired (reduced-motion default is static).
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
  children,
  style,
  testID,
}: AFProgressRingProps) {
  const geo = ringGeometry(size, stroke, progress);
  const center = size / 2;
  const pct = Math.round(clampProgress(progress) * 100);

  return (
    <View
      style={[{ width: size, height: size }, style]}
      testID={testID}
      accessibilityRole="progressbar"
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
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
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
