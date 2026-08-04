/**
 * AFInlineErrorRow — small, in-place failure notice + retry affordance.
 *
 * Distinct from `AFErrorState` (a full-block, centered empty/error page for
 * when a whole screen has nothing else to show). This is the "one row inside
 * an otherwise-working screen just failed" case (RC-1 audit P1-7): a cart
 * checkout call, a WHOOP status check, an Apple Health snapshot fetch. Modeled
 * on `ConnectedHealthView`'s row-status affordances — the same af.* tokens,
 * the same small cyan text-button shape as its "Troubleshoot" action — so a
 * failure inside a card reads as part of the same design language rather than
 * a jarring native `Alert`.
 *
 * Never a dialog: the row renders inline, `accessibilityRole="alert"` so a
 * screen reader announces it once, and the retry action is a plain in-line
 * Pressable (44pt hit target via hitSlop) — the caller supplies `onRetry`,
 * which is always an EXISTING retry path (this component invents no new
 * retry logic of its own).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { af, afType } from '@/theme';

export interface AFInlineErrorRowProps {
  /** Plain-language, already-resolved failure message (no i18n key here). */
  message: string;
  onRetry: () => void;
  /** Already-resolved retry label (defaults to "Retry" via the caller's own t()). */
  retryLabel: string;
  testID?: string;
}

export function AFInlineErrorRow({ message, onRetry, retryLabel, testID }: AFInlineErrorRowProps) {
  return (
    <View
      style={styles.row}
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Icon name="alert-circle" size={14} color={af.redText} />
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={onRetry}
        hitSlop={10}
        style={styles.retryBtn}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
      >
        <Text style={styles.retryText}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
  },
  message: { ...afType.caption, color: af.textSecondary, flex: 1 },
  retryBtn: { minHeight: 32, paddingHorizontal: 4, justifyContent: 'center' },
  retryText: { ...afType.caption, color: af.cyan, fontWeight: '700' },
});
