/**
 * useUnifiedPerformanceMemory — the single hook-friendly selector for the
 * unified Performance Memory snapshot.
 *
 * Wires the app's live read surfaces — hydration `state.history`, the
 * Command-Event Ledger, the Voice Check-In store, the current recovery
 * snapshot, the ledger's Performance Age snapshots, and the new capture store
 * (travel / caffeine / priority) — into the pure `deriveUnifiedPerformanceMemory`
 * aggregator. It dispatches NOTHING into the hydration reducer, so consuming it
 * can never affect a hydration point, performance band, or recovery score
 * (Score-Protection). The aggregator owns all derivation; this hook only
 * projects the stores into its plain inputs.
 */
import React from 'react';

import { useAppStore } from '@/store/useAppStore';
import {
  useCommandLedgerStore,
  selectCommandEvents,
} from '@/services/commandLedger';
import { useVoiceCheckInStore } from '@/services/voiceCheckIn';
import { usePerformanceMemoryCaptureStore } from '@/services/performanceMemoryCapture';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '@/services/recoveryEngine';
import { ledgerToPerformanceAgeSnapshots } from '@/utils/intelligence/commandEventAdapters';
import {
  deriveUnifiedPerformanceMemory,
  type UnifiedPerformanceMemory,
} from '@/utils/performanceMemoryUnified';

export function useUnifiedPerformanceMemory(): UnifiedPerformanceMemory {
  const { state } = useAppStore();
  const ledger = useCommandLedgerStore();
  const checkIn = useVoiceCheckInStore();
  const capture = usePerformanceMemoryCaptureStore();

  const { history, userState, engineOutput } = state;
  const { records } = checkIn;
  const { travel, caffeine, priorities } = capture;

  return React.useMemo(() => {
    const ledgerEvents = selectCommandEvents(ledger);

    // Real logged hydration only — the synthetic "yesterday" anchor is excluded
    // so it can never inflate the pattern counts (no fabrication).
    const hydrationHistory = history
      .filter((h) => !h.isSynthetic)
      .map((h) => ({ atMs: h.timestamp.getTime(), score: h.score }));

    const checkIns = records.map((r) => ({
      dayIndex: r.dayIndex,
      energy: r.answers.energy,
      stress: r.answers.stress,
      goal: r.answers.goal,
    }));

    const recovery = deriveRecoverySnapshot(
      recoveryInputsFromState(userState, engineOutput),
    );

    return deriveUnifiedPerformanceMemory({
      nowMs: Date.now(),
      ledgerEvents,
      hydrationHistory,
      checkIns,
      performanceAgeSnapshots: ledgerToPerformanceAgeSnapshots(ledgerEvents),
      recovery: {
        recovery: recovery.recovery,
        pressure: recovery.pressure,
        trend: recovery.trend,
      },
      travel,
      caffeine,
      priorities,
    });
  }, [
    ledger,
    records,
    travel,
    caffeine,
    priorities,
    history,
    userState,
    engineOutput,
  ]);
}
