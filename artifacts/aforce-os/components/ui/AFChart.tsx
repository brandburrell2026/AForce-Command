/**
 * AFChart — a compact line/bar chart with an accessible summary (spec §5, §11:
 * charts require a plain-language summary + accessible data representation).
 * Scaling math lives in `chartScale` (pure, tested); this is the SVG shell.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Rect, Line } from 'react-native-svg';
import { af, afType } from '@/theme';
import { chartScale } from './afPrimitives.logic';

export interface AFChartProps {
  values: number[];
  labels?: string[];
  mode?: 'line' | 'bar';
  height?: number;
  color?: string;
  /** Plain-language summary read by screen readers in place of the SVG. */
  summary?: string;
  testID?: string;
}

const WIDTH = 320; // logical; the Svg scales to container via viewBox

export function AFChart({
  values,
  labels,
  mode = 'line',
  height = 120,
  color = af.red,
  summary,
  testID,
}: AFChartProps) {
  const { points, polyline, min, max } = chartScale(values, WIDTH, height, 8);
  const autoSummary =
    summary ??
    (values.length
      ? `${mode} chart, ${values.length} points, range ${min} to ${max}.`
      : 'No data.');

  return (
    <View testID={testID}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={autoSummary}
        style={{ height }}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none">
          <Line x1={0} y1={height - 8} x2={WIDTH} y2={height - 8} stroke={af.divider} strokeWidth={1} />
          {mode === 'line' && points.length > 1 && (
            <Polyline points={polyline} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {mode === 'line' &&
            points.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />)}
          {mode === 'bar' &&
            points.map((p, i) => (
              <Rect key={i} x={p.x - 8} y={p.y} width={16} height={height - 8 - p.y} rx={3} fill={color} />
            ))}
        </Svg>
      </View>
      {labels && (
        <View style={styles.labels}>
          {labels.map((l, i) => (
            <Text key={`${l}-${i}`} style={styles.label}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { ...afType.caption, color: af.textTertiary },
});
