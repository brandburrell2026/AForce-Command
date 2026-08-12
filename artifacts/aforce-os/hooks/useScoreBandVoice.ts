/**
 * AForce Command Voice Engine — score band alert hook.
 *
 * Watches the live `engineOutput.score` and fires `commandSpeak()`
 * exactly once per band crossing (PEAK / STABLE / CORRECT / RISK /
 * CRITICAL). Re-renders that don't change the band do NOT re-fire.
 *
 * Gating, in priority order:
 *   1. `notificationSettings.scoreDecayAlerts`
 *                                         — the Notifications screen's
 *                                           per-class opt-out. This hook is
 *                                           the ONLY producer behind that row,
 *                                           so without this gate the switch
 *                                           promised a silence it could not
 *                                           deliver (Wave-4 notification audit).
 *   2. `voiceCoachEnabled` master switch — silences everything when off.
 *   3. `voiceScope`                       — only `'all'` and `'risk'`
 *                                           allow score-band alerts.
 *   4. Band-crossing state machine        — fire once per (oldBand →
 *                                           newBand) transition.
 *
 * Mounting on the first render is deliberately suppressed: we capture
 * the initial band so the engine doesn't shout at the user the moment
 * they open the app. The next genuine band change will fire normally.
 */

import { useEffect, useRef } from 'react';

import { useAppStore, useFeatureFlags } from '../store/useAppStore';
import { useEngineSlice } from '../store/slices';
import {
  categoryAllowedForScope,
  scoreBand,
  scoreBandLine,
  type ScoreBand,
} from '../services/voice/commandVoice';
import { commandSpeak } from '../services/voice/commandVoiceBus';
import { findVoice } from '../services/voiceCatalog';
import { formatSpokenLineForCoach } from '../services/voice/coachPhrasing';

export function useScoreBandVoice(): void {
  const engine = useEngineSlice();
  const {
    voiceCoachEnabled, voiceIntensity, voiceScope, selectedVoiceId, notificationSettings,
  } = useAppStore();
  const eliteVoice = useFeatureFlags().elite_voice_coach_enabled;

  // Snapshot of the band that fired most recently (or the band the
  // engine was in at first render — see the suppress-first-fire note
  // above). `null` only at mount before the first effect runs.
  const lastFiredBandRef = useRef<ScoreBand | null>(null);

  useEffect(() => {
    const band = scoreBand(engine.score);

    // First-render initialization: capture the current band silently
    // so the engine doesn't fire on app open.
    if (lastFiredBandRef.current === null) {
      lastFiredBandRef.current = band;
      return;
    }

    // Same band as last fire → not a crossing, stay quiet.
    if (lastFiredBandRef.current === band) return;

    // Crossing detected. Update the state machine BEFORE the gates so
    // re-enabling the engine after a crossing does not retro-fire.
    const previousBand = lastFiredBandRef.current;
    lastFiredBandRef.current = band;

    if (!notificationSettings.scoreDecayAlerts) return;
    if (!voiceCoachEnabled) return;
    if (!categoryAllowedForScope('score_band', voiceScope)) return;

    // Elite Voice Coach (flag-gated, delivery-only): re-voice the spoken line
    // in the selected coach's tone. Off → the exact shipped line. The engine
    // still chose the band + line; coachPhrasing only prepends a tone lead and
    // fail-safes to the original on any §64/substance violation.
    const line = scoreBandLine(engine.score, voiceIntensity);
    const spoken =
      eliteVoice
        ? formatSpokenLineForCoach(line, findVoice(selectedVoiceId)?.archetype ?? 'push')
        : line;

    commandSpeak(spoken, {
      level: engine.performanceState.level,
      intensity: voiceIntensity,
      category: 'score_band',
    });

    // previousBand is currently unused but is captured for future
    // direction-aware variants (e.g. "Performance restored" on
    // upward crossings). Marking it intentionally:
    void previousBand;
  }, [
    engine.score,
    engine.performanceState.level,
    notificationSettings.scoreDecayAlerts,
    voiceCoachEnabled,
    voiceIntensity,
    voiceScope,
    eliteVoice,
    selectedVoiceId,
  ]);
}
