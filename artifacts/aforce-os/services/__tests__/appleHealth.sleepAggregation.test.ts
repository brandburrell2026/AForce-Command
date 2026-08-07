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
 *
 * RC-2 P0 follow-up (2026-08-06, post-#585 independent verdict) — three
 * changes to this file:
 *   - B1 (BLOCKING): the original stage-preference rule dropped ALL value-1
 *     coverage whenever ANY stage sample existed, even value-1 time entirely
 *     OUTSIDE the stage envelope (e.g. after a watch dies mid-night) — see
 *     the "partial watch coverage" describe block below for the regression
 *     fixture with the reviewer's exact device-scenario numbers.
 *   - S1: the flagship device-scenario fixture below was mutation-proven
 *     vacuous per-mechanism (its 8 watch segments were perfectly contiguous,
 *     so stage-preference and interval-union each individually reverted
 *     without failing it). It now has realistic awake gaps AND a realistic
 *     same-source overlap so each guard is independently load-bearing.
 *   - S3: `reduceSleepByIntervalUnion` no longer re-runs `selectSleepIntervals`
 *     internally (see its header in `services/appleHealth.ts`) — it unions
 *     an already-selected set. Fixtures below that mix classes (stage +
 *     unspecified + inBed/awake) now go through the `selectThenUnion` helper
 *     to exercise the same select-once-then-union pipeline the real
 *     `fetchAppleHealthSnapshot` caller uses.
 */
import { describe, it, expect } from 'vitest';

import {
  reduceSleepByIntervalUnion,
  reduceSleepByIntervalUnionDetailed,
  selectSleepIntervals,
  type SleepInterval,
} from '../appleHealth';

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

/**
 * S3: composes select-then-union exactly the way `fetchAppleHealthSnapshot`
 * does. Most fixtures in this file exercise the full pipeline (they mix
 * stage/unspecified/inBed/awake samples the way a real HealthKit response
 * does), so this avoids repeating that composition at every call site. A few
 * fixtures below pass an already-homogeneous, pre-selected set directly to
 * `reduceSleepByIntervalUnion` instead, to test the union/merge mechanism in
 * isolation — those are commented where they do.
 */
function selectThenUnion(intervals: readonly SleepInterval[]): number {
  return reduceSleepByIntervalUnion(selectSleepIntervals(intervals).selected);
}

describe('reduceSleepByIntervalUnion — the device scenario (Ruling A)', () => {
  it('Watch stages (with realistic awake gaps + one realistic same-source overlap) + iPhone unspecified bridging the whole night collapse to the stage total, NOT the iPhone-bridged total', () => {
    // S1 (RC-2 P0 follow-up): the original version of this fixture was 8
    // PERFECTLY CONTIGUOUS 50-minute segments — no gaps, no overlaps — which
    // made it mutation-blind: reverting stage preference alone still passed
    // (nothing for the iPhone layer to bridge) and reverting interval-union
    // alone still passed (nothing overlapping to double-count). This version
    // has 3 realistic awake gaps (brief night wake-ups the Watch caught but
    // the iPhone's coarser motion classifier did not) and one realistic
    // same-source overlap (a few minutes of HealthKit boundary jitter
    // between two adjacent stage samples) — a shape a real night's data
    // plausibly has. Segment durations still sum to 400min/6.6667h; the
    // union total is 397min/6.6167h once the 3-minute overlap is correctly
    // deduplicated (that 3-minute reduction is itself proof the merge step
    // is doing real work, not just passing data through).
    const seg = (startMin: number, durMin: number, value: 3 | 4 | 5): SleepInterval => {
      const start = Date.UTC(2026, 7, 5, 23, 0, 0) + startMin * MIN;
      return { startMs: start, endMs: start + durMin * MIN, value, sourceName: "Brandon's Apple Watch" };
    };
    const watchStages: SleepInterval[] = [
      seg(0, 50, 4),
      // 15-minute awake gap (65 - 50)
      seg(65, 50, 3),
      // 20-minute awake gap (135 - 115)
      seg(135, 50, 5),
      seg(182, 50, 4), // starts 3min before the previous segment ends (185) — same-source overlap
      // 15-minute awake gap (247 - 232)
      seg(247, 50, 3),
      seg(297, 50, 4), // touches (no gap) — merge must not double-count a mere touch either
      seg(347, 50, 5), // touches
      seg(397, 50, 3), // touches; ends at 447min
    ];
    // iPhone: one coarse unspecified block spanning the ENTIRE envelope
    // (23:00 -> 23:00+447min), including all 3 awake gaps — modeling the
    // realistic case where the iPhone's motion-based detector misses brief
    // night wake-ups a stage-capable Watch caught.
    const envelopeStart = Date.UTC(2026, 7, 5, 23, 0, 0);
    const iPhoneUnspecified: SleepInterval = {
      startMs: envelopeStart,
      endMs: envelopeStart + 447 * MIN,
      value: 1,
      sourceName: 'iPhone',
    };

    const intervals = [...watchStages, iPhoneUnspecified];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages'); // iPhone layer fully inside the stage envelope on both ends — no uncovered tail
    expect(selected).toHaveLength(8);

    const totalMs = reduceSleepByIntervalUnion(selected);
    const totalHours = totalMs / HOUR;

    // Correct: 397min = 6.6167h — the merged stage total (400min of segment
    // duration minus the 3-minute same-source overlap the union correctly
    // dedupes once, not the 400min naive flat sum).
    expect(totalMs).toBe(397 * MIN);
    expect(totalHours).toBeCloseTo(397 / 60, 3);

    // Old (pre-#585) buggy flat sum of EVERY asleep sample, no selection and
    // no merge at all, would be 400min (stages) + 447min (the full iPhone
    // block) = 847min ≈ 14.1h — in the same class as the device's 13.33h
    // evidence, not anywhere near the correct ~6.6h.
    expect(totalHours).toBeLessThan(7);
    expect(totalHours * 2).toBeGreaterThan(13);

    // MUTATION PROOF 1 (stage preference): dropping stage preference (i.e.
    // selecting stage+unspecified together, still unioned/merged correctly)
    // lets the continuous iPhone layer bridge all 3 awake gaps, producing
    // the FULL envelope span (447min = 7.45h) — provably more than the
    // correct 397min, so this mutation now fails the fixture.
    const noPreferenceSelected = intervals.filter(
      (i) => i.value === 1 || i.value === 3 || i.value === 4 || i.value === 5,
    );
    const noPreferenceTotal = reduceSleepByIntervalUnion(noPreferenceSelected);
    expect(noPreferenceTotal).toBe(447 * MIN);
    expect(noPreferenceTotal).not.toBe(totalMs);

    // MUTATION PROOF 2 (interval union): keeping correct stage-only
    // selection but flat-summing instead of merging overlaps double-counts
    // the 3-minute overlap between segments 3 and 4, producing 400min — off
    // by exactly the overlap, so this mutation now fails the fixture too.
    const flatSummed = selected.reduce((sum, i) => sum + (i.endMs - i.startMs), 0);
    expect(flatSummed).toBe(400 * MIN);
    expect(flatSummed).not.toBe(totalMs);
  });
});

describe('selectSleepIntervals — stage preference', () => {
  it('stages present, value-1 fully inside the envelope → value-1 samples are excluded entirely from the selection', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: HOUR, endMs: 2 * HOUR, value: 3, sourceName: "Brandon's Apple Watch" },
      { startMs: 0, endMs: 2 * HOUR, value: 1, sourceName: 'iPhone' }, // the overlapping double-count layer, exactly spanning the envelope
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages');
    expect(selected).toHaveLength(2);
    expect(selected.every((i) => i.value === 3 || i.value === 4 || i.value === 5)).toBe(true);
  });

  it('a stage sample excludes value-1 samples INSIDE its envelope but keeps a genuine uncovered tail OUTSIDE it (B1, RC-2 P0 follow-up)', () => {
    // B1: this test used to assert that a SINGLE stage sample excludes ALL
    // value-1 samples, "even many of them" — including one entirely AFTER
    // the stage sample ends. That codified the undercounting defect: a
    // value-1 sample outside the stage envelope is the only signal of real
    // sleep for that stretch (e.g. the Watch died and the iPhone kept
    // detecting sleep), and dropping it silently reports less sleep than
    // actually happened. This rewrite asserts the corrected behavior: the
    // two value-1 samples fully INSIDE the envelope are still excluded (they
    // are the double-counting iPhone layer for time the Watch already
    // covered), but the value-1 sample starting exactly where the stage
    // sample ends is a genuine uncovered tail and must be kept.
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 5, sourceName: "Brandon's Apple Watch" }, // envelope: [0, HOUR]
      { startMs: 0, endMs: 30 * MIN, value: 1, sourceName: 'iPhone' }, // inside envelope — excluded
      { startMs: 30 * MIN, endMs: HOUR, value: 1, sourceName: 'iPhone' }, // inside envelope — excluded
      { startMs: HOUR, endMs: 90 * MIN, value: 1, sourceName: 'iPhone' }, // AFTER envelope end — genuine uncovered tail, kept
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered');
    expect(selected).toHaveLength(2);
    const tail = selected.find((i) => i.value === 1);
    expect(tail).toBeDefined();
    expect(tail?.startMs).toBe(HOUR); // clipped to the envelope end, not the original 60min start
    expect(tail?.endMs).toBe(90 * MIN);

    // The stage run and the kept tail touch exactly at HOUR, so they merge
    // into one continuous 90-minute total — the two excluded in-envelope
    // value-1 samples never contribute.
    expect(reduceSleepByIntervalUnion(selected)).toBe(90 * MIN);
  });

  it('a value-1 sample entirely BEFORE the stage envelope is also kept, clipped to the envelope start (symmetric case)', () => {
    const intervals: SleepInterval[] = [
      { startMs: -30 * MIN, endMs: 0, value: 1, sourceName: 'iPhone' }, // BEFORE envelope start — genuine uncovered lead-in
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" }, // envelope: [0, HOUR]
      { startMs: 0, endMs: HOUR, value: 1, sourceName: 'iPhone' }, // exactly spans the envelope — excluded
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered');
    expect(selected).toHaveLength(2);
    const lead = selected.find((i) => i.value === 1);
    expect(lead?.startMs).toBe(-30 * MIN);
    expect(lead?.endMs).toBe(0); // clipped to the envelope start
    expect(reduceSleepByIntervalUnion(selected)).toBe(90 * MIN);
  });
});

