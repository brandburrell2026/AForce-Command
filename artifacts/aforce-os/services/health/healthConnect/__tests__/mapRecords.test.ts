import { describe, it, expect } from 'vitest';
import { dedupeRecords } from '@workspace/health-core';
import {
  mapSleepSessionRecord,
  mapSleepStages,
  mapHeartRateVariabilityRmssdRecord,
  resolveHealthConnectOrigin,
  type MapContext,
} from '../mapRecords';
import type { HcSleepStage, HeartRateVariabilityRmssdRecord, SleepSessionRecord } from '../types';

const CTX: MapContext = { userId: 'user_1', syncedAt: '2026-08-03T12:00:00.000Z' };

function sleepRecord(packageName: string, stages: HcSleepStage[]): SleepSessionRecord {
  return {
    metadata: {
      id: 'hc_sleep_1',
      dataOrigin: { packageName },
      lastModifiedTime: '2026-08-03T07:00:00.000Z',
    },
    startTime: stages[0].startTime,
    endTime: stages[stages.length - 1].endTime,
    stages,
  };
}

// ─── Provenance: Samsung-via-Health-Connect vs first-party google_health ─────

describe('provenance chain — Samsung origin (via Health Connect)', () => {
  const stages: HcSleepStage[] = [{ startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 }];
  const record = sleepRecord('com.sec.android.app.shealth', stages);

  it('resolveHealthConnectOrigin maps the Samsung package to samsung_health', () => {
    expect(resolveHealthConnectOrigin(record.metadata.dataOrigin)).toBe('samsung_health');
  });

  it('produces chain [samsung_health(measured, pkg), google_health(aggregator_export)]', () => {
    const mapped = mapSleepSessionRecord(record, CTX);
    expect(mapped.provenanceChain).toEqual([
      { provider: 'samsung_health', nativeOrigin: 'com.sec.android.app.shealth', transport: 'measured' },
      { provider: 'google_health', transport: 'aggregator_export' },
    ]);
    // Delivering provider is always google_health — that's this whole adapter's identity.
    expect(mapped.provider).toBe('google_health');
  });

  it('dedupeRecords KEEPS the Samsung-origin record with its chain intact when no direct Samsung connection exists', () => {
    const mapped = mapSleepSessionRecord(record, CTX);
    const result = dedupeRecords([mapped], { activeDirectProviders: new Set() });
    expect(result.dropped).toEqual([]);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0].provenanceChain).toHaveLength(2);
    expect(result.kept[0].provenanceChain[0].provider).toBe('samsung_health');
  });

  it('dedupeRecords DROPS the Samsung-via-HC copy once a direct Samsung connection is active (aggregator_copy_of_direct)', () => {
    const mapped = mapSleepSessionRecord(record, CTX);
    const result = dedupeRecords([mapped], { activeDirectProviders: new Set(['samsung_health']) });
    expect(result.kept).toEqual([]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0].reason).toBe('aggregator_copy_of_direct');
  });
});

describe('provenance chain — first-party google_health record', () => {
  it.each(['com.google.android.apps.fitness', 'com.google.android.apps.healthdata'])(
    'package %s resolves to a single google_health hop, transport measured',
    (packageName) => {
      const stages: HcSleepStage[] = [
        { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 },
      ];
      const record = sleepRecord(packageName, stages);
      const mapped = mapSleepSessionRecord(record, CTX);
      expect(mapped.provenanceChain).toEqual([
        { provider: 'google_health', nativeOrigin: packageName, transport: 'measured' },
      ]);
      expect(mapped.provenanceChain).toHaveLength(1);
    },
  );
});

describe('provenance chain — unrecognized package', () => {
  it('resolves to unknown_device_app as origin, still with a google_health aggregator hop (honest, never upgraded to first-party)', () => {
    const stages: HcSleepStage[] = [{ startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 4 }];
    const record = sleepRecord('com.some.random.fitness.app', stages);
    const mapped = mapSleepSessionRecord(record, CTX);
    expect(mapped.provenanceChain).toEqual([
      { provider: 'unknown_device_app', nativeOrigin: 'com.some.random.fitness.app', transport: 'measured' },
      { provider: 'google_health', transport: 'aggregator_export' },
    ]);
  });
});

// ─── Sleep stage mapping table ────────────────────────────────────────────────

