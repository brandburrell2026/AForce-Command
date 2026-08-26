import { describe, it, expect } from 'vitest';

import {
  isSamsungHealthSupported,
  fetchSamsungHealthSnapshot,
  reduceSleepSegmentsToHours,
  toProviderSnapshot,
} from '../samsungHealth';

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

const AWAKE = 40001;
const LIGHT = 40002;
const DEEP = 40003;
const REM = 40004;

const seg = (startMs: number, endMs: number, stage: number) => ({
  start: startMs,
  end: endMs,
  stage,
});

describe('samsungHealth', () => {
  it('isSamsungHealthSupported is false on non-Android', () => {
    expect(isSamsungHealthSupported()).toBe(false);
  });

  it('fetchSamsungHealthSnapshot returns the all-null snapshot when SDK unavailable', async () => {
    const snap = await fetchSamsungHealthSnapshot();
    expect(snap).toEqual({
      restingHeartRate: null,
      stepsToday: null,
      workoutMinutesToday: null,
      sleepHoursLastNight: null,
    });
  });

  it('reduceSleepSegmentsToHours returns real hours for a normal night', () => {
    // 23:00 -> 06:30 with a 30-minute awake block mid-night: 7h of asleep
    // stages actually measured, and the awake block never counted.
    const base = Date.UTC(2026, 7, 11, 23, 0, 0);
    const hours = reduceSleepSegmentsToHours([
      seg(base, base + 90 * MIN, LIGHT),
      seg(base + 90 * MIN, base + 150 * MIN, DEEP),
      seg(base + 150 * MIN, base + 180 * MIN, AWAKE),
      seg(base + 180 * MIN, base + 300 * MIN, REM),
      seg(base + 300 * MIN, base + 450 * MIN, LIGHT),
    ]);
    expect(hours).toBeCloseTo(7, 6);
  });

  it('reduceSleepSegmentsToHours returns null for an EMPTY segment array — no sample is not a measured zero (Wave-4 Part 12)', () => {
    // An empty array means the window held no sleep samples at all. This
    // used to fall through the reduce as ms=0 and report a confident 0h,
    // which `utils/scoring/breakdown.ts` scores as the maximal sleep
    // deficit; null contributes nothing instead.
    expect(reduceSleepSegmentsToHours([])).toBeNull();
  });

  it('reduceSleepSegmentsToHours returns null when EVERY segment is awake — the SDK classified nothing as asleep', () => {
    const base = Date.UTC(2026, 7, 11, 23, 0, 0);
    expect(
      reduceSleepSegmentsToHours([
        seg(base, base + 2 * HOUR, AWAKE),
        seg(base + 2 * HOUR, base + 5 * HOUR, AWAKE),
      ]),
    ).toBeNull();
  });

  it('reduceSleepSegmentsToHours returns null when malformed spans are the only asleep evidence', () => {
    // `Math.max(0, end - start)` clamps a zero-length and an inverted
    // segment away — corrupt input, not a night with no sleep in it.
    const base = Date.UTC(2026, 7, 11, 23, 0, 0);
    expect(
      reduceSleepSegmentsToHours([
        seg(base, base, DEEP),
        seg(base + 3 * HOUR, base + HOUR, REM),
      ]),
    ).toBeNull();
  });

  it('reduceSleepSegmentsToHours still returns null for a non-array response (the original guard is preserved)', () => {
    expect(reduceSleepSegmentsToHours(null)).toBeNull();
    expect(reduceSleepSegmentsToHours(undefined)).toBeNull();
    expect(reduceSleepSegmentsToHours({ error: 'permission_denied' })).toBeNull();
  });

  it('reduceSleepSegmentsToHours counts a single genuine asleep segment among awake ones', () => {
    // Proves the null exits above are about the ABSENCE of asleep
    // evidence, not a blanket refusal to report short nights: 45 minutes
    // is still a measurement and still reported.
    const base = Date.UTC(2026, 7, 11, 23, 0, 0);
    const hours = reduceSleepSegmentsToHours([
      seg(base, base + 30 * MIN, AWAKE),
      seg(base + 30 * MIN, base + 75 * MIN, LIGHT),
      seg(base + 75 * MIN, base + 2 * HOUR, AWAKE),
    ]);
    expect(hours).toBeCloseTo(0.75, 6);
  });

  it('toProviderSnapshot tags with the samsung_health provider id', () => {
    const lifted = toProviderSnapshot(
      { restingHeartRate: 58, stepsToday: 8200, workoutMinutesToday: 45, sleepHoursLastNight: 7.6 },
      1700000000000,
    );
    expect(lifted).toEqual({
      providerId: 'samsung_health',
      restingHeartRate: 58,
      stepsToday: 8200,
      workoutMinutesToday: 45,
      sleepHoursLastNight: 7.6,
      fetchedAt: 1700000000000,
    });
  });
});
