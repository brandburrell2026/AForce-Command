/**
 * AForce Concierge — remembered preferences (see / edit / forget).
 *
 * Preference memory is distinct from health records: nothing here reads or
 * writes intake, scores, or device data. Every save goes through the server's
 * consent-gated PUT; every forget is a DELETE the member taps. The screen also
 * says plainly when nothing is stored.
 */
import React from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import {
  AFCard,
  AFInlineErrorRow,
  AFPrimaryButton,
  AFScreen,
  AFSecondaryButton,
  AFSectionLabel,
  AFSegmentedControl,
  AFSkeleton,
  AFTextButton,
  AFTopBar,
} from '@/components/ui';
import { classifyConciergeError, conciergeApi } from '@/services/concierge/conciergeApi';
import type { ConciergePreferences, ConciergePreferencesRecord } from '@/services/concierge/conciergeTypes';

type ToneValue = NonNullable<ConciergePreferences['tone']> | 'none';
const TONES: ToneValue[] = ['none', 'rock', 'bb', 'surge', 'sage'];

export function ConciergeMemoryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [record, setRecord] = React.useState<ConciergePreferencesRecord | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [goal, setGoal] = React.useState('');
  const [routine, setRoutine] = React.useState('');
  const [tone, setTone] = React.useState<ToneValue>('none');

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await conciergeApi.getPreferences();
      setRecord(res.preferences);
      setGoal(res.preferences?.prefs.primaryGoal ?? '');
      setRoutine(res.preferences?.prefs.routine ?? '');
      setTone(res.preferences?.prefs.tone ?? 'none');
    } catch (err) {
      setRecord(null);
      setError(classifyConciergeError(err) === 'offline' ? t('concierge.state.offline_title') : t('common.error'));
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await conciergeApi.savePreferences({
        primaryGoal: goal.trim() || null,
        routine: routine.trim() || null,
        tone: tone === 'none' ? null : tone,
      });
      setRecord(res.preferences);
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  }, [goal, routine, tone, t]);

  const forgetNote = React.useCallback(
    async (index: number) => {
      setBusy(true);
      try {
        const res = await conciergeApi.forgetPreference(`notes.${index}`);
        setRecord(res.preferences);
      } catch {
        setError(t('common.error'));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const forgetAll = React.useCallback(() => {
    const run = async () => {
      setBusy(true);
      try {
        await conciergeApi.forgetAllPreferences();
        setRecord(null);
        setGoal('');
        setRoutine('');
        setTone('none');
      } catch {
        setError(t('common.error'));
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') {
      void run();
      return;
    }
    Alert.alert(t('concierge.memory.forget_all_title'), t('concierge.memory.forget_all_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('concierge.memory.forget_all'), style: 'destructive', onPress: () => void run() },
    ]);
  }, [t]);

  const consentLine = record?.consentAt
    ? t('concierge.memory.consent_line', {
        date: new Date(record.consentAt).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }),
      })
    : t('concierge.memory.session_only');

  return (
    <AFScreen scroll contentContainerStyle={styles.content}>
      <AFTopBar
        eyebrow={t('concierge.memory.eyebrow')}
        title={t('concierge.memory.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
      />
      <Text style={styles.intro}>{t('concierge.memory.intro')}</Text>

      {record === undefined ? (
        <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
          <AFSkeleton height={44} radius={12} />
          <AFSkeleton height={44} radius={12} />
          <AFSkeleton height={44} radius={12} />
        </View>
      ) : (
        <>
          {error ? <AFInlineErrorRow message={error} onRetry={() => void load()} retryLabel={t('common.retry')} /> : null}
          {record === null ? <Text style={styles.empty}>{t('concierge.memory.empty')}</Text> : null}

          <AFCard variant="raised" style={styles.card}>
            <AFSectionLabel label={t('concierge.memory.goal')} />
            <TextInput
              value={goal}
              onChangeText={setGoal}
              placeholder={t('concierge.memory.not_set')}
              placeholderTextColor={af.textTertiary}
              style={styles.input}
              accessibilityLabel={t('concierge.memory.goal')}
              maxLength={160}
              testID="concierge-memory-goal"
            />
            <AFSectionLabel label={t('concierge.memory.routine')} />
            <TextInput
              value={routine}
              onChangeText={setRoutine}
              placeholder={t('concierge.memory.not_set')}
              placeholderTextColor={af.textTertiary}
              style={styles.input}
              accessibilityLabel={t('concierge.memory.routine')}
              maxLength={160}
              testID="concierge-memory-routine"
            />
            <AFSectionLabel label={t('concierge.memory.tone')} />
            <AFSegmentedControl
              segments={TONES.map((v) => ({ key: v, label: t(`concierge.tone.${v}`).split(' — ')[0] ?? v }))}
              value={tone}
              onChange={(v) => setTone(v as ToneValue)}
              testID="concierge-memory-tone"
            />
            <View style={styles.saveRow}>
              <AFPrimaryButton label={t('common.save')} onPress={() => void save()} loading={busy} testID="concierge-memory-save" />
            </View>
            <Text style={styles.consent}>{consentLine}</Text>
          </AFCard>

          {record?.prefs.notes && record.prefs.notes.length > 0 ? (
            <AFCard style={styles.card}>
              <AFSectionLabel label={t('concierge.memory.notes')} />
              {record.prefs.notes.map((note, i) => (
                <View key={`${i}-${note}`} style={styles.noteRow}>
                  <Text style={styles.note}>{note}</Text>
                  <AFTextButton
                    label={t('concierge.memory.forget')}
                    onPress={() => void forgetNote(i)}
                    disabled={busy}
                    testID={`concierge-memory-forget-note-${i}`}
                  />
                </View>
              ))}
            </AFCard>
          ) : null}

          {record ? (
            <View style={styles.forgetAll}>
              <AFSecondaryButton label={t('concierge.memory.forget_all')} onPress={forgetAll} disabled={busy} testID="concierge-memory-forget-all" />
            </View>
          ) : null}
        </>
      )}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48, gap: afLayout.cardGap },
  intro: { ...afType.secondary, color: af.textSecondary, marginBottom: 8 },
  skeletons: { gap: 12 },
  empty: { ...afType.secondary, color: af.textTertiary },
  card: { gap: 10 },
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
  saveRow: { marginTop: 6 },
  consent: { ...afType.caption, color: af.textTertiary },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: afLayout.controlMinHeight },
  note: { ...afType.secondary, color: af.textPrimary, flex: 1 },
  forgetAll: { marginTop: 8 },
});
