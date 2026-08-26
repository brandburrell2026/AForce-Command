/**
 * HomeBaselineHero — what stands in the readiness slot before AForce has
 * observed anything (Wave 5, founder ruling 2026-08-12). The gate that decides
 * when this renders lives in `homeBaselineState.ts`; this file is only the
 * treatment.
 *
 * It occupies the hero slot, it does not add to it: one eyebrow naming the
 * slot, one statement, one line of supporting copy. No number, no band word,
 * no arc, no second call to action — the member's one move is still the
 * command card directly beneath, and the copy points at it rather than
 * competing with it.
 *
 * Tone is load-bearing here, not decoration. Missing observation is not a
 * deficit, so this is not an error, not an empty box, not a spinner, and never
 * Signal Red as text: the only red is the short divider rule (a fill — the
 * brand's N–N monogram idiom), which is what keeps the block reading as
 * intentional rather than as something that failed to load.
 *
 * Store-free and router-free by design — af.* tokens plus i18n only — so it
 * can be render-tested directly, per this directory's convention of never
 * mounting the connected `HomeScreenV2` container in tests (see
 * `__tests__/homeScreenV2Wiring.test.ts`'s header).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { af, afType, Spacing, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

export interface HomeBaselineHeroProps {
  testID?: string;
}

export function HomeBaselineHero({ testID }: HomeBaselineHeroProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap} testID={testID}>
      {/* Same eyebrow the arc carries, so the slot keeps its identity: this is
          where readiness will live once there is something to show. */}
      <Text style={styles.eyebrow}>{t('home.v2.readiness_label')}</Text>
      <Text style={styles.title} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
        {t('home.v2.baseline_title')}
      </Text>
      <View style={styles.rule} />
      <Text style={styles.body}>{t('home.v2.baseline_body')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches `HomeScreenV2`'s `arcWrap` rhythm so the slot sits where the arc
  // sits, and the day the member's first log arrives nothing jumps sideways.
  wrap: { alignItems: 'center', marginVertical: 24, paddingVertical: Spacing[4] },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  // The dominant element in the slot — and deliberately far quieter than the
  // 76pt score numeral it stands in for. The screen must not look more certain
  // than the data is.
  title: { ...afType.title1, color: af.textPrimary, marginTop: Spacing[3], textAlign: 'center' },
  // Signal Red as a FILL only (af.red fails AA as text on dark — see
  // theme/afTokens.ts); the brand divider, not an alert.
  rule: { width: 28, height: 2, borderRadius: 1, backgroundColor: af.red, marginVertical: Spacing[4] },
  // Capped so the two lines break evenly instead of running the full width.
  body: { ...afType.secondary, color: af.textSecondary, textAlign: 'center', maxWidth: 300 },
});
