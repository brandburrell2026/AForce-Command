/**
 * EdHomeSignalFooter — The Cover's honest-signals furniture (E2).
 *
 * Mono footer of the same four readings the V3 grid shows, computed by the
 * SAME honest formatters (formatHydrationPct / formatSleepHours /
 * formatHrvMs) and the same permanent Recovery em-dash. Absent readings
 * stay em-dashes — nothing is manufactured to fill the row.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import { edType } from '@/theme/editorialTokens';

import { EdRule, useEdInk } from '../core';

function FooterSignal({ label, value }: { label: string; value: string }) {
  const ink = useEdInk();
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} style={styles.signal}>
      <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{label}</Text>
      <Text style={[edType.data as TextStyle, { color: ink.primary, marginTop: 3 }]}>{value}</Text>
    </View>
  );
}

export function EdHomeSignalFooter({
  signals,
}: {
  signals: ReadonlyArray<{ label: string; value: string }>;
}) {
  return (
    <View testID="editorial-signal-footer">
      <EdRule />
      <View style={styles.row}>
        {signals.map((s) => (
          <FooterSignal key={s.label} label={s.label} value={s.value} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 26,
    rowGap: 12,
  },
  signal: {
    minWidth: 64,
  },
});
