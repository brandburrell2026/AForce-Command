/**
 * SIGNAL RESOLUTION — deterministic fixtures for the 12 brief scenarios.
 *
 * Pure data only (no RN, no clocks — every timestamp is derived from the
 * frozen `FIXED_NOW`). Mirrors the builder-function convention used by
 * `connectedHealthFixtures.ts`. See `__tests__/signalResolution.test.ts` for
 * the assertions each fixture exists to prove.
 */
import {
  buildDeduplicationKey,
  HEALTH_RECORD_SCHEMA_VERSION,
  type CanonicalHealthMetricType,
  type CanonicalHealthRecord,
  type CanonicalHealthValue,
  type HealthProviderId,
  type HrvMethod,
  type ProviderScoreKind,
  type ProviderSnapshot,
  type ProvenanceHop,
} from '@workspace/health-core';
import type { ResolveHealthSignalsInput } from './signalResolution';

export const FIXED_NOW = new Date('2026-08-03T12:00:00Z').getTime();
export const HOUR = 60 * 60_000;

const USER_ID = 'user-1';

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

// ─── Record builder ───────────────────────────────────────────────────────

interface MkRecordOverrides {
  provider: HealthProviderId;
  metricType: CanonicalHealthMetricType;
  value: CanonicalHealthValue;
  observedAtMs: number;
  syncedAtMs?: number;
  startTimeMs?: number;
  endTimeMs?: number;
  provenanceChain?: ProvenanceHop[];
  originalSource?: string;
  hrvMethod?: HrvMethod;
  scoreKind?: ProviderScoreKind;
  unit?: string;
  externalId?: string;
}

function mkRecord(o: MkRecordOverrides): CanonicalHealthRecord {
  const provenanceChain: ProvenanceHop[] = o.provenanceChain ?? [{ provider: o.provider, transport: 'measured' }];
  const origin = provenanceChain[0].provider;
  const observedAt = iso(o.observedAtMs);
  const syncedAt = iso(o.syncedAtMs ?? o.observedAtMs);
  const deduplicationKey = buildDeduplicationKey({
    userId: USER_ID,
    metricType: o.metricType,
    origin,
    externalId: o.externalId,
    startTime: o.startTimeMs != null ? iso(o.startTimeMs) : undefined,
    endTime: o.endTimeMs != null ? iso(o.endTimeMs) : undefined,
    observedAt,
  });
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: USER_ID,
    provider: o.provider,
    originalSource: o.originalSource,
    externalId: o.externalId,
    metricType: o.metricType,
    value: o.value,
    unit: o.unit,
    startTime: o.startTimeMs != null ? iso(o.startTimeMs) : undefined,
    endTime: o.endTimeMs != null ? iso(o.endTimeMs) : undefined,
    observedAt,
    syncedAt,
    hrvMethod: o.hrvMethod,
    scoreKind: o.scoreKind,
    provenanceChain,
    deduplicationKey,
  };
}

function mkSnapshot(o: Partial<ProviderSnapshot> & { providerId: HealthProviderId; fetchedAt: number }): ProviderSnapshot {
  return { ...o };
}

function baseInput(over: Partial<ResolveHealthSignalsInput>): ResolveHealthSignalsInput {
  return {
    biometrics: undefined,
    records: undefined,
    activeDirectProviders: new Set<HealthProviderId>(),
    connections: undefined,
    nowMs: FIXED_NOW,
    ...over,
  };
}

// ─── 1. Apple-only (snapshot plane) ────────────────────────────────────────

export const APPLE_ONLY: ResolveHealthSignalsInput = baseInput({
  biometrics: {
    apple_health: mkSnapshot({
      providerId: 'apple_health',
      fetchedAt: FIXED_NOW - 1 * HOUR,
      sleepHoursLastNight: 7.2,
      restingHeartRate: 54,
      hrvSdnnMs: 42, // Apple's true statistic — canonical field, no legacy translation needed
      stepsToday: 8500,
      workoutMinutesToday: 35,
    }),
  },
  activeDirectProviders: new Set(),
});

// ─── 2. HC-only (snapshot plane, google_health) ────────────────────────────
// Deliberately omits workoutMinutesToday to also exercise the 'no_data'
// reason for a family within an otherwise fully-populated, connected provider.

export const HC_ONLY: ResolveHealthSignalsInput = baseInput({
  biometrics: {
    google_health: mkSnapshot({
      providerId: 'google_health',
      fetchedAt: FIXED_NOW - 2 * HOUR,
      sleepHoursLastNight: 6.5,
      restingHeartRate: 58,
      hrvRmssdMs: 30,
      stepsToday: 6000,
    }),
  },
  activeDirectProviders: new Set(),
});

