import { describe, it, expect } from 'vitest';
import { dedupeRecords, resolveOriginForAggregator } from '@workspace/health-core';

import {
  mapSleepSamplesToRecords,
  mapRestingHeartRateSamples,
  mapHrvSdnnSamples,
  mapStepsSamples,
  mapActiveEnergySamples,
  mapRespiratoryRateSamples,
  mapWorkoutSamples,
  resolvePartialAppleHealthAuthorization,
  type HKSleepCategorySample,
  type HKQuantitySample,
  type HKWorkoutSample,
} from '../appleHealthRecords';

const USER_ID = 'user_evidence_only';
const SYNCED_AT = '2026-08-03T09:00:00.000Z';

/** Apple's own bundle id — the ONLY thing that earns first-party attribution now. See appleHealthRecords.ts's honesty rules. */
const APPLE_FIRST_PARTY_BUNDLE = { source: { bundleIdentifier: 'com.apple.health' } };

describe('mapSleepSamplesToRecords', () => {
  // A realistic night, 23:00 -> 07:00, on the Apple Watch — stamped with
  // Apple's own bundle id (positive evidence of first-party), plus the SAME
  // night re-exported into HealthKit by the Oura app.
  const appleWatchNight: HKSleepCategorySample[] = [
    { value: 0, startDate: '2026-08-02T23:00:00.000Z', endDate: '2026-08-02T23:15:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // inBed, not asleep
    { value: 3, startDate: '2026-08-02T23:15:00.000Z', endDate: '2026-08-03T01:15:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // asleepCore -> light, 2h
    { value: 4, startDate: '2026-08-03T01:15:00.000Z', endDate: '2026-08-03T02:15:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // asleepDeep, 1h
    { value: 2, startDate: '2026-08-03T02:15:00.000Z', endDate: '2026-08-03T02:30:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // awake, 15m
    { value: 5, startDate: '2026-08-03T02:30:00.000Z', endDate: '2026-08-03T03:30:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // asleepREM, 1h
    { value: 3, startDate: '2026-08-03T03:30:00.000Z', endDate: '2026-08-03T07:00:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // asleepCore -> light, 3.5h
  ];

  const ouraViaHealthKitNight: HKSleepCategorySample[] = [
    {
      value: 1, // asleepUnspecified — Oura's re-export doesn't carry AForce's stage granularity here.
      startDate: '2026-08-02T23:10:00.000Z',
      endDate: '2026-08-03T06:50:00.000Z',
      sourceRevision: { source: { bundleIdentifier: 'com.ouraring.oura', name: 'Oura' } },
    },
  ];

  it('empty read produces an empty array — no fabricated night', () => {
    expect(mapSleepSamplesToRecords([], { userId: USER_ID, syncedAt: SYNCED_AT })).toEqual([]);
  });

  it('groups by source into one record per origin and computes honest sleep math for the direct (Apple Watch) record', () => {
    const records = mapSleepSamplesToRecords(
      [...appleWatchNight, ...ouraViaHealthKitNight],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(2);

    const appleRecord = records.find((r) => r.provenanceChain.length === 1)!;
    expect(appleRecord).toBeDefined();
    expect(appleRecord.metricType).toBe('sleep_session');
    expect(appleRecord.provider).toBe('apple_health');
    expect(appleRecord.provenanceChain).toEqual([
      { provider: 'apple_health', nativeOrigin: 'com.apple.health', transport: 'measured' },
    ]);
    expect(appleRecord.originalSource).toBeUndefined();

    // asleep-not-inBed: 2h (light) + 1h (deep) + 1h (rem) + 3.5h (light) = 7.5h.
    // 15m inBed and 15m awake are excluded from totalSleepHours.
    const value = appleRecord.value as { totalSleepHours: number; inBedHours: number | null; stages: unknown[] | null };
    expect(value.totalSleepHours).toBeCloseTo(7.5, 5);
    expect(value.inBedHours).toBeCloseTo(0.25, 5);
    expect(value.stages).not.toBeNull();
    // inBed sample (value 0) never becomes a stage entry.
    expect(value.stages).toHaveLength(5);
    expect(value.stages!.every((s: any) => s.stage !== undefined)).toBe(true);

    expect(appleRecord.startTime).toBe('2026-08-02T23:00:00.000Z');
    expect(appleRecord.endTime).toBe('2026-08-03T07:00:00.000Z');
    expect(appleRecord.observedAt).toBe(appleRecord.endTime);
    expect(appleRecord.syncedAt).toBe(SYNCED_AT);
  });

  it('the Oura-via-HealthKit record carries a two-hop provenance chain honestly attributed to Oura', () => {
    const records = mapSleepSamplesToRecords(ouraViaHealthKitNight, {
      userId: USER_ID,
      syncedAt: SYNCED_AT,
    });
    expect(records).toHaveLength(1);
    const [ouraRecord] = records;
    expect(ouraRecord.provider).toBe('apple_health'); // delivered to AForce via HealthKit
    expect(ouraRecord.originalSource).toBe('com.ouraring.oura');
    expect(ouraRecord.provenanceChain).toEqual([
      { provider: 'oura', nativeOrigin: 'com.ouraring.oura', transport: 'measured' },
      { provider: 'apple_health', transport: 'aggregator_export' },
    ]);
  });

  it('dedupeRecords drops the Oura-via-HealthKit record when Oura is directly connected, keeping the Apple Watch record', () => {
    const records = mapSleepSamplesToRecords(
      [...appleWatchNight, ...ouraViaHealthKitNight],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );

    const { kept, dropped } = dedupeRecords(records, {
      activeDirectProviders: new Set(['oura']),
    });

    expect(kept).toHaveLength(1);
    expect(kept[0].provenanceChain).toHaveLength(1);
    expect(kept[0].provenanceChain[0].provider).toBe('apple_health');

    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toBe('aggregator_copy_of_direct');
    expect(dropped[0].record.originalSource).toBe('com.ouraring.oura');
  });

  it('does NOT drop the Oura-via-HealthKit record when Oura has no active direct connection', () => {
    const records = mapSleepSamplesToRecords(
      [...appleWatchNight, ...ouraViaHealthKitNight],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    const { kept, dropped } = dedupeRecords(records, {
      activeDirectProviders: new Set(),
    });
    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(0);
  });

  it('a genuinely unrecognized third-party bundle id is attributed honestly as unknown_device_app, never as apple_health', () => {
    const records = mapSleepSamplesToRecords(
      [
        {
          value: 1,
          startDate: '2026-08-02T23:00:00.000Z',
          endDate: '2026-08-03T06:00:00.000Z',
          sourceRevision: { source: { bundleIdentifier: 'com.somefitnessapp.tracker' } },
        },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    expect(records[0].provenanceChain[0].provider).toBe('unknown_device_app');
    expect(records[0].provenanceChain[1]).toEqual({ provider: 'apple_health', transport: 'aggregator_export' });
  });

  it('an ABSENT bundle id (no sourceRevision at all) is attributed as unknown_device_app, NEVER assumed first-party', () => {
    // Previously: no sourceRevision was treated as "must be the Apple
    // Watch" and given a single first-party hop. That was an unfounded
    // guess — every genuine HKSample carries a populated sourceRevision,
    // so a missing one is honestly "we don't know", not "assume Apple".
    const records = mapSleepSamplesToRecords(
      [{ value: 1, startDate: '2026-08-02T23:00:00.000Z', endDate: '2026-08-03T06:00:00.000Z' }],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    expect(records[0].provenanceChain).toEqual([
      { provider: 'unknown_device_app', transport: 'measured' },
      { provider: 'apple_health', transport: 'aggregator_export' },
    ]);
    expect(records[0].provider).toBe('apple_health'); // still the delivering provider
  });

  it('com.aforce.os (our own app writing back into HealthKit) is NEVER attributed as first-party apple_health — no self-loop', () => {
    const records = mapSleepSamplesToRecords(
      [
        {
          value: 1,
          startDate: '2026-08-02T23:00:00.000Z',
          endDate: '2026-08-03T06:00:00.000Z',
          sourceRevision: { source: { bundleIdentifier: 'com.aforce.os' } },
        },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    // NOT [{ provider: 'apple_health', transport: 'measured' }] — that would
    // claim Apple's platform measured a value AForce itself wrote.
    expect(records[0].provenanceChain).toEqual([
      { provider: 'unknown_device_app', nativeOrigin: 'com.aforce.os', transport: 'measured' },
      { provider: 'apple_health', transport: 'aggregator_export' },
    ]);
    expect(records[0].originalSource).toBe('com.aforce.os');
  });

  it("com.apple.Health (the real Health.app bundle id, capital H) resolves single-hop first-party apple_health — matching health-core's canonical policy", () => {
    // Regression pin for a real divergence found when this adapter's
    // first-party check was migrated onto health-core's shared
    // resolveOriginForAggregator: the old LOCAL allow-list here only knew
    // the lowercase 'com.apple.health' stem (the device-sample prefix), and
    // never recognized 'com.apple.Health' — the Health app's OWN bundle id
    // per lib/health-core/src/dedupe.ts's AGGREGATOR_FIRST_PARTY_ORIGINS.
    // That meant the actual Health app bundle id would have been misfiled
    // as unknown_device_app + an aggregator hop. The helper is canonical;
    // this pins the corrected (single-hop, first-party) outcome.
    const records = mapSleepSamplesToRecords(
      [
        {
          value: 1,
          startDate: '2026-08-02T23:00:00.000Z',
          endDate: '2026-08-03T06:00:00.000Z',
          sourceRevision: { source: { bundleIdentifier: 'com.apple.Health' } },
        },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    expect(records[0].provenanceChain).toEqual([
      { provider: 'apple_health', nativeOrigin: 'com.apple.Health', transport: 'measured' },
    ]);
  });

  it('inBedHours is null (not derived from asleep+awake) when no explicit inBed(0) sample is present', () => {
    // Same shape of night as ouraViaHealthKitNight-style data — asleep and
    // awake samples, but the source never sent an explicit inBed(0) sample.
    const records = mapSleepSamplesToRecords(
      [
        { value: 1, startDate: '2026-08-02T23:00:00.000Z', endDate: '2026-08-03T02:00:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // asleep, 3h
        { value: 2, startDate: '2026-08-03T02:00:00.000Z', endDate: '2026-08-03T02:15:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // awake, 15m
        { value: 1, startDate: '2026-08-03T02:15:00.000Z', endDate: '2026-08-03T05:15:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }, // asleep, 3h
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    const value = records[0].value as { totalSleepHours: number; inBedHours: number | null };
    expect(value.totalSleepHours).toBeCloseTo(6, 5); // 3h + 3h asleep; the 15m awake gap excluded
    // NOT 6.25 (asleep+awake summed) — this source never told us an in-bed
    // interval, so the honest answer is null, not a derived guess.
    expect(value.inBedHours).toBeNull();
  });

  it('a sample with an unparseable date is dropped individually, not fabricated or crash-inducing', () => {
    const records = mapSleepSamplesToRecords(
      [
        { value: 1, startDate: 'not-a-date', endDate: '2026-08-03T02:00:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE },
        { value: 4, startDate: '2026-08-03T02:00:00.000Z', endDate: '2026-08-03T03:00:00.000Z', sourceRevision: APPLE_FIRST_PARTY_BUNDLE },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    expect(records[0].startTime).toBe('2026-08-03T02:00:00.000Z');
    expect(records[0].endTime).toBe('2026-08-03T03:00:00.000Z');
    const value = records[0].value as { totalSleepHours: number; stages: unknown[] | null };
    expect(value.stages).toHaveLength(1); // only the valid sample survives
    expect(value.totalSleepHours).toBeCloseTo(1, 5);
  });

  it('a source group where EVERY sample has an unparseable date produces no record, not a zero-span fabrication', () => {
    const records = mapSleepSamplesToRecords(
      [{ value: 1, startDate: 'garbage', endDate: 'also garbage', sourceRevision: APPLE_FIRST_PARTY_BUNDLE }],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toEqual([]);
  });
});

describe('mapHrvSdnnSamples', () => {
  it('empty read produces an empty array', () => {
    expect(mapHrvSdnnSamples([], { userId: USER_ID, syncedAt: SYNCED_AT })).toEqual([]);
  });

  it('lands HRV in the sdnn pathway — hrvMethod is always sdnn, never rmssd', () => {
    const samples: HKQuantitySample[] = [
      { quantity: 62.4, startDate: '2026-08-03T07:05:00.000Z', endDate: '2026-08-03T07:05:00.000Z', uuid: 'hrv-1' },
    ];
    const [record] = mapHrvSdnnSamples(samples, { userId: USER_ID, syncedAt: SYNCED_AT });
    expect(record.metricType).toBe('hrv');
    expect(record.hrvMethod).toBe('sdnn');
    expect(record.hrvMethod).not.toBe('rmssd');
    expect(record.value).toBe(62.4);
    expect(record.unit).toBe('ms');
    expect(record.externalId).toBe('hrv-1');
    // No sourceRevision on this sample ⇒ no positive first-party evidence ⇒
    // unknown_device_app + apple_health aggregator hop (never assumed Apple).
    expect(record.provenanceChain).toEqual([
      { provider: 'unknown_device_app', transport: 'measured' },
      { provider: 'apple_health', transport: 'aggregator_export' },
    ]);
  });

  it('never emits hrvMethod rmssd across a batch of samples', () => {
    const samples: HKQuantitySample[] = Array.from({ length: 5 }, (_, i) => ({
      quantity: 40 + i,
      startDate: `2026-08-0${i + 1}T07:00:00.000Z`,
      endDate: `2026-08-0${i + 1}T07:00:00.000Z`,
    }));
    const records = mapHrvSdnnSamples(samples, { userId: USER_ID, syncedAt: SYNCED_AT });
    expect(records).toHaveLength(5);
    expect(records.every((r) => r.hrvMethod === 'sdnn')).toBe(true);
  });
});

describe('mapRestingHeartRateSamples', () => {
  it('empty read produces an empty array', () => {
    expect(mapRestingHeartRateSamples([], { userId: USER_ID, syncedAt: SYNCED_AT })).toEqual([]);
  });

  it('maps a resting heart rate sample with bpm unit and no hrvMethod field', () => {
    const [record] = mapRestingHeartRateSamples(
      [{ quantity: 54, startDate: '2026-08-03T07:00:00.000Z', endDate: '2026-08-03T07:00:00.000Z', uuid: 'rhr-1' }],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(record.metricType).toBe('resting_heart_rate');
    expect(record.value).toBe(54);
    expect(record.unit).toBe('bpm');
    expect(record.hrvMethod).toBeUndefined();
  });

  it('drops a sample with an unparseable date instead of throwing, keeping the rest of the batch', () => {
    const records = mapRestingHeartRateSamples(
      [
        { quantity: 54, startDate: 'not-a-real-date', endDate: '2026-08-03T07:00:00.000Z' },
        { quantity: 58, startDate: '2026-08-03T08:00:00.000Z', endDate: '2026-08-03T08:00:00.000Z' },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe(58);
  });
});

describe('mapStepsSamples', () => {
  it('empty read produces an empty array', () => {
    expect(mapStepsSamples([], { userId: USER_ID, syncedAt: SYNCED_AT })).toEqual([]);
  });

  it('maps step-count intervals with count unit, one record per sample', () => {
    const samples: HKQuantitySample[] = [
      { quantity: 1200, startDate: '2026-08-03T06:00:00.000Z', endDate: '2026-08-03T07:00:00.000Z' },
      { quantity: 3400, startDate: '2026-08-03T07:00:00.000Z', endDate: '2026-08-03T08:00:00.000Z' },
    ];
    const records = mapStepsSamples(samples, { userId: USER_ID, syncedAt: SYNCED_AT });
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.value)).toEqual([1200, 3400]);
    expect(records.every((r) => r.unit === 'count' && r.metricType === 'steps')).toBe(true);
  });
});

describe('mapActiveEnergySamples', () => {
  it('empty read produces an empty array', () => {
    expect(mapActiveEnergySamples([], { userId: USER_ID, syncedAt: SYNCED_AT })).toEqual([]);
  });

  it('maps active energy in kcal', () => {
    const [record] = mapActiveEnergySamples(
      [{ quantity: 320.5, startDate: '2026-08-03T06:00:00.000Z', endDate: '2026-08-03T07:00:00.000Z' }],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(record.metricType).toBe('active_energy');
    expect(record.unit).toBe('kcal');
    expect(record.value).toBe(320.5);
  });
});

describe('mapRespiratoryRateSamples', () => {
  it('empty read produces an empty array', () => {
    expect(mapRespiratoryRateSamples([], { userId: USER_ID, syncedAt: SYNCED_AT })).toEqual([]);
  });

  it('maps respiratory rate in brpm', () => {
    const [record] = mapRespiratoryRateSamples(
      [{ quantity: 14.2, startDate: '2026-08-03T03:00:00.000Z', endDate: '2026-08-03T03:00:00.000Z' }],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(record.metricType).toBe('respiratory_rate');
    expect(record.unit).toBe('brpm');
  });
});

describe('mapWorkoutSamples', () => {
  it('empty read produces an empty array', () => {
    expect(mapWorkoutSamples([], { userId: USER_ID, syncedAt: SYNCED_AT })).toEqual([]);
  });

  it('maps a workout into a structured WorkoutValue, lowercasing activity kind', () => {
    const samples: HKWorkoutSample[] = [
      {
        workoutActivityType: 'Running',
        durationSec: 1800,
        totalEnergyBurnedKcal: 260,
        averageHeartRateBpm: 148,
        startDate: '2026-08-03T12:00:00.000Z',
        endDate: '2026-08-03T12:30:00.000Z',
        uuid: 'workout-1',
      },
    ];
    const [record] = mapWorkoutSamples(samples, { userId: USER_ID, syncedAt: SYNCED_AT });
    expect(record.metricType).toBe('workout');
    expect(record.value).toEqual({
      activityKind: 'running',
      durationMin: 30,
      activeEnergyKcal: 260,
      avgHeartRateBpm: 148,
    });
    expect(record.startTime).toBe('2026-08-03T12:00:00.000Z');
    expect(record.endTime).toBe('2026-08-03T12:30:00.000Z');
    expect(record.externalId).toBe('workout-1');
  });

  it('never fabricates energy/heart-rate — absent fields stay null', () => {
    const [record] = mapWorkoutSamples(
      [
        {
          workoutActivityType: 'walking',
          durationSec: 600,
          startDate: '2026-08-03T12:00:00.000Z',
          endDate: '2026-08-03T12:10:00.000Z',
        },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    const value = record.value as { activeEnergyKcal: number | null; avgHeartRateBpm: number | null };
    expect(value.activeEnergyKcal).toBeNull();
    expect(value.avgHeartRateBpm).toBeNull();
  });

  it('drops a workout with an unparseable date instead of throwing', () => {
    const records = mapWorkoutSamples(
      [
        { workoutActivityType: 'cycling', durationSec: 900, startDate: 'nope', endDate: '2026-08-03T12:15:00.000Z' },
        {
          workoutActivityType: 'walking',
          durationSec: 600,
          startDate: '2026-08-03T13:00:00.000Z',
          endDate: '2026-08-03T13:10:00.000Z',
        },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    expect(records).toHaveLength(1);
    expect((records[0].value as { activityKind: string }).activityKind).toBe('walking');
  });
});

describe('resolvePartialAppleHealthAuthorization', () => {
  it('every requested READ type is indeterminate — HealthKit never reports allow/deny for reads', () => {
    const result = resolvePartialAppleHealthAuthorization({
      toRead: ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'HKCategoryTypeIdentifierSleepAnalysis'],
      toShare: [],
    });
    expect(result).toEqual({
      granted: [],
      denied: [],
      indeterminate: [
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        'HKCategoryTypeIdentifierSleepAnalysis',
      ],
    });
  });

  it('partitions SHARE (write) types using the caller-supplied granted/denied sets', () => {
    const result = resolvePartialAppleHealthAuthorization(
      {
        toRead: ['HKQuantityTypeIdentifierStepCount'],
        toShare: ['HKQuantityTypeIdentifierDietaryWater', 'HKQuantityTypeIdentifierBodyMass'],
      },
      {
        toShareGranted: ['HKQuantityTypeIdentifierDietaryWater'],
        toShareDenied: ['HKQuantityTypeIdentifierBodyMass'],
      },
    );
    expect(result.granted).toEqual(['HKQuantityTypeIdentifierDietaryWater']);
    expect(result.denied).toEqual(['HKQuantityTypeIdentifierBodyMass']);
    expect(result.indeterminate).toEqual(['HKQuantityTypeIdentifierStepCount']);
  });

  it('a requested SHARE type absent from both granted and denied sets is indeterminate, not silently denied', () => {
    const result = resolvePartialAppleHealthAuthorization({
      toRead: [],
      toShare: ['HKQuantityTypeIdentifierDietaryWater'],
    });
    expect(result).toEqual({ granted: [], denied: [], indeterminate: ['HKQuantityTypeIdentifierDietaryWater'] });
  });
});

// ─── Cross-platform origin-resolution parity (Apple side) ────────────────────
//
// This adapter no longer implements its own first-party-origin policy — it
// delegates hop-0 resolution to health-core's resolveOriginForAggregator.
// These tests pin two things:
//   1. this adapter's REAL output (via mapSleepSamplesToRecords) matches
//      what the canonical helper says for 'apple_health', proving genuine
//      delegation rather than a reimplementation that happens to agree today.
//   2. for every input that isn't first-party evidence for EITHER aggregator
//      (degenerate values, unrecognized junk, and known third-party wearable
//      ids), 'apple_health' and 'google_health' resolve IDENTICALLY — the
//      same regression the sibling Health Connect adapter's test file pins
//      for its own side (see healthConnect/__tests__/mapRecords.test.ts).
describe('cross-platform origin resolution parity (apple_health adapter)', () => {
  function hop0Provider(bundleId: string | undefined) {
    const [record] = mapSleepSamplesToRecords(
      [
        {
          value: 1,
          startDate: '2026-08-02T23:00:00.000Z',
          endDate: '2026-08-03T06:00:00.000Z',
          ...(bundleId !== undefined ? { sourceRevision: { source: { bundleIdentifier: bundleId } } } : {}),
        },
      ],
      { userId: USER_ID, syncedAt: SYNCED_AT },
    );
    return record.provenanceChain[0].provider;
  }

  it('delegates genuinely to resolveOriginForAggregator — adapter output matches the helper for every case', () => {
    const inputs: (string | undefined)[] = [
      undefined,
      'not-a-real-bundle-id',
      'com.ouraring.oura',
      'com.sec.android.app.shealth',
      'com.google.android.apps.fitness',
      'com.apple.health',
      'com.apple.Health',
      'com.aforce.os',
    ];
    for (const input of inputs) {
      expect(hop0Provider(input)).toBe(resolveOriginForAggregator('apple_health', input));
    }
  });

  // Degenerate / non-first-party inputs — SAME policy outcome on both
  // aggregators, since none of these are positive first-party evidence for
  // either platform. First-party spellings are deliberately excluded here
  // (they are platform-specific by construction); that asymmetry is covered
  // by health-core's own aggregatorOrigins.test.ts.
  const parityInputs: { label: string; input: string | undefined }[] = [
    { label: 'undefined (no sourceRevision)', input: undefined },
    { label: 'empty string', input: '' },
    { label: 'unrecognized junk', input: 'not-a-real-bundle-id' },
    { label: 'Oura bundle id', input: 'com.ouraring.oura' },
    { label: 'Samsung package', input: 'com.sec.android.app.shealth' },
    { label: 'Google Fit package (denylisted)', input: 'com.google.android.apps.fitness' },
  ];

  for (const { label, input } of parityInputs) {
    it(`${label} ⇒ identical origin on apple_health and google_health`, () => {
      const viaApple = resolveOriginForAggregator('apple_health', input);
      const viaGoogle = resolveOriginForAggregator('google_health', input);
      expect(viaApple).toBe(viaGoogle);
      // And this adapter's real behavior matches the shared result too.
      expect(hop0Provider(input)).toBe(viaApple);
    });
  }
});
