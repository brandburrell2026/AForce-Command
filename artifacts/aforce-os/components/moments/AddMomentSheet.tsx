/**
 * AddMomentSheet — manual Moment entry (Phase 2, founder approval
 * 2026-08-12). Required so Moments delivers value with ZERO calendar access
 * (Phase 3 is founder-gated). Deliberately dependency-free: day pills +
 * hour/minute steppers instead of a native date picker (no new packages).
 * Writes only to the Moments store — never the score path.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AFDisclosureSheet, AFPrimaryButton, AFSegmentedControl } from '@/components/ui';
import { af, afType } from '@/theme';
import type { MomentImportance, MomentType } from '@/types/moments';
import { addMoment } from '@/services/momentsStore';

const DAY_MS = 86_400_000;
const TYPES: MomentType[] = ['work', 'training', 'travel', 'recovery', 'personal', 'performance'];

export function AddMomentSheet({
  visible,
  onClose,
  baseNowIso,
}: {
  visible: boolean;
  onClose: () => void;
  baseNowIso: string;
}) {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [dayOffset, setDayOffset] = React.useState(0);
  const [hour, setHour] = React.useState(14);
  const [minute, setMinute] = React.useState(0);
  const [type, setType] = React.useState<MomentType>('work');
  const [importance, setImportance] = React.useState<MomentImportance>('high');
  const [prepGoal, setPrepGoal] = React.useState('');

  const save = () => {
    const title = name.trim();
    if (!title) return;
    const start = new Date(Date.parse(baseNowIso) + dayOffset * DAY_MS);
    start.setHours(hour, minute, 0, 0);
    addMoment({
      id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      source: 'manual',
      title,
      type,
      importance,
      startAtIso: start.toISOString(),
      prepGoal: prepGoal.trim() || undefined,
      createdAtIso: new Date().toISOString(),
    });
    setName('');
    setPrepGoal('');
    onClose();
  };

  return (
    <AFDisclosureSheet visible={visible} onClose={onClose} title={t('moments.add_title')} testID="add-moment-sheet">
      <Text style={styles.label}>{t('moments.add_name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('moments.add_name_placeholder')}
        placeholderTextColor={af.textTertiary}
        style={styles.input}
        accessibilityLabel={t('moments.add_name')}
        testID="add-moment-name"
      />

      <Text style={styles.label}>{t('moments.add_when')}</Text>
      <View style={styles.rowWrap}>
        {[0, 1, 2].map((i) => {
          const d = new Date(Date.parse(baseNowIso) + i * DAY_MS);
          const label =
            i === 0 ? t('moments.add_today') : i === 1 ? t('moments.add_tomorrow')
            : new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(d);
          const on = dayOffset === i;
          return (
            <Pressable
              key={i}
              onPress={() => setDayOffset(i)}
              style={[styles.pill, on && styles.pillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
        <View style={styles.timeGroup}>
          <Stepper value={hour} onChange={(v) => setHour((v + 24) % 24)} format={(v) => String(v).padStart(2, '0')} a11y="hour" />
          <Text style={styles.timeColon}>:</Text>
          <Stepper value={minute} onChange={(v) => setMinute(((v % 60) + 60) % 60)} step={15} format={(v) => String(v).padStart(2, '0')} a11y="minute" />
        </View>
      </View>

      <Text style={styles.label}>{t('moments.add_type')}</Text>
      <View style={styles.rowWrap}>
        {TYPES.map((k) => {
          const on = type === k;
          return (
            <Pressable
              key={k}
              onPress={() => setType(k)}
              style={[styles.pill, on && styles.pillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`add-moment-type-${k}`}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>
                {t(`moments.category_${k}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('moments.add_importance')}</Text>
      <AFSegmentedControl
        segments={(['high', 'moderate', 'low'] as const).map((k) => ({
          key: k,
          label: t(`moments.importance_${k}`),
        }))}
        value={importance}
        onChange={(key) => setImportance(key as MomentImportance)}
        testID="add-moment-importance"
      />

      <Text style={styles.label}>{t('moments.add_prep_goal')}</Text>
      <TextInput
        value={prepGoal}
        onChangeText={setPrepGoal}
        placeholder={t('moments.add_prep_goal_placeholder')}
        placeholderTextColor={af.textTertiary}
        style={styles.input}
        accessibilityLabel={t('moments.add_prep_goal')}
      />

      <View style={styles.saveWrap}>
        <AFPrimaryButton
          label={t('moments.add_save')}
          onPress={save}
          disabled={!name.trim()}
          testID="add-moment-save"
        />
      </View>
    </AFDisclosureSheet>
  );
}

function Stepper({
  value,
  onChange,
  step = 1,
  format,
  a11y,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  format: (v: number) => string;
  a11y: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(value - step)} hitSlop={8} accessibilityLabel={`decrease ${a11y}`}>
        <Text style={styles.stepperButton}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{format(value)}</Text>
      <Pressable onPress={() => onChange(value + step)} hitSlop={8} accessibilityLabel={`increase ${a11y}`}>
        <Text style={styles.stepperButton}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10, marginTop: 16, marginBottom: 8 },
  input: {
    ...afType.body, color: af.textPrimary, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  pillOn: { backgroundColor: af.red, borderColor: af.red },
  pillText: { ...afType.caption, color: af.textSecondary },
  pillTextOn: { color: af.onRed },
  timeGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  timeColon: { ...afType.bodyStrong, color: af.textSecondary },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  stepperButton: { ...afType.title3, color: af.textSecondary, minWidth: 18, textAlign: 'center' },
  stepperValue: { ...afType.bodyStrong, color: af.textPrimary, fontVariant: ['tabular-nums'], minWidth: 26, textAlign: 'center' },
  saveWrap: { marginTop: 20 },
});
