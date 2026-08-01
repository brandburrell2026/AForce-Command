/**
 * NightOutCommandScreen (NO-c) — the first real AForce Night Out command
 * experience and the reusable protocol pattern: HYDROSTATE → NOW → NEXT → LATER,
 * one screen, one decision, one dominant action.
 *
 * Water-First ONLY. No alcohol logging, beverage scan, correction/deletion, or
 * provider surfaces (those are later slices). PRESENTATION ONLY: it never mutates
 * HydroState. Completion routes through the approved `logIntake('water')` intake
 * path (Score-Protection). The command/dose/confidence/timing come from the
 * deterministic engine; this screen only arranges and accepts them.
 *
 * Authorization is enforced by the route (`app/night-out.tsx`); this screen
 * assumes it is only mounted when Night Out is authorized (Founder/Internal
 * Preview). Opening it changes nothing; accepting a command changes nothing;
 * only a verified COMPLETE WATER routes an intake.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { AFScreen, AFReadinessArc } from '@/components/ui';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { useEngineSlice, useActionsSlice } from '@/store/slices';
import { parseEngineActionCopy, parseDoseOz } from '@/utils/recovery/recoveryCommandFromStore';
import {
  deriveCommandConfidence,
  commandConfidenceInputsFromState,
} from '@/utils/scoring/commandConfidence';
import { useNightOutCommandTimer } from '@/hooks/useNightOutCommandTimer';
import {
  resolveNightOutCommandView,
  NIGHT_OUT_ADJUST_OZ,
  isApprovedAdjustOz,
} from '@/services/nightOut/commandPresentation';
import {
  NIGHT_OUT_PUBLIC_NAME,
  NIGHT_OUT_DESCRIPTOR,
  NIGHT_OUT_EYEBROW,
} from '@/services/nightOut/naming';
import type { FluidType } from '@/types';

interface Actions {
  logIntake: (t: FluidType, opts?: { silent?: boolean; ozOverride?: number }) => Promise<void>;
}

function haptic(kind: 'light' | 'medium' | 'success') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else if (kind === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else Haptics.selectionAsync().catch(() => {});
}

/** Freshest confirmed-signal age (ms) from real state timestamps, or null. */
function freshestAgeMs(state: ReturnType<typeof useAppStore>['state'], now: number): number | null {
  const ts: number[] = [];
  const li = state.userState.lastIntakeTime;
  if (li) ts.push(li instanceof Date ? li.getTime() : new Date(li).getTime());
  if (state.userState.weatherFetchedAt) ts.push(state.userState.weatherFetchedAt);
  const freshest = ts.filter((t) => Number.isFinite(t)).sort((a, b) => b - a)[0];
  return freshest ? Math.max(0, now - freshest) : null;
}

