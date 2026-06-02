/**
 * AForce Command Voice Engine — score band alert hook.
 *
 * Watches the live `engineOutput.score` and fires `commandSpeak()`
 * exactly once per band crossing (PEAK / STABLE / CORRECT / RISK /
 * CRITICAL). Re-renders that don't change the band do NOT re-fire.
 *
 * Gating, in priority order:
 *   1. `voiceCoachEnabled` master switch — silences everything when off.
 *   2. `voiceScope`                       — only `'all'` and `'risk'`
 *                                           allow score-band alerts.
 *   3. Band-crossing state machine        — fire once per (oldBand →
 *                                           newBand) transition.
 *
 * Mounting on the first render is deliberately suppressed: we capture
 * the initial band so the engine doesn't shout at the user the moment
 * they open the app. The next genuine band change will fire normally.
 */

import { useEffect, useRef } from 'react';

import { useAppStore } from '../store/useAppStore';
import { useEngineSlice } from '../store/slices';
import {
  categoryAllowedForScope,
  scoreBand,
  scoreBandLine,
  type ScoreBand,
} from '../services/voice/commandVoice';
import { commandSpeak } from '../services/voice/commandVoiceBus';

export function useScoreBandVoice(): void {
  const engine = useEngineSlice();
  const { voiceCoachEnabled, voiceIntensity, voiceScope } = useAppStore();

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

    if (!voiceCoachEnabled) return;
    if (!categoryAllowedForScope('score_band', voiceScope)) return;

    commandSpeak(scoreBandLine(engine.score, voiceIntensity), {
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
    voiceCoachEnabled,
    voiceIntensity,
    voiceScope,
  ]);
}
