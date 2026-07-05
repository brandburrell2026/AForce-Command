/**
 * useConversationalCoach — Section 64 Step 2 proactive coach (voice-only).
 *
 * Watches the live signals and speaks FIRST only on a genuinely new, high-value
 * moment (Water-First priority via the pure policy), staying SILENT otherwise
 * (Constitution Principle 6). Every line it speaks passes the §64 language guard
 * before TTS (fail-closed via `speakGuarded`). Mirrors `useScoreBandVoice`
 * (event-driven, first-fire suppressed) + `PerformanceStatementMount` (foreground
 * / mute / mode gates).
 *
 * Score-Protection: dispatches nothing and never awards/mutates score. It only
 * READS store slices (engine, user, ledger-derived daily lesson) — consistent
 * with the shipped §59–§61 hooks. The whole thing is inert unless the caller is
 * active (mounted behind `conversational_intelligence_enabled`).
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../store/useAppStore';
import { useEngineSlice, useUserSlice } from '../store/slices';
import { useDailyLesson } from './useDailyLesson';
import { useCoachMode, shouldSpeak } from '../services/coachMode';
import { isVoicePlaybackEnabled } from '../services/textToSpeech';
import { commandSpeak } from '../services/voice/commandVoiceBus';
import i18n from '../services/i18nService';
import {
  assembleCoachContext,
  nextProactiveUtterance,
  type CoachSignals,
} from '../utils/intelligence/conversationalIntelligence';
import { speakGuarded } from '../utils/intelligence/conversationalLanguage';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function useConversationalCoach(active: boolean): void {
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const lesson = useDailyLesson();
  const coachMode = useCoachMode();
  const { voiceCoachEnabled } = useAppStore();

  // Last-spoken dedupe key (a still-active trigger never repeats; silence resets
  // it so a new moment re-speaks). `primedRef` suppresses the very first
  // evaluation so the coach never speaks the instant the app opens.
  const prevKeyRef = useRef<string | null>(null);
  const primedRef = useRef(false);

  const level = engine.performanceState.level;
  const followedToday =
    (userState.confirmationDelta ?? 0) > 0 &&
    userState.confirmationDeltaSetAt != null &&
    Date.now() - userState.confirmationDeltaSetAt.getTime() < ONE_DAY_MS;

  useEffect(() => {
    if (!active) {
      prevKeyRef.current = null;
      primedRef.current = false;
      return;
    }

    const signals: CoachSignals = {
      level,
      score: engine.score,
      urgency: engine.command.urgencyLevel,
      commandAction: engine.command.action,
      commandFollowedToday: followedToday,
      recoveryWindowActive: engine.social?.inRecoveryWindow ?? false,
      hasDailyLesson: lesson.kind === 'lesson',
    };
    const step = nextProactiveUtterance(prevKeyRef.current, assembleCoachContext(signals));
    // Update the dedupe key BEFORE the gates so re-enabling voice after a moment
    // does not retro-fire a stale trigger (mirrors useScoreBandVoice).
    prevKeyRef.current = step.key;

    // First evaluation: prime the key without speaking — never speak on app open.
    if (!primedRef.current) {
      primedRef.current = true;
      return;
    }

    if (!step.utterance) return; // silent: no trigger or a duplicate
    if (!shouldSpeak(coachMode)) return; // silent / ambient mode → no speech
    if (!voiceCoachEnabled) return; // master voice switch off
    if (AppState.currentState !== 'active') return; // foreground only
    if (!isVoicePlaybackEnabled()) return; // muted → skip

    const text = i18n.t(step.utterance.lineKey, step.utterance.params);
    speakGuarded(text, (t) => commandSpeak(t, { level }));
  }, [
    active,
    level,
    engine.score,
    engine.command.urgencyLevel,
    engine.command.action,
    engine.social,
    followedToday,
    lesson.kind,
    coachMode,
    voiceCoachEnabled,
  ]);
}
