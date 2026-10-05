/**
 * AForce Concierge — optional first-run setup (no wearable required).
 *
 * Three short questions — goal, routine, tone — plus an explicit "save to my
 * account" switch. Saving is OFF by default: with it off, the answers shape
 * this session only and nothing is stored. Skip is always one tap away.
 */
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { AFPrimaryButton, AFSegmentedControl, AFTextButton } from '@/components/ui';
import type { ConciergePreferences } from '@/services/concierge/conciergeTypes';

export const GOAL_KEYS = ['training', 'work', 'travel', 'family', 'general'] as const;
export type GoalKey = (typeof GOAL_KEYS)[number];
const TONE_KEYS = ['none', 'rock', 'bb', 'surge', 'sage'] as const;
type ToneKey = (typeof TONE_KEYS)[number];

export interface IntroResult {
  prefs: ConciergePreferences;
  save: boolean;
}

export interface ConciergeIntroCardProps {
  onStart: (result: IntroResult) => void;
  onSkip: () => void;
  testID?: string;
}

export function ConciergeIntroCard({ onStart, onSkip, testID = 'concierge-intro' }: ConciergeIntroCardProps) {
  const { t } = useTranslation();
  const [goal, setGoal] = React.useState<GoalKey | null>(null);
  const [routine, setRoutine] = React.useState('');
  const [tone, setTone] = React.useState<ToneKey>('none');
  const [save, setSave] = React.useState(false);

  const start = () => {
    onStart({
      prefs: {
        primaryGoal: goal ? t(`concierge.intro_goal.${goal}`) : null,
        routine: routine.trim() || null,
        tone: tone === 'none' ? null : tone,
      },
      save,
    });
  };

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title} accessibilityRole="header">{t('concierge.intro_title')}</Text>
      <Text style={styles.body}>{t('concierge.intro_body')}</Text>

      <Text style={styles.label}>{t('concierge.intro_goal_label')}</Text>
      <View style={styles.chips}>
        {GOAL_KEYS.map((k) => {
          const selected = goal === k;
          return (
            <Pressable
              key={k}
              onPress={() => setGoal(selected ? null : k)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`concierge.intro_goal.${k}`)}
              style={[styles.chip, selected && styles.chipSelected]}
              testID={`${testID}-goal-${k}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(`concierge.intro_goal.${k}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('concierge.intro_routine_label')}</Text>
      <TextInput
        value={routine}
        onChangeText={setRoutine}
        placeholder={t('concierge.intro_routine_placeholder')}
        placeholderTextColor={af.textTertiary}
        style={styles.input}
        maxLength={160}
        accessibilityLabel={t('concierge.intro_routine_label')}
        testID={`${testID}-routine`}
      />

      <Text style={styles.label}>{t('concierge.intro_tone_label')}</Text>
      <AFSegmentedControl
        segments={TONE_KEYS.map((k) => ({ key: k, label: t(`concierge.tone.${k}`).split(' — ')[0] ?? k }))}
        value={tone}
        onChange={(k) => setTone(k as ToneKey)}
        testID={`${testID}-tone`}
      />

      <View style={styles.saveRow}>
        <View style={styles.saveText}>
          <Text style={styles.saveLabel}>{t('concierge.intro_save_label')}</Text>
          <Text style={styles.saveHint}>{t('concierge.intro_save_hint')}</Text>
        </View>
        <Switch
          value={save}
          onValueChange={setSave}
          trackColor={{ false: af.surfaceRaised, true: af.green }}
          thumbColor={af.textPrimary}
          ios_backgroundColor={af.surfaceRaised}
          accessibilityLabel={t('concierge.intro_save_label')}
          testID={`${testID}-save`}
        />
      </View>

      <View style={styles.actions}>
        <AFTextButton label={t('concierge.intro_skip')} onPress={onSkip} testID={`${testID}-skip`} />
        <AFPrimaryButton label={t('concierge.intro_start')} onPress={start} style={styles.start} testID={`${testID}-start`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: afLayout.cardPadding,
    borderRadius: afLayout.radiusCard,
    backgroundColor: af.surface,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    gap: 10,
  },
  title: { ...afType.title3, color: af.textPrimary },
  body: { ...afType.secondary, color: af.textSecondary },
  label: { ...afType.caption, color: af.textTertiary, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: afLayout.controlMinHeight,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: afLayout.radiusPill,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    backgroundColor: af.canvasElevated,
  },
  chipSelected: { borderColor: af.redHairline, backgroundColor: af.redDim },
  chipText: { ...afType.secondary, color: af.textSecondary },
  chipTextSelected: { color: af.textPrimary },
  input: {
    ...afType.body,
    color: af.textPrimary,
    minHeight: afLayout.controlMinHeight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    backgroundColor: af.canvasElevated,
  },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  saveText: { flex: 1, gap: 2 },
  saveLabel: { ...afType.secondary, color: af.textPrimary },
  saveHint: { ...afType.caption, color: af.textTertiary },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 6 },
  start: { minWidth: 140 },
});
