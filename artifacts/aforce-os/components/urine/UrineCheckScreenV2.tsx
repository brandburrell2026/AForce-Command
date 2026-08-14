/**
 * UrineCheckScreenV2 — Phase 3 redesign of the Urine Hydration Check (spec §5),
 * rendered when `spec_urine` is on. Same data + the SAME live write path as the
 * legacy screen (`updateSymptoms` / `updateEnergyState` / `confirmStatus`) — this
 * screen mutates the hydration/readiness store, so those calls are preserved
 * verbatim (must not regress). Presentation only on the af.* system.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AFScreen,
  AFTopBar,
  AFCard,
  AFSectionLabel,
  AFPrimaryButton,
  AFStatusBadge,
  type AFStatusTone,
} from '@/components/ui';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { classifyWriteFailure, WRITE_FAILURE_COPY } from '@/store/app/writeFailure';
import { SYMPTOM_CATALOG, ENERGY_STATE_OPTIONS } from '@/data/mockData';
import type { UserState } from '@/types';
import {
  assessUrineColor,
  urineColorForSignal,
  URINE_COLOR_OPTIONS,
  URINE_COLOR_SIGNAL,
  URINE_DISCLAIMER,
  type UrineColor,
  type UrineCheckResult,
  type UrineSeverity,
} from '@/services/urineHydrationCheck';

const SEVERITY: Record<UrineSeverity, { color: string; tone: AFStatusTone }> = {
  stable: { color: af.green, tone: 'positive' },
  good: { color: af.cyan, tone: 'info' },
  support: { color: af.amber, tone: 'caution' },
  correction: { color: af.red, tone: 'critical' },
};

const haptic = (kind: 'select' | 'heavy') => {
  import('expo-haptics')
    .then((m) =>
      (kind === 'heavy' ? m.impactAsync(m.ImpactFeedbackStyle.Heavy) : m.selectionAsync()).catch(
        () => {},
      ),
    )
    .catch(() => {});
};

export function UrineCheckScreenV2({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<UrineColor | null>(null);
  const result: UrineCheckResult | null = selection ? assessUrineColor(selection) : null;
  const sev = result ? SEVERITY[result.severity] : null;

  const { state, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus } =
    useAppStore();
  const { userState, engineOutput } = state;

  const [symptoms, setSymptoms] = useState<string[]>(userState.symptoms);
  const [energy, setEnergy] = useState<UserState['energyState']>(userState.energyState);
  useEffect(() => setSymptoms(userState.symptoms), [userState.symptoms]);
  useEffect(() => setEnergy(userState.energyState), [userState.energyState]);
  // Seed the picker from PERSISTED state, the same way symptoms and energy are
  // seeded above. Without this the tiles reset to "nothing chosen" on every
  // reload even though the signal was saved, which reads as the save having
  // failed. Re-runs when the store adopts server state so another device's
  // check-in is reflected here too.
  useEffect(() => {
    setSelection(urineColorForSignal(userState.urineSignal));
  }, [userState.urineSignal]);

  const toggleSymptom = (id: string) => {
    haptic('select');
    setSymptoms((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  // LIVE write path. The symptom/energy/check-in calls are preserved verbatim
  // from the legacy screen; the urine signal is the one addition.
  //
  // Until now the chosen color lived only in `selection` and was dropped on
  // confirm — the screen rendered a verdict from it but never wrote it, so the
  // hydration score never saw the check. `updateUrineSignal` already existed and
  // was already wired through the store to `POST /aforce/urine`; it simply had
  // no caller. Nothing new is computed here: the tile is translated to the
  // persisted scale and handed to the existing action.
  const handleConfirm = async () => {
    haptic('heavy');
    try {
      await Promise.all([
        updateSymptoms(symptoms),
        updateEnergyState(energy),
        // Skipped when no tile is chosen: the member confirming symptoms alone
        // must not silently overwrite a previously recorded signal.
        ...(selection ? [updateUrineSignal(URINE_COLOR_SIGNAL[selection])] : []),
      ]);
      await confirmStatus();
    } catch (err) {
      // A failed check-in used to reach console only, so the member was told
      // nothing and believed it saved. Reuses the same classifier and copy the
      // intake path uses — no new vocabulary, no new locale keys — so a urine
      // failure reads as truthfully as a lost intake does.
      const failure = classifyWriteFailure(err);
      Alert.alert(
        t(`common.action_failed_title.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].title,
        }),
        t(`common.action_failed_body.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].body,
        }),
      );
    }
  };

  return (
    <AFScreen scroll>
      <AFTopBar eyebrow={t('urine.v2.eyebrow')} title={t('urine.v2.title')} onBack={onBack} />
      <Text style={styles.disclaimer}>{URINE_DISCLAIMER}</Text>

      {/* Color tiles — real swatch hexes preserved */}
      <View style={styles.tileGrid}>
        {URINE_COLOR_OPTIONS.map((opt) => {
          const active = selection === opt.color;
          return (
            <Pressable
              key={opt.color}
              onPress={() => setSelection(opt.color)}
              accessibilityRole="button"
              accessibilityLabel={t('urine.v2.select_a11y', { label: opt.label })}
              accessibilityState={{ selected: active }}
              testID={`urine-color-${opt.color}`}
              style={[styles.tile, { borderColor: active ? af.red : af.border }]}
            >
              <View style={[styles.swatch, { backgroundColor: opt.hex }]} />
              <Text style={styles.tileLabel}>{opt.label.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Verdict */}
      {result && sev ? (
        <AFCard variant="standard" style={{ borderColor: sev.color }} testID="urine-check-result">
          <AFStatusBadge label={result.colorLabel} tone={sev.tone} icon={null} />
          <Text style={styles.verdict} testID="urine-check-verdict">
            {result.verdict}
          </Text>
          <Text style={styles.detail}>{result.detail}</Text>
          <View style={[styles.recCard, { borderColor: sev.color }]}>
            {/* Border keeps the severity color; the label uses redText for the
                'correction' band so red text stays WCAG-AA on the dark card. */}
            <Text style={[styles.recLabel, { color: result.severity === 'correction' ? af.redText : sev.color }]}>{t('urine.v2.recommended')}</Text>
            <Text style={styles.recBody}>{result.recommendation}</Text>
          </View>
        </AFCard>
      ) : (
        <AFCard>
          <Text style={styles.placeholder}>{t('urine.v2.placeholder')}</Text>
        </AFCard>
      )}

      {/* Performance signals */}
      <View style={styles.section}>
        <AFSectionLabel label={t('urine.v2.performance_signals')} action={{ label: t('urine.v2.signals_active', { count: symptoms.length }), onPress: () => {} }} />
        <AFCard>
          <View style={styles.chipRow}>
            {SYMPTOM_CATALOG.map((s) => {
              const active = symptoms.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggleSymptom(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && { borderColor: af.red, backgroundColor: af.redDim }]}
                >
                  <Text style={[styles.chipText, { color: active ? af.red : af.textSecondary }]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </AFCard>
      </View>

      {/* Energy state */}
      <View style={styles.section}>
        <AFSectionLabel label={t('urine.v2.energy_state')} />
        <View style={styles.energyGrid}>
          {ENERGY_STATE_OPTIONS.map((opt) => {
            const selected = energy === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  haptic('select');
                  setEnergy(opt.value);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.energyTile,
                  {
                    borderColor: selected ? opt.color : af.border,
                    backgroundColor: selected ? `${opt.color}14` : af.surface,
                  },
                ]}
              >
                <Text style={[styles.energyLabel, { color: opt.color }]}>{opt.label}</Text>
                <Text style={styles.energyDesc}>{opt.desc}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Live score preview */}
      <View style={styles.section}>
        <AFCard>
          <Text style={styles.previewLabel}>{t('urine.v2.current_score')}</Text>
          <Text style={styles.previewScore}>{engineOutput.score}</Text>
          <Text style={styles.previewState}>
            {engineOutput.performanceState.level} · {engineOutput.command.action}
          </Text>
        </AFCard>
      </View>

      <View style={{ marginTop: 20 }}>
        <AFPrimaryButton label={t('urine.v2.complete_cycle')} icon="check-circle" onPress={handleConfirm} />
      </View>
      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  disclaimer: { ...afType.caption, color: af.textTertiary, marginTop: 12 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  tile: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: af.surface,
  },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  tileLabel: { ...afType.eyebrow, color: af.textTertiary },
  verdict: { ...afType.title3, color: af.textPrimary, marginTop: 10 },
  detail: { ...afType.secondary, color: af.textSecondary, marginTop: 4 },
  recCard: { marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  recLabel: { ...afType.eyebrow, marginBottom: 4 },
  recBody: { ...afType.body, color: af.textPrimary },
  placeholder: { ...afType.secondary, color: af.textTertiary, textAlign: 'center', paddingVertical: 8 },
  section: { marginTop: 24, gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: af.border,
  },
  chipText: { ...afType.caption },
  energyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  energyTile: { width: '47%', flexGrow: 1, padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  energyLabel: { ...afType.bodyStrong },
  energyDesc: { ...afType.caption, color: af.textTertiary },
  previewLabel: { ...afType.eyebrow, color: af.textTertiary },
  previewScore: { ...afType.displayScore, fontSize: 44, lineHeight: 48, color: af.textPrimary, fontVariant: ['tabular-nums'], marginTop: 4 },
  previewState: { ...afType.caption, color: af.textSecondary, marginTop: 4 },
});
