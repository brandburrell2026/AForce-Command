/**
 * RC-2 P0 device-validation fix — steps double-count.
 *
 * `reduceStepsByBucketMax` (services/appleHealth.ts) replaces the old
 * raw-sample-sum step count, which double-counted whenever an iPhone AND a
 * paired Apple Watch both recorded steps for the same activity (the
 * founder's real device: build 47, TestFlight, both devices present). This
 * suite proves the pure reduction with multi-source fixtures — no
 * HealthKit/React Native dependency, matching this repo's convention of
 * testing HealthKit-adjacent pure logic without mocking the native module
 * (see appleHealth.test.ts's own "dormant" header).
 */
import { describe, it, expect } from 'vitest';

import { reduceStepsByBucketMax, lastNonEmptyStepsBucketEndMs, type StepsSourceBucket } from '../appleHealth';

describe('reduceStepsByBucketMax', () => {
  it('does NOT double-count an hour where iPhone + Watch both recorded overlapping steps — takes the max, not the sum', () => {
    const buckets: StepsSourceBucket[] = [
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 400 },
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T09:00:00.000Z', quantity: 420 },
    ];
    // Old (wrong) method would give 820. Correct: max(400, 420) = 420.
    expect(reduceStepsByBucketMax(buckets)).toBe(420);
  });

  it('preserves genuine non-overlapping contributions from each device across different hours', () => {
    const buckets: StepsSourceBucket[] = [
      // Morning: only iPhone was carried (Watch not worn yet).
      { sourceName: 'iPhone', startDate: '2026-08-05T07:00:00.000Z', quantity: 300 },
      // Midday: both overlap — take the max.
      { sourceName: 'iPhone', startDate: '2026-08-05T12:00:00.000Z', quantity: 500 },
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T12:00:00.000Z', quantity: 650 },
      // Evening: only the Watch was worn (phone left at home for a run).
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T18:00:00.000Z', quantity: 1200 },
    ];
    // 300 (iPhone-only) + 650 (max of midday overlap) + 1200 (Watch-only) = 2150.
    // The old raw sum would have given 300 + 500 + 650 + 1200 = 2650.
    expect(reduceStepsByBucketMax(buckets)).toBe(2150);
  });

  it('a single source with no overlap is unaffected (max of one value is that value)', () => {
    const buckets: StepsSourceBucket[] = [
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 400 },
      { sourceName: 'iPhone', startDate: '2026-08-05T10:00:00.000Z', quantity: 350 },
    ];
    expect(reduceStepsByBucketMax(buckets)).toBe(750);
  });

  it('three sources in the same bucket (e.g. iPhone + Watch + a third tracker) still take only the single max', () => {
    const buckets: StepsSourceBucket[] = [
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 200 },
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T09:00:00.000Z', quantity: 450 },
      { sourceName: 'Third Party Tracker', startDate: '2026-08-05T09:00:00.000Z', quantity: 300 },
    ];
    expect(reduceStepsByBucketMax(buckets)).toBe(450);
  });

  it('empty input yields zero, never throws', () => {
    expect(reduceStepsByBucketMax([])).toBe(0);
  });

  it('a bucket with a zero-quantity source alongside a real one still takes the real max', () => {
    const buckets: StepsSourceBucket[] = [
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 0 },
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T09:00:00.000Z', quantity: 180 },
    ];
    expect(reduceStepsByBucketMax(buckets)).toBe(180);
  });
});

/**
 * RC-2 Founder Ruling C (2026-08-06) — `stepsToday`'s chosen observation
 * time: the end of the LATEST hour-bucket that survived the same
 * per-bucket MAX reduction `reduceStepsByBucketMax` performs (quantity >
 * 0). Same fixtures as `reduceStepsByBucketMax` above, reused so both
 * functions are proven against the identical device-shaped data.
 */
describe('lastNonEmptyStepsBucketEndMs', () => {
  it('returns the end (start + 1h) of the single latest non-empty bucket across sources', () => {
    const buckets: StepsSourceBucket[] = [
      // Morning: only iPhone.
      { sourceName: 'iPhone', startDate: '2026-08-05T07:00:00.000Z', quantity: 300 },
      // Midday: both overlap.
      { sourceName: 'iPhone', startDate: '2026-08-05T12:00:00.000Z', quantity: 500 },
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T12:00:00.000Z', quantity: 650 },
      // Evening: only the Watch — this is the LATEST non-empty bucket.
      { sourceName: "Brandon's Apple Watch", startDate: '2026-08-05T18:00:00.000Z', quantity: 1200 },
    ];
    expect(lastNonEmptyStepsBucketEndMs(buckets)).toBe(Date.parse('2026-08-05T19:00:00.000Z'));
  });

  it('a later bucket that reduces to zero (all sources zero-quantity) is NOT treated as the latest non-empty one', () => {
    const buckets: StepsSourceBucket[] = [
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 400 },
      // Later bucket exists but every source in it is zero — must be skipped.
      { sourceName: 'iPhone', startDate: '2026-08-05T20:00:00.000Z', quantity: 0 },
    ];
    expect(lastNonEmptyStepsBucketEndMs(buckets)).toBe(Date.parse('2026-08-05T10:00:00.000Z'));
  });

  it('empty input yields null, never throws', () => {
    expect(lastNonEmptyStepsBucketEndMs([])).toBeNull();
  });

  it('all-zero input yields null (nothing to timestamp)', () => {
    const buckets: StepsSourceBucket[] = [
      { sourceName: 'iPhone', startDate: '2026-08-05T09:00:00.000Z', quantity: 0 },
    ];
    expect(lastNonEmptyStepsBucketEndMs(buckets)).toBeNull();
  });
});
