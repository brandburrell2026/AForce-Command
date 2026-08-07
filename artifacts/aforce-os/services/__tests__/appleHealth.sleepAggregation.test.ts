/**
 * RC-2 Ruling A (2026-08-06) device-validation fix — Apple Health sleep
 * cross-source double-count.
 *
 * Device evidence (build 48): the Home score reported
 * 13.332682222222223h of sleep from 49 samples for a real ~7.5h night.
 * 13.33 / 2 ≈ 6.67h — textbook Apple Watch "time asleep" for that night.
 * The OLD method flat-summed every "asleep" sample (value 1, 3, 4, or 5)
 * across every source with no dedup: when an Apple Watch writes per-stage
 * samples (3/4/5) for a night AND the paired iPhone independently writes an
 * `asleepUnspecified` (1) layer for the SAME night, the flat sum doubled
 * the real total.
 *
 * `selectSleepIntervals` + `reduceSleepByIntervalUnion` (services/appleHealth.ts)
 * fix this the same way `reduceStepsByBucketMax` fixed the analogous steps
 * bug: pure functions, no HealthKit/React Native dependency, proven here
 * with multi-source fixtures — matching this repo's convention of testing
 * HealthKit-adjacent pure logic without mocking the native module.
 */
import { describe, it, expect } from 'vitest';

import { reduceSleepByIntervalUnion, selectSleepIntervals, type SleepInterval } from '../appleHealth';

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('reduceSleepByIntervalUnion — the device scenario (Ruling A)', () => {
  it('Watch stages + iPhone unspecified fully overlapping the same night collapse to the stage total (~6.7h), NOT the flat-summed ~13.3h', () => {
    // Watch: 8 contiguous 50-minute stage segments, 23:00 -> 05:40 = 400min = 6.6667h.
    const watchStages: SleepInterval[] = Array.from({ length: 8 }, (_, i) => {
      const start = Date.UTC(2026, 7, 5, 23, 0, 0) + i * 50 * MIN;
      return {
        startMs: start,
        endMs: start + 50 * MIN,
        value: (3 + (i % 3)) as 3 | 4 | 5, // rotates core/deep/rem — all stage values
        sourceName: "Brandon's Apple Watch",
      };
    });
    // iPhone: one unspecified block covering nearly the same window, 23:00 -> 05:36 = 396min = 6.6h.
    const iPhoneUnspecified: SleepInterval = {
      startMs: Date.UTC(2026, 7, 5, 23, 0, 0),
      endMs: Date.UTC(2026, 7, 5, 23, 0, 0) + 396 * MIN,
      value: 1,
      sourceName: 'iPhone',
    };

    const intervals = [...watchStages, iPhoneUnspecified];
    const totalMs = reduceSleepByIntervalUnion(intervals);
    const totalHours = totalMs / HOUR;

    // Old (buggy) flat sum would be 400min (stages) + 396min (unspecified) =
    // 796min = 13.27h — essentially the device's 13.33h evidence. The fix
    // must land near the stage total (400min = 6.6667h), not anywhere near
    // double that.
    expect(totalHours).toBeCloseTo(400 / 60, 2);
    expect(totalHours).toBeLessThan(7);
    expect(totalHours * 2).toBeGreaterThan(13); // sanity: confirms this really is ~half the old bug's total
  });
});

describe('selectSleepIntervals — stage preference', () => {
  it('stages present → value-1 samples are excluded entirely from the selection', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: HOUR, endMs: 2 * HOUR, value: 3, sourceName: "Brandon's Apple Watch" },
      { startMs: 0, endMs: 2 * HOUR, value: 1, sourceName: 'iPhone' }, // the overlapping double-count layer
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages');
    expect(selected).toHaveLength(2);
    expect(selected.every((i) => i.value === 3 || i.value === 4 || i.value === 5)).toBe(true);
  });

  it('a single stage sample is enough to exclude ALL value-1 samples, even many of them', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 5, sourceName: "Brandon's Apple Watch" },
      { startMs: 0, endMs: 30 * MIN, value: 1, sourceName: 'iPhone' },
      { startMs: 30 * MIN, endMs: HOUR, value: 1, sourceName: 'iPhone' },
      { startMs: HOUR, endMs: 90 * MIN, value: 1, sourceName: 'iPhone' },
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages');
    expect(selected).toHaveLength(1);
  });
});

