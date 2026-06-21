/**
 * usePerformanceStatement — the hook-friendly surface for Performance
 * Statements™.
 *
 * Reads the persisted once-per-day delivery store (via `useSyncExternalStore`),
 * the active coach archetype, and the live performance signals, then selects the
 * statement to speak and resolves its localised spoken text. It dispatches
 * nothing into the hydration reducer and persists only through the dedicated
 * Performance Statements service, so consuming it can never affect a hydration
 * point, performance band, or recovery score (Score-Protection isolation).
 *
 * It returns the IDs + already-spoken flag the mount needs; it intentionally
 * exposes the spoken `text` for the audio engine only — there is no on-screen
 * text surface for the statement (voice-only).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useEngineSlice, useUserSlice } from '@/store/slices';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';
import { getSelectedVoiceId } from '@/services/textToSpeech';
import { DEFAULT_VOICE_ID, findVoice } from '@/services/voiceCatalog';
import {
  hydratePerformanceStatements,
  recordStatementDelivered,
  selectAlreadySpokenToday,
  selectRecentlyUsedIds,
  usePerformanceStatementStore,
} from '@/services/performanceStatements';
import {
  selectPerformanceStatement,
  type StatementDescriptor,
} from '@/utils/performanceStatements';
import type { PerformanceLevel } from '@/types';

export interface PerformanceStatementController {
  /** False until AsyncStorage has loaded. */
  hydrated: boolean;
  /** True when a statement was already spoken for today's local day. */
  alreadySpokenToday: boolean;
  /** The statement to speak, or null when none applies. */
  descriptor: StatementDescriptor | null;
  /** Localised spoken copy for `descriptor` (audio engine only), or null. */
  text: string | null;
  /** Current performance level — drives speak() rate / pitch. */
  level: PerformanceLevel;
  /** Record that statement `id` was spoken today. */
  markDelivered: (id: string, now?: Date) => Promise<void>;
}

export function usePerformanceStatement(): PerformanceStatementController {
  const state = usePerformanceStatementStore();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const { t } = useTranslation();

  // Ensure storage is read at least once even if app boot hasn't.
  React.useEffect(() => {
    void hydratePerformanceStatements();
  }, []);

  const archetype =
    findVoice(getSelectedVoiceId() ?? DEFAULT_VOICE_ID)?.archetype ?? 'push';

  const recentlyUsedIds = selectRecentlyUsedIds(state);

  const descriptor = React.useMemo(() => {
    const snapshot = deriveRecoverySnapshot(
      recoveryInputsFromState(userState, engine),
    );
    return selectPerformanceStatement({
      archetype,
      recentlyUsedIds,
      signals: {
        recovery: snapshot.recovery,
        recoveryTrend: snapshot.trend,
        complianceStreak: userState.complianceStreak,
      },
    });
  }, [archetype, recentlyUsedIds, userState, engine]);

  const text = descriptor ? t(descriptor.i18nKey, descriptor.params) : null;

  const markDelivered = React.useCallback(
    (id: string, now?: Date) => recordStatementDelivered(id, now),
    [],
  );

  return {
    hydrated: state.hydrated,
    alreadySpokenToday: selectAlreadySpokenToday(state),
    descriptor,
    text,
    level: engine.performanceState.level,
    markDelivered,
  };
}
