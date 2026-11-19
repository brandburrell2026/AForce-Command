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

import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
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
  /**
   * The localized "{{min}} min" string. Used for the SCREEN READER only —
   * rendering it under the numeral printed the number twice (the E4 review
   * caught "15" above "15 min"). There is no bare unit key to render, and
   * D3 forbids adding one, so the visible unit is carried by the caption.
   */
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
      {/* minutesLabel is deliberately not rendered — see its prop doc. */}
      <Text
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        style={styles.numeral}
      >
        {minutes}
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
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The prototype's card: 20pt corner, a light numeral, a 4pt progress line.
  wrap: {
    marginTop: 20, padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: af.border, backgroundColor: af.surface,
  },
  numeral: { ...(edType.protoNumeral as TextStyle), color: af.textPrimary },
  caption: { ...(edType.protoEyebrow as TextStyle), color: af.textSecondary, marginTop: 10 },
  track: {
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    alignSelf: 'stretch',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fill: {},
});
