/**
 * WEEKLY HEALTH AGGREGATES — aggregator unit tests (W3.4).
 *
 * Covers the scenarios named in the brief: aggregation math, missing days,
 * a duplicated-source week (Oura direct + via-Apple, same nights ⇒ counted
 * once), timezone bucketing, a DST-transition week, an HRV method-conflict
 * week, insufficient-data, provider-score attribution, per-day override
 * precedence, and the Score-Protection source-scan lock.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HealthProviderId } from '@workspace/health-core';
import {
  buildWeeklyHealthAggregates,
  defaultDayBoundariesMs,
  type WeeklyHealthMetricAggregate,
  type WeeklyHrvMetricAggregate,
} from '../weeklyHealthAggregates';
import {
  FIXED_NOW,
  DAYS,
  UTC_OFFSET_MIN,
  PDT_OFFSET_MIN,
  TIMEZONE_WEEK_BOUNDARIES,
  DST_WEEK_BOUNDARIES,
  FULL_WEEK_SLEEP_RECORDS,
  MISSING_DAYS_SLEEP_RECORDS,
  INSUFFICIENT_DATA_SLEEP_RECORDS,
  DUPLICATED_SOURCE_WEEK_RECORDS,
  DUPLICATED_SOURCE_ACTIVE_DIRECT_PROVIDERS,
  DUPLICATED_SOURCE_RHR_DIRECT_VALUES,
  HRV_METHOD_CONFLICT_WEEK_RECORDS,
  HRV_SDNN_VALUES,
  TIMEZONE_WEEK_LATE_LOCAL_NIGHT_RECORD,
  TIMEZONE_WEEK_MIDDAY_RECORDS,
  TIMEZONE_WEEK_MIDDAY_RHR_VALUES,
  DST_WEEK_STEPS_RECORDS,
  DST_WEEK_BOUNDARY_EDGE_RECORD,
  PROVIDER_SCORE_WEEK_RECORDS,
  WHOOP_RECOVERY_VALUES_BY_DAY,
  dayMidMs,
  mkRecord,
} from '../weeklyHealthAggregatesFixtures';

function expectOk(agg: WeeklyHealthMetricAggregate): asserts agg is Extract<WeeklyHealthMetricAggregate, { status: 'ok' }> {
  expect(agg.status).toBe('ok');
}

function expectInsufficient(
  agg: WeeklyHealthMetricAggregate,
): asserts agg is Extract<WeeklyHealthMetricAggregate, { status: 'insufficient_data' }> {
  expect(agg.status).toBe('insufficient_data');
}

describe('aggregation math — full week, single provider', () => {
  const result = buildWeeklyHealthAggregates({
    records: FULL_WEEK_SLEEP_RECORDS,
    activeDirectProviders: new Set<HealthProviderId>(['oura']),
    days: DAYS,
    timezoneOffsetMin: UTC_OFFSET_MIN,
    nowMs: FIXED_NOW,
  });

  it('computes mean/min/max over all 7 nights', () => {
    expectOk(result.sleepDuration);
    expect(result.sleepDuration.mean).toBeCloseTo(7.2, 6);
    expect(result.sleepDuration.min).toBe(6.5);
    expect(result.sleepDuration.max).toBe(8.0);
    expect(result.sleepDuration.daysCovered).toBe(7);
    expect(result.sleepDuration.coverage).toEqual({ covered: 7, total: 7, missingDays: [] });
  });

  it('attributes the single contributing source with a full day count', () => {
    expectOk(result.sleepDuration);
    expect(result.sleepDuration.sources).toEqual([{ source: 'oura', aggregator: undefined, daysCount: 7 }]);
  });

  it('reports the most recent covered day\'s freshness (today, zero age ⇒ fresh)', () => {
    expectOk(result.sleepDuration);
    expect(result.sleepDuration.freshness).toBe('fresh');
  });
});

describe('missing days — partial week above the coverage threshold', () => {
  const result = buildWeeklyHealthAggregates({
    records: MISSING_DAYS_SLEEP_RECORDS,
    activeDirectProviders: new Set<HealthProviderId>(['whoop']),
    days: DAYS,
    timezoneOffsetMin: UTC_OFFSET_MIN,
    nowMs: FIXED_NOW,
  });

  it('reports exactly the missing day indexes, still "ok" at 4-of-7', () => {
    expectOk(result.sleepDuration);
    expect(result.sleepDuration.coverage).toEqual({ covered: 4, total: 7, missingDays: [1, 3, 5] });
    expect(result.sleepDuration.mean).toBeCloseTo(7.3, 6);
    expect(result.sleepDuration.min).toBe(7.0);
    expect(result.sleepDuration.max).toBeCloseTo(7.6, 6);
  });
});

describe('insufficient data — below the default 3-of-7 coverage threshold', () => {
  const result = buildWeeklyHealthAggregates({
    records: INSUFFICIENT_DATA_SLEEP_RECORDS,
    activeDirectProviders: new Set<HealthProviderId>(['oura']),
    days: DAYS,
    timezoneOffsetMin: UTC_OFFSET_MIN,
    nowMs: FIXED_NOW,
  });

  it('is a DISTINCT status from a real-but-low aggregate — no mean/min/max leak through', () => {
    expectInsufficient(result.sleepDuration);
    expect(result.sleepDuration.daysCovered).toBe(2);
    expect(result.sleepDuration.coverage).toEqual({ covered: 2, total: 7, missingDays: [0, 1, 2, 3, 4] });
    expect('mean' in result.sleepDuration).toBe(false);
  });

  it('respects a custom minCoverageDays', () => {
    const lenient = buildWeeklyHealthAggregates({
      records: INSUFFICIENT_DATA_SLEEP_RECORDS,
      activeDirectProviders: new Set<HealthProviderId>(['oura']),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
      minCoverageDays: 2,
    });
    expectOk(lenient.sleepDuration);
    expect(lenient.sleepDuration.daysCovered).toBe(2);
  });

  it('a genuinely LOW but fully-covered week is "ok", never recoded as insufficient', () => {
    const lowButCovered = buildWeeklyHealthAggregates({
      records: FULL_WEEK_SLEEP_RECORDS.map((r) => ({
        ...r,
        value: { totalSleepHours: 3.5, inBedHours: null, stages: null },
      })),
      activeDirectProviders: new Set<HealthProviderId>(['oura']),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });
    expectOk(lowButCovered.sleepDuration);
    expect(lowButCovered.sleepDuration.mean).toBeCloseTo(3.5, 6);
    expect(lowButCovered.sleepDuration.daysCovered).toBe(7);
  });
});

describe('duplicated-source week — Oura direct + Oura-via-Apple, same nights', () => {
  const result = buildWeeklyHealthAggregates({
    records: DUPLICATED_SOURCE_WEEK_RECORDS,
    activeDirectProviders: DUPLICATED_SOURCE_ACTIVE_DIRECT_PROVIDERS,
    days: DAYS,
    timezoneOffsetMin: UTC_OFFSET_MIN,
    nowMs: FIXED_NOW,
  });

  it('counts each night ONCE — coverage is 3, not 6', () => {
    expectOk(result.restingHeartRate);
    expect(result.restingHeartRate.coverage).toEqual({ covered: 3, total: 7, missingDays: [3, 4, 5, 6] });
  });

  it('the mean reflects only the direct values — the aggregator copy never enters the average', () => {
    expectOk(result.restingHeartRate);
    const expectedMean =
      DUPLICATED_SOURCE_RHR_DIRECT_VALUES.reduce((a, b) => a + b, 0) / DUPLICATED_SOURCE_RHR_DIRECT_VALUES.length;
    expect(result.restingHeartRate.mean).toBeCloseTo(expectedMean, 6);
    expect(result.restingHeartRate.min).toBe(Math.min(...DUPLICATED_SOURCE_RHR_DIRECT_VALUES));
    expect(result.restingHeartRate.max).toBe(Math.max(...DUPLICATED_SOURCE_RHR_DIRECT_VALUES));
  });

  it('attributes all 3 nights to Oura direct — the Apple copy leaves no attribution trace', () => {
    expectOk(result.restingHeartRate);
    expect(result.restingHeartRate.sources).toEqual([{ source: 'oura', aggregator: undefined, daysCount: 3 }]);
  });
});

describe('HRV method-conflict week — dominant method wins, minority excluded (never blended)', () => {
  const result = buildWeeklyHealthAggregates({
    records: HRV_METHOD_CONFLICT_WEEK_RECORDS,
    activeDirectProviders: new Set<HealthProviderId>(['garmin']),
    days: DAYS,
    timezoneOffsetMin: UTC_OFFSET_MIN,
    nowMs: FIXED_NOW,
  });

  function expectHrvOk(
    agg: WeeklyHrvMetricAggregate,
  ): asserts agg is Extract<WeeklyHrvMetricAggregate, { status: 'ok' }> {
    expect(agg.status).toBe('ok');
  }

  it('picks sdnn as dominant (5 days vs 2) and flags the conflict', () => {
    expectHrvOk(result.hrv);
    expect(result.hrv.hrvMethod).toBe('sdnn');
    expect(result.hrv.methodConflict).toBe(true);
    expect(result.hrv.excludedMethodConflictDays).toBe(2);
    expect(result.hrv.excludedMethodConflictDayIndexes).toEqual([5, 6]);
  });

  it('aggregates ONLY the dominant-method days — rmssd values never enter mean/min/max', () => {
    expectHrvOk(result.hrv);
    const expectedMean = HRV_SDNN_VALUES.reduce((a, b) => a + b, 0) / HRV_SDNN_VALUES.length;
    expect(result.hrv.mean).toBeCloseTo(expectedMean, 6);
    expect(result.hrv.min).toBe(Math.min(...HRV_SDNN_VALUES));
    expect(result.hrv.max).toBe(Math.max(...HRV_SDNN_VALUES));
    expect(result.hrv.daysCovered).toBe(5);
    // No day is truly "missing" — every day had a reading, just 2 used the excluded method.
    expect(result.hrv.coverage).toEqual({ covered: 5, total: 7, missingDays: [] });
  });

  it('a single-method week reports no conflict at all', () => {
    const singleMethod = buildWeeklyHealthAggregates({
      records: HRV_METHOD_CONFLICT_WEEK_RECORDS.filter((r) => r.hrvMethod === 'sdnn'),
      activeDirectProviders: new Set<HealthProviderId>(),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });
    expectHrvOk(singleMethod.hrv);
    expect(singleMethod.hrv.methodConflict).toBe(false);
    expect(singleMethod.hrv.excludedMethodConflictDays).toBe(0);
  });
});

describe('timezone — local-day bucketing under a non-zero offset', () => {
  it('a reading just before local midnight buckets into TODAY\'s local day, not the UTC calendar date it prints', () => {
    const result = buildWeeklyHealthAggregates({
      records: [...TIMEZONE_WEEK_MIDDAY_RECORDS, TIMEZONE_WEEK_LATE_LOCAL_NIGHT_RECORD],
      activeDirectProviders: new Set<HealthProviderId>(),
      days: DAYS,
      timezoneOffsetMin: PDT_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });
    expectOk(result.restingHeartRate);
    expect(result.restingHeartRate.coverage).toEqual({ covered: 7, total: 7, missingDays: [] });
    const allValues = [...TIMEZONE_WEEK_MIDDAY_RHR_VALUES, 55];
    const expectedMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    expect(result.restingHeartRate.mean).toBeCloseTo(expectedMean, 6);
  });

  it('the default boundary constructor matches the one used to build the fixture', () => {
    const boundaries = defaultDayBoundariesMs(DAYS, PDT_OFFSET_MIN, FIXED_NOW);
    expect(boundaries).toEqual(TIMEZONE_WEEK_BOUNDARIES);
    expect(boundaries).toHaveLength(DAYS + 1);
  });
});

describe('DST week — a non-uniform (23h) day mid-week, no double-count or gap', () => {
  const result = buildWeeklyHealthAggregates({
    records: [...DST_WEEK_STEPS_RECORDS, DST_WEEK_BOUNDARY_EDGE_RECORD],
    activeDirectProviders: new Set<HealthProviderId>(),
    days: DAYS,
    timezoneOffsetMin: 0, // ignored — dayBoundariesMs below is authoritative
    dayBoundariesMs: DST_WEEK_BOUNDARIES,
    nowMs: FIXED_NOW,
  });

  it('every day is covered — the shortened day is not silently dropped', () => {
    expectOk(result.steps);
    expect(result.steps.coverage).toEqual({ covered: 7, total: 7, missingDays: [] });
  });

  it('the boundary-edge record lands in exactly one day (day 4), never day 3 and never both', () => {
    expectOk(result.steps);
    // If the edge record (9999) leaked into BOTH days, the mean would be
    // (…+9999) too large; if it fell into NEITHER day, too small. Either
    // failure mode shows up here.
    const perDayBase = [1000, 2000, 3000, 4000, 5000, 6000, 7000];
    const expectedSum = perDayBase.reduce((a, b) => a + b, 0) + 9999; // counted exactly once, folded into day 4
    expect(result.steps.mean).toBeCloseTo(expectedSum / 7, 6);
    expect(result.steps.min).toBe(1000);
    expect(result.steps.max).toBe(5000 + 9999);
  });

  it('rejects a malformed boundary array and falls back to the default constructor', () => {
    const fallback = buildWeeklyHealthAggregates({
      records: DST_WEEK_STEPS_RECORDS,
      activeDirectProviders: new Set<HealthProviderId>(),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      dayBoundariesMs: [1, 2, 3], // wrong length — must not be trusted
      nowMs: FIXED_NOW,
    });
    expect(fallback.dayBoundariesMs).toEqual(defaultDayBoundariesMs(DAYS, UTC_OFFSET_MIN, FIXED_NOW));
  });
});

describe('provider scores — attributed per (provider, kind), never blended', () => {
  const result = buildWeeklyHealthAggregates({
    records: PROVIDER_SCORE_WEEK_RECORDS,
    activeDirectProviders: new Set<HealthProviderId>(['whoop']),
    days: DAYS,
    timezoneOffsetMin: UTC_OFFSET_MIN,
    nowMs: FIXED_NOW,
  });

  it('aggregates the one attributed group across its covered days', () => {
    expect(result.providerScores).toHaveLength(1);
    const group = result.providerScores[0];
    expect(group.provider).toBe('whoop');
    expect(group.kind).toBe('whoop_recovery');
    expect(group.status).toBe('ok');
    const values = Object.values(WHOOP_RECOVERY_VALUES_BY_DAY);
    if (group.status === 'ok') {
      expect(group.mean).toBeCloseTo(values.reduce((a, b) => a + b, 0) / values.length, 6);
      expect(group.min).toBe(Math.min(...values));
      expect(group.max).toBe(Math.max(...values));
    }
    expect(group.coverage).toEqual({
      covered: 5,
      total: 7,
      missingDays: [0, 6],
    });
  });

  it('a group below the coverage threshold reports insufficient_data, never a fabricated mean', () => {
    const sparse = buildWeeklyHealthAggregates({
      records: [
        mkRecord({
          provider: 'whoop',
          metricType: 'provider_score',
          scoreKind: 'whoop_strain',
          value: 12,
          observedAtMs: dayMidMs(6),
        }),
      ],
      activeDirectProviders: new Set<HealthProviderId>(['whoop']),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });
    expect(sparse.providerScores).toHaveLength(1);
    expect(sparse.providerScores[0].status).toBe('insufficient_data');
    expect(sparse.providerScores[0].daysCovered).toBe(1);
  });
});

describe('per-day override precedence — dailySignals wins over the records plane', () => {
  it('an explicit override for a day replaces whatever that day\'s records bucket would have produced', () => {
    const day6ConflictingRecord = mkRecord({
      provider: 'apple_health',
      metricType: 'resting_heart_rate',
      value: 999,
      observedAtMs: dayMidMs(6),
    });
    const records = [0, 1, 2].map((dayIndex) =>
      mkRecord({
        provider: 'apple_health',
        metricType: 'resting_heart_rate',
        value: 50 + dayIndex * 2,
        observedAtMs: dayMidMs(dayIndex),
      }),
    );

    const result = buildWeeklyHealthAggregates({
      records: [...records, day6ConflictingRecord],
      activeDirectProviders: new Set<HealthProviderId>(),
      dailySignals: [
        {
          dayIndex: 6,
          input: {
            biometrics: {
              apple_health: { providerId: 'apple_health', fetchedAt: FIXED_NOW, restingHeartRate: 100 },
            },
            records: undefined,
            activeDirectProviders: new Set<HealthProviderId>(),
            connections: undefined,
            nowMs: FIXED_NOW,
          },
        },
      ],
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });

    expectOk(result.restingHeartRate);
    expect(result.restingHeartRate.coverage.covered).toBe(4);
    expect(result.restingHeartRate.max).toBe(100); // the override's value — not the conflicting 999
    expect(result.restingHeartRate.min).toBe(50);
    expect(result.restingHeartRate.mean).toBeCloseTo((50 + 52 + 54 + 100) / 4, 6);
  });
});

describe('Score-Protection', () => {
  it('never imports the off-limits scoring modules', () => {
    const src = readFileSync(join(__dirname, '..', 'weeklyHealthAggregates.ts'), 'utf8');
    // Scoped to actual import/require statements — the file header's PROSE
    // names both modules to document that it does NOT touch them, which
    // would otherwise false-positive a naive whole-file scan.
    expect(src).not.toMatch(/from\s+['"][^'"]*scoringEngine/);
    expect(src).not.toMatch(/from\s+['"][^'"]*statusColor/);
    expect(src).not.toMatch(/require\(['"][^'"]*scoringEngine/);
    expect(src).not.toMatch(/require\(['"][^'"]*statusColor/);
  });

  it('the output carries no generic "score" field — only provider-attributed entries', () => {
    const result = buildWeeklyHealthAggregates({
      records: PROVIDER_SCORE_WEEK_RECORDS,
      activeDirectProviders: new Set<HealthProviderId>(['whoop']),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });
    expect(Object.keys(result)).not.toContain('score');
    for (const group of result.providerScores) {
      expect(group).toHaveProperty('provider');
      expect(group).toHaveProperty('kind');
    }
  });
});

describe('sanity — deterministic across input order', () => {
  it('shuffled record order produces an identical aggregate', () => {
    const forward = buildWeeklyHealthAggregates({
      records: FULL_WEEK_SLEEP_RECORDS,
      activeDirectProviders: new Set<HealthProviderId>(['oura']),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });
    const reversed = buildWeeklyHealthAggregates({
      records: [...FULL_WEEK_SLEEP_RECORDS].reverse(),
      activeDirectProviders: new Set<HealthProviderId>(['oura']),
      days: DAYS,
      timezoneOffsetMin: UTC_OFFSET_MIN,
      nowMs: FIXED_NOW,
    });
    expect(forward.sleepDuration).toEqual(reversed.sleepDuration);
  });
});