describe('selectSleepIntervals / reduceSleepByIntervalUnion — partial watch coverage (B1, RC-2 P0 follow-up)', () => {
  it('watch worn 22:10, dies 02:00 (iPhone unspecified covers 22:05-06:00): reports ~7.58h, matching the reviewer-measured fix, NOT the 3.5h the merged #585 code reported', () => {
    // Reviewer-measured scenario (independent verdict, post-#585, BLOCKING):
    // the Watch is worn at 22:10 and dies at 02:00 — its stage samples cover
    // 22:10-00:50 and 01:10-02:00 (210min/3.5h of actual stage-asleep time,
    // with a real 20-minute watch-detected awake gap at 00:50-01:10). The
    // paired iPhone independently detects "asleep unspecified" for the
    // WHOLE night, 22:05-06:00 (it has no idea the Watch died at 02:00).
    // Truth is approximately 7.5h — the number that must match the Health
    // app's own "Time Asleep" figure for that specific night on-device, not
    // a hardcoded target. The #585-merged code, which dropped ALL value-1
    // coverage whenever ANY stage sample existed, reported 3.5h — a 53%
    // undercount, and a WORSE regression than the 13.33h double-count bug
    // Ruling A fixed in the first place.
    const base = Date.UTC(2026, 7, 5, 22, 0, 0); // 22:00
    const watchStage1: SleepInterval = {
      startMs: base + 10 * MIN, // 22:10
      endMs: base + 170 * MIN, // 00:50 (+160min)
      value: 4,
      sourceName: "Brandon's Apple Watch",
    };
    const watchStage2: SleepInterval = {
      startMs: base + 190 * MIN, // 01:10 (real 20min awake gap after stage1)
      endMs: base + 240 * MIN, // 02:00 (+50min) — the watch dies here
      value: 3,
      sourceName: "Brandon's Apple Watch",
    };
    const iPhoneUnspecified: SleepInterval = {
      startMs: base + 5 * MIN, // 22:05
      endMs: base + 480 * MIN, // 06:00 (+475min) — the iPhone never stops "seeing" sleep
      value: 1,
      sourceName: 'iPhone',
    };
    const intervals = [watchStage1, watchStage2, iPhoneUnspecified];

    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered');
    // stage1, stage2, the 5-minute lead-in (22:05-22:10), and the 4-hour
    // tail (02:00-06:00) — four kept intervals.
    expect(selected).toHaveLength(4);

    const totalMs = reduceSleepByIntervalUnion(selected);
    const totalHours = totalMs / HOUR;
    expect(totalMs).toBe(455 * MIN);
    expect(totalHours).toBeCloseTo(7.5833, 3);
    expect(totalHours).toBeGreaterThan(7); // NOT the 3.5h the merged #585 code reported
    expect(totalHours).toBeLessThan(8); // NOT the iPhone's full un-clipped 475min/7.9167h either — the stage envelope is still authoritative inside its own span

    // Documents the exact regression this fixture guards: the OLD
    // (#585-merged) selection — stage-preference with no envelope, no
    // residual fill — on this SAME input.
    const oldBuggySelected = intervals.filter((i) => i.value === 3 || i.value === 4 || i.value === 5);
    const oldBuggyTotal = reduceSleepByIntervalUnion(oldBuggySelected);
    expect(oldBuggyTotal).toBe(210 * MIN);
    expect(oldBuggyTotal / HOUR).toBeCloseTo(3.5, 3);
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
    expect(selectThenUnion(intervals)).toBe(2 * HOUR);
  });

  it('neither stage nor unspecified samples exist → branch is "none", selection is empty', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 0, sourceName: 'iPhone' }, // inBed only
      { startMs: HOUR, endMs: HOUR + 10 * MIN, value: 2, sourceName: 'iPhone' }, // awake only
    ];
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('none');
    expect(selected).toEqual([]);
    // S3: `reduceSleepByIntervalUnion` no longer selects internally, so
    // passing these raw inBed/awake intervals directly would merge them (a
    // real time span) instead of correctly excluding them — must go through
    // selection first, exactly as the real `fetchAppleHealthSnapshot` caller
    // does.
    expect(selectThenUnion(intervals)).toBe(0);
  });

  it('empty input yields branch "none" and zero total, never throws', () => {
    expect(selectSleepIntervals([])).toEqual({ branch: 'none', selected: [] });
    expect(reduceSleepByIntervalUnion([])).toBe(0);
  });
});

