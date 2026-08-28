/**
 * useHeatGuard — derives the live Heat Guard band from current user state,
 * fires the `heat_warning` voice template on STABLE → escalation crossings,
 * and exposes both the current band and a callback that opens the voice
 * overlay so the host screen can react.
 *
 * Lives outside the home tab so the orchestrator stays slim and the heat
 * logic remains self-contained / unit-testable in isolation.
 *
 * TRUTH CONTRACT (founder ruling, wrong-scale close-out): the engine input
 * comes from `services/heatGuardInput.buildHeatSignalInput` — measured
 * facts only (real weather, member-reported signals, real weight), the
 * activity drive on the engine's documented 0–1 intensity axis via the
 * canonical bridge, and zero-risk NEUTRAL elements for every unmeasured
 * vital. The previous inline version synthesized vitals from the drives
 * (166 °F ambient, 410 bpm, 90 oz/hr); that is banned — see the builder's
 * header for the full contract.
 *
 * REACHABILITY NOTE (2026-08-28): no production surface currently imports
 * this hook (its former host, the legacy Home SignalsZone, is orphaned).
 * It is corrected rather than deleted because the founder ruled the
 * fabricated-vitals behavior unacceptable wherever it exists; orphan-tree
 * retirement is a separately scoped lane.
 */

import React from 'react';
import { Platform } from 'react-native';
import { hapticNotify } from '@/services/haptics';

import { evaluateHeatRisk } from '../services/heatRiskEngine';
import { buildHeatSignalInput } from '../services/heatGuardInput';
import { renderTemplate } from '../services/voiceTemplateEngine';
import { speak } from '../services/textToSpeech';
import { resolvePersona } from '../services/voicePersonaService';
import type { HeatRiskBand } from '../types/heat';
import type { VoiceContext } from '../types/voicePersona';
import type { AutopilotUrgency } from '../types/sweat';
import { useEngineSlice, useSweatAutopilotSlice, useUserSlice } from '../store/slices';
import { getHeatBandFromCelsius, shouldEscalateForBand } from '../utils/heatBand';

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
  /**
   * Recheck cadence (minutes) the host screen should use for its
   * recovery / "did you follow it?" countdown. When a sweat session
   * is active and within its 4h recovery window, this comes from
   * the session's autopilot. Otherwise it falls back to a default
   * cadence derived from the live Heat Guard band.
   */
  recheckIntervalMin: number;
  /** Why we picked that cadence — drives the UI urgency tier. */
  recheckUrgency: AutopilotUrgency;
  /** True when the cadence is being driven by an active sweat session. */
  autopilotActive: boolean;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Default recheck cadence when no sweat-driven autopilot is active.
 * Mirrors the spec's three-tier ladder so heat-driven escalations
 * surface the same intervals as a freshly logged session.
 */
function defaultCadenceForBand(band: HeatRiskBand): { intervalMin: number; urgency: AutopilotUrgency } {
  if (band === 'CRITICAL' || band === 'HIGH_RISK') return { intervalMin: 8, urgency: 'critical' };
  if (band === 'WARNING') return { intervalMin: 12, urgency: 'high' };
  return { intervalMin: 20, urgency: 'moderate' };
}

export function useHeatGuard({ onEscalate }: UseHeatGuardOptions): HeatGuardResult {
  const { performanceState, score } = useEngineSlice();
  const userState = useUserSlice();
  const { autopilot, setAt } = useSweatAutopilotSlice();

  const heatScore = React.useMemo<HeatGuardResult>(() => {
    const heat = evaluateHeatRisk(buildHeatSignalInput(userState, score));

    // Sweat-driven autopilot drives cadence for the duration of the
    // recovery window (spec §4). Outside that window we fall back to a
    // band-derived default so the recheck cadence still reflects current
    // physiological strain.
    //
    // SAFETY CLAMP: when both signals are live we always pick the SAFER
    // of the two — min interval (more frequent rechecks) and max urgency
    // (moderate < high < critical). This prevents a low-cadence
    // autopilot (e.g. voice-seeded "performance mode on" at 30 min /
    // moderate) from silently downgrading a CRITICAL heat band's
    // mandatory 8 min / critical cadence.
    const windowMs = (autopilot?.recoveryWindowHours ?? 0) * HOUR_MS;
    const autopilotActive =
      !!autopilot && setAt != null && Date.now() - setAt < windowMs;
    const fallback = defaultCadenceForBand(heat.band);
    const URGENCY_RANK: Record<AutopilotUrgency, number> = {
      moderate: 0, high: 1, critical: 2,
    };
    const safer = (a: AutopilotUrgency, b: AutopilotUrgency): AutopilotUrgency =>
      URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;

    const recheckIntervalMin = autopilotActive
      ? Math.min(autopilot!.intervalMin, fallback.intervalMin)
      : fallback.intervalMin;
    const recheckUrgency = autopilotActive
      ? safer(autopilot!.urgency, fallback.urgency)
      : fallback.urgency;

    return {
      score: heat.score,
      band: heat.band,
      recheckIntervalMin,
      recheckUrgency,
      autopilotActive,
    };
  }, [
    score, userState.lastIntakeTime, userState.weatherTempC,
    userState.weatherHumidity, userState.activityLevel,
    userState.bodyWeightLbs, userState.symptoms,
    userState.urineSignal, userState.energyState,
    autopilot, setAt,
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
    // Voice / haptic escalation is gated by the temperature-derived
    // band: only fire when ambient temp is in HIGH (≥85 °F) or
    // CRITICAL (≥95 °F). At ELEVATED or NORMAL the engine band may
    // still update silently for downstream UI, but no voice fires.
    const tempBand = getHeatBandFromCelsius(userState.weatherTempC);
    if (
      SEVERITY[next] > SEVERITY[prev] &&
      next !== 'STABLE' &&
      shouldEscalateForBand(tempBand)
    ) {
      const persona = resolvePersona(performanceState.level);
      const ctx: VoiceContext = { mode: persona.mode, score: heatScore.score, heat_band: next };
      const line = renderTemplate('heat_warning', ctx);
      speak(line.spoken);
      if (Platform.OS !== 'web') {
        hapticNotify('warning');
      }
      onEscalate();
    }
    prevBandRef.current = next;
  }, [heatScore.band, heatScore.score, performanceState.level, userState.weatherTempC, onEscalate]);

  return heatScore;
}
