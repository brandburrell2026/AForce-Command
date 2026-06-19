/**
 * HydroScan 2.0™ — Consumption prompt.
 *
 * Asks "Did you consume this?" with three intents. Selecting one is an
 * ADVISORY signal only: the caller records it to local HydroScan History
 * and NEVER logs intake or mutates score (Score-Protection). "Log Intake"
 * remains the sole, explicit score path elsewhere on the screen.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../Icon';
import { Colors } from '@/theme/colors';
import type { ConsumptionStatus } from '@/types/scan';

const OPTIONS: { status: ConsumptionStatus; icon: string }[] = [
  { status: 'consumed', icon: 'check-circle' },
  { status: 'not_yet', icon: 'clock' },
  { status: 'just_curious', icon: 'help-circle' },
];

export function ConsumptionPrompt({
  selected,
  onSelect,
}: {
  selected: ConsumptionStatus | null;
  onSelect: (status: ConsumptionStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.card} testID="hydroscan2-consumption-prompt">
      <Text style={styles.eyebrow}>{t('hydroScan2.consumption.eyebrow')}</Text>
      <Text style={styles.question}>{t('hydroScan2.consumption.question')}</Text>

      <View style={styles.options}>
        {OPTIONS.map(({ status, icon }) => {
          const active = selected === status;
          const tint = active ? Colors.accent.brand : Colors.text.muted;
          return (
            <Pressable
              key={status}
              onPress={() => onSelect(status)}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: active ? Colors.accent.brand : Colors.border.medium,
                  backgroundColor: active ? `${Colors.accent.brand}12` : Colors.fill.light,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`hydroScan2.consumption.${status}`)}
              testID={`hydroscan2-consumption-${status}`}
            >
              <Icon name={icon} size={14} color={tint} />
              <Text style={[styles.optionText, { color: active ? Colors.text.primary : Colors.text.secondary }]}>
                {t(`hydroScan2.consumption.${status}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected !== null && (
        <Text style={styles.note}>{t('hydroScan2.consumption.advisoryNote')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    gap: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.8,
  },
  question: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  note: { fontSize: 11, color: Colors.text.muted, lineHeight: 16 },
});