describe('reduceSleepByIntervalUnion — same-source overlap', () => {
  it('two overlapping stage samples from the SAME source are counted once, not twice', () => {
    // Already an all-stage, pre-selected set — exercises the union/merge
    // mechanism directly.
    const selected: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: 30 * MIN, endMs: 90 * MIN, value: 4, sourceName: "Brandon's Apple Watch" },
    ];
    // Union: 0 -> 90min = 1.5h. Naive sum would be 1h + 1h = 2h.
    expect(reduceSleepByIntervalUnion(selected)).toBe(90 * MIN);
  });

  it('three overlapping same-source samples still merge to one run, once the value-1 sample selection would exclude is removed', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: 40 * MIN, value: 3, sourceName: 'iPhone' },
      { startMs: 20 * MIN, endMs: 60 * MIN, value: 1, sourceName: 'iPhone' },
      { startMs: 50 * MIN, endMs: 80 * MIN, value: 3, sourceName: 'iPhone' },
    ];
    // Stages exist (0-40 and 50-80) and fully cover the value-1 sample's
    // span (20-60 sits inside the [0,80] envelope), so selection excludes
    // it before union runs. Selected: [0,40] and [50,80] — disjoint (10min
    // gap, 40 -> 50) — NOT merged.
    expect(selectThenUnion(intervals)).toBe(40 * MIN + 30 * MIN);
  });
});

