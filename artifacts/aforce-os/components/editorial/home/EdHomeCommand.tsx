/**
 * EdHomeCommand — The Cover's command presentation (E2; Black Issue restyle
 * 2026-10-06).
 *
 * COMMAND CONTRACT (locked): renders the guarded canonical RecoveryCommand
 * VERBATIM — the title/instruction handed in are the same
 * parseEngineActionCopy output HomeScreenV2 renders, and the rationale is
 * the same guarded explanation. This block authors nothing: no dose, no
 * timing, no urgency, no eligibility.
 *
 * Black Issue: red mono kicker ("YOUR NEXT MOVE"), the command as the
 * statement, the quiet reason line, and the outlined "WHY THIS?" pill. The
 * primary action is optional here — the Cover renders its full-width CTA
 * at the foot of the screen (reference layout); when a caller passes
 * `primaryLabel` + `onPrimary` the ghost button renders as before. Open-only
 * either way (CORRECTION 2): it never logs.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { commandReasonLine } from '@/components/ui/afPrimitives.logic';
import { AF_MAX_DISPLAY_FONT_SCALE, af } from '@/theme';
import { edRhythm, edType } from '@/theme/editorialTokens';

import { useEdInk } from '../core';

export function EdHomeCommand({
  kicker,
  title,
  instruction,
  rationale,
  whyLabel,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
}: {
  kicker: string;
  title: string;
  instruction?: string;
  rationale?: string;
  whyLabel: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
}) {
  const ink = useEdInk();
  const [showWhy, setShowWhy] = React.useState(false);
  const reason = commandReasonLine(rationale);
  return (
    <View testID="editorial-command">
      <Text style={[edType.caption as TextStyle, { color: af.redText }]}>{kicker.toUpperCase()}</Text>
      <Text
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        style={[edType.statement as TextStyle, { color: ink.primary, marginTop: 8 }]}
      >
        {title}
      </Text>
      {instruction ? (
        <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 6 }]}>
          {instruction}
        </Text>
      ) : null}
      {reason ? (
        <Text
          style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 8 }]}
          testID="editorial-command-reason"
        >
          {showWhy && rationale ? rationale : reason.line}
        </Text>
      ) : null}
      {reason?.hasMore ? (
        <Pressable
          onPress={() => setShowWhy((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showWhy }}
          hitSlop={8}
          style={styles.whyTarget}
          testID="editorial-command-why"
        >
          {/* 44pt target around a 28pt outlined pill — the reference's
              WHY THIS? chip, in the AA red text token. */}
          <View style={[styles.whyPill, { borderColor: af.redText }]}>
            <Text style={[edType.micro as TextStyle, { color: af.redText }]}>{whyLabel.toUpperCase()}</Text>
          </View>
        </Pressable>
      ) : null}
      {primaryLabel && onPrimary ? (
        <Pressable
          onPress={onPrimary}
          disabled={primaryLoading}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          accessibilityState={{ disabled: primaryLoading, busy: primaryLoading }}
          style={({ pressed }) => [
            styles.primary,
            { borderColor: ink.primary, opacity: primaryLoading ? 0.5 : pressed ? 0.75 : 1 },
          ]}
          testID="editorial-command-primary"
        >
          <Text
            maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
            style={[edType.confirm as TextStyle, { color: ink.primary }]}
          >
            {primaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  whyTarget: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
  },
  whyPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  primary: {
    marginTop: 14,
    minHeight: edRhythm.minTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
});
