/**
 * NightOutCommandView (NO-c) — PURE PRESENTATIONAL component.
 *
 * Renders the Night Out command UI from an already-resolved view model + plain
 * callbacks. It reads NO store, NO flag, NO route, NO timer — so it can be
 * rendered in isolation by a non-shipping test harness WITHOUT bypassing the
 * production route guard (`app/night-out.tsx` remains the only authorized entry).
 * The container `screens/NightOutCommandScreen.tsx` resolves the model + wires
 * the store/timer/handlers and renders this component. Presentation only; it
 * cannot mutate score/session.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AFReadinessArc } from '@/components/ui';
import { af, afType } from '@/theme';
import type { NightOutCommandView as NightOutCommandViewModel } from '@/services/nightOut/commandPresentation';
import {
  NIGHT_OUT_PUBLIC_NAME,
  NIGHT_OUT_DESCRIPTOR,
  NIGHT_OUT_EYEBROW,
} from '@/services/nightOut/naming';

export interface NightOutCommandViewProps {
  view: NightOutCommandViewModel;
  reducedMotion: boolean;
  adjusting: boolean;
  approvedAdjustOz: readonly number[];
  selectedDoseOz?: number;
  onPrimary: () => void;
  onToggleAdjust: () => void;
  onAdjustPick: (oz: number) => void;
  onNotNow: () => void;
}

export function NightOutCommandView({
  view,
  reducedMotion,
  adjusting,
  approvedAdjustOz,
  selectedDoseOz,
  onPrimary,
  onToggleAdjust,
  onAdjustPick,
  onNotNow,
}: NightOutCommandViewProps) {
  const accent = af.cyan; // restrained cyan for water / active protocol
  const { now, hero } = view;

  return (
    <View testID="night-out-command-view">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{NIGHT_OUT_EYEBROW}</Text>
        <Text style={styles.title} accessibilityRole="header">{NIGHT_OUT_PUBLIC_NAME}</Text>
        <Text style={styles.descriptor}>{NIGHT_OUT_DESCRIPTOR}</Text>
      </View>

      {/* HYDROSTATE hero — the only hero metric */}
      <View
        style={styles.heroWrap}
        accessible
        accessibilityLabel={`HydroState ${hero.score}, ${hero.stateLabel}`}
      >
        <AFReadinessArc score={hero.score} size={220} color={accent} animate={!reducedMotion}>
          <Text style={styles.score}>{hero.score}</Text>
          <Text style={styles.stateLabel}>{hero.stateLabel}</Text>
        </AFReadinessArc>
        <Text style={styles.interpretation}>{hero.interpretation}</Text>
      </View>

      {/* NOW */}
      <Text style={styles.sectionLabel} accessibilityRole="header">NOW</Text>
      <View style={styles.nowCard} testID={`night-out-now-${view.mode}`}>
        {view.mode === 'no-command' ? (
          <Text style={styles.calm} testID="night-out-calm">{now.calmMessage}</Text>
        ) : view.mode === 'processing' ? (
          <Text style={styles.processing} testID="night-out-processing">{now.processingLabel}</Text>
        ) : (
          <>
            <Text style={styles.commandTitle}>{now.title}</Text>
            <Text style={styles.commandBody}>{now.instruction}</Text>
            <Text style={styles.window}>{now.windowLabel}</Text>
            {!!now.reason && <Text style={styles.reason}>{now.reason}</Text>}

            {/* Calm telemetry — confidence + freshness as TEXT (color-independent) */}
            <Text style={styles.telemetry} testID="night-out-telemetry">
              Command confidence: {now.confidenceLabel} · {now.freshnessLabel}
            </Text>

            {adjusting && (
              <View style={styles.adjustRow} testID="night-out-adjust-row">
                {approvedAdjustOz.map((oz) => (
                  <Pressable
                    key={oz}
                    onPress={() => onAdjustPick(oz)}
                    style={[styles.ozChip, selectedDoseOz === oz && { borderColor: accent }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${oz} ounces`}
                    accessibilityState={{ selected: selectedDoseOz === oz }}
                  >
                    <Text style={[styles.ozChipText, selectedDoseOz === oz && { color: accent }]}>{oz} oz</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* One dominant action */}
            <Pressable
              onPress={onPrimary}
              style={[styles.primaryCta, { backgroundColor: accent }]}
              accessibilityRole="button"
              accessibilityLabel={now.cta === 'START WATER' ? 'Start water' : 'Complete water'}
              testID="night-out-primary-cta"
            >
              <Text style={styles.primaryCtaText}>{now.cta}</Text>
            </Pressable>

            <View style={styles.secondaryRow}>
              {now.showAdjust && (
                <Pressable
                  onPress={onToggleAdjust}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Adjust amount"
                  testID="night-out-adjust"
                >
                  <Text style={styles.secondaryText}>Adjust</Text>
                </Pressable>
              )}
              {now.showNotNow && (
                <Pressable
                  onPress={onNotNow}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Not now"
                  testID="night-out-not-now"
                >
                  <Text style={styles.secondaryText}>Not now</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>

      {/* NEXT */}
      <Text style={styles.sectionLabel} accessibilityRole="header">NEXT</Text>
      <View style={styles.quietCard}>
        <Text style={styles.quietPrimary}>Update confirmed intake</Text>
        <Text style={styles.quietSub}>{view.next.reassessLabel} · only if something changes</Text>
      </View>

      {/* LATER */}
      <Text style={styles.sectionLabel} accessibilityRole="header">LATER</Text>
      <View style={styles.quietCard}>
        <Text style={styles.quietPrimary}>{view.later.previewLabel}</Text>
        <Text style={styles.quietSub}>Subject to change</Text>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  header: { marginTop: 8, marginBottom: 8, alignItems: 'center', gap: 2 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  title: { ...afType.title1, color: af.textPrimary },
  descriptor: { ...afType.caption, color: af.textTertiary },
  heroWrap: { alignItems: 'center', marginVertical: 20, gap: 12 },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  stateLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  interpretation: { ...afType.body, color: af.textSecondary, textAlign: 'center' },
  sectionLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 20, marginBottom: 8 },
  nowCard: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface, gap: 8 },
  calm: { ...afType.title3, color: af.textPrimary, textAlign: 'center', paddingVertical: 12 },
  processing: { ...afType.title3, color: af.cyan, textAlign: 'center', paddingVertical: 12 },
  commandTitle: { ...afType.eyebrow, color: af.cyan },
  commandBody: { ...afType.title2, color: af.textPrimary },
  window: { ...afType.secondary, color: af.textSecondary },
  reason: { ...afType.secondary, color: af.textTertiary },
  telemetry: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  adjustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  ozChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: af.border, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ozChipText: { ...afType.caption, color: af.textSecondary },
  primaryCta: { marginTop: 12, paddingVertical: 16, borderRadius: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  primaryCtaText: { ...afType.bodyStrong, color: af.canvas, letterSpacing: 1 },
  secondaryRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  secondaryBtn: { flex: 1, paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: af.border },
  secondaryText: { ...afType.secondary, color: af.textSecondary },
  quietCard: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: af.divider, backgroundColor: af.canvasElevated, gap: 4 },
  quietPrimary: { ...afType.body, color: af.textPrimary },
  quietSub: { ...afType.caption, color: af.textTertiary },
});
