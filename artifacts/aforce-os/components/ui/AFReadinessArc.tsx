/**
 * AFReadinessArc — the "thin arc" behind a dominant readiness value (spec §5,
 * §8.2 Home). A partial arc (default 270°, gap centered at the bottom) with a
 * track + a progress stroke; center content is supplied as `children` (the
 * score, state, freshness). Static by default — a static arc IS the
 * reduced-motion presentation (spec §11); consumers may animate the fill.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { af } from '@/theme';
import { arcGeometry } from './afPrimitives.logic';

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

  return (
    <View style={[{ width: size, height: size }, style]} testID={testID}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
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
          <Circle
            cx={center}
            cy={center}
            r={geo.radius}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={geo.dashArray}
            strokeDashoffset={geo.dashoffset}
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
