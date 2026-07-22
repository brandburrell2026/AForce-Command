/**
 * WhyThisForYouCard — explains the personalization behind a HydroScan or
 * Smart Capture recommendation. Renders the dominant 1–3 signals as
 * chips so the user feels: "the system understands my body, intake, and
 * environment."
 *
 * Lives inside both `HydrationScanScreen` (above ProductFitCard) and
 * `SmartCaptureModal` (above the correction CTA). Pure presentation —
 * the signal derivation is in `utils/personalizationSignals.ts`.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import type { PersonalizationOutput } from '../utils/personalizationSignals';

interface Props {
  personalization: PersonalizationOutput;
  accentColor?: string;
  /** When true, renders the compact in-modal variant (no outer card). */
  compact?: boolean;
}

export function WhyThisForYouCard({ personalization, accentColor, compact }: Props) {
  const { t } = useTranslation();
  const accent = accentColor ?? Colors.accent.primary;
  const { reasons, summary } = personalization;

  // Even when there are no dominant reasons we still render the
  // "Tuned to your body" line so the user sees the system is adapting.
  const showChips = reasons.length > 0;

  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    compact ? <View style={styles.compactWrap}>{children}</View> : <View style={styles.card}>{children}</View>;

  return (
    <Container>
      <View style={styles.headerRow}>
        <Icon name="target" size={12} color={accent} />
        <Text style={[styles.eyebrow, { color: accent }]}>{summary.toUpperCase()}</Text>
      </View>
      {showChips && (
        <View style={styles.chipRow} accessibilityLabel={t('hydroScan2.cards.personalization_a11y')}>
          {reasons.map((r) => (
            <View
              key={r.key}
              style={[styles.chip, { borderColor: `${accent}55` }]}
              testID={`why-chip-${r.key}`}
            >
              <Text style={[styles.chipText, { color: Colors.text.primary }]} numberOfLines={1}>
                {r.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
    gap: 8,
  },
  compactWrap: {
    gap: 6,
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: Colors.fill.medium,
  },
  chipText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
});
