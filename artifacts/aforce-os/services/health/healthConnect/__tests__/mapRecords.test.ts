import { describe, it, expect } from 'vitest';
import {
  dedupeRecords,
  HRV_METHOD_BY_PROVIDER,
  resolveOriginForAggregator,
  type SleepSessionValue,
} from '@workspace/health-core';
import {
  mapSleepSessionRecord,
  mapSleepStages,
  mapHeartRateRecord,
  mapHeartRateVariabilityRmssdRecord,
  resolveHealthConnectOrigin,
  type MapContext,
} from '../mapRecords';
import type {
  HcSleepStage,
  HeartRateRecord,
  HeartRateVariabilityRmssdRecord,
  SleepSessionRecord,
} from '../types';

const CTX: MapContext = { userId: 'user_1', syncedAt: '2026-08-03T12:00:00.000Z' };

// Every fixture used by the provenance and dedup-key blocks carries real
// sleep stages, so mapSleepSessionRecord's zero-sleep null guard never fires
// for them — hence the `!` at those call sites. The guard itself is pinned
// in its own describe block below.
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

// Same fixture shape, but with a fixed session span so an EMPTY stage list is
// expressible — sleepRecord above reads its span off stages[0].
function sleepSessionWithStages(stages: HcSleepStage[]): SleepSessionRecord {
  return {
    metadata: {
      id: 'hc_sleep_zero',
      dataOrigin: { packageName: 'com.google.android.apps.healthdata' },
      lastModifiedTime: '2026-08-03T09:00:00.000Z',
    },
    startTime: '2026-08-03T02:00:00.000Z',
    endTime: '2026-08-03T09:00:00.000Z',
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
    const mapped = mapSleepSessionRecord(record, CTX)!;
    expect(mapped.provenanceChain).toEqual([
      { provider: 'samsung_health', nativeOrigin: 'com.sec.android.app.shealth', transport: 'measured' },
      { provider: 'google_health', transport: 'aggregator_export' },
    ]);
    // Delivering provider is always google_health — that's this whole adapter's identity.
    expect(mapped.provider).toBe('google_health');
  });

  it('dedupeRecords KEEPS the Samsung-origin record with its chain intact when no direct Samsung connection exists', () => {
    const mapped = mapSleepSessionRecord(record, CTX)!;
    const result = dedupeRecords([mapped], { activeDirectProviders: new Set() });
    expect(result.dropped).toEqual([]);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0].provenanceChain).toHaveLength(2);
    expect(result.kept[0].provenanceChain[0].provider).toBe('samsung_health');
  });

  it('dedupeRecords DROPS the Samsung-via-HC copy once a direct Samsung connection is active (aggregator_copy_of_direct)', () => {
    const mapped = mapSleepSessionRecord(record, CTX)!;
    const result = dedupeRecords([mapped], { activeDirectProviders: new Set(['samsung_health']) });
    expect(result.kept).toEqual([]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0].reason).toBe('aggregator_copy_of_direct');
  });
});

describe('provenance chain — first-party google_health record', () => {
  it('the Health Connect app package resolves to a single google_health hop, transport measured', () => {
    const stages: HcSleepStage[] = [
      { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 },
    ];
    const record = sleepRecord('com.google.android.apps.healthdata', stages);
    const mapped = mapSleepSessionRecord(record, CTX)!;
    expect(mapped.provenanceChain).toEqual([
      { provider: 'google_health', nativeOrigin: 'com.google.android.apps.healthdata', transport: 'measured' },
    ]);
    expect(mapped.provenanceChain).toHaveLength(1);
  });

  it('Google Fit is DENYLISTED, not first-party — resolves to unknown_device_app with the aggregator hop intact', () => {
    // Regression pin for a real divergence found when this adapter's
    // first-party check was migrated onto health-core's shared
    // resolveOriginForAggregator: the old LOCAL allow-list here
    // (GOOGLE_FIRST_PARTY_PACKAGES) treated 'com.google.android.apps.fitness'
    // (Google Fit) as first-party google_health, alongside the real Health
    // Connect app package. That was a real defect — health-core's
    // AGGREGATOR_NEVER_FIRST_PARTY guard exists specifically because Fit is a
    // separate consumer app writing phone-estimated data INTO Health
    // Connect, not Health Connect itself (see lib/health-core/src/dedupe.ts).
    // The helper is canonical; this pins the corrected outcome.
    const stages: HcSleepStage[] = [
      { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 },
    ];
    const record = sleepRecord('com.google.android.apps.fitness', stages);
    const mapped = mapSleepSessionRecord(record, CTX)!;
    expect(mapped.provenanceChain).toEqual([
      { provider: 'unknown_device_app', nativeOrigin: 'com.google.android.apps.fitness', transport: 'measured' },
      { provider: 'google_health', transport: 'aggregator_export' },
    ]);
  });
});

