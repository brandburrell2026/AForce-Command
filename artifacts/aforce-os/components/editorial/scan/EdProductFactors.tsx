/**
 * EdProductFactors — the product-factor evidence rows (E6-B).
 *
 * These are LOOKED UP or CALCULATED facts about the product. Not one of them
 * involves the member, and the section eyebrow above says so — that separation
 * is the whole point of the classification (founder ruling D1/D3).
 *
 * Two rules do the honest work here:
 *
 *  D5 — an UNKNOWN attribute has no value. It prints the em dash and NO bar,
 *       because a bar drawn at any width is a measurement we do not have. This
 *       is the defect E6-B0 fixed at the source: absent sugar used to arrive
 *       as 0 and render as the best possible score.
 *
 *  D3 — provenance rides with the value. Every catalog row is an ESTIMATE
 *       today, AForce's own products included, so the mark is not a badge of
 *       shame on competitors — it is the truth about the whole table.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import type { AttributeProvenance } from '@/types/comparison';
import { edInkFor, edRhythm, edType } from '@/theme/editorialTokens';

import { PROVENANCE_LABEL } from './editorialScanPresentation';

export interface ProductFactor {
  label: string;
  /** `null` = UNKNOWN. A measured 0 is data and renders as 0. */
  value: number | null;
  provenance: AttributeProvenance;
  testID?: string;
}

export function EdProductFactors({ factors }: { factors: ProductFactor[] }) {
  const ink = edInkFor('black');
  return (
    <View style={styles.rows}>
      {factors.map((f) => {
        const unknown = f.value == null;
        // Spoken as one sentence. A screen reader otherwise hears the label,
        // a bare number and a provenance word as three unrelated fragments —
        // and the provenance is the part that changes what the number means.
        const spoken = unknown
          ? `${f.label}: not on file.`
          : `${f.label}: ${f.value} out of 100. ${PROVENANCE_LABEL[f.provenance]}.`;
        return (
          <View
            key={f.label}
            accessible
            accessibilityLabel={spoken}
            style={styles.row}
            testID={f.testID}
          >
            {/* `flex: 1` sets flexBasis 0, which forces the label to shrink
                below its content and break mid-word once Dynamic Type grows.
                Shrink-with-a-floor lets the row wrap instead. */}
            <Text style={[edType.micro as TextStyle, { color: ink.quiet, flexShrink: 1, minWidth: 130 }]}>
              {f.label}
            </Text>
            <Text style={[edType.data as TextStyle, { color: unknown ? ink.quiet : ink.primary }]}>
              {unknown ? '—' : f.value}
            </Text>
            <Text style={[edType.micro as TextStyle, { color: ink.quiet, minWidth: 74, textAlign: 'right' }]}>
              {PROVENANCE_LABEL[f.provenance]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 14,
    rowGap: 4,
    flexWrap: 'wrap',
    minHeight: edRhythm.minTarget * 0.6,
    paddingVertical: 7,
  },
});
