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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  // RC-1 fix: `value` and `compareAt` were two separately-labeled Text nodes
  // ("$29.99" then the hardcoded, non-localized "Was $39.99"), so a screen
  // reader announced them as two disconnected reads instead of one price.
  // Composed into a single "$X, was $Y" label on the row. RC-1 verdict-pass
  // correction: this previously reused `logIntake.score_was`, an orphan key
  // scoped to the intake-logging surface with a different meaning in
  // context; a pricing primitive should not borrow another feature's key.
  // Uses the dedicated `common.was` key instead (added alongside this fix;
  // see docs/i18n/TRANSLATION-REVIEW.md for its per-locale status).
  const composedLabel = compareAt ? `${value}, ${t('common.was')} ${compareAt}` : value;
  return (
    <View style={styles.wrap} testID={testID}>
      <View
        style={styles.row}
        accessible
        accessibilityRole="text"
        accessibilityLabel={composedLabel}
      >
        <Text style={[size === 'lg' ? styles.valueLg : styles.value]}>
          {value}
        </Text>
        {compareAt && (
          <Text style={styles.compareAt}>
            {compareAt}
          </Text>
        )}
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