describe('mapSleepStages — HC stage int → canonical stage table', () => {
  it('maps 0 unknown / 2 sleeping (undifferentiated) to unspecified', () => {
    const value = mapSleepStages([
      { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T03:00:00.000Z', stage: 0 },
      { startTime: '2026-08-03T03:00:00.000Z', endTime: '2026-08-03T04:00:00.000Z', stage: 2 },
    ]);
    expect(value.stages).toEqual([
      { stage: 'unspecified', startUtc: '2026-08-03T02:00:00.000Z', endUtc: '2026-08-03T03:00:00.000Z' },
      { stage: 'unspecified', startUtc: '2026-08-03T03:00:00.000Z', endUtc: '2026-08-03T04:00:00.000Z' },
    ]);
    // Both count as asleep time — "sleeping"/"unknown" default to asleep, not awake.
    expect(value.totalSleepHours).toBe(2);
    expect(value.inBedHours).toBe(2);
  });

  it('maps 1 awake / 4 light / 5 deep / 6 REM correctly', () => {
    const value = mapSleepStages([
      { startTime: '2026-08-03T01:00:00.000Z', endTime: '2026-08-03T01:30:00.000Z', stage: 1 }, // 0.5h awake
      { startTime: '2026-08-03T01:30:00.000Z', endTime: '2026-08-03T04:00:00.000Z', stage: 4 }, // 2.5h light
      { startTime: '2026-08-03T04:00:00.000Z', endTime: '2026-08-03T05:30:00.000Z', stage: 5 }, // 1.5h deep
      { startTime: '2026-08-03T05:30:00.000Z', endTime: '2026-08-03T07:00:00.000Z', stage: 6 }, // 1.5h REM
    ]);
    expect(value.stages?.map((s) => s.stage)).toEqual(['awake', 'light', 'deep', 'rem']);
    // asleep = light + deep + rem = 5.5h; awake excluded from sleep time.
    expect(value.totalSleepHours).toBeCloseTo(5.5, 10);
    // in-bed = all four segments = 6h.
    expect(value.inBedHours).toBeCloseTo(6, 10);
  });

  it('excludes stage 3 (out of bed) from the stages array AND from both totals entirely', () => {
    const value = mapSleepStages([
      { startTime: '2026-08-03T01:00:00.000Z', endTime: '2026-08-03T04:00:00.000Z', stage: 5 }, // 3h deep
      { startTime: '2026-08-03T04:00:00.000Z', endTime: '2026-08-03T04:30:00.000Z', stage: 3 }, // 0.5h out of bed — excluded
      { startTime: '2026-08-03T04:30:00.000Z', endTime: '2026-08-03T06:30:00.000Z', stage: 6 }, // 2h REM
    ]);
    expect(value.stages).toHaveLength(2);
    expect(value.stages?.some((s) => s.startUtc === '2026-08-03T04:00:00.000Z')).toBe(false);
    expect(value.totalSleepHours).toBeCloseTo(5, 10); // 3 + 2, NOT 5.5
    expect(value.inBedHours).toBeCloseTo(5, 10); // out-of-bed time not counted as in-bed either
  });

  it('an out-of-bed-only session yields no stages and zero sleep time (not null totals)', () => {
    const value = mapSleepStages([{ startTime: '2026-08-03T04:00:00.000Z', endTime: '2026-08-03T04:30:00.000Z', stage: 3 }]);
    expect(value.stages).toBeNull();
    expect(value.totalSleepHours).toBe(0);
    expect(value.inBedHours).toBe(0);
  });

  it('an empty stage list is distinguished from a zero-duration session (inBedHours null, not 0)', () => {
    const value = mapSleepStages([]);
    expect(value.stages).toBeNull();
    expect(value.totalSleepHours).toBe(0);
    expect(value.inBedHours).toBeNull();
  });
});

// ─── HRV — RMSSD only, never SDNN ─────────────────────────────────────────────

describe('mapHeartRateVariabilityRmssdRecord', () => {
  function hrvRecord(packageName: string): HeartRateVariabilityRmssdRecord {
    return {
      metadata: { id: 'hc_hrv_1', dataOrigin: { packageName }, lastModifiedTime: '2026-08-03T07:00:00.000Z' },
      time: '2026-08-03T07:00:00.000Z',
      heartRateVariabilityMillis: 42.5,
    };
  }

  it('stamps hrvMethod as rmssd and carries the raw millis as value — RMSSD never lands as sdnn', () => {
    const mapped = mapHeartRateVariabilityRmssdRecord(hrvRecord('com.google.android.apps.healthdata'), CTX);
    expect(mapped.metricType).toBe('hrv');
    expect(mapped.hrvMethod).toBe('rmssd');
    expect(mapped.hrvMethod).not.toBe('sdnn');
    expect(mapped.value).toBe(42.5);
    expect(mapped.unit).toBe('ms');
  });

  it('carries the RMSSD label through Samsung-via-Health-Connect provenance too', () => {
    const mapped = mapHeartRateVariabilityRmssdRecord(hrvRecord('com.sec.android.app.shealth'), CTX);
    expect(mapped.hrvMethod).toBe('rmssd');
    expect(mapped.provenanceChain[0].provider).toBe('samsung_health');
  });
});

// ─── Deduplication key shape (sanity — real key builder is health-core's, frozen) ─

describe('deduplicationKey', () => {
  it('uses the record origin (hop 0), not the delivering provider, per health-core buildDeduplicationKey', () => {
    const stages: HcSleepStage[] = [{ startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 }];
    const mapped = mapSleepSessionRecord(sleepRecord('com.sec.android.app.shealth', stages), CTX);
    expect(mapped.deduplicationKey).toBe('user_1|sleep_session|samsung_health|ext:hc_sleep_1');
  });
});
