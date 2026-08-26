/**
 * AFCommandCard — the signature "one command" surface (spec §5, §8.2/§8.10):
 * eyebrow → command → instruction → ONE-LINE reason → primary action → full
 * rationale disclosure.
 *
 * Every field is a prop — the card NEVER invents copy, dose, or timer (spec §6:
 * command surfaces derive from one normalized RecoveryCommand).
 *
 * Wave 5: the reason line is inline. Hiding the whole rationale behind the
 * disclosure (spec §8.10) meant WHY — the north star's fourth question — cost a
 * tap, so the card answered three of four at a glance. The card now shows the
 * rationale's first sentence (via the pure `commandReasonLine`) and keeps the
 * disclosure ONLY when the full text actually says more; when it doesn't, the
 * disclosure was a control that revealed what was already on screen.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { af, afType, afLayout } from '@/theme';
import { AFCard } from './AFCard';
import { AFPrimaryButton, AFSecondaryButton, AFTextButton } from './AFButton';
import { commandReasonLine } from './afPrimitives.logic';

export interface AFCommandCardProps {
  eyebrow?: string;
  title: string;
  instruction: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  rationale?: string;
  whyLabel?: string;
  testID?: string;
}

export function AFCommandCard({
  eyebrow = 'Your next move',
  title,
  instruction,
  primaryLabel,
  onPrimary,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  rationale,
  whyLabel = 'Why this command',
  testID,
}: AFCommandCardProps) {
  const [showWhy, setShowWhy] = React.useState(false);
  const reason = commandReasonLine(rationale);
  return (
    <AFCard variant="raised" testID={testID}>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.instruction}>{instruction}</Text>

      {reason && (
        <Text style={styles.reason} numberOfLines={1} ellipsizeMode="tail" testID="af-command-reason">
          {reason.line}
        </Text>
      )}

      <View style={styles.actions}>
        <AFPrimaryButton label={primaryLabel} onPress={onPrimary} loading={primaryLoading} />
        {secondaryLabel && onSecondary && (
          <AFSecondaryButton label={secondaryLabel} onPress={onSecondary} />
        )}
      </View>

      {reason?.hasMore && (
        <View style={styles.why}>
          <AFTextButton
            label={whyLabel}
            icon={showWhy ? 'chevron-up' : 'chevron-down'}
            onPress={() => setShowWhy((v) => !v)}
          />
          {showWhy && <Text style={styles.rationale}>{rationale}</Text>}
        </View>
      )}
    </AFCard>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...afType.eyebrow, color: af.textTertiary, marginBottom: 8 },
  title: { ...afType.title1, color: af.textPrimary },
  instruction: { ...afType.body, color: af.textSecondary, marginTop: 6 },
  // Quieter than the instruction on purpose: the reason supports the command,
  // it never competes with it for the one-action read.
  reason: { ...afType.caption, color: af.textTertiary, marginTop: 8 },
  actions: { marginTop: afLayout.cardPadding, gap: 12 },
  why: { marginTop: 8 },
  rationale: { ...afType.secondary, color: af.textSecondary, marginTop: 4 },
});
