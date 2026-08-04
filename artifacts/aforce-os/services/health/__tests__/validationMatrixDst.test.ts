/**
 * VALIDATION MATRIX — spring-forward DST through the real pipeline, and a
 * timezone-change bucketing-shift check (Squad-E gap-closure, priority 2).
 *
 * `NY_SPRING_FORWARD_WEEK_BOUNDARIES` (`../validationMatrixFixtures.ts`) was,
 * before this file, proven correct ONLY in isolation — the "ground truth"
 * describe block in `../__tests__/validationMatrix.test.ts` checks the
 * boundary MATH (23h day, strictly increasing, matches Intl) but never once
 * hands those boundaries to `buildWeeklyHealthAggregates`. This file is that
 * missing feed: a real week of records run through the real aggregator,
 * asserting exactly 7 buckets, no vanished day, and no double-counted day
 * across the actual 23h spring-forward transition (Mar 8 → Mar 9, 2026,
 * America/New_York).
 *
 * Also closes the "timezone-change" cheap item from the same gap report:
 * the SAME record set fed through `buildWeeklyHealthAggregates` under two
 * different `timezoneOffsetMin` values must shift which day bucket a
 * boundary-adjacent record lands in — never lose it, never double-count it.
 *
 * READ-ONLY discipline: `buildWeeklyHealthAggregates`, `resolveHealthSignals`,
 * and `defaultDayBoundariesMs` are imported and exercised — never modified.
 */
import { describe, it, expect } from 'vitest';
import { resolveHealthSignals } from '../signalResolution';
import { buildWeeklyHealthAggregates, defaultDayBoundariesMs } from '../weeklyHealthAggregates';
import { mkRecord } from '../weeklyHealthAggregatesFixtures';
import {
  NY_SPRING_FORWARD_WEEK_BOUNDARIES,
  SPRING_FORWARD_WEEK_RECORDS,
  SPRING_FORWARD_ACTIVE_DIRECT,
  SPRING_FORWARD_WEEK_NOW_MS,
  SPRING_FORWARD_STEPS_VALUES,
  FIXED_NOW,
} from '../validationMatrixFixtures';

describe('spring-forward DST (real 23h day, Mar 8 2026) fed through buildWeeklyHealthAggregates', () => {
  const weekly = buildWeeklyHealthAggregates({
    records: SPRING_FORWARD_WEEK_RECORDS,
    activeDirectProviders: SPRING_FORWARD_ACTIVE_DIRECT,
    days: 7,
    timezoneOffsetMin: 0, // ignored — dayBoundariesMs takes precedence
    dayBoundariesMs: [...NY_SPRING_FORWARD_WEEK_BOUNDARIES],
    nowMs: SPRING_FORWARD_WEEK_NOW_MS,
  });

  it('produces exactly 7 buckets using the real spring-forward boundaries, with no vanished day', () => {
    expect(weekly.dayBoundariesMs).toEqual(NY_SPRING_FORWARD_WEEK_BOUNDARIES);
    expect(weekly.windowDays).toBe(7);
    expect(weekly.steps.status).toBe('ok');
    if (weekly.steps.status === 'ok') {
      expect(weekly.steps.daysCovered).toBe(7);
      expect(weekly.steps.coverage.missingDays).toEqual([]); // every one of the 7 days — including the 23h day — has its own reading
    }
  });

  it('the boundary-edge record (placed exactly at the real day3→day4 instant) lands in day 4 only — summed honestly with day 4\'s own reading, never counted in day 3, never in both', () => {
    if (weekly.steps.status !== 'ok') throw new Error('expected ok');
    // Day 4's total is its own 4400 PLUS the edge record's 999 — same origin
    // (apple_health), so within-origin summation is honest, mirroring the
    // fall-back week's day4 pattern in ../__tests__/validationMatrix.test.ts.
    expect(weekly.steps.max).toBe(4400 + 999);
    const expectedMean =
      (SPRING_FORWARD_STEPS_VALUES[0] +
        SPRING_FORWARD_STEPS_VALUES[1] +
        SPRING_FORWARD_STEPS_VALUES[2] +
        SPRING_FORWARD_STEPS_VALUES[3] +
        (SPRING_FORWARD_STEPS_VALUES[4] + 999) +
        SPRING_FORWARD_STEPS_VALUES[5] +
        SPRING_FORWARD_STEPS_VALUES[6]) /
      7;
    expect(weekly.steps.mean).toBeCloseTo(expectedMean, 6);
  });

  it('day 3 (the real 23h spring-forward day) honestly carries ONLY its own reading — the edge record did not leak backward into it', () => {
    const day3Records = SPRING_FORWARD_WEEK_RECORDS.filter(
      (r) =>
        Date.parse(r.observedAt) >= NY_SPRING_FORWARD_WEEK_BOUNDARIES[3] &&
        Date.parse(r.observedAt) < NY_SPRING_FORWARD_WEEK_BOUNDARIES[4] &&
        r.metricType === 'steps',
    );
    expect(day3Records).toHaveLength(1);
    const signals = resolveHealthSignals({
      biometrics: undefined,
      records: day3Records,
      activeDirectProviders: SPRING_FORWARD_ACTIVE_DIRECT,
      nowMs: NY_SPRING_FORWARD_WEEK_BOUNDARIES[4],
    });
    expect(signals.steps.available).toBe(true);
    if (signals.steps.available) expect(signals.steps.value).toBe(SPRING_FORWARD_STEPS_VALUES[3]); // 4300 — never 4300+999
  });

  it('every day is attributed to the single source that supplied it — no phantom second source introduced by the 23h day', () => {
    if (weekly.steps.status !== 'ok') throw new Error('expected ok');
    expect(weekly.steps.sources).toEqual([{ source: 'apple_health', aggregator: undefined, daysCount: 7 }]);
  });
});

