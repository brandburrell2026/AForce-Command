/**
 * EdCanonicalClock — the Brief's single instrument (E4, Decision 1).
 *
 * The engine's `riskTimer` made visible: `nextRecheckMinutes` as an editorial
 * numeral over a hairline gauge. The gauge's length is the SAME
 * completed/total the checklist states in words — the completion ring folded
 * in, per the founder ruling, so the screen carries one dominant instrument
 * instead of two.
 *
 * It computes nothing. No second clock, no readiness score, no percentage,
 * no derived progress metric.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { edAccent, edInkFor, edType } from '@/theme/editorialTokens';

export function EdCanonicalClock({
  minutes,
  minutesLabel,
  caption,
  gaugeFraction,
  a11yLabel,
}: {
  /** engine riskTimer, via deriveProtocol.nextRecheckMinutes. */
  minutes: number;
  /** Localized "{{min}} min"-style unit line, passed in already resolved. */
  minutesLabel: string;
  /** Mono caption naming what the number is. */
  caption: string;
  /** 0..1 — the checklist's own completed/total, nothing else. */
  gaugeFraction: number;
  a11yLabel: string;
}) {
  const ink = edInkFor('black');
  const pct = Math.max(0, Math.min(1, gaugeFraction));
  return (
    <View accessible accessibilityLabel={a11yLabel} style={styles.wrap} testID="editorial-canonical-clock">
      <Text
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        style={[edType.numberHero as TextStyle, { color: ink.primary }]}
      >
        {minutes}
      </Text>
      <Text style={[edType.caption as TextStyle, { color: ink.quiet, marginTop: 2 }]}>
        {minutesLabel}
      </Text>
      {/* The hairline gauge — the folded-in completion ring. Decorative:
          the checklist below says the same thing in words. */}
      {/* Laid out by flex ratio rather than a percentage string — this screen
          renders no percentage anywhere, in copy or in style (Decision 1). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.track, { backgroundColor: ink.rule }]}
      >
        <View style={[styles.fill, { flex: pct, backgroundColor: edAccent.red }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 8 }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  track: {
    height: StyleSheet.hairlineWidth * 2,
    marginTop: 14,
    alignSelf: 'stretch',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fill: {},
});
