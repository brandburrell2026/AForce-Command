/**
 * VALIDATION MATRIX — duplicates never amplify (Squad-E gap-closure, priority 1).
 *
 * The independent review of PR #505 found ZERO coverage of the canonical
 * duplicate case: one real-world measurement arriving twice — once direct
 * from its origin provider, once re-exported by an aggregator (Apple
 * Health / Health Connect). `lib/health-core/src/dedupe.ts` exists
 * specifically to collapse this; this suite proves the collapse survives
 * `resolveHealthSignals` AND `buildWeeklyHealthAggregates` for the three
 * families named in the gap report — sleep, workouts (previously covered by
 * NO fixture in this suite at all), and steps (a TRUE duplicate pair,
 * distinct from `ALL_FIVE_PROVIDERS_WEEK_RECORDS` day 4's within-origin
 * SUMMATION case in `../__tests__/validationMatrix.test.ts`).
 *
 * METHOD: every duplicate pair below shares an identical provider-native id
 * (`externalId`) and origin (`provenanceChain[0].provider`) with its "single
 * copy" counterpart — see `../validationMatrixFixtures.ts`'s section E for
 * why that makes this a GENUINELY deduplicable pair (both
 * `dedupeRecords` Pass 1's key-identical collapse AND Pass 2's
 * aggregator-copy-of-direct drop agree on it), not merely two records that
 * happen to share a metric type. Each assertion compares the SINGLE-copy
 * resolution against the PAIR (duplicate) resolution with `toEqual` —
 * proving the output is EXACTLY identical, not merely "didn't crash" and not
 * merely "didn't sum to 2x" (an average would also pass a weaker check).
 *
 * READ-ONLY discipline: `resolveHealthSignals`, `buildWeeklyHealthAggregates`,
 * and `dedupeRecords` are imported and exercised — never modified. See the
 * mutation-verification note in the PR description for the targeted,
 * fully-reverted source mutation that proves these assertions are not
 * vacuous.
 */
import { describe, it, expect } from 'vitest';
import { resolveHealthSignals } from '../signalResolution';
import { buildWeeklyHealthAggregates } from '../weeklyHealthAggregates';
import {
  DUPLICATE_SLEEP_SINGLE_INPUT,
  DUPLICATE_SLEEP_PAIR_INPUT,
  DUPLICATE_WORKOUT_SINGLE_INPUT,
  DUPLICATE_WORKOUT_PAIR_INPUT,
  DUPLICATE_STEPS_SINGLE_INPUT,
  DUPLICATE_STEPS_PAIR_INPUT,
  DUPLICATE_SLEEP_WEEK_SINGLE_RECORDS,
  DUPLICATE_SLEEP_WEEK_PAIR_RECORDS,
  DUPLICATE_SLEEP_WEEK_ACTIVE_DIRECT,
  DUPLICATE_WORKOUT_WEEK_SINGLE_RECORDS,
  DUPLICATE_WORKOUT_WEEK_PAIR_RECORDS,
  DUPLICATE_WORKOUT_WEEK_ACTIVE_DIRECT,
  DUPLICATE_STEPS_WEEK_SINGLE_RECORDS,
  DUPLICATE_STEPS_WEEK_PAIR_RECORDS,
  DUPLICATE_STEPS_WEEK_ACTIVE_DIRECT,
  FIXED_NOW,
} from '../validationMatrixFixtures';

// ─── Through resolveHealthSignals — single-day resolution ──────────────────

describe('duplicates never amplify — resolveHealthSignals (direct + genuine aggregator copy, same measurement)', () => {
  it('duplicate SLEEP: two copies resolve identically to one copy (Oura direct + Oura-via-Apple)', () => {
    const single = resolveHealthSignals(DUPLICATE_SLEEP_SINGLE_INPUT);
    const pair = resolveHealthSignals(DUPLICATE_SLEEP_PAIR_INPUT);
    expect(pair.sleepDuration).toEqual(single.sleepDuration);
    expect(single.sleepDuration.available).toBe(true);
    if (single.sleepDuration.available) {
      expect(single.sleepDuration.source).toBe('oura');
      expect(single.sleepDuration.value.totalSleepHours).toBe(7.4); // never doubled, never averaged
    }
  });

  it('duplicate WORKOUT: two copies resolve identically to one copy (Garmin direct + Garmin-via-Apple) — workout had ZERO prior fixture coverage in this suite', () => {
    const single = resolveHealthSignals(DUPLICATE_WORKOUT_SINGLE_INPUT);
    const pair = resolveHealthSignals(DUPLICATE_WORKOUT_PAIR_INPUT);
    expect(pair.workouts).toEqual(single.workouts);
    expect(single.workouts.available).toBe(true);
    if (single.workouts.available) {
      expect(single.workouts.value).toHaveLength(1); // never two entries for one real workout
      expect(single.workouts.value[0].durationMin).toBe(32);
      expect(single.workouts.source).toBe('garmin');
    }
  });

  it('duplicate STEPS: two copies resolve identically to one copy (Oura direct + Oura-via-Apple) — distinct from the within-origin summation case', () => {
    const single = resolveHealthSignals(DUPLICATE_STEPS_SINGLE_INPUT);
    const pair = resolveHealthSignals(DUPLICATE_STEPS_PAIR_INPUT);
    expect(pair.steps).toEqual(single.steps);
    expect(single.steps.available).toBe(true);
    if (single.steps.available) {
      expect(single.steps.value).toBe(6200); // never 12400 (summed) and never 6200±blend
      expect(single.steps.source).toBe('oura');
    }
  });

  it('sanity: the pair inputs really do carry two records each (the equality above is not vacuous because the inputs were already identical)', () => {
    expect(DUPLICATE_SLEEP_PAIR_INPUT.records).toHaveLength(2);
    expect(DUPLICATE_WORKOUT_PAIR_INPUT.records).toHaveLength(2);
    expect(DUPLICATE_STEPS_PAIR_INPUT.records).toHaveLength(2);
    expect(DUPLICATE_SLEEP_SINGLE_INPUT.records).toHaveLength(1);
    expect(DUPLICATE_WORKOUT_SINGLE_INPUT.records).toHaveLength(1);
    expect(DUPLICATE_STEPS_SINGLE_INPUT.records).toHaveLength(1);
  });
});

