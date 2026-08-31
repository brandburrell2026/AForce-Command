/**
 * AForce Command Voice Engine — risk timer alert hook.
 *
 * Watches `engineOutput.riskTimer.minutes` and fires once when the
 * timer crosses each of the four spec thresholds: 16, 8, 4, 0. Uses
 * a descending state machine so 16 doesn't re-fire when we descend
 * to 8, and so a tick that lands directly on 4 (skipping 8 because
 * the user paused or the engine recomputed) still fires its own line
 * without firing the missed thresholds.
 *
 * The state machine resets when `minutes` climbs back above 16 — the
 * user completed a hydration cycle and the next descent should fire
 * the full ladder again.
 *
 * Gating, in priority order:
 *   1. `notificationSettings.recheckReminders`
 *                                         — the Notifications screen's
 *                                           per-class opt-out. This hook is
 *                                           the ONLY producer behind that row,
 *                                           so without this gate the switch
 *                                           promised a silence it could not
 *                                           deliver (Wave-4 notification audit).
 *   2. `voiceCoachEnabled` master switch — silences everything when off.
 *   3. `voiceScope`                       — only `'all'` and `'risk'`
 *                                           allow risk-timer alerts.
 *   4. Threshold state machine            — see above.
 */

import { useEffect, useRef } from 'react';

import { useAppStore, useFeatureFlags } from '../store/useAppStore';
import { useEngineSlice } from '../store/slices';
import {
  RISK_THRESHOLDS,
  categoryAllowedForScope,
  riskTimerLine,
  thresholdFor,
  type RiskThreshold,
} from '../services/voice/commandVoice';
import { commandSpeak } from '../services/voice/commandVoiceBus';
import { findVoice } from '../services/voiceCatalog';
import { formatSpokenLineForCoach } from '../services/voice/coachPhrasing';

export function useRiskTimerVoice(): void {
  const engine = useEngineSlice();
  const {
    voiceCoachEnabled, voiceIntensity, voiceScope, selectedVoiceId, notificationSettings,
  } = useAppStore();
  const eliteVoice = useFeatureFlags().elite_voice_coach_enabled;

  /**
   * The most-recently-fired threshold, or null when no alert has fired
   * since the last reset. Reset to null when the timer climbs above
   * the first (16-min) threshold — the next descent re-arms the ladder.
   */
  const lastFiredThresholdRef = useRef<RiskThreshold | null>(null);

  useEffect(() => {
    const minutes = engine.riskTimer.minutes;

    // Cycle reset: timer climbed above the first threshold. Re-arm.
    if (minutes > RISK_THRESHOLDS[0]) {
      lastFiredThresholdRef.current = null;
      return;
    }

    const current = thresholdFor(minutes);
    if (current === null) return;

    // Already fired this threshold (or a deeper one). Stay quiet.
    const last = lastFiredThresholdRef.current;
    if (last !== null && current >= last) return;

    // Update the state machine BEFORE the gates so toggling settings
    // mid-cycle never retro-fires past thresholds.
    lastFiredThresholdRef.current = current;

    if (!notificationSettings.recheckReminders) return;
    if (!voiceCoachEnabled) return;
    if (!categoryAllowedForScope('risk_timer', voiceScope)) return;

    // Elite Voice Coach (flag-gated, delivery-only) — see useScoreBandVoice.
    // The live minutes ride along so the spoken clock IS the canonical timer
    // (RP-5 × ruling R2), not a static approximation of it.
    const line = riskTimerLine(current, voiceIntensity, minutes);
    const spoken =
      eliteVoice
        ? formatSpokenLineForCoach(line, findVoice(selectedVoiceId)?.archetype ?? 'push')
        : line;

    commandSpeak(spoken, {
      level: engine.performanceState.level,
      intensity: voiceIntensity,
      category: 'risk_timer',
    });
  }, [
    engine.riskTimer.minutes,
    engine.performanceState.level,
    notificationSettings.recheckReminders,
    voiceCoachEnabled,
    voiceIntensity,
    voiceScope,
    eliteVoice,
    selectedVoiceId,
  ]);
}
