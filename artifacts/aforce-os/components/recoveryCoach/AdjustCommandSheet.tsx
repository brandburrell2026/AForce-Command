/**
 * AdjustCommandSheet — the "Adjust command" flow for the Recovery Coach (#332).
 * A bottom sheet with the three ways to adjust the active command: snooze the
 * recheck, log a different amount than prescribed, or dismiss. Presentation only
 * — the store actions (snooze / logIntake) are passed in by the route so this
 * stays free of store coupling.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AFDisclosureSheet, AFListRow, AFSectionLabel } from '@/components/ui';
import { af, afType } from '@/theme';

const DOSE_OPTIONS = [8, 12, 16, 20, 24] as const;

export interface AdjustCommandSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Snooze the recheck (store SNOOZE = +20 min) then leave the Coach. */
  onSnooze: () => void;
  /** Log a chosen oz amount instead of the prescribed dose, then leave. */
  onLogDose: (oz: number) => void;
  /** Close the Coach without acting. */
  onDismiss: () => void;
}

export function AdjustCommandSheet({
  visible,
  onClose,
  onSnooze,
  onLogDose,
  onDismiss,
}: AdjustCommandSheetProps) {
  const { t } = useTranslation();
  return (
    <AFDisclosureSheet visible={visible} onClose={onClose} title={t('coach.v2.adjust')}>
      <AFListRow
        icon="clock"
        title={t('home.snooze')}
        subtitle={t('coach.v2.snooze_subtitle')}
        onPress={onSnooze}
        testID="adjust-snooze"
      />

      <View style={styles.section}>
        <AFSectionLabel label={t('coach.v2.log_different')} />
        <View style={styles.doseRow}>
          {DOSE_OPTIONS.map((oz) => (
            <Pressable
              key={oz}
              onPress={() => onLogDose(oz)}
              accessibilityRole="button"
              accessibilityLabel={t('coach.v2.log_oz_a11y', { oz })}
              testID={`adjust-dose-${oz}`}
              style={({ pressed }) => [styles.doseChip, pressed && styles.doseChipPressed]}
            >
              <Text style={styles.doseText}>{t('coach.v2.dose_oz', { oz })}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AFListRow icon="x" title={t('coach.v2.dismiss')} onPress={onDismiss} testID="adjust-dismiss" />
      </View>
    </AFDisclosureSheet>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  doseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  doseChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
  },
  doseChipPressed: { backgroundColor: af.surfacePressed },
  doseText: { ...afType.bodyStrong, color: af.textPrimary },
});
