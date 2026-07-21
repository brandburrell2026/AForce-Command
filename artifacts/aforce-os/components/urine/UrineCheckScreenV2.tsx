/**
 * UrineCheckScreenV2 — Phase 3 redesign of the Urine Hydration Check (spec §5),
 * rendered when `spec_urine` is on. Same data + the SAME live write path as the
 * legacy screen (`updateSymptoms` / `updateEnergyState` / `confirmStatus`) — this
 * screen mutates the hydration/readiness store, so those calls are preserved
 * verbatim (must not regress). Presentation only on the af.* system.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

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
import { SYMPTOM_CATALOG, ENERGY_STATE_OPTIONS } from '@/data/mockData';
import type { UserState } from '@/types';
import {
  assessUrineColor,
  URINE_COLOR_OPTIONS,
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
  const [selection, setSelection] = useState<UrineColor | null>(null);
  const result: UrineCheckResult | null = selection ? assessUrineColor(selection) : null;
  const sev = result ? SEVERITY[result.severity] : null;

  const { state, updateSymptoms, updateEnergyState, confirmStatus } = useAppStore();
  const { userState, engineOutput } = state;

  const [symptoms, setSymptoms] = useState<string[]>(userState.symptoms);
  const [energy, setEnergy] = useState<UserState['energyState']>(userState.energyState);
  useEffect(() => setSymptoms(userState.symptoms), [userState.symptoms]);
  useEffect(() => setEnergy(userState.energyState), [userState.energyState]);

  const toggleSymptom = (id: string) => {
    haptic('select');
    setSymptoms((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  // LIVE write path — preserved verbatim from the legacy screen.
  const handleConfirm = async () => {
    haptic('heavy');
    try {
      await Promise.all([updateSymptoms(symptoms), updateEnergyState(energy)]);
      await confirmStatus();
    } catch (err) {
      console.error('Confirm status failed:', err);
    }
  };

  return (
    <AFScreen scroll>
      <AFTopBar eyebrow="AForce · Tool" title="Urine check" onBack={onBack} />
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
              accessibilityLabel={`Select ${opt.label}`}
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
            <Text style={[styles.recLabel, { color: sev.color }]}>RECOMMENDED</Text>
            <Text style={styles.recBody}>{result.recommendation}</Text>
          </View>
        </AFCard>
      ) : (
        <AFCard>
          <Text style={styles.placeholder}>Tap a color above to read your hydration signal.</Text>
        </AFCard>
      )}

      {/* Performance signals */}
      <View style={styles.section}>
        <AFSectionLabel label="Performance signals" action={{ label: `${symptoms.length} active`, onPress: () => {} }} />
        <AFCard>
          <View style={styles.chipRow}>
            {SYMPTOM_CATALOG.map((s) => {
              const active = symptoms.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggleSymptom(s.id)}
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
        <AFSectionLabel label="Energy state" />
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
          <Text style={styles.previewLabel}>CURRENT SCORE</Text>
          <Text style={styles.previewScore}>{engineOutput.score}</Text>
          <Text style={styles.previewState}>
            {engineOutput.performanceState.level} · {engineOutput.command.action}
          </Text>
        </AFCard>
      </View>

      <View style={{ marginTop: 20 }}>
        <AFPrimaryButton label="Complete cycle" icon="check-circle" onPress={handleConfirm} />
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
