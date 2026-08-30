/**
 * EdRegistrationTarget — the barcode target (E6-B, founder ruling D2).
 *
 * The production scanner is a live barcode decoder: it takes no photograph,
 * stores none and transmits none. The old viewfinder hid that — a reticule
 * inside a circular ring is the visual grammar of photographic capture and
 * analysis, which is exactly the impression the product law forbids.
 *
 * This is a REGISTRATION TARGET: four corner marks on a black plate, the
 * printer's mark for aligning a page, and the shape a barcode reader actually
 * wants. No ring, no lens, no shutter, no crosshair.
 *
 * Nothing here animates. A pulsing or sweeping target reads as *scanning
 * something* — the diagnostic impression again — and the Reduce Motion rule
 * would only hide it for some members rather than fix it for all.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import { edAccent, edInkFor, edRhythm, edType } from '@/theme/editorialTokens';

export function EdRegistrationTarget({
  label,
  note,
  testID,
}: {
  /** e.g. "POINT AT BARCODE" — what the member is being asked to do. */
  label: string;
  /** Optional technical truth, e.g. "BARCODE DETECTION · ON DEVICE". */
  note?: string;
  testID?: string;
}) {
  const ink = edInkFor('black');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={note ? `${label}. ${note}` : label}
      style={styles.plate}
      testID={testID}
    >
      {/* Four registration corners. Marked as decorative: the composed label
          above already says what this is, and eight sibling views would
          otherwise be read out one by one. */}
      <View
        style={StyleSheet.absoluteFill}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </View>

      <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>{label}</Text>
      {note ? (
        <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 8 }]}>{note}</Text>
      ) : null}
    </View>
  );
}

const CORNER = 22;
const W = 2;

const styles = StyleSheet.create({
  plate: {
    // Clear of the statement above it. Without this the top corner marks sit
    // in the headline's descender space and read as part of the word.
    marginTop: 26,
    minHeight: edRhythm.minTarget * 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: edAccent.red,
  },
  tl: { top: 0, left: 0, borderTopWidth: W, borderLeftWidth: W },
  tr: { top: 0, right: 0, borderTopWidth: W, borderRightWidth: W },
  bl: { bottom: 0, left: 0, borderBottomWidth: W, borderLeftWidth: W },
  br: { bottom: 0, right: 0, borderBottomWidth: W, borderRightWidth: W },
});
