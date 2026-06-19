/**
 * useVoiceCheckIn — the single hook-friendly surface for the morning Voice
 * Check-In ritual.
 *
 * Reads the persisted check-in store (via `useSyncExternalStore`) and exposes
 * the derived "is it due", the latest answers, and the `complete` / `snooze`
 * recorders. It dispatches nothing into the hydration reducer and persists
 * only through the dedicated check-in service, so consuming it can never
 * affect a hydration point, performance band, or recovery score
 * (Score-Protection isolation).
 */
import React from 'react';

import {
  DEFAULT_SNOOZE_MINUTES,
  hydrateVoiceCheckIn,
  recordCheckIn,
  selectIsCheckInDue,
  selectLatestRecord,
  snoozeCheckIn,
  useVoiceCheckInStore,
} from '@/services/voiceCheckIn';
import type {
  VoiceCheckInAnswers,
  VoiceCheckInRecord,
} from '@/utils/voiceCheckIn';

export interface VoiceCheckInController {
  /** False until AsyncStorage has loaded — gate UI on this. */
  hydrated: boolean;
  /** All completed check-ins, ascending by day. */
  records: VoiceCheckInRecord[];
  /** The most recent completed check-in, or null. */
  latest: VoiceCheckInRecord | null;
  /** The latest answers, or null — feeds Brain Energy / Performance Forecast. */
  latestAnswers: VoiceCheckInAnswers | null;
  /** Is the morning ritual due right now? */
  isDue: boolean;
  /** Snooze expiry epoch ms, or null when not snoozed. */
  snoozedUntilMs: number | null;
  /** Record (or overwrite) today's check-in. */
  complete: (answers: VoiceCheckInAnswers, now?: Date) => Promise<void>;
  /** Snooze the ritual; defaults to DEFAULT_SNOOZE_MINUTES from now. */
  snooze: (minutes?: number, now?: Date) => Promise<void>;
}

export function useVoiceCheckIn(): VoiceCheckInController {
  const state = useVoiceCheckInStore();

  // Ensure storage is read at least once even if app boot hasn't.
  React.useEffect(() => {
    void hydrateVoiceCheckIn();
  }, []);

  const latest = selectLatestRecord(state);

  const complete = React.useCallback(
    (answers: VoiceCheckInAnswers, now?: Date) => recordCheckIn(answers, now),
    [],
  );

  const snooze = React.useCallback(
    (minutes: number = DEFAULT_SNOOZE_MINUTES, now: Date = new Date()) =>
      snoozeCheckIn(now.getTime() + minutes * 60_000),
    [],
  );

  return {
    hydrated: state.hydrated,
    records: state.records,
    latest,
    latestAnswers: latest?.answers ?? null,
    isDue: selectIsCheckInDue(state),
    snoozedUntilMs: state.snoozedUntilMs,
    complete,
    snooze,
  };
}
