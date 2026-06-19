/**
 * useHydroScanHistory — the single hook-friendly surface for the local,
 * advisory HydroScan History.
 *
 * Reads the persisted history store (via `useSyncExternalStore`) and exposes
 * the recorded scans plus the `record` / `clear` recorders. It dispatches
 * nothing into the hydration reducer and persists only through the dedicated
 * history service, so consuming it can never affect a hydration point,
 * performance band, or recovery score (Score-Protection isolation).
 */
import React from 'react';

import {
  clearHydroScanHistory,
  hydrateHydroScanHistory,
  recordScan,
  selectLatestScan,
  useHydroScanHistoryStore,
  type HydroScanHistoryInput,
} from '@/services/hydroScanHistory';
import type { HydroScanHistoryEntry } from '@/types/scan';

export interface HydroScanHistoryController {
  /** False until AsyncStorage has loaded — gate UI on this. */
  hydrated: boolean;
  /** All recorded scans, most recent first. */
  entries: HydroScanHistoryEntry[];
  /** The most recent scan, or null. */
  latest: HydroScanHistoryEntry | null;
  /** Record an advisory scan row. Never mutates score. */
  record: (input: HydroScanHistoryInput) => Promise<void>;
  /** Clear all history. */
  clear: () => Promise<void>;
}

export function useHydroScanHistory(): HydroScanHistoryController {
  const state = useHydroScanHistoryStore();

  // Ensure storage is read at least once even if app boot hasn't.
  React.useEffect(() => {
    void hydrateHydroScanHistory();
  }, []);

  const record = React.useCallback(
    (input: HydroScanHistoryInput) => recordScan(input),
    [],
  );
  const clear = React.useCallback(() => clearHydroScanHistory(), []);

  return {
    hydrated: state.hydrated,
    entries: state.entries,
    latest: selectLatestScan(state),
    record,
    clear,
  };
}
