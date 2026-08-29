/**
 * EdHomeCommand — The Cover's command presentation (E2).
 *
 * COMMAND CONTRACT (locked): renders the guarded canonical RecoveryCommand
 * VERBATIM — the title/instruction handed in are the same
 * parseEngineActionCopy output HomeScreenV2 renders, and the rationale is
 * the same guarded explanation. This block authors nothing: no dose, no
 * timing, no urgency, no eligibility. The primary action opens the logging
 * surface; it never logs (open-only, per CORRECTION 2).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { commandReasonLine } from '@/components/ui/afPrimitives.logic';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { edAccent, edRhythm, edType } from '@/theme/editorialTokens';

import { useEdInk } from '../core';

export function EdHomeCommand({
  kicker,
  title,
  instruction,
  rationale,
  whyLabel,
  primaryLabel,
  onPrimary,
  primaryLoading,
}: {
  kicker: string;
  title: string;
  instruction?: string;
  rationale?: string;
  whyLabel: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading: boolean;
}) {
  const ink = useEdInk();
  const [showWhy, setShowWhy] = React.useState(false);
  const reason = commandReasonLine(rationale);
  return (
    <View testID="editorial-command">
      <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>
        <Text style={{ color: edAccent.red }}>{'—— '}</Text>
        {kicker}
      </Text>
      <Text
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        style={[edType.command as TextStyle, { color: ink.primary, marginTop: 10 }]}
      >
        {title}
      </Text>
      {instruction ? (
        <Text style={[edType.body as TextStyle, { color: ink.primary, marginTop: 6 }]}>
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
          style={styles.whyChip}
          testID="editorial-command-why"
        >
          <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{whyLabel}</Text>
        </Pressable>
      ) : null}
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
        testID="editorial-log-water"
      >
        <Text
          maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
          style={[edType.confirm as TextStyle, { color: ink.primary }]}
        >
          {primaryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  whyChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
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