// ─── 3. Samsung-via-Health-Connect (attribution surfaced) ──────────────────

export const SAMSUNG_VIA_HEALTH_CONNECT: ResolveHealthSignalsInput = baseInput({
  records: [
    mkRecord({
      provider: 'google_health',
      metricType: 'resting_heart_rate',
      value: 52,
      observedAtMs: FIXED_NOW - 1 * HOUR,
      provenanceChain: [
        { provider: 'samsung_health', nativeOrigin: 'com.sec.android.app.shealth', transport: 'measured' },
        { provider: 'google_health', transport: 'aggregator_export' },
      ],
      originalSource: 'com.sec.android.app.shealth',
    }),
  ],
  // No direct Samsung connection exists (Samsung ships via Health Connect only) — origin
  // stays 'samsung_health' in the output without ever appearing in activeDirectProviders.
  activeDirectProviders: new Set(),
});

// ─── 4. Oura direct ─────────────────────────────────────────────────────────

export const OURA_DIRECT: ResolveHealthSignalsInput = baseInput({
  records: [
    mkRecord({
      provider: 'oura',
      metricType: 'sleep_session',
      value: { totalSleepHours: 7.8, inBedHours: 8.2, stages: null },
      observedAtMs: FIXED_NOW - 6 * HOUR,
      startTimeMs: FIXED_NOW - 14 * HOUR,
      endTimeMs: FIXED_NOW - 6 * HOUR,
    }),
  ],
  activeDirectProviders: new Set(['oura']),
});

// ─── 5. WHOOP direct ────────────────────────────────────────────────────────

export const WHOOP_DIRECT: ResolveHealthSignalsInput = baseInput({
  records: [
    mkRecord({
      provider: 'whoop',
      metricType: 'hrv',
      value: 38,
      hrvMethod: 'rmssd',
      observedAtMs: FIXED_NOW - 3 * HOUR,
    }),
  ],
  activeDirectProviders: new Set(['whoop']),
});

// ─── 6. Oura direct + Oura-via-Apple (dedup: direct wins, no double-count) ─

export const OURA_DIRECT_PLUS_VIA_APPLE: ResolveHealthSignalsInput = baseInput({
  records: [
    mkRecord({
      provider: 'oura',
      metricType: 'resting_heart_rate',
      value: 50,
      observedAtMs: FIXED_NOW - 2 * HOUR,
      externalId: 'oura-rhr-1',
    }),
    mkRecord({
      provider: 'apple_health',
      metricType: 'resting_heart_rate',
      value: 53, // the aggregator copy's own (slightly different) sample — must be DROPPED, not blended
      observedAtMs: FIXED_NOW - 2 * HOUR,
      provenanceChain: [
        { provider: 'oura', nativeOrigin: 'com.ouraring.oura', transport: 'measured' },
        { provider: 'apple_health', transport: 'aggregator_export' },
      ],
      originalSource: 'com.ouraring.oura',
      externalId: 'apple-oura-copy',
    }),
  ],
  activeDirectProviders: new Set(['oura']),
});

// ─── 7. WHOOP direct + platform-exported (no double-count) ─────────────────

export const WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED: ResolveHealthSignalsInput = baseInput({
  records: [
    mkRecord({
      provider: 'whoop',
      metricType: 'resting_heart_rate',
      value: 48,
      observedAtMs: FIXED_NOW - 1 * HOUR,
      externalId: 'whoop-rhr-1',
    }),
    mkRecord({
      provider: 'apple_health',
      metricType: 'resting_heart_rate',
      value: 50, // the exported copy's own sample — must be DROPPED, not averaged with 48
      observedAtMs: FIXED_NOW - 1 * HOUR,
      provenanceChain: [
        { provider: 'whoop', nativeOrigin: 'com.whoop.iphone', transport: 'measured' },
        { provider: 'apple_health', transport: 'aggregator_export' },
      ],
      originalSource: 'com.whoop.iphone',
      externalId: 'apple-whoop-copy',
    }),
  ],
  activeDirectProviders: new Set(['whoop']),
});

// ─── 8. Stale vs. no-recent-data — distinct unavailable reasons ────────────

/** A reading exists but is beyond the §53 `wearable_sync` expiry window (72h). */
export const RESTING_HR_EXPIRED: ResolveHealthSignalsInput = baseInput({
  records: [
    mkRecord({
      provider: 'garmin',
      metricType: 'resting_heart_rate',
      value: 60,
      observedAtMs: FIXED_NOW - 100 * HOUR,
    }),
  ],
  activeDirectProviders: new Set(['garmin']),
});

/** The provider is connected but has never produced a reading for this family. */
export const RESTING_HR_NEVER_SYNCED: ResolveHealthSignalsInput = baseInput({
  records: [],
  activeDirectProviders: new Set(['garmin']),
});