describe('provenance chain — unrecognized package', () => {
  it('resolves to unknown_device_app as origin, still with a google_health aggregator hop (honest, never upgraded to first-party)', () => {
    const stages: HcSleepStage[] = [{ startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 4 }];
    const record = sleepRecord('com.some.random.fitness.app', stages);
    const mapped = mapSleepSessionRecord(record, CTX)!;
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

  it('an unrecognized stage int (e.g. 7, STAGE_TYPE_AWAKE_IN_BED) falls back to unspecified rather than being dropped', () => {
    // HcSleepStageType is `number`, not a closed 0-6 union, precisely so a
    // real HC provider can hand us stage 7 without an unsound cast.
    const value = mapSleepStages([
      { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T03:00:00.000Z', stage: 7 },
    ]);
    expect(value.stages).toEqual([
      { stage: 'unspecified', startUtc: '2026-08-03T02:00:00.000Z', endUtc: '2026-08-03T03:00:00.000Z' },
    ]);
    // Counted as asleep+in-bed, same as the other "some real state, no bucket yet" ints (0, 2).
    expect(value.totalSleepHours).toBe(1);
    expect(value.inBedHours).toBe(1);
  });
});

// ─── mapSleepSessionRecord — never fabricate a 0h night from a non-measurement ─
//
// mapSleepStages still reports 0 for these (its own tests above pin that, and
// they stay as they are — it is a pure stage summarizer). The RECORD mapper is
// where the honesty call lives: a 0 that means "HC gave us nothing to read"
// must not leave this adapter at all, because downstream a literal 0 scores as
// the maximal sleep deficit while an absent record contributes nothing.

describe('mapSleepSessionRecord — zero-sleep sessions produce NO record', () => {
  it('a session with no stages at all produces NO record — the stage data is missing, not a 0h night', () => {
    expect(mapSleepSessionRecord(sleepSessionWithStages([]), CTX)).toBeNull();
  });

  it('an awake-only session produces NO record — HC classified none of it as sleep', () => {
    const result = mapSleepSessionRecord(
      sleepSessionWithStages([
        { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T04:00:00.000Z', stage: 1 },
        { startTime: '2026-08-03T04:00:00.000Z', endTime: '2026-08-03T06:00:00.000Z', stage: 1 },
      ]),
      CTX,
    );
    // Two real in-bed hours are on the floor here, and that is the accepted
    // cost: totalSleepHours is non-nullable, so shipping the in-bed time means
    // shipping a fabricated 0h of sleep next to it.
    expect(result).toBeNull();
  });

  it('an out-of-bed-only session produces NO record — every stage was excluded from sleep time', () => {
    expect(
      mapSleepSessionRecord(
        sleepSessionWithStages([
          { startTime: '2026-08-03T04:00:00.000Z', endTime: '2026-08-03T04:30:00.000Z', stage: 3 },
        ]),
        CTX,
      ),
    ).toBeNull();
  });

  it('an awake + out-of-bed mix produces NO record — neither contributes sleep evidence', () => {
    expect(
      mapSleepSessionRecord(
        sleepSessionWithStages([
          { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T03:00:00.000Z', stage: 1 },
          { startTime: '2026-08-03T03:00:00.000Z', endTime: '2026-08-03T03:30:00.000Z', stage: 3 },
        ]),
        CTX,
      ),
    ).toBeNull();
  });

  it('real sleep stages whose durations all clamp to 0 produce NO record — unreadable timestamps, not a 0h night', () => {
    const result = mapSleepSessionRecord(
      sleepSessionWithStages([
        // Unparseable — durationMs sees NaN and clamps.
        { startTime: 'not-a-timestamp', endTime: 'also-not-a-timestamp', stage: 5 },
        // Inverted — end before start, likewise clamped.
        { startTime: '2026-08-03T05:00:00.000Z', endTime: '2026-08-03T04:00:00.000Z', stage: 6 },
      ]),
      CTX,
    );
    // The stages ARE deep and REM; only their durations are unreadable. A
    // corrupt clock must not be reported as a night of no sleep.
    expect(result).toBeNull();
  });

  it('a session with any positive sleep time still maps in full', () => {
    const result = mapSleepSessionRecord(
      sleepSessionWithStages([
        { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T03:00:00.000Z', stage: 1 }, // awake
        { startTime: '2026-08-03T03:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 }, // 6h deep
      ]),
      CTX,
    );
    expect(result).not.toBeNull();
    expect(result!.metricType).toBe('sleep_session');
    expect((result!.value as SleepSessionValue).totalSleepHours).toBeCloseTo(6, 10);
    expect((result!.value as SleepSessionValue).inBedHours).toBeCloseTo(7, 10);
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

// ─── mapHeartRateRecord — never fabricate 0 bpm from an empty session ────────

describe('mapHeartRateRecord', () => {
  function hrRecord(samples: { time: string; beatsPerMinute: number }[]): HeartRateRecord {
    return {
      metadata: {
        id: 'hc_hr_1',
        dataOrigin: { packageName: 'com.google.android.apps.healthdata' },
        lastModifiedTime: '2026-08-03T07:00:00.000Z',
      },
      startTime: '2026-08-03T06:00:00.000Z',
      endTime: '2026-08-03T06:05:00.000Z',
      samples,
    };
  }

  it('an empty sample array produces NO record — never a fabricated 0 bpm', () => {
    const result = mapHeartRateRecord(hrRecord([]), CTX);
    expect(result).toBeNull();
  });

  it('a non-empty sample array still averages correctly and rounds to 1 decimal', () => {
    const result = mapHeartRateRecord(
      hrRecord([
        { time: '2026-08-03T06:00:00.000Z', beatsPerMinute: 60 },
        { time: '2026-08-03T06:01:00.000Z', beatsPerMinute: 61 },
        { time: '2026-08-03T06:02:00.000Z', beatsPerMinute: 60 },
      ]),
      CTX,
    );
    expect(result).not.toBeNull();
    expect(result!.metricType).toBe('heart_rate_summary');
    expect(result!.value).toBeCloseTo(60.3, 5);
    expect(result!.unit).toBe('bpm');
  });
});

// ─── GOOGLE_HRV_METHOD invariant (moved out of a module-load throw — see mapRecords.ts) ─

describe('GOOGLE_HRV_METHOD invariant', () => {
  it('health-core still declares rmssd for google_health — this adapter hardcodes that assumption without re-deriving it', () => {
    // mapRecords.ts used to throw at import time if this ever drifted.
    // That's a production landmine (crashes on import, not on use); the
    // invariant now lives here instead, where a failure is a clear,
    // catchable test failure rather than an app-wide crash.
    expect(HRV_METHOD_BY_PROVIDER.google_health).toBe('rmssd');
  });
});

// ─── Deduplication key shape (sanity — real key builder is health-core's, frozen) ─

describe('deduplicationKey', () => {
  it('uses the record origin (hop 0), not the delivering provider, per health-core buildDeduplicationKey', () => {
    const stages: HcSleepStage[] = [{ startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 }];
    const mapped = mapSleepSessionRecord(sleepRecord('com.sec.android.app.shealth', stages), CTX)!;
    expect(mapped.deduplicationKey).toBe('user_1|sleep_session|samsung_health|ext:hc_sleep_1');
  });
});

// ─── Cross-platform origin-resolution parity (Health Connect side) ───────────
//
// This adapter no longer implements its own first-party-origin policy — it
// delegates hop-0 resolution to health-core's resolveOriginForAggregator.
// These tests pin two things:
//   1. this adapter's REAL output (via resolveHealthConnectOrigin) matches
//      what the canonical helper says for 'google_health', proving genuine
//      delegation rather than a reimplementation that happens to agree today.
//   2. for every input that isn't first-party evidence for EITHER aggregator
//      (degenerate values, unrecognized junk, and known third-party wearable
//      ids), 'apple_health' and 'google_health' resolve IDENTICALLY — the
//      same regression the sibling Apple adapter's test file pins for its
//      own side (see __tests__/appleHealthRecords.test.ts).
describe('cross-platform origin resolution parity (google_health adapter)', () => {
  it('delegates genuinely to resolveOriginForAggregator — adapter output matches the helper for every case', () => {
    const inputs = [
      '',
      'not-a-real-package-id',
      'com.ouraring.oura',
      'com.sec.android.app.shealth',
      'com.google.android.apps.fitness',
      'com.google.android.apps.healthdata',
    ];
    for (const input of inputs) {
      expect(resolveHealthConnectOrigin({ packageName: input })).toBe(
        resolveOriginForAggregator('google_health', input),
      );
    }
  });

  // Degenerate / non-first-party inputs — SAME policy outcome on both
  // aggregators, since none of these are positive first-party evidence for
  // either platform. First-party spellings are deliberately excluded here
  // (they are platform-specific by construction); that asymmetry is covered
  // by health-core's own aggregatorOrigins.test.ts.
  const parityInputs: { label: string; input: string }[] = [
    { label: 'empty string', input: '' },
    { label: 'unrecognized junk', input: 'not-a-real-package-id' },
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
      expect(resolveHealthConnectOrigin({ packageName: input })).toBe(viaGoogle);
    });
  }
});
