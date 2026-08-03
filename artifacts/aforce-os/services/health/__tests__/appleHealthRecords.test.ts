import { describe, it, expect } from 'vitest';
import { dedupeRecords } from '@workspace/health-core';

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

describe('mapSleepSamplesToRecords', () => {
  // A realistic night, 23:00 -> 07:00, on the Apple Watch (first-party,
  // no bundle id — the shape a device-native HK sample normally has),
  // plus the SAME night re-exported into HealthKit by the Oura app.
  const appleWatchNight: HKSleepCategorySample[] = [
    { value: 0, startDate: '2026-08-02T23:00:00.000Z', endDate: '2026-08-02T23:15:00.000Z' }, // inBed, not asleep
    { value: 3, startDate: '2026-08-02T23:15:00.000Z', endDate: '2026-08-03T01:15:00.000Z' }, // asleepCore -> light, 2h
    { value: 4, startDate: '2026-08-03T01:15:00.000Z', endDate: '2026-08-03T02:15:00.000Z' }, // asleepDeep, 1h
    { value: 2, startDate: '2026-08-03T02:15:00.000Z', endDate: '2026-08-03T02:30:00.000Z' }, // awake, 15m
    { value: 5, startDate: '2026-08-03T02:30:00.000Z', endDate: '2026-08-03T03:30:00.000Z' }, // asleepREM, 1h
    { value: 3, startDate: '2026-08-03T03:30:00.000Z', endDate: '2026-08-03T07:00:00.000Z' }, // asleepCore -> light, 3.5h
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
    expect(appleRecord.provenanceChain).toEqual([{ provider: 'apple_health', transport: 'measured' }]);
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
    expect(record.provenanceChain).toEqual([{ provider: 'apple_health', transport: 'measured' }]);
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