describe('reduceSleepByIntervalUnion — adjacent vs. gap handling', () => {
  it('exactly-adjacent (touching) intervals merge without double-counting the boundary instant', () => {
    const selected: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: HOUR, endMs: 2 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" }, // starts exactly where the previous ends
    ];
    expect(reduceSleepByIntervalUnion(selected)).toBe(2 * HOUR);
  });

  it('a genuine gap (an awake period) between two stage runs is NOT bridged — the gap itself is never counted as asleep', () => {
    const selected: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      // 30-minute gap here (an awake(2) sample would sit here on a real
      // device, but even without one explicitly present, the union must
      // not silently bridge it).
      { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" },
    ];
    const totalMs = reduceSleepByIntervalUnion(selected);
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
    // S3: the awake(2) sample sits time-adjacent to both stage runs, so
    // passing it straight to `reduceSleepByIntervalUnion` (which no longer
    // filters by value) would wrongly bridge them into one 150min run.
    // Selection must exclude it first.
    expect(selectThenUnion(intervals)).toBe(120 * MIN);
  });
});

describe('reduceSleepByIntervalUnion — inBed(0)/awake(2) exclusion', () => {
  it('inBed and awake samples never contribute to the total even when they overlap real sleep', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: 8 * HOUR, value: 0, sourceName: 'iPhone' }, // inBed spans the whole night
      { startMs: HOUR, endMs: 2 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
    ];
    // Only the 1-hour stage sample counts; the 8-hour inBed span is inert.
    expect(selectThenUnion(intervals)).toBe(HOUR);
  });

  it('inBed(0) alongside unspecified(1), with no stage samples, still falls back correctly and ignores inBed', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: 8 * HOUR, value: 0, sourceName: 'iPhone' },
      { startMs: HOUR, endMs: 7 * HOUR, value: 1, sourceName: 'iPhone' },
    ];
    const { branch } = selectSleepIntervals(intervals);
    expect(branch).toBe('unspecified');
    expect(selectThenUnion(intervals)).toBe(6 * HOUR);
  });
});

