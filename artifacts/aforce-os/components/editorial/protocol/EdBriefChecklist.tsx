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

import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
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
  pendingLabel,
}: {
  steps: readonly BriefStep[];
  /** Localized state words, resolved by the caller. */
  doneLabel: string;
  activeLabel: string;
  /** State word for a not-yet-active step — its window is a TIME, not a state. */
  pendingLabel: string;
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
        // ...but a pending row's trailing slot is its WINDOW, which is a time,
        // not a state. The spoken label therefore always carries a real state
        // word AND the window, so a reader is never left to infer the state
        // from a clock (E4 review).
        const spokenState = step.complete ? doneLabel : live ? activeLabel : pendingLabel;
        const a11y = [step.label, spokenState, step.complete || live ? '' : step.window]
          .filter((part) => part.trim().length > 0)
          .join(', ');
        return (
          <View key={step.id}>
            <EdRule />
            <View
              accessible
              accessibilityLabel={a11y}
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
                /* The live row is display-voice (edType.command), so it caps
                   at the house boundary like every other statement — an
                   oversized word must never force an iOS mid-word break. */
                maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
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
