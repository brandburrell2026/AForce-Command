/**
 * useIntentCapture — the single hook-friendly surface for Intent Capture™.
 *
 * Reads the persisted per-day intent store (via `useSyncExternalStore`) and
 * exposes today's intent, the derived coaching posture, and the recorder. It
 * dispatches nothing into the hydration reducer and persists only through the
 * dedicated intent service, so consuming it can never affect a hydration point,
 * performance band, or recovery score (Score-Protection isolation).
 */
import React from 'react';

import {
  hydrateIntentCapture,
  recordIntent,
  selectLatestIntentRecord,
  selectTodayIntentRecord,
  useIntentCaptureStore,
} from '@/services/intentCapture';
import {
  coachingPostureForIntent,
  type CoachingPosture,
  type IntentId,
  type IntentRecord,
  type IntentSource,
} from '@/utils/intentCapture';

export interface IntentCaptureController {
  /** False until AsyncStorage has loaded. */
  hydrated: boolean;
  /** The most recent intent record across all days, or null. */
  latest: IntentRecord | null;
  /** Today's captured intent, or null when none today. */
  todayIntent: IntentId | null;
  /** Coaching posture derived from TODAY's intent (neutral when none). */
  posture: CoachingPosture;
  /** Record (or overwrite) today's intent. */
  record: (intent: IntentId, source?: IntentSource, now?: Date) => Promise<void>;
}

export function useIntentCapture(): IntentCaptureController {
  const state = useIntentCaptureStore();

  // Ensure storage is read at least once even if app boot hasn't.
  React.useEffect(() => {
    void hydrateIntentCapture();
  }, []);

  const todayIntent = selectTodayIntentRecord(state)?.intent ?? null;

  const posture = React.useMemo(
    () => coachingPostureForIntent(todayIntent),
    [todayIntent],
  );

  const record = React.useCallback(
    (intent: IntentId, source?: IntentSource, now?: Date) =>
      recordIntent(intent, source, now),
    [],
  );

  return {
    hydrated: state.hydrated,
    latest: selectLatestIntentRecord(state),
    todayIntent,
    posture,
    record,
  };
}
