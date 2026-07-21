/**
 * AFCommandCard — the signature "one command" surface (spec §5, §8.2/§8.10):
 * eyebrow → command → instruction → primary action → rationale disclosure.
 *
 * Every field is a prop — the card NEVER invents copy, dose, or timer (spec §6:
 * command surfaces derive from one normalized RecoveryCommand). The rationale
 * lives behind a "Why this command" disclosure, not always-on (spec §8.10).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { af, afType, afLayout } from '@/theme';
import { AFCard } from './AFCard';
import { AFPrimaryButton, AFSecondaryButton, AFTextButton } from './AFButton';

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
  return (
    <AFCard variant="raised" testID={testID}>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.instruction}>{instruction}</Text>

      <View style={styles.actions}>
        <AFPrimaryButton label={primaryLabel} onPress={onPrimary} loading={primaryLoading} />
        {secondaryLabel && onSecondary && (
          <AFSecondaryButton label={secondaryLabel} onPress={onSecondary} />
        )}
      </View>

      {rationale && (
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
  actions: { marginTop: afLayout.cardPadding, gap: 12 },
  why: { marginTop: 8 },
  rationale: { ...afType.secondary, color: af.textSecondary, marginTop: 4 },
});
