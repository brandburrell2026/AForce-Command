/**
 * EdFeatureNumbers — the Feature's pull numbers (E5).
 *
 * The spec's move: "Streak 5 beside honest em-dashes — Collecting states keep
 * their dignity in print." A value that was measured prints as a number; a
 * value whose source did not answer prints as the em dash, at the same size and
 * in the same row, without apology or a smaller typographic class.
 *
 * The dash comes from `edNumberDisplay` via EdNumber — the E1 primitive that
 * already encodes the truthful-neutral rule (a measured 0 is data and prints as
 * `0`; only null/undefined/NaN print as `—`) and already speaks "no reading"
 * to a screen reader instead of a silent glyph.
 *
 * FOUNDER DECISION D1 (2026-08-30): no positive hue on this stock. Soursop
 * Green measures 2.48:1 against paper — below the 4.5:1 text floor and below
 * even the 3:1 graphical floor — so a "good" number here is carried by weight,
 * rule and position, never by colour. EdNumber's own ink split (measured =
 * primary ink, unmeasured = quiet ink) is the entire visual hierarchy.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EdNumber } from '../index';

export interface FeatureNumber {
  /** Null when the source did not answer — prints as the em dash. */
  value: number | null;
  /** Caption furniture, e.g. "CURRENT STREAK". EdNumber speaks it. */
  label: string;
  /** Optional inline unit ("days") — set on the value, not the caption, so a
   *  two-word caption never wraps under its own number. */
  unit?: string;
  testID?: string;
}

export function EdFeatureNumbers({ numbers }: { numbers: FeatureNumber[] }) {
  return (
    <View style={styles.row}>
      {numbers.map((n) => (
        // EdNumber composes its own accessible group (including the "no
        // reading" label for an unmeasured value), so this wrapper carries
        // only layout — nesting a second accessible node would flatten it.
        <View key={n.label} style={styles.cell} testID={n.testID}>
          <EdNumber value={n.value} unit={n.unit} role="numberFeature" caption={n.label} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 28,
    rowGap: 18,
    marginTop: 22,
  },
  cell: { minWidth: 72 },
});
