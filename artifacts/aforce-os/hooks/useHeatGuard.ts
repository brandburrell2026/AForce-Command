/**
 * useHeatGuard — derives the live Heat Guard band from current user state,
 * fires the `heat_warning` voice template on STABLE → escalation crossings,
 * and exposes both the current band and a callback that opens the voice
 * overlay so the host screen can react.
 *
 * Lives outside the home tab so the orchestrator stays slim and the heat
 * logic remains self-contained / unit-testable in isolation.
 */

import React from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { evaluateHeatRisk } from '../services/heatRiskEngine';
import { renderTemplate } from '../services/voiceTemplateEngine';
import { speak } from '../services/textToSpeech';
import { resolvePersona } from '../services/voicePersonaService';
import type { HeatRiskBand, HeatSymptom } from '../types/heat';
import type { VoiceContext } from '../types/voicePersona';
import { useEngineSlice, useUserSlice } from '../store/slices';

const SYMPTOM_IDS: HeatSymptom[] = [
  'dizziness','headache','nausea','cramping','chills','confusion','fatigue',
];
const SEVERITY: Record<HeatRiskBand, number> = {
  STABLE: 0, ELEVATED: 1, WARNING: 2, HIGH_RISK: 3, CRITICAL: 4,
};

export interface UseHeatGuardOptions {
  /** Called when an escalation should open the voice overlay. */
  onEscalate: () => void;
}

export interface HeatGuardResult {
  score: number;
  band: HeatRiskBand;
}

export function useHeatGuard({ onEscalate }: UseHeatGuardOptions): HeatGuardResult {
  const { performanceState, score } = useEngineSlice();
  const userState = useUserSlice();

  const heatScore = React.useMemo<HeatGuardResult>(() => {
    const symptoms: HeatSymptom[] = (userState.symptoms ?? []).filter(
      (s): s is HeatSymptom => (SYMPTOM_IDS as string[]).includes(s),
    );
    return evaluateHeatRisk({
      hydrationScore: score,
      recentFluidOz: 0,
      minutesSinceLastIntake: Math.max(
        0,
        Math.round((Date.now() - new Date(userState.lastIntakeTime).getTime()) / 60000),
      ),
      ambientTempF: 78 + (userState.heatLoad ?? 0) * 22,
      humidityPct: 50 + (userState.heatLoad ?? 0) * 25,
      sunExposure: Math.min(1, (userState.heatLoad ?? 0)),
      continuousActiveMin: Math.round((userState.activityLevel ?? 0) * 60),
      activityIntensity: userState.activityLevel ?? 0,
      heartRateBpm: 110 + Math.round((userState.activityLevel ?? 0) * 60),
      hrRecoveryDelaySec: Math.round((userState.activityLevel ?? 0) * 25),
      sweatLossOzPerHr: (userState.sweatRate ?? 0) * 30,
      bodyWeightLbs: userState.bodyWeightLbs || 175,
      recoveryMomentum: 1 - (userState.heatLoad ?? 0),
      symptoms,
      urineSignal: userState.urineSignal ?? 2,
      energyState:
        userState.energyState === 'crashed' ? 'crashed'
        : userState.energyState === 'low' ? 'low'
        : userState.energyState === 'peak' ? 'peak' : 'steady',
      sleepDeficitHrs: 0,
      recentHeatEvent: false,
    });
  }, [
    score, userState.lastIntakeTime, userState.heatLoad, userState.activityLevel,
    userState.sweatRate, userState.bodyWeightLbs, userState.symptoms,
    userState.urineSignal, userState.energyState,
  ]);

  // Escalation effect — fires only on STABLE → non-STABLE upward crossings.
  // First observed band seeds the ref silently (never alert on mount).
  const prevBandRef = React.useRef<HeatRiskBand>('STABLE');
  const didMountRef = React.useRef(false);
  React.useEffect(() => {
    const next = heatScore.band;
    if (!didMountRef.current) {
      didMountRef.current = true;
      prevBandRef.current = next;
      return;
    }
    const prev = prevBandRef.current;
    if (SEVERITY[next] > SEVERITY[prev] && next !== 'STABLE') {
      const persona = resolvePersona(performanceState.level);
      const ctx: VoiceContext = { mode: persona.mode, score: heatScore.score, heat_band: next };
      const line = renderTemplate('heat_warning', ctx);
      speak(line.spoken);
      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch { /* ignore */ }
      }
      onEscalate();
    }
    prevBandRef.current = next;
  }, [heatScore.band, heatScore.score, performanceState.level, onEscalate]);

  return heatScore;
}