describe('selectSleepIntervals — unspecified fallback', () => {
  it('no stage samples exist → falls back to the union of value-1 samples', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 1, sourceName: 'iPhone' },
      { startMs: HOUR, endMs: 2 * HOUR, value: 1, sourceName: 'iPhone' },
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('unspecified');
    expect(selected).toHaveLength(2);
    expect(reduceSleepByIntervalUnion(intervals)).toBe(2 * HOUR);
  });

  it('neither stage nor unspecified samples exist → branch is "none", selection is empty', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 0, sourceName: 'iPhone' }, // inBed only
      { startMs: HOUR, endMs: HOUR + 10 * MIN, value: 2, sourceName: 'iPhone' }, // awake only
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('none');
    expect(selected).toEqual([]);
    expect(reduceSleepByIntervalUnion(intervals)).toBe(0);
  });

  it('empty input yields branch "none" and zero total, never throws', () => {
    expect(selectSleepIntervals([])).toEqual({ branch: 'none', selected: [] });
    expect(reduceSleepByIntervalUnion([])).toBe(0);
  });
});

describe('reduceSleepByIntervalUnion — same-source overlap', () => {
  it('two overlapping stage samples from the SAME source are counted once, not twice', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: 30 * MIN, endMs: 90 * MIN, value: 4, sourceName: "Brandon's Apple Watch" },
    ];
    // Union: 0 -> 90min = 1.5h. Naive sum would be 1h + 1h = 2h.
    expect(reduceSleepByIntervalUnion(intervals)).toBe(90 * MIN);
  });

  it('three overlapping same-source samples still merge to one run', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: 40 * MIN, value: 3, sourceName: 'iPhone' },
      { startMs: 20 * MIN, endMs: 60 * MIN, value: 1, sourceName: 'iPhone' },
      { startMs: 50 * MIN, endMs: 80 * MIN, value: 3, sourceName: 'iPhone' },
    ];
    // Stages exist (0-40 and 50-80), so the value-1 sample (20-60) is
    // excluded by selection before union even runs. Selected: [0,40] and
    // [50,80] — disjoint (10min gap, 40 -> 50) — NOT merged.
    expect(reduceSleepByIntervalUnion(intervals)).toBe(40 * MIN + 30 * MIN);
  });
});

describe('reduceSleepByIntervalUnion — adjacent vs. gap handling', () => {
  it('exactly-adjacent (touching) intervals merge without double-counting the boundary instant', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: HOUR, endMs: 2 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" }, // starts exactly where the previous ends
    ];
    expect(reduceSleepByIntervalUnion(intervals)).toBe(2 * HOUR);
  });

  it('a genuine gap (an awake period) between two stage runs is NOT bridged — the gap itself is never counted as asleep', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      // 30-minute gap here (an awake(2) sample would sit here on a real
      // device, but even without one explicitly present, the union must
      // not silently bridge it).
      { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" },
    ];
    const totalMs = reduceSleepByIntervalUnion(intervals);
    // Correct: sum of the two real segments = 60min + 60min = 120min.
    expect(totalMs).toBe(120 * MIN);
    // Guards against a "naive span" bug (min(start) -> max(end) = 150min),
    // which would silently count the 30-minute gap as asleep time.
    expect(totalMs).not.toBe(150 * MIN);
  });

  it('an explicit awake(2) sample sitting in the gap does not extend the asleep total either — it is excluded from selection', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: HOUR, endMs: 90 * MIN, value: 2, sourceName: "Brandon's Apple Watch" }, // awake
      { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" },
    ];
    expect(reduceSleepByIntervalUnion(intervals)).toBe(120 * MIN);
  });
});

describe('reduceSleepByIntervalUnion — inBed(0)/awake(2) exclusion', () => {
  it('inBed and awake samples never contribute to the total even when they overlap real sleep', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: 8 * HOUR, value: 0, sourceName: 'iPhone' }, // inBed spans the whole night
      { startMs: HOUR, endMs: 2 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
    ];
    // Only the 1-hour stage sample counts; the 8-hour inBed span is inert.
    expect(reduceSleepByIntervalUnion(intervals)).toBe(HOUR);
  });

  it('inBed(0) alongside unspecified(1), with no stage samples, still falls back correctly and ignores inBed', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: 8 * HOUR, value: 0, sourceName: 'iPhone' },
      { startMs: HOUR, endMs: 7 * HOUR, value: 1, sourceName: 'iPhone' },
    ];
    const { branch } = selectSleepIntervals(intervals);
    expect(branch).toBe('unspecified');
    expect(reduceSleepByIntervalUnion(intervals)).toBe(6 * HOUR);
  });
});
