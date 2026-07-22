/**
 * AFMetric — a single value with label, optional unit, trend, and timestamp
 * (spec §5). Uses tabular numerals so digits don't jitter as values change.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../Icon';
import { af, afType } from '@/theme';
import { trendOf } from './afPrimitives.logic';

export interface AFMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Signed delta; drives the trend arrow + color. 0/undefined = flat/no trend. */
  trendDelta?: number | null;
  timestamp?: string;
  testID?: string;
}

const TREND_COLOR = { up: af.green, down: af.redText, flat: af.textTertiary } as const;
const TREND_ICON = { up: 'trending-up', down: 'trending-down', flat: 'minus' } as const;

export function AFMetric({ label, value, unit, trendDelta, timestamp, testID }: AFMetricProps) {
  const { direction, sign } = trendOf(trendDelta);
  const showTrend = trendDelta != null && direction !== 'flat';
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} allowFontScaling>
          {value}
        </Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {showTrend && (
        <View style={styles.trendRow} accessibilityLabel={`trend ${direction} ${Math.abs(trendDelta as number)}`}>
          <Icon name={TREND_ICON[direction]} size={12} color={TREND_COLOR[direction]} />
          <Text style={[styles.trend, { color: TREND_COLOR[direction] }]}>
            {sign}
            {Math.abs(trendDelta as number)}
          </Text>
        </View>
      )}
      {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { ...afType.eyebrow, color: af.textTertiary },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { ...afType.title1, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  unit: { ...afType.secondary, color: af.textSecondary },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trend: { ...afType.caption, fontVariant: ['tabular-nums'] },
  timestamp: { ...afType.caption, color: af.textTertiary },
});
