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
 *
 * RC-2 P0 gate for build 49 (2026-08-06, post-#592 independent verdict) —
 * F1: `selectSleepIntervals` was rewritten from a min/max STAGE envelope to
 * PER-SOURCE COVERAGE (see `services/appleHealth.ts`'s "Sleep aggregation"
 * file header for the full design). Two consequences for THIS file:
 *   - The S1 flagship fixture's 3 "awake gap" comments described real watch
 *     behavior (brief night wake-ups) but were coded as bare time gaps with
 *     no sample of any kind — under per-source coverage that reads as "the
 *     watch recorded nothing here," which would let the iPhone layer fill
 *     them and change the fixture's own asserted total. Fixed by adding
 *     explicit `awake(2)` samples from the Watch in those 3 gaps — this
 *     preserves the flagship 397min/6.6167h value AND makes the fixture
 *     faithful to what a real watchOS session actually writes.
 *   - The "partial watch coverage" (B1) fixture's own comment already
 *     describes its 00:50-01:10 gap as "a real 20-min watch-detected awake
 *     gap," but it too was coded as a bare gap. Same fix, same reason: an
 *     explicit `awake(2)` sample there keeps this fixture's asserted 455min
 *     total unchanged under the new coverage logic (see that describe block
 *     for the worked-out reasoning).
 *   - A new "F1 — per-source coverage" describe block below adds: a
 *     dedicated unrecorded-gap fixture (the direct contrast to S1's
 *     recorded-awake-gap case), probes (g)/(h)/(i)/(j) from the #592
 *     verdict with exact before/after numbers, and a stack-safety
 *     (S-c) large-N test.
 */
import { describe, it, expect } from 'vitest';

import {
  reduceSleepByIntervalUnion,
  reduceSleepByIntervalUnionDetailed,
  selectSleepIntervals,
  type SleepInterval,
  type SleepUnionResult,
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
    //
    // F1 (RC-2 P0 gate for build 49): the 3 gaps below are now REAL
    // `awake(2)` samples from the Watch, not bare time gaps. Per-source
    // coverage (F1) treats "the stage source wrote nothing here" as
    // uncovered and fillable by the iPhone layer — correct for a watch
    // that's dead/off-wrist, wrong for a watch that is on-wrist and
    // explicitly recording AWAKE. A real watchOS sleep session writes
    // exactly the latter for a brief night wake-up, so this fixture must
    // model that explicitly or F1 would (correctly, per its own design)
    // let the iPhone layer fill these gaps and inflate the total — see the
    // separate "unrecorded gap" fixture below for the case where that fill
    // SHOULD happen.
    const seg = (startMin: number, durMin: number, value: 3 | 4 | 5): SleepInterval => {
      const start = Date.UTC(2026, 7, 5, 23, 0, 0) + startMin * MIN;
      return { startMs: start, endMs: start + durMin * MIN, value, sourceName: "Brandon's Apple Watch" };
    };
    const watchAwake = (startMin: number, endMin: number): SleepInterval => {
      const base = Date.UTC(2026, 7, 5, 23, 0, 0);
      return { startMs: base + startMin * MIN, endMs: base + endMin * MIN, value: 2, sourceName: "Brandon's Apple Watch" };
    };
    const watchStages: SleepInterval[] = [
      seg(0, 50, 4),
      watchAwake(50, 65), // 15-minute explicit awake gap
      seg(65, 50, 3),
      watchAwake(115, 135), // 20-minute explicit awake gap
      seg(135, 50, 5),
      seg(182, 50, 4), // starts 3min before the previous segment ends (185) — same-source overlap
      watchAwake(232, 247), // 15-minute explicit awake gap
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
    // The Watch's own awake(2) samples now cover the 3 gaps, so the iPhone
    // layer's residual is empty end to end — branch stays 'stages', and
    // ONLY the 8 stage segments are selected (the 3 awake samples are
    // coverage evidence, never asleep time themselves).
    expect(branch).toBe('stages');
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
    // F1 (RC-2 P0 gate for build 49): this comment always described
    // 00:50-01:10 as "a real 20-min watch-detected awake gap," but it used
    // to be coded as a bare time gap with no sample at all. Under the new
    // per-source coverage rule, a bare gap reads as "the watch recorded
    // nothing here" — genuinely fillable by the iPhone layer — which is the
    // OPPOSITE of "watch-detected awake." Modeled explicitly now so this
    // fixture's own 455min/7.5833h assertion stays correct under F1 (worked
    // out below) instead of silently changing to 475min once the watch's
    // own awake evidence is accounted for.
    const watchAwakeGap: SleepInterval = {
      startMs: base + 170 * MIN, // 00:50
      endMs: base + 190 * MIN, // 01:10
      value: 2,
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
    const intervals = [watchStage1, watchAwakeGap, watchStage2, iPhoneUnspecified];

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
 * S3: the `lastEndMs`-detailed sibling of `selectThenUnion` above — composes
 * select-then-union-detailed exactly the way `fetchAppleHealthSnapshot` does
 * (`reduceSleepByIntervalUnionDetailed(selected)`, never over raw/unselected
 * samples). Used by fixtures below whose INTENT is the full selection+union
 * pipeline (e.g. "does inBed really get excluded before lastEndMs is
 * computed"); fixtures whose intent is the merge mechanism ALONE pass an
 * already-homogeneous pre-selected set directly to
 * `reduceSleepByIntervalUnionDetailed`, same convention as `selectThenUnion`.
 */
function selectThenUnionDetailed(intervals: readonly SleepInterval[]): SleepUnionResult {
  return reduceSleepByIntervalUnionDetailed(selectSleepIntervals(intervals).selected);
}

/**
 * RC-2 Founder Ruling C (2026-08-06) — `sleepHoursLastNight`'s chosen
 * observation time: "the end of the LAST merged asleep interval from the
 * union selection." `reduceSleepByIntervalUnionDetailed` is the exact same
 * reduction as `reduceSleepByIntervalUnion` (proven identical `totalMs` in
 * every case below) with the last merged run's end also captured. Per S3's
 * contract (this file's header, item 3), it takes an ALREADY-SELECTED set —
 * fixtures that need real exclusion behavior (stage-preference, inBed/awake
 * drop) go through `selectThenUnionDetailed`; fixtures below that pass
 * pre-selected/homogeneous sets directly are testing the merge mechanism in
 * isolation, exactly like `reduceSleepByIntervalUnion`'s own tests above.
 */
describe('reduceSleepByIntervalUnionDetailed — lastEndMs (Ruling C)', () => {
  it('totalMs is byte-identical to reduceSleepByIntervalUnion for the same (already-selected) input', () => {
    const selected: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" },
    ];
    const detailed = reduceSleepByIntervalUnionDetailed(selected);
    expect(detailed.totalMs).toBe(reduceSleepByIntervalUnion(selected));
  });

  it('lastEndMs is the end of the LAST (latest-starting) merged run — a genuine gap starts a new run', () => {
    const selected: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      // Gap, then a second run ending later — lastEndMs must reflect THIS run's end.
      { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" },
    ];
    expect(reduceSleepByIntervalUnionDetailed(selected).lastEndMs).toBe(150 * MIN);
  });

  it('overlapping intervals within the last run extend lastEndMs to the latest end seen in that run — never regresses it backward', () => {
    const selected: SleepInterval[] = [
      { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" },
      // Same run (overlaps the first) but a shorter, already-selected second
      // interval — proves the merge takes the MAX end within the run, not
      // simply the last-processed interval's end.
      { startMs: 30 * MIN, endMs: 50 * MIN, value: 4, sourceName: "Brandon's Apple Watch" },
    ];
    expect(reduceSleepByIntervalUnionDetailed(selected).lastEndMs).toBe(HOUR);
  });

  it('the device-scenario fixture (Watch stages + iPhone unspecified, same night), through the real select-then-union pipeline, resolves lastEndMs to the stage total\'s own end', () => {
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
    // Through selection first (stage-preference excludes the fully-covered
    // iPhone layer) — exactly what `fetchAppleHealthSnapshot` does.
    const { lastEndMs } = selectThenUnionDetailed([...watchStages, iPhoneUnspecified]);
    // 8 contiguous 50-min stage segments starting 23:00 -> the last one ends at 23:00 + 400min.
    expect(lastEndMs).toBe(Date.UTC(2026, 7, 5, 23, 0, 0) + 400 * MIN);
  });

  it('empty input yields totalMs 0 and lastEndMs null, never throws', () => {
    expect(reduceSleepByIntervalUnionDetailed([])).toEqual({ totalMs: 0, lastEndMs: null });
  });

  it('inBed-only input is excluded by SELECTION (not by the union function itself) — the real pipeline yields totalMs 0 and lastEndMs null', () => {
    // RC-2 P0 follow-up (S3): `reduceSleepByIntervalUnionDetailed` no longer
    // filters by value at all — passing an inBed(0) interval directly to it
    // would merge it in verbatim (filtering is `selectSleepIntervals`'s job
    // now). This fixture proves the FULL pipeline still yields "nothing to
    // timestamp" for an inBed-only night, via selection, not via the union
    // step — see `selectThenUnionDetailed`'s header.
    const inBedOnly: SleepInterval[] = [{ startMs: 0, endMs: HOUR, value: 0, sourceName: 'iPhone' }];
    expect(selectSleepIntervals(inBedOnly)).toEqual({ branch: 'none', selected: [] });
    expect(selectThenUnionDetailed(inBedOnly)).toEqual({ totalMs: 0, lastEndMs: null });
  });
});

describe('F1 — per-source coverage (RC-2 P0 gate for build 49, post-#592 independent verdict)', () => {
  /**
   * A frozen copy of the PRE-F1 (#592) `selectSleepIntervals` body — the
   * min/max STAGE envelope rule — kept ONLY here, as a static comparison
   * point for the probes below. Deliberately NOT imported from
   * `services/appleHealth.ts` (that function no longer exists there): this
   * copy must stay frozen even as the real implementation evolves further,
   * so "old" always means "what build 49 is being gated against," not
   * "whatever selectSleepIntervals used to do most recently."
   */
  function oldEnvelopeSelect(intervals: readonly SleepInterval[]): SleepInterval[] {
    const stageIntervals = intervals.filter((i) => i.value === 3 || i.value === 4 || i.value === 5);
    const unspecifiedIntervals = intervals.filter((i) => i.value === 1);
    if (stageIntervals.length === 0) return unspecifiedIntervals;
    if (unspecifiedIntervals.length === 0) return stageIntervals;
    const envStart = Math.min(...stageIntervals.map((i) => i.startMs));
    const envEnd = Math.max(...stageIntervals.map((i) => i.endMs));
    const residual: SleepInterval[] = [];
    for (const iv of unspecifiedIntervals) {
      if (iv.startMs < envStart) residual.push({ ...iv, endMs: Math.min(iv.endMs, envStart) });
      if (iv.endMs > envEnd) residual.push({ ...iv, startMs: Math.max(iv.startMs, envEnd) });
    }
    const kept = residual.filter((i) => i.endMs > i.startMs);
    return [...stageIntervals, ...kept];
  }

  it('the direct contrast to the S1 fixture above: a genuinely UNRECORDED gap between two stage runs (no watch sample of ANY kind) IS filled by the iPhone layer', () => {
    const watchRun1: SleepInterval = { startMs: 0, endMs: HOUR, value: 4, sourceName: "Brandon's Apple Watch" };
    // 30-minute gap, HOUR -> 90min: NO sample of any kind from the Watch —
    // contrast this directly with the S1 fixture's awake(2)-filled gaps
    // above (recorded evidence -> excluded) and the partial-coverage (B1)
    // fixture's now-explicit awake gap. This is the OTHER half of the same
    // distinction: absence of evidence -> filled.
    const watchRun2: SleepInterval = { startMs: 90 * MIN, endMs: 150 * MIN, value: 3, sourceName: "Brandon's Apple Watch" };
    const iPhoneUnspecified: SleepInterval = { startMs: 0, endMs: 150 * MIN, value: 1, sourceName: 'iPhone' }; // spans the whole session, including the unrecorded gap

    const { branch, selected } = selectSleepIntervals([watchRun1, watchRun2, iPhoneUnspecified]);
    expect(branch).toBe('stages+uncovered');
    const totalMs = reduceSleepByIntervalUnion(selected);
    // Correct: the 30-minute gap is genuinely recovered (120min stage +
    // 30min fill = 150min) — NOT silently dropped to 120min, which is what
    // would happen if "no sample" were (wrongly) treated the same as
    // "explicit awake sample."
    expect(totalMs).toBe(150 * MIN);
    expect(totalMs).not.toBe(120 * MIN);
  });

  it('probe (g) — awake tail: reproduces the #592 verdict\'s exact old-buggy figure (465min) and eliminates 100% of the watch-scored-AWAKE inclusion (30min); the remaining 15min is a genuinely-unrecorded lead-in this same design correctly fills, so the fully-correct total for THIS fixture is 435min/7.25h, not the verdict\'s rounded "truth 420"', () => {
    const base = Date.UTC(2026, 7, 5, 22, 0, 0); // 22:00
    const watchStage: SleepInterval = { startMs: base + HOUR, endMs: base + 8 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" }; // 23:00-06:00, 420min
    const watchAwakeTail: SleepInterval = { startMs: base + 8 * HOUR, endMs: base + 8 * HOUR + 30 * MIN, value: 2, sourceName: "Brandon's Apple Watch" }; // 06:00-06:30, explicit
    // 22:45-06:30 — matches the verdict's literal probe bounds exactly.
    const iPhoneUnspecified: SleepInterval = { startMs: base + 45 * MIN, endMs: base + 8 * HOUR + 30 * MIN, value: 1, sourceName: 'iPhone' };
    const intervals = [watchStage, watchAwakeTail, iPhoneUnspecified];

    const oldTotalMs = reduceSleepByIntervalUnion(oldEnvelopeSelect(intervals));
    expect(oldTotalMs).toBe(465 * MIN); // matches the verdict's stated old-buggy figure exactly

    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered');
    const newTotalMs = reduceSleepByIntervalUnion(selected);
    expect(oldTotalMs - newTotalMs).toBe(30 * MIN); // 100% of the watch-scored-AWAKE inclusion eliminated
    expect(newTotalMs).toBe(435 * MIN); // 7.25h — see the file's PR-body note on why this is 435, not the verdict's rounded 420
  });

  it('probe (g), flush variant — with no confounding lead-in, isolating ONLY the awake-tail defect reaches the verdict\'s literal "truth 420" exactly', () => {
    const base = Date.UTC(2026, 7, 5, 22, 0, 0);
    const watchStage: SleepInterval = { startMs: base + HOUR, endMs: base + 8 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" }; // 23:00-06:00
    const watchAwakeTail: SleepInterval = { startMs: base + 8 * HOUR, endMs: base + 8 * HOUR + 30 * MIN, value: 2, sourceName: "Brandon's Apple Watch" };
    const iPhoneUnspecified: SleepInterval = { startMs: base + HOUR, endMs: base + 8 * HOUR + 30 * MIN, value: 1, sourceName: 'iPhone' }; // flush with stage start — no lead-in confound

    const intervals = [watchStage, watchAwakeTail, iPhoneUnspecified];
    const oldTotalMs = reduceSleepByIntervalUnion(oldEnvelopeSelect(intervals));
    expect(oldTotalMs).toBe(450 * MIN); // 420 stage + 30 tail, no lead-in confound

    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages'); // fully covered end to end — no residual at all
    const newTotalMs = reduceSleepByIntervalUnion(selected);
    expect(newTotalMs).toBe(420 * MIN); // exactly the watch's stage total
  });

  it('probe (h) — inBed lead-in: reproduces the verdict\'s exact "480 -> 420", with no discrepancy (the watch\'s own inBed sample fully covers the iPhone\'s pre-sleep layer)', () => {
    const base = Date.UTC(2026, 7, 5, 22, 0, 0); // 22:00
    const watchInBed: SleepInterval = { startMs: base, endMs: base + HOUR, value: 0, sourceName: "Brandon's Apple Watch" }; // 22:00-23:00
    const watchStage: SleepInterval = { startMs: base + HOUR, endMs: base + 8 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" }; // 23:00-06:00, 420min
    const iPhoneUnspecified: SleepInterval = { startMs: base, endMs: base + 8 * HOUR, value: 1, sourceName: 'iPhone' }; // 22:00-06:00, flush with the watch's combined inBed+stage span
    const intervals = [watchInBed, watchStage, iPhoneUnspecified];

    const oldTotalMs = reduceSleepByIntervalUnion(oldEnvelopeSelect(intervals));
    expect(oldTotalMs).toBe(480 * MIN); // matches the verdict exactly — 420 stage + a 60min inBed lead-in the OLD stage-only envelope couldn't see

    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages'); // the watch's own inBed sample fully covers the iPhone's lead-in — no residual
    const newTotalMs = reduceSleepByIntervalUnion(selected);
    expect(newTotalMs).toBe(420 * MIN); // matches the verdict's stated truth exactly
  });

  it('probe (i) — nap + night + iPhone-only stretch: two DISJOINT watch clusters no longer collapse into one envelope; reproduces the verdict\'s exact "8.0h -> 9.5h truth"', () => {
    const day = Date.UTC(2026, 7, 5, 0, 0, 0); // midnight anchor
    const nap: SleepInterval = { startMs: day + 14 * HOUR, endMs: day + 15 * HOUR, value: 4, sourceName: "Brandon's Apple Watch" }; // 14:00-15:00, 60min
    const night: SleepInterval = { startMs: day + 23.5 * HOUR, endMs: day + 30.5 * HOUR, value: 3, sourceName: "Brandon's Apple Watch" }; // 23:30 -> +1d 06:30, 420min
    // The watch recorded NOTHING here (off charging before bed) — a
    // genuinely separate short pre-bed rest stretch only the iPhone caught.
    const iPhoneOnly: SleepInterval = { startMs: day + 22 * HOUR, endMs: day + 23.5 * HOUR, value: 1, sourceName: 'iPhone' }; // 22:00-23:30, 90min
    const intervals = [nap, night, iPhoneOnly];

    const oldTotalMs = reduceSleepByIntervalUnion(oldEnvelopeSelect(intervals));
    expect(oldTotalMs).toBe(480 * MIN); // 8.0h — the single min/max envelope [14:00, +1d 06:30] swallows the iPhone-only stretch as "inside the envelope," wrongly excluding it entirely

    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered');
    const newTotalMs = reduceSleepByIntervalUnion(selected);
    expect(newTotalMs).toBe(570 * MIN); // 9.5h — matches the verdict's stated truth exactly
  });

  it('probe (j) — watch dies then is re-worn: a genuinely-unrecorded gap BETWEEN two SAME-night stage clusters is filled, reproducing the verdict\'s exact "3.5h -> ~8.5h" (hit exactly, not just approximately)', () => {
    const base = Date.UTC(2026, 7, 5, 22, 0, 0); // 22:00
    const beforeDeath: SleepInterval = { startMs: base, endMs: base + 100 * MIN, value: 4, sourceName: "Brandon's Apple Watch" }; // 22:00-23:40, 100min
    // 300-minute (5h) dead-battery gap, 23:40 -> 04:40: the watch is off the
    // wrist / charging and writes NOTHING — not even an awake/inBed sample.
    const afterRewear: SleepInterval = { startMs: base + 400 * MIN, endMs: base + 510 * MIN, value: 3, sourceName: "Brandon's Apple Watch" }; // 04:40-06:30, 110min
    // Flush with the watch's overall session bounds (22:00-06:30) so the
    // OLD min/max-envelope computation has no lead-in/tail confound —
    // isolating this probe to the disjoint-cluster defect alone.
    const iPhoneUnspecified: SleepInterval = { startMs: base, endMs: base + 510 * MIN, value: 1, sourceName: 'iPhone' };
    const intervals = [beforeDeath, afterRewear, iPhoneUnspecified];

    const oldTotalMs = reduceSleepByIntervalUnion(oldEnvelopeSelect(intervals));
    expect(oldTotalMs).toBe(210 * MIN); // 3.5h — matches the verdict exactly: the 5-hour dead gap is silently absorbed as "inside the envelope"

    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered');
    const newTotalMs = reduceSleepByIntervalUnion(selected);
    expect(newTotalMs).toBe(510 * MIN); // 8.5h — matches the verdict's stated truth exactly (100 + 110 stage minutes + the 300-minute dead-gap correctly recovered)
  });
});

describe('selectSleepIntervals — S-c stack safety (RC-2 P0 gate for build 49)', () => {
  /**
   * A frozen copy of the PRE-F1 (#592) envelope calculation ONLY (not the
   * full selection function) — isolates exactly the
   * `Math.min(...arr.map())`/`Math.max(...arr.map())` pattern S-c targets,
   * so this test still proves the defect even after `selectSleepIntervals`
   * itself has moved on from a min/max envelope entirely.
   */
  function oldSpreadEnvelope(stageIntervals: readonly SleepInterval[]): { envStart: number; envEnd: number } {
    return {
      envStart: Math.min(...stageIntervals.map((i) => i.startMs)),
      envEnd: Math.max(...stageIntervals.map((i) => i.endMs)),
    };
  }

  it('S-c: the OLD Math.min/max-spread envelope calculation overflows the call stack on a large array; the current implementation does not', () => {
    // HealthKit's `queryCategorySamples` is called with `limit: 0`
    // (`fetchAppleHealthSnapshot`, unbounded) — a pathological/misbehaving
    // response could return a very large sample array. `Math.min(...arr)`/
    // `Math.max(...arr)` spread every element into a single function call's
    // argument list, which throws "Maximum call stack size exceeded" well
    // before a real night's sample count, but easily within what an
    // unbounded query could return.
    const N = 150_000;
    const stageIntervals: SleepInterval[] = [];
    for (let i = 0; i < N; i++) {
      stageIntervals.push({ startMs: i, endMs: i + 1, value: 4, sourceName: "Brandon's Apple Watch" });
    }
    expect(() => oldSpreadEnvelope(stageIntervals)).toThrow(/call stack/i);
  });

  it('S-c: selectSleepIntervals handles a large, mostly-contiguous interval array (no spread anywhere in its call graph)', () => {
    const N = 150_000;
    const intervals: SleepInterval[] = [];
    // Overlapping/contiguous by construction (each interval starts before
    // the previous one ends) so `mergeIntervalSpans` collapses them into
    // ONE covered span — a large-N case with a SMALL number of covered
    // spans (the common real-world shape: one continuous sleep session).
    for (let i = 0; i < N; i++) {
      intervals.push({ startMs: i, endMs: i + 2, value: 4, sourceName: "Brandon's Apple Watch" });
    }
    intervals.push({ startMs: -1000, endMs: N + 1000, value: 1, sourceName: 'iPhone' });

    expect(() => selectSleepIntervals(intervals)).not.toThrow();
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered'); // the iPhone sample's lead-in/tail slices, outside the merged covered span, are kept
    expect(selected.length).toBe(N + 2); // N stage intervals + 1 lead-in slice + 1 tail slice
  });

  it('S-c: also holds when the large N produces MANY disjoint covered spans (worst case for both mergeIntervalSpans and subtractCoveredSpans, not just the common contiguous case)', () => {
    // Regression guard for a SEPARATE spread hazard this engineer found
    // (not one of the reviewer's named findings) while implementing F1:
    // `subtractCoveredSpans`'s residual slices used to be appended via
    // `residual.push(...subtractCoveredSpans(iv, covered))` in
    // `selectSleepIntervals` — spreading a large return array into `push`'s
    // argument list is the exact same call-stack-limit hazard as
    // `Math.min(...arr)`, just relocated. This fixture is the shape that
    // actually exercises it: every stage interval is separated by a 1ms
    // gap, so `mergeIntervalSpans` produces N disjoint covered spans, and
    // the ONE wide value-1 sample below straddles all of them, producing on
    // the order of N residual slices from a SINGLE `subtractCoveredSpans`
    // call — precisely the shape that overflowed `push(...)`'s argument
    // list before the fix (and that a naive per-span "shrink a `remaining`
    // list" implementation of `subtractCoveredSpans` would also make
    // quadratic — this one is linear, see its own header comment).
    const N = 150_000;
    const intervals: SleepInterval[] = [];
    for (let i = 0; i < N; i++) {
      intervals.push({ startMs: i * 2, endMs: i * 2 + 1, value: 4, sourceName: "Brandon's Apple Watch" });
    }
    intervals.push({ startMs: 0, endMs: N * 2, value: 1, sourceName: 'iPhone' });

    expect(() => selectSleepIntervals(intervals)).not.toThrow();
    const { branch, selected } = selectSleepIntervals(intervals);
    expect(branch).toBe('stages+uncovered');
    // N stage intervals + (N - 1) 1ms gap-fill residual slices between them
    // + 1 final 1ms tail slice after the last stage interval (the iPhone
    // sample runs to N*2, one ms past the last stage interval's end).
    expect(selected.length).toBe(N + N);
  });
});
