/**
 * useProactiveCoach — Section 64 Step 3.
 *
 * The store-connected accessor for the proactive, speak-first coach line. It
 * gathers the live inputs (engine snapshot, intake/cycle history, §61 daily
 * lesson, feature flags) and delegates every decision to the pure
 * `proactiveCoachResponse`. Read-only: dispatches nothing into the reducer and
 * never touches score (Score-Protection).
 *
 * Returns the `VoiceCommandResponse` to speak, or `null` to stay silent. The
 * `conversational_intelligence_enabled` flag (OFF in production) is enforced
 * inside the pure layer, so this hook is inert in the production binary.
 */
import React from 'react';

import { useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { useDailyLesson } from '@/hooks/useDailyLesson';
import { proactiveCoachResponse } from '@/services/voiceService';
import type { VoiceCommandResponse } from '@/types/voice';

export function useProactiveCoach(): VoiceCommandResponse | null {
  const { state } = useAppStore();
  const flags = useFeatureFlags();
  const { kind: dailyLessonKind } = useDailyLesson();
  const ciEnabled = flags.conversational_intelligence_enabled;

  return React.useMemo(
    () =>
      proactiveCoachResponse({
        engineOutput: state.engineOutput,
        history: state.history,
        dailyLessonKind,
        flags: { conversational_intelligence_enabled: ciEnabled },
        now: new Date(),
      }),
    [state.engineOutput, state.history, dailyLessonKind, ciEnabled],
  );
}
