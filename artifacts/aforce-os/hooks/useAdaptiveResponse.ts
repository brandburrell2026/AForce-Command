/**
 * useAdaptiveResponse — hook-friendly selector for the Section 59 Personal
 * Response Library.
 *
 * Reads the append-only Command-Event Ledger (an external store that lives
 * OUTSIDE the hydration reducer / AppState — Score-Protection isolation) and
 * runs the pure `deriveAdaptiveResponseProfile`. It dispatches NOTHING into the
 * reducer, so consuming it can never affect a hydration point, performance band,
 * or recovery score. The engine owns all derivation; this hook only projects the
 * ledger into it. Mirrors `useUnifiedPerformanceMemory`.
 */
import React from 'react';

import { useCommandLedgerStore, selectCommandEvents } from '@/services/commandLedger';
import { deriveAdaptiveResponseProfile } from '@/utils/intelligence/adaptiveResponseEngine';
import type { AdaptiveResponseProfile } from '@/types/adaptiveResponse';

export function useAdaptiveResponse(): AdaptiveResponseProfile {
  const ledger = useCommandLedgerStore();
  return React.useMemo(
    () => deriveAdaptiveResponseProfile(selectCommandEvents(ledger)),
    [ledger],
  );
}
