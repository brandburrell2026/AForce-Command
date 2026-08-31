/**
 * EdIntakeConfirm — the review-and-confirm block of the Scan intake lifecycle
 * (RP-6, founder ruling R4, 2026-08-31).
 *
 * PRESENTATIONAL ONLY: the write lives in the screen's confirmation handler;
 * this block renders the lifecycle's three states and raises callbacks.
 *
 *   review   quantity adjustment around the product's serving size, bounded
 *            by the Decision Guard ceiling — the member decides, then confirms
 *   logged   the recorded amount with an UNDO affordance (the server keeps an
 *            append-only correction; nothing is ever deleted)
 *   undone   a quiet receipt that today's counters no longer include it
 *
 * Subordinate by design — recognition is not consumption, so this block never
 * demands: no urgency vocabulary, quiet type, and the screen renders it only
 * behind the canonical recommendation gate.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { edInkFor, edRhythm, edType } from '@/theme/editorialTokens';

import { EdCaption } from '../index';

interface Props {
  productName: string;
  oz: number;
  minOz: number;
  maxOz: number;
  stepOz: number;
  busy: boolean;
  logged: boolean;
  undone: boolean;
  onAdjust: (deltaOz: number) => void;
  onConfirm: () => void;
  onUndo: () => void;
}

export function EdIntakeConfirm({
  productName,
  oz,
  minOz,
  maxOz,
  stepOz,
  busy,
  logged,
  undone,
  onAdjust,
  onConfirm,
  onUndo,
}: Props) {
  const ink = edInkFor('black');

  if (undone) {
    return (
      <View style={styles.block} testID="ed-scan-intake-undone">
        <EdCaption text="REMOVED FROM TODAY" />
        <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 8 }]}>
          The record is kept. The amount no longer counts toward today.
        </Text>
      </View>
    );
  }

  if (logged) {
    return (
      <View style={styles.block} testID="ed-scan-intake-logged">
        <EdCaption text="RECORDED" />
        <Text style={[edType.body as TextStyle, { color: ink.primary, marginTop: 8 }]}>
          {`${oz} oz · ${productName}`}
        </Text>
        <Pressable
          onPress={onUndo}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Undo the recorded ${oz} ounces of ${productName}`}
          accessibilityState={{ busy, disabled: busy }}
          hitSlop={8}
          style={styles.target}
          testID="ed-scan-intake-undo"
        >
          <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>UNDO</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.block} testID="ed-scan-intake-review">
      <EdCaption text="LOG THIS INTAKE" />
      <View style={styles.amountRow}>
        <Pressable
          onPress={() => onAdjust(-stepOz)}
          disabled={busy || oz - stepOz < minOz}
          accessibilityRole="button"
          accessibilityLabel="Smaller amount"
          accessibilityState={{ disabled: busy || oz - stepOz < minOz }}
          hitSlop={8}
          style={styles.stepTarget}
          testID="ed-scan-intake-minus"
        >
          <Text style={[edType.data as TextStyle, { color: ink.primary }]}>−</Text>
        </Pressable>
        <Text
          accessibilityLabel={`${oz} ounces`}
          style={[edType.data as TextStyle, { color: ink.primary }]}
        >
          {`${oz} oz`}
        </Text>
        <Pressable
          onPress={() => onAdjust(stepOz)}
          disabled={busy || oz + stepOz > maxOz}
          accessibilityRole="button"
          accessibilityLabel="Larger amount"
          accessibilityState={{ disabled: busy || oz + stepOz > maxOz }}
          hitSlop={8}
          style={styles.stepTarget}
          testID="ed-scan-intake-plus"
        >
          <Text style={[edType.data as TextStyle, { color: ink.primary }]}>+</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onConfirm}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Confirm and log ${oz} ounces of ${productName}`}
        accessibilityState={{ busy, disabled: busy }}
        hitSlop={8}
        style={styles.target}
        testID="ed-scan-intake-confirm"
      >
        <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>CONFIRM</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 26 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 22,
    marginTop: 10,
  },
  stepTarget: {
    minHeight: edRhythm.minTarget,
    minWidth: edRhythm.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  target: {
    marginTop: 14,
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