// ─── 9. Conflicting HRV methods (priority wins, method reported, never averaged) ─

export const HRV_METHOD_CONFLICT: ResolveHealthSignalsInput = baseInput({
  records: [
    mkRecord({
      provider: 'apple_health',
      metricType: 'hrv',
      value: 45,
      hrvMethod: 'sdnn',
      observedAtMs: FIXED_NOW - 2 * HOUR,
    }),
    mkRecord({
      provider: 'garmin',
      metricType: 'hrv',
      value: 32,
      hrvMethod: 'rmssd',
      observedAtMs: FIXED_NOW - 3 * HOUR,
    }),
  ],
  // hrv ladder: whoop > oura > garmin > apple_health > samsung > google — garmin outranks apple.
  activeDirectProviders: new Set(['garmin']),
});

// ─── 10. Conflicting sleep sessions — same-origin collapsed, cross-origin selected not merged ─

export const SLEEP_OVERLAP_AND_CROSS_ORIGIN: ResolveHealthSignalsInput = baseInput({
  records: [
    // Same-origin (apple_health) near-duplicate sessions — >80% window overlap,
    // values within 5% tolerance — dedupeRecords Pass 3 collapses these to one.
    mkRecord({
      provider: 'apple_health',
      metricType: 'sleep_session',
      value: { totalSleepHours: 7.0, inBedHours: 7.6, stages: null },
      observedAtMs: FIXED_NOW - 9 * HOUR,
      startTimeMs: FIXED_NOW - 17 * HOUR,
      endTimeMs: FIXED_NOW - 9 * HOUR,
      externalId: 'apple-sleep-a',
    }),
    mkRecord({
      provider: 'apple_health',
      metricType: 'sleep_session',
      value: { totalSleepHours: 7.05, inBedHours: 7.6, stages: null },
      observedAtMs: FIXED_NOW - 8.9 * HOUR,
      startTimeMs: FIXED_NOW - 16.9 * HOUR,
      endTimeMs: FIXED_NOW - 8.9 * HOUR,
      externalId: 'apple-sleep-b',
    }),
    // Cross-origin (whoop) — a real, independent measurement. Higher ladder
    // priority AND fresher. Must be SELECTED outright, never averaged with Apple's.
    mkRecord({
      provider: 'whoop',
      metricType: 'sleep_session',
      value: {
        totalSleepHours: 6.2,
        inBedHours: 6.8,
        stages: [{ stage: 'deep', startUtc: iso(FIXED_NOW - 3 * HOUR), endUtc: iso(FIXED_NOW - 2.5 * HOUR) }],
      },
      observedAtMs: FIXED_NOW - 1.8 * HOUR,
      startTimeMs: FIXED_NOW - 8 * HOUR,
      endTimeMs: FIXED_NOW - 1.8 * HOUR,
      externalId: 'whoop-sleep-1',
    }),
  ],
  activeDirectProviders: new Set(['whoop']),
});

// ─── 11. Partial permissions — deniedTypes ⇒ permission_denied for that family only ─

export const PARTIAL_PERMISSIONS: ResolveHealthSignalsInput = baseInput({
  biometrics: {
    apple_health: mkSnapshot({
      providerId: 'apple_health',
      fetchedAt: FIXED_NOW - 1 * HOUR,
      hrvSdnnMs: 40, // present in the raw blob but MUST be suppressed — hrv is denied below
      stepsToday: 5000,
      sleepHoursLastNight: 7,
    }),
  },
  activeDirectProviders: new Set(),
  connections: {
    apple_health: {
      presentationState: 'connected_limited',
      grantedTypes: ['steps', 'sleep_session'],
      deniedTypes: ['hrv'],
    },
  },
});

// ─── 12. No data — nothing connected anywhere ──────────────────────────────

export const NO_DATA: ResolveHealthSignalsInput = baseInput({
  biometrics: undefined,
  records: undefined,
  activeDirectProviders: new Set(),
  connections: undefined,
});

export const ALL_SIGNAL_RESOLUTION_FIXTURES = {
  APPLE_ONLY,
  HC_ONLY,
  SAMSUNG_VIA_HEALTH_CONNECT,
  OURA_DIRECT,
  WHOOP_DIRECT,
  OURA_DIRECT_PLUS_VIA_APPLE,
  WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED,
  RESTING_HR_EXPIRED,
  RESTING_HR_NEVER_SYNCED,
  HRV_METHOD_CONFLICT,
  SLEEP_OVERLAP_AND_CROSS_ORIGIN,
  PARTIAL_PERMISSIONS,
  NO_DATA,
} as const;
