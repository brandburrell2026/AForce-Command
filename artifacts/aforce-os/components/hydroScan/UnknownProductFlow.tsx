/**
 * HydroScan 2.0™ — never-dead-end unknown-product flow.
 *
 * When a scan can't recognize a product, the user is never left at an
 * error. They pick a coarse category + (optional) amount + whether they
 * consumed it, and we record an ADVISORY HydroScan History row with a
 * conservative impact/timing headline. Nothing here mutates score
 * (Score-Protection); "Log Intake" remains the only score path.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '../Icon';
import { Colors } from '@/theme/colors';
import type { ConsumptionStatus, UnknownProductType } from '@/types/scan';

const TYPES: { type: UnknownProductType; icon: string }[] = [
  { type: 'water', icon: 'droplet' },
  { type: 'protein', icon: 'activity' },
  { type: 'energy', icon: 'zap' },
  { type: 'supplement', icon: 'info' },
  { type: 'other', icon: 'help-circle' },
];

const OZ_OPTIONS = [8, 12, 16, 20] as const;

const CONSUMPTION: ConsumptionStatus[] = ['consumed', 'not_yet', 'just_curious'];

export interface UnknownProductRecord {
  type: UnknownProductType;
  approxOz: number | null;
  consumption: ConsumptionStatus;
}

export function UnknownProductFlow({
  onRecord,
  saved,
}: {
  onRecord: (record: UnknownProductRecord) => void;
  saved: boolean;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<UnknownProductType | null>(null);
  const [approxOz, setApproxOz] = useState<number | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionStatus>('consumed');

  if (saved) {
    return (
      <View style={[styles.card, styles.savedCard]} testID="hydroscan2-unknown-saved">
        <Icon name="check-circle" size={16} color={Colors.states.PEAK.primary} />
        <Text style={styles.savedText}>{t('hydroScan2.unknown.saved')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="hydroscan2-unknown-flow">
      <View style={styles.header}>
        <Icon name="help-circle" size={14} color={Colors.accent.brand} />
        <Text style={styles.title}>{t('hydroScan2.unknown.title')}</Text>
      </View>
      <Text style={styles.hint}>{t('hydroScan2.unknown.hint')}</Text>

      {/* Category */}
      <Text style={styles.sectionLabel}>{t('hydroScan2.unknown.typeLabel')}</Text>
      <View style={styles.chips}>
        {TYPES.map(({ type: ty, icon }) => {
          const active = type === ty;
          return (
            <Pressable
              key={ty}
              onPress={() => setType(ty)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: active ? Colors.accent.brand : Colors.border.medium,
                  backgroundColor: active ? `${Colors.accent.brand}12` : Colors.fill.light,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`hydroscan2-unknown-type-${ty}`}
            >
              <Icon name={icon} size={11} color={active ? Colors.accent.brand : Colors.text.muted} />
              <Text style={[styles.chipText, { color: active ? Colors.text.primary : Colors.text.secondary }]}>
                {t(`hydroScan2.unknown.type.${ty}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Approx amount (optional) */}
      <Text style={styles.sectionLabel}>{t('hydroScan2.unknown.amountLabel')}</Text>
      <View style={styles.chips}>
        {OZ_OPTIONS.map((oz) => {
          const active = approxOz === oz;
          return (
            <Pressable
              key={oz}
              onPress={() => setApproxOz(active ? null : oz)}
              style={({ pressed }) => [
                styles.ozChip,
                {
                  borderColor: active ? Colors.accent.brand : Colors.border.medium,
                  backgroundColor: active ? `${Colors.accent.brand}12` : Colors.fill.light,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`hydroscan2-unknown-oz-${oz}`}
            >
              <Text style={[styles.chipText, { color: active ? Colors.text.primary : Colors.text.secondary }]}>
                {t('hydroScan2.unknown.oz', { oz })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Consumption */}
      <Text style={styles.sectionLabel}>{t('hydroScan2.consumption.question')}</Text>
      <View style={styles.chips}>
        {CONSUMPTION.map((c) => {
          const active = consumption === c;
          return (
            <Pressable
              key={c}
              onPress={() => setConsumption(c)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: active ? Colors.accent.brand : Colors.border.medium,
                  backgroundColor: active ? `${Colors.accent.brand}12` : Colors.fill.light,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`hydroscan2-unknown-consumption-${c}`}
            >
              <Text style={[styles.chipText, { color: active ? Colors.text.primary : Colors.text.secondary }]}>
                {t(`hydroScan2.consumption.${c}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => type && onRecord({ type, approxOz, consumption })}
        disabled={type === null}
        style={({ pressed }) => [
          styles.saveBtn,
          {
            borderColor: Colors.accent.brand,
            opacity: type === null ? 0.4 : pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('hydroScan2.unknown.save')}
        testID="hydroscan2-unknown-save"
      >
        <Icon name="check-circle" size={14} color={Colors.accent.brand} />
        <Text style={[styles.saveText, { color: Colors.accent.brand }]}>
          {t('hydroScan2.unknown.save')}
        </Text>
      </Pressable>
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
  savedCard: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text.primary },
  hint: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.6,
    marginTop: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  ozChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  saveText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
});
