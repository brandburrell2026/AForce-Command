/**
 * useLocationIntelligence — flag-gated read hook for Location Intelligence™.
 *
 * The single place the UI/derivation layer reads the normalized location
 * context + travel signal. When `location_intelligence_enabled` is OFF the
 * hook is completely inert: it does NO I/O and returns a frozen empty
 * context with no travel signal, so every consumer is byte-identical to its
 * pre-Location-Intelligence behavior. When ON, it fetches a snapshot from the
 * data-layer service (which itself caches + falls back to a mock) and exposes
 * the pure-engine context + travel signal.
 *
 * Score-Protection: read-only. The only score-adjacent number it surfaces is
 * the capped, target-side `environmentalAdderOz` from the pure engine.
 */
import React from 'react';

import { useFeatureFlags } from '@/store/useAppStore';
import {
  deriveLocationContext,
  type LocationContext,
  type TravelSignal,
} from '@/utils/location/locationIntelligence';
import {
  emptyLocationInputs,
  getLocationSnapshot,
  type LocationSnapshot,
} from '@/services/locationIntelligenceService';

export interface LocationIntelligenceState {
  /** Whether the feature flag is on. */
  enabled: boolean;
  /** Normalized environmental context (inert when disabled / not loaded). */
  context: LocationContext;
  /** Travel signal vs. the last persisted anchor (inert when disabled). */
  travel: TravelSignal;
  /** Snapshot source, or null when disabled / not yet loaded. */
  source: 'live' | 'mock' | null;
}

/** The inert context — exactly what the pure engine returns for empty input. */
const INERT_CONTEXT: LocationContext = deriveLocationContext(emptyLocationInputs());

const INERT_TRAVEL: TravelSignal = {
  isTraveling: false,
  timezoneShifted: false,
  distanceKm: null,
  protocolKey: null,
};

const INERT_STATE: LocationIntelligenceState = {
  enabled: false,
  context: INERT_CONTEXT,
  travel: INERT_TRAVEL,
  source: null,
};

export function useLocationIntelligence(): LocationIntelligenceState {
  const flags = useFeatureFlags();
  const enabled = !!flags.location_intelligence_enabled;
  const [snapshot, setSnapshot] = React.useState<LocationSnapshot | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    getLocationSnapshot()
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch(() => {
        // Service already falls back to a mock; a thrown error here just
        // means we keep the inert/loading context. Never surface a crash.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return React.useMemo<LocationIntelligenceState>(() => {
    if (!enabled) return INERT_STATE;
    if (!snapshot) return { ...INERT_STATE, enabled: true };
    return {
      enabled: true,
      context: snapshot.context,
      travel: snapshot.travel,
      source: snapshot.source,
    };
  }, [enabled, snapshot]);
}
