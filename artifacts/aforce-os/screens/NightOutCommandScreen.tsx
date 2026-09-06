/**
 * NightOutCommandScreen (NO-c) — CONTAINER for the Water-First command experience.
 *
 * Resolves the view model from the deterministic engine + confidence/freshness +
 * the persisted command timer, wires the handlers (START/COMPLETE/Adjust/Not Now),
 * and renders the pure presentational `NightOutCommandView`. Water-First ONLY — no
 * alcohol/scan/correction/provider surfaces. PRESENTATION ONLY: it never mutates
 * HydroState; COMPLETE WATER routes through the approved `logIntake('water')` path
 * (Score-Protection). Authorization is enforced by the route (`app/night-out.tsx`);
 * this container is only mounted when Night Out is authorized.
 */
import { evidenceAgeMs } from '../services/nightOut/commandPresentation';
import React from 'react';
import { Platform } from 'react-native';
import { hapticImpact, hapticNotify, hapticSelection } from '@/services/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { AFScreen } from '@/components/ui';
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
import { NightOutCommandView } from '@/components/nightOut/NightOutCommandView';
import type { FluidType } from '@/types';

interface Actions {
  logIntake: (t: FluidType, opts?: { silent?: boolean; ozOverride?: number }) => Promise<void>;
}

function haptic(kind: 'light' | 'medium' | 'success') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') hapticNotify('success');
  else if (kind === 'medium') hapticImpact('medium');
  else hapticSelection();
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
  const confidenceLevel = deriveCommandConfidence(commandConfidenceInputsFromState(state.userState, now));
  const reassessMinutes = engine.riskTimer.minutes;
  const commandId = engine.command.id ?? 'nightout-water';
  const windowMs = Math.max(1, reassessMinutes) * 60 * 1000;

  // RESTORATION TRUTH: while a timer is active (including after background /
  // force-close / reopen restore), the displayed command is the one that was
  // ACCEPTED — read from the persisted snapshot, NOT the (possibly changed) live
  // engine command. So the timer can never restore with a different amount.
  const isActive = !!timer.view && timer.view.status !== 'invalid';
  const acceptedDose = timer.accepted?.doseOz;
  const doseOz = isActive ? (acceptedDose ?? engineDose) : (pendingDoseOz ?? engineDose);
  const displayTitle = isActive ? (timer.accepted?.title ?? 'Water first') : (title || 'Water first');
  const displayInstruction = isActive
    ? (timer.accepted?.instruction ?? (doseOz ? `Drink ${doseOz} oz water` : 'Drink water'))
    : (instruction || (doseOz ? `Drink ${doseOz} oz water` : 'Drink water'));

  const hasActionableCommand =
    !deferred && ((doseOz ?? 0) > 0 || displayInstruction.trim().length > 0 || displayTitle.trim().length > 0);

  const view = resolveNightOutCommandView({
    score,
    stateLabel: engine.performanceState.level,
    interpretation: engine.command.explanation || 'Your confirmed signals are steady.',
    hasActionableCommand,
    commandTitle: displayTitle,
    commandInstruction: displayInstruction,
    doseOz,
    reason: engine.command.explanation || '',
    confidenceLevel,
    freshnessAgeMs: evidenceAgeMs(state.userState, now),
    reassessMinutes,
    windowMinutes: reassessMinutes,
    timerView: timer.view,
    justCompleted: processing,
  });

  const onStartWater = async () => {
    haptic('medium');
    await timer.start(commandId, windowMs, { doseOz, title: displayTitle, instruction: displayInstruction });
    setAdjusting(false);
  };

  const onCompleteWater = async () => {
    // Route through the APPROVED intake path — never mutate score here. Log the
    // amount the user ACCEPTED (from the snapshot), not a since-changed engine dose.
    await logIntake('water', { silent: true, ozOverride: doseOz });
    haptic('success');
    await timer.clear();
    setProcessing(true);
    setPendingDoseOz(undefined);
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
      <NightOutCommandView
        view={view}
        reducedMotion={reducedMotion}
        adjusting={adjusting}
        approvedAdjustOz={NIGHT_OUT_ADJUST_OZ}
        selectedDoseOz={doseOz}
        onPrimary={view.now.cta === 'START WATER' ? onStartWater : onCompleteWater}
        onToggleAdjust={() => { haptic('light'); setAdjusting((v) => !v); }}
        onAdjustPick={onAdjustPick}
        onNotNow={onNotNow}
      />
    </AFScreen>
  );
}