/**
 * RC-2 Founder Ruling C (2026-08-06) — `sleepHoursLastNight`'s chosen
 * observation time: "the end of the LAST merged asleep interval from the
 * union selection." `reduceSleepByIntervalUnionDetailed` is the exact same
 * reduction as `reduceSleepByIntervalUnion` (proven identical `totalMs` in
 * every case below) with the last merged run's end also captured.
 */
describe('reduceSleepByIntervalUnionDetailed — lastEndMs (Ruling C)', () => {
  it('totalMs is byte-identical to reduceSleepByIntervalUnion for the same input', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" },
    ];
    const detailed = reduceSleepByIntervalUnionDetailed(intervals);
    expect(detailed.totalMs).toBe(reduceSleepByIntervalUnion(intervals));
  });

  it('lastEndMs is the end of the LAST (latest-starting) merged run — a genuine gap starts a new run', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      // Gap, then a second run ending later — lastEndMs must reflect THIS run's end.
      { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" },
    ];
    expect(reduceSleepByIntervalUnionDetailed(intervals).lastEndMs).toBe(150 * MIN);
  });

  it('overlapping intervals within the last run extend lastEndMs to the latest end seen in that run', () => {
    const intervals: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      // Same run (overlaps the first) but a shorter source — must NOT
      // regress lastEndMs backward.
      { startMs: 30 * MIN, endMs: 50 * MIN, value: 1, sourceName: 'iPhone' },
    ];
    // Stage present -> iPhone's value-1 sample is excluded by selection
    // entirely, so only the Watch's [0, 60min] survives; lastEndMs = 60min.
    expect(reduceSleepByIntervalUnionDetailed(intervals).lastEndMs).toBe(HOUR);
  });

  it('the device-scenario fixture (Watch stages + iPhone unspecified, same night) resolves lastEndMs to the stage total\'s own end', () => {
    const watchStages: SleepInterval[] = Array.from({ length: 8 }, (_, i) => {
      const start = Date.UTC(2026, 7, 5, 23, 0, 0) + i * 50 * MIN;
      return {
        startMs: start,
        endMs: start + 50 * MIN,
        value: (3 + (i % 3)) as 3 | 4 | 5,
        sourceName: "Brandon's Apple Watch",
      };
    });
    const iPhoneUnspecified: SleepInterval = {
      startMs: Date.UTC(2026, 7, 5, 23, 0, 0),
      endMs: Date.UTC(2026, 7, 5, 23, 0, 0) + 396 * MIN,
      value: 1,
      sourceName: 'iPhone',
    };
    const { lastEndMs } = reduceSleepByIntervalUnionDetailed([...watchStages, iPhoneUnspecified]);
    // 8 contiguous 50-min stage segments starting 23:00 -> the last one ends at 23:00 + 400min.
    expect(lastEndMs).toBe(Date.UTC(2026, 7, 5, 23, 0, 0) + 400 * MIN);
  });

  it('empty / all-excluded input yields totalMs 0 and lastEndMs null, never throws', () => {
    expect(reduceSleepByIntervalUnionDetailed([])).toEqual({ totalMs: 0, lastEndMs: null });
    const inBedOnly: SleepInterval[] = [{ startMs: 0, endMs: HOUR, value: 0, sourceName: 'iPhone' }];
    expect(reduceSleepByIntervalUnionDetailed(inBedOnly)).toEqual({ totalMs: 0, lastEndMs: null });
  });
});
