/**
 * EdBriefChecklist — the Brief's behavioural steps as rows under hairlines
 * (E4). Per Decision 1 this is the TRUTHFUL step-completion representation:
 * the clock's gauge is a visual echo of it, never a substitute.
 *
 * Rows carry the step's own label and window verbatim from `deriveProtocol`.
 * No doses anywhere — the step windows already mirror the canonical
 * riskTimer, which is the only cadence Protocol may show.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import { edInkFor, edPositive, edType } from '@/theme/editorialTokens';

import { EdRule } from '../core';

export interface BriefStep {
  id: string;
  label: string;
  window: string;
  complete: boolean;
}

export function EdBriefChecklist({
  steps,
  doneLabel,
  activeLabel,
}: {
  steps: readonly BriefStep[];
  /** Localized state words, resolved by the caller. */
  doneLabel: string;
  activeLabel: string;
}) {
  const ink = edInkFor('black');
  const activeIndex = steps.findIndex((s) => !s.complete);
  return (
    <View testID="editorial-brief-checklist">
      {steps.map((step, i) => {
        const live = i === activeIndex;
        // State is said in words on every row — the mark is never the only
        // carrier of whether a step is done.
        const state = step.complete ? doneLabel : live ? activeLabel : step.window;
        return (
          <View key={step.id}>
            <EdRule />
            <View
              accessible
              accessibilityLabel={`${step.label}, ${state}`}
              style={styles.row}
              testID={`editorial-brief-step-${step.id}`}
            >
              <Text
                style={[
                  edType.micro as TextStyle,
                  { color: step.complete ? edPositive : ink.quiet, width: 18 },
                ]}
              >
                {step.complete ? '✓' : '—'}
              </Text>
              <Text
                style={[
                  (live ? edType.command : edType.body) as TextStyle,
                  { color: step.complete ? ink.quiet : ink.primary, flexShrink: 1 },
                ]}
              >
                {step.label}
              </Text>
              <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{state}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
    flexWrap: 'wrap',
    rowGap: 2,
    paddingVertical: 4,
  },
});