describe('timezone-change — the SAME records under two different day-boundary sets shift bucketing correctly (no loss, no double-count)', () => {
  const boundariesUtc = defaultDayBoundariesMs(7, 0, FIXED_NOW);
  const boundariesEst = defaultDayBoundariesMs(7, -300, FIXED_NOW); // America/New_York standard offset, no DST in this constant-offset helper

  it('the two boundary sets genuinely differ (sanity — otherwise this test would prove nothing)', () => {
    expect(boundariesEst).not.toEqual(boundariesUtc);
    for (let i = 0; i < boundariesUtc.length; i++) {
      expect(boundariesEst[i] - boundariesUtc[i]).toBe(5 * 60 * 60_000); // EST boundaries land 5h later in UTC terms
    }
  });

  // Placed EXACTLY at the UTC-offset boundary for day index 4 — this instant
  // is >= boundariesUtc[4] (so it's day 4 under UTC) but < boundariesEst[4]
  // (which is 5h later), so it's still day 3 under the EST offset.
  const record = mkRecord({
    provider: 'apple_health',
    metricType: 'steps',
    value: 7777,
    observedAtMs: boundariesUtc[4],
    externalId: 'tz-change-edge',
  });

  it('under UTC (offset 0), the record lands in day 4', () => {
    const weekly = buildWeeklyHealthAggregates({
      records: [record],
      activeDirectProviders: new Set(),
      days: 7,
      timezoneOffsetMin: 0,
      nowMs: FIXED_NOW,
    });
    expect(weekly.dayBoundariesMs).toEqual(boundariesUtc);
    expect(weekly.steps.status).toBe('insufficient_data');
    if (weekly.steps.status === 'insufficient_data') {
      expect(weekly.steps.daysCovered).toBe(1);
      expect(weekly.steps.coverage.missingDays).not.toContain(4);
      expect(weekly.steps.coverage.missingDays).toContain(3);
    }
  });

  it('under EST (offset -300), the SAME instant lands in day 3 instead — shifted, never lost, never double-counted', () => {
    const weekly = buildWeeklyHealthAggregates({
      records: [record],
      activeDirectProviders: new Set(),
      days: 7,
      timezoneOffsetMin: -300,
      nowMs: FIXED_NOW,
    });
    expect(weekly.dayBoundariesMs).toEqual(boundariesEst);
    expect(weekly.steps.status).toBe('insufficient_data');
    if (weekly.steps.status === 'insufficient_data') {
      expect(weekly.steps.daysCovered).toBe(1); // still exactly one covered day — never zero (lost), never two (double-counted)
      expect(weekly.steps.coverage.missingDays).not.toContain(3);
      expect(weekly.steps.coverage.missingDays).toContain(4);
    }
  });
});