export default function NightOutCommandScreen() {
  const { state } = useAppStore();
  const engine = useEngineSlice();
  const { logIntake } = useActionsSlice<Actions>();
  const reducedMotion = useReducedMotion();
  const timer = useNightOutCommandTimer();

  const [adjusting, setAdjusting] = React.useState(false);
  const [pendingDoseOz, setPendingDoseOz] = React.useState<number | undefined>(undefined);
  const [deferred, setDeferred] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);

  const now = Date.now();
  const score = Math.max(0, Math.min(100, Math.round(engine.score)));
  const { title, instruction } = parseEngineActionCopy(engine.command.action);
  const engineDose = parseDoseOz(engine.command.action);
  const doseOz = pendingDoseOz ?? engineDose;
  const confidenceLevel = deriveCommandConfidence(commandConfidenceInputsFromState(state.userState, now));
  const reassessMinutes = engine.riskTimer.minutes;
  const commandId = engine.command.id ?? 'nightout-water';
  const windowMs = Math.max(1, reassessMinutes) * 60 * 1000;

  const hasActionableCommand =
    !deferred && ((doseOz ?? 0) > 0 || instruction.trim().length > 0 || title.trim().length > 0);

  const view = resolveNightOutCommandView({
    score,
    stateLabel: engine.performanceState.level,
    interpretation: engine.command.explanation || 'Your confirmed signals are steady.',
    hasActionableCommand,
    commandTitle: title || 'Water first',
    commandInstruction: instruction || (doseOz ? `Drink ${doseOz} oz water` : 'Drink water'),
    doseOz,
    reason: engine.command.explanation || '',
    confidenceLevel,
    freshnessAgeMs: freshestAgeMs(state, now),
    reassessMinutes,
    windowMinutes: reassessMinutes,
    timerView: timer.view,
    justCompleted: processing,
  });

  const accent = af.cyan; // restrained cyan for water / active protocol

  const onStartWater = async () => {
    haptic('medium');
    await timer.start(commandId, windowMs);
    setAdjusting(false);
  };

  const onCompleteWater = async () => {
    // Route through the APPROVED intake path — never mutate score here.
    await logIntake('water', { silent: true, ozOverride: doseOz });
    haptic('success');
    await timer.clear();
    setProcessing(true);
    setPendingDoseOz(undefined);
    // Presentation-only: leave the neutral "Reassessing…" state until the engine
    // reflects the new state, then return to the fresh command.
    setTimeout(() => setProcessing(false), 1500);
  };

  const onAdjustPick = (oz: number) => {
    if (!isApprovedAdjustOz(oz)) return; // approved amounts only; never arbitrary
    haptic('light');
    setPendingDoseOz(oz);
    setAdjusting(false);
  };

  const onNotNow = () => {
    haptic('light');
    setDeferred(true); // no score penalty; session preserved
    void timer.clear();
  };

  return (
    <AFScreen scroll>
      {/* Header hierarchy */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{NIGHT_OUT_EYEBROW}</Text>
        <Text style={styles.title}>{NIGHT_OUT_PUBLIC_NAME}</Text>
        <Text style={styles.descriptor}>{NIGHT_OUT_DESCRIPTOR}</Text>
      </View>

      {/* HYDROSTATE hero — the only hero metric */}
      <View style={styles.heroWrap}>
        <AFReadinessArc score={score} size={220} color={accent} animate={!reducedMotion}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.stateLabel}>{view.hero.stateLabel}</Text>
        </AFReadinessArc>
        <Text style={styles.interpretation}>{view.hero.interpretation}</Text>
      </View>

      {/* NOW */}
      <Text style={styles.sectionLabel}>NOW</Text>
      <View style={styles.nowCard} testID={`night-out-now-${view.mode}`}>
        {view.mode === 'no-command' ? (
          <Text style={styles.calm} testID="night-out-calm">{view.now.calmMessage}</Text>
        ) : view.mode === 'processing' ? (
          <Text style={styles.processing} testID="night-out-processing">{view.now.processingLabel}</Text>
        ) : (
          <>
            <Text style={styles.commandTitle}>{view.now.title}</Text>
            <Text style={styles.commandBody}>{view.now.instruction}</Text>
            <Text style={styles.window}>{view.now.windowLabel}</Text>
            {!!view.now.reason && <Text style={styles.reason}>{view.now.reason}</Text>}

            {/* Calm telemetry: one governed confidence + freshness line */}
            <Text style={styles.telemetry} testID="night-out-telemetry">
              Command confidence: {view.now.confidenceLabel} · {view.now.freshnessLabel}
            </Text>

            {/* Adjust picker (approved amounts only) */}
            {adjusting && (
              <View style={styles.adjustRow} testID="night-out-adjust-row">
                {NIGHT_OUT_ADJUST_OZ.map((oz) => (
                  <Pressable
                    key={oz}
                    onPress={() => onAdjustPick(oz)}
                    style={[styles.ozChip, doseOz === oz && { borderColor: accent }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${oz} ounces`}
                  >
                    <Text style={[styles.ozChipText, doseOz === oz && { color: accent }]}>{oz} oz</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* One dominant action */}
            <Pressable
              onPress={view.now.cta === 'START WATER' ? onStartWater : onCompleteWater}
              style={[styles.primaryCta, { backgroundColor: accent }]}
              accessibilityRole="button"
              accessibilityLabel={view.now.cta === 'START WATER' ? 'Start water' : 'Complete water'}
              testID="night-out-primary-cta"
            >
              <Text style={styles.primaryCtaText}>{view.now.cta}</Text>
            </Pressable>

            {/* Secondary actions */}
            <View style={styles.secondaryRow}>
              {view.now.showAdjust && (
                <Pressable
                  onPress={() => { haptic('light'); setAdjusting((v) => !v); }}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Adjust amount"
                  testID="night-out-adjust"
                >
                  <Text style={styles.secondaryText}>Adjust</Text>
                </Pressable>
              )}
              {view.now.showNotNow && (
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
      <Text style={styles.sectionLabel}>NEXT</Text>
      <View style={styles.quietCard}>
        <Text style={styles.quietPrimary}>Update confirmed intake</Text>
        <Text style={styles.quietSub}>{view.next.reassessLabel} · only if something changes</Text>
      </View>

      {/* LATER */}
      <Text style={styles.sectionLabel}>LATER</Text>
      <View style={styles.quietCard}>
        <Text style={styles.quietPrimary}>{view.later.previewLabel}</Text>
        <Text style={styles.quietSub}>Subject to change</Text>
      </View>

      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 8, marginBottom: 8, alignItems: 'center', gap: 2 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  title: { ...afType.title1, color: af.textPrimary },
  descriptor: { ...afType.caption, color: af.textTertiary },
  heroWrap: { alignItems: 'center', marginVertical: 20, gap: 12 },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  stateLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  interpretation: { ...afType.body, color: af.textSecondary, textAlign: 'center' },
  sectionLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 20, marginBottom: 8 },
  nowCard: {
    padding: 18, borderRadius: 18, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.surface, gap: 8,
  },
  calm: { ...afType.title3, color: af.textPrimary, textAlign: 'center', paddingVertical: 12 },
  processing: { ...afType.title3, color: af.cyan, textAlign: 'center', paddingVertical: 12 },
  commandTitle: { ...afType.eyebrow, color: af.cyan },
  commandBody: { ...afType.title2, color: af.textPrimary },
  window: { ...afType.secondary, color: af.textSecondary },
  reason: { ...afType.secondary, color: af.textTertiary },
  telemetry: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  adjustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  ozChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, minWidth: 44, alignItems: 'center',
  },
  ozChipText: { ...afType.caption, color: af.textSecondary },
  primaryCta: {
    marginTop: 12, paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryCtaText: { ...afType.bodyStrong, color: af.canvas, letterSpacing: 1 },
  secondaryRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  secondaryBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: af.border },
  secondaryText: { ...afType.secondary, color: af.textSecondary },
  quietCard: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: af.divider, backgroundColor: af.canvasElevated, gap: 4 },
  quietPrimary: { ...afType.body, color: af.textPrimary },
  quietSub: { ...afType.caption, color: af.textTertiary },
});
