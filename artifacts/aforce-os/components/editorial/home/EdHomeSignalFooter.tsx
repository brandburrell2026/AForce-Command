/**
 * EdHomeSignalFooter — The Cover's honest-signals row (E2; Black Issue
 * restyle 2026-10-06).
 *
 * The same four readings the V3 grid shows, computed by the SAME honest
 * formatters (formatHydrationPct / formatSleepHours / formatHrvMs) and the
 * same permanent Recovery em-dash. Absent readings stay em-dashes — nothing
 * is manufactured to fill the row. Black Issue: mono labels over bold
 * values, four across, a hairline above and below; the first signal
 * (hydration) carries the one red accent as AA red text.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import { AF_MAX_DISPLAY_FONT_SCALE, af } from '@/theme';
import { edType } from '@/theme/editorialTokens';

import { EdRule, useEdInk } from '../core';

function FooterSignal({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const ink = useEdInk();
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} style={styles.signal}>
      <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{label.toUpperCase()}</Text>
      <Text
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        style={[edType.confirm as TextStyle, { color: accent ? af.redText : ink.primary, marginTop: 5 }]}
      >
        {value}
      </Text>
    </View>
  );
}

export function EdHomeSignalFooter({
  signals,
}: {
  signals: ReadonlyArray<{ label: string; value: string; accent?: boolean }>;
}) {
  return (
    <View testID="editorial-signal-footer">
      <EdRule />
      <View style={styles.row}>
        {signals.map((s) => (
          <FooterSignal key={s.label} label={s.label} value={s.value} accent={s.accent} />
        ))}
      </View>
      <EdRule />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 18,
    rowGap: 12,
  },
  signal: {
    minWidth: 64,
    flexGrow: 1,
  },
});