// ─── Through buildWeeklyHealthAggregates — the full weekly rollup ──────────

describe('duplicates never amplify — buildWeeklyHealthAggregates (dedup-once-then-bucket pipeline)', () => {
  it('duplicate SLEEP inside a full week: the weekly aggregate is byte-identical whether the duplicate is present or not', () => {
    const single = buildWeeklyHealthAggregates({
      records: DUPLICATE_SLEEP_WEEK_SINGLE_RECORDS,
      activeDirectProviders: DUPLICATE_SLEEP_WEEK_ACTIVE_DIRECT,
      days: 7,
      timezoneOffsetMin: 0,
      nowMs: FIXED_NOW,
    });
    const pair = buildWeeklyHealthAggregates({
      records: DUPLICATE_SLEEP_WEEK_PAIR_RECORDS,
      activeDirectProviders: DUPLICATE_SLEEP_WEEK_ACTIVE_DIRECT,
      days: 7,
      timezoneOffsetMin: 0,
      nowMs: FIXED_NOW,
    });
    expect(pair).toEqual(single);
    // And the shared result is honestly non-trivial (not two vacuously-equal insufficient_data stubs).
    expect(single.sleepDuration.status).toBe('insufficient_data'); // 1-of-7 days, below default minCoverageDays (3)
    if (single.sleepDuration.status === 'insufficient_data') expect(single.sleepDuration.daysCovered).toBe(1);
  });

  it('duplicate WORKOUT inside a full week: the weekly aggregate is byte-identical whether the duplicate is present or not', () => {
    const single = buildWeeklyHealthAggregates({
      records: DUPLICATE_WORKOUT_WEEK_SINGLE_RECORDS,
      activeDirectProviders: DUPLICATE_WORKOUT_WEEK_ACTIVE_DIRECT,
      days: 7,
      timezoneOffsetMin: 0,
      nowMs: FIXED_NOW,
    });
    const pair = buildWeeklyHealthAggregates({
      records: DUPLICATE_WORKOUT_WEEK_PAIR_RECORDS,
      activeDirectProviders: DUPLICATE_WORKOUT_WEEK_ACTIVE_DIRECT,
      days: 7,
      timezoneOffsetMin: 0,
      nowMs: FIXED_NOW,
    });
    expect(pair).toEqual(single);
    expect(single.workouts.status).toBe('insufficient_data');
    if (single.workouts.status === 'insufficient_data') expect(single.workouts.daysCovered).toBe(1);
  });

  it('duplicate STEPS inside a full week: the weekly aggregate is byte-identical whether the duplicate is present or not', () => {
    const single = buildWeeklyHealthAggregates({
      records: DUPLICATE_STEPS_WEEK_SINGLE_RECORDS,
      activeDirectProviders: DUPLICATE_STEPS_WEEK_ACTIVE_DIRECT,
      days: 7,
      timezoneOffsetMin: 0,
      nowMs: FIXED_NOW,
    });
    const pair = buildWeeklyHealthAggregates({
      records: DUPLICATE_STEPS_WEEK_PAIR_RECORDS,
      activeDirectProviders: DUPLICATE_STEPS_WEEK_ACTIVE_DIRECT,
      days: 7,
      timezoneOffsetMin: 0,
      nowMs: FIXED_NOW,
    });
    expect(pair).toEqual(single);
    expect(single.steps.status).toBe('insufficient_data');
    if (single.steps.status === 'insufficient_data') expect(single.steps.daysCovered).toBe(1);
  });
});
