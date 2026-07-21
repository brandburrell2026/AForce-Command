/**
 * AFPrice — money display primitive (spec §5, Phase 3). Presentation-ONLY: it
 * takes pre-formatted strings, never cents or pricing math. All price
 * computation stays in the authoritative `data/pricing.ts` / server, so this
 * primitive can never introduce a mispricing (money-path safety).
 *
 * Tabular numerals so digits align; compare-at renders struck-through and
 * muted; caption (e.g. "$0.99 / serving") sits below.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { af, afType } from '@/theme';

export interface AFPriceProps {
  /** Pre-formatted price, e.g. "$29.99". */
  value: string;
  /** Optional struck-through original price, e.g. "$39.99". */
  compareAt?: string;
  /** Optional sub-line, e.g. "$0.99 / serving". */
  caption?: string;
  size?: 'md' | 'lg';
  testID?: string;
}

export function AFPrice({ value, compareAt, caption, size = 'md', testID }: AFPriceProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <Text style={[size === 'lg' ? styles.valueLg : styles.value]} accessibilityLabel={value}>
          {value}
        </Text>
        {compareAt && <Text style={styles.compareAt}>{compareAt}</Text>}
      </View>
      {caption && <Text style={styles.caption}>{caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  value: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  valueLg: { ...afType.title1, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  compareAt: {
    ...afType.secondary,
    color: af.textTertiary,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  caption: { ...afType.caption, color: af.textTertiary },
});
