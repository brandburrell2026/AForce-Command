/**
 * VALIDATION MATRIX — cross-module integration sweep (QA).
 *
 * See `../validationMatrixFixtures.ts` for the full rationale: this suite
 * does NOT re-prove any single module's contract in isolation (that is
 * already done, exhaustively, by `signalResolution.test.ts`,
 * `weeklyHealthAggregates.test.ts`, `healthSignalsFromStore.test.ts`, and
 * `scoreProtectionInvariants.test.ts`). It composes `resolveHealthSignals` →
 * `buildWeeklyHealthAggregates` / `toReadinessBiometrics` across real
 * multi-provider, multi-day inputs — including genuine (`Intl`-derived, not
 * synthetic) DST calendar boundaries and a mid-week permission revocation —
 * to prove the six documented honesty invariants hold END TO END:
 *
 *   1. No cross-provider blending survives composition (never summed/averaged
 *      across origins at any stage, including through the weekly rollup).
 *   2. Honest unavailable/insufficient reasons propagate through every layer.
 *   3. HRV method is preserved end-to-end — through the weekly rollup's
 *      dominant-method selection AND into the readiness adapter's
 *      method-true field — never coerced.
 *   4. Provider scores stay provider-attributed end-to-end (weekly rollup +
 *      readiness adapter), never re-homed.
 *   5. The priority-ladder-first / freshness-gated selection rule (never
 *      plain freshest-wins, never plain priority-ignoring-age) holds for
 *      both directions of that rule on the same two competing origins.
 *   6. Real calendar-boundary correctness (no double-count, no gap on an
 *      actual DST transition) AND mid-week permission revocation preserves
 *      sibling metrics for the same provider.
 *
 * READ-ONLY discipline: `signalResolution.ts`, `weeklyHealthAggregates.ts`,
 * and `readinessSignals.ts` are imported and exercised — never modified.
 * Nothing here touches `scoringEngine.ts` / `statusColor.ts` (both
 * off-limits; score-protection is `scoreProtectionInvariants.test.ts`'s job,
 * not re-litigated here).
 */
import { describe, it, expect } from 'vitest';
import { resolveHealthSignals } from '../signalResolution';
import { buildWeeklyHealthAggregates } from '../weeklyHealthAggregates';
import { toReadinessBiometrics } from '../readinessSignals';
import {
  findLocalMidnightUtcMs,
  NY_TZ,
  NY_FALL_BACK_WEEK_BOUNDARIES,
  NY_SPRING_FORWARD_WEEK_BOUNDARIES,
  PRIORITY_BEATS_FRESHER_LOWER_PRIORITY,
  STALE_TOP_PRIORITY_LOSES_TO_FRESH_LOWER_PRIORITY,
  SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY,
  ALL_FIVE_PROVIDERS_WEEK_RECORDS,
  ALL_FIVE_PROVIDERS_ACTIVE_DIRECT,
  ALL_FIVE_PROVIDERS_DAY6_RECORDS,
  ALL_FIVE_PROVIDERS_DAY1_RECORDS,
  ALL_FIVE_PROVIDERS_DAY1_ANCHOR_MS,
  ALL_FIVE_WEEK_NOW_MS,
  buildRevokedMidWeekDayInputs,
} from '../validationMatrixFixtures';

const HOUR = 60 * 60_000;

// ─── 0. Ground truth — the DST boundaries themselves are real, not synthetic ─

describe('ground truth — DST boundaries derived from genuine Intl tz data', () => {
  it('fall-back week: day index 3 (Nov 1 → Nov 2, America/New_York, 2026) is a real 25h local day', () => {
    const hours = (NY_FALL_BACK_WEEK_BOUNDARIES[4] - NY_FALL_BACK_WEEK_BOUNDARIES[3]) / HOUR;
    expect(hours).toBeCloseTo(25, 2);
    // Every other day in the same week stays a plain 24h day.
    for (let i = 0; i < NY_FALL_BACK_WEEK_BOUNDARIES.length - 1; i++) {
      if (i === 3) continue;
      expect((NY_FALL_BACK_WEEK_BOUNDARIES[i + 1] - NY_FALL_BACK_WEEK_BOUNDARIES[i]) / HOUR).toBeCloseTo(24, 2);
    }
  });

  it('spring-forward week: day index 3 (Mar 8 → Mar 9, America/New_York, 2026) is a real 23h local day', () => {
    const hours = (NY_SPRING_FORWARD_WEEK_BOUNDARIES[4] - NY_SPRING_FORWARD_WEEK_BOUNDARIES[3]) / HOUR;
    expect(hours).toBeCloseTo(23, 2);
    for (let i = 0; i < NY_SPRING_FORWARD_WEEK_BOUNDARIES.length - 1; i++) {
      if (i === 3) continue;
      expect((NY_SPRING_FORWARD_WEEK_BOUNDARIES[i + 1] - NY_SPRING_FORWARD_WEEK_BOUNDARIES[i]) / HOUR).toBeCloseTo(24, 2);
    }
  });

  it('both boundary sets are strictly increasing (the exact shape buildWeeklyHealthAggregates requires)', () => {
    for (const boundaries of [NY_FALL_BACK_WEEK_BOUNDARIES, NY_SPRING_FORWARD_WEEK_BOUNDARIES]) {
      expect(boundaries).toHaveLength(8);
      for (let i = 1; i < boundaries.length; i++) {
        expect(boundaries[i]).toBeGreaterThan(boundaries[i - 1]);
      }
    }
  });

  it('sanity-checks the finder against the independently-known repeated/skipped local hour', () => {
    // Fall-back: 05:30 and 06:30 UTC both read as 01:30 local (the repeated hour).
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: NY_TZ, hour12: false, hour: '2-digit', minute: '2-digit' });
    expect(fmt.format(Date.parse('2026-11-01T05:30:00Z'))).toBe('01:30');
    expect(fmt.format(Date.parse('2026-11-01T06:30:00Z'))).toBe('01:30');
    // Spring-forward: 02:30 local never occurs on Mar 8 — 06:30 UTC → 01:30, 07:30 UTC → 03:30.
    expect(fmt.format(Date.parse('2026-03-08T06:30:00Z'))).toBe('01:30');
    expect(fmt.format(Date.parse('2026-03-08T07:30:00Z'))).toBe('03:30');
    // The helper's own output must agree with Node's ICU, not a hand rule.
    expect(findLocalMidnightUtcMs(2026, 11, 2, NY_TZ)).toBe(NY_FALL_BACK_WEEK_BOUNDARIES[4]);
  });
});

// ─── 5. Priority-ladder-first, freshness-gated — both directions ───────────

describe('invariant 5 — priority ladder first, gated by freshness (never plain freshest-wins, never plain priority-ignoring-age)', () => {
  it('an AGING top-priority origin (whoop, 12h) beats a FRESHER lower-priority origin (oura, 1h)', () => {
    const signals = resolveHealthSignals(PRIORITY_BEATS_FRESHER_LOWER_PRIORITY);
    expect(signals.hrv.available).toBe(true);
    if (signals.hrv.available) {
      expect(signals.hrv.source).toBe('whoop');
      expect(signals.hrv.value.valueMs).toBe(40); // whoop's own value — never oura's 55, never an average
      expect(signals.hrv.freshness).toBe('aging');
    }
  });

  it('a STALE top-priority origin (whoop, 48h) loses to a FRESH lower-priority origin (oura, 1h)', () => {
    const signals = resolveHealthSignals(STALE_TOP_PRIORITY_LOSES_TO_FRESH_LOWER_PRIORITY);
    expect(signals.hrv.available).toBe(true);
    if (signals.hrv.available) {
      expect(signals.hrv.source).toBe('oura');
      expect(signals.hrv.value.valueMs).toBe(55); // oura's own value — never whoop's 40, never an average
      expect(signals.hrv.freshness).toBe('fresh');
    }
  });
});

// ─── Attribution survives the readiness-adapter boundary ───────────────────

describe('attribution (true origin, never the transport) survives resolveHealthSignals → toReadinessBiometrics', () => {
  it('a Samsung reading delivered via Health Connect lands on the samsung_health snapshot, never google_health', () => {
    const signals = resolveHealthSignals(SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY);
    expect(signals.restingHeartRate.available).toBe(true);
    if (signals.restingHeartRate.available) expect(signals.restingHeartRate.source).toBe('samsung_health');

    const bio = toReadinessBiometrics(signals);
    expect(bio.samsung_health?.restingHeartRate).toBe(52);
    expect(bio.google_health).toBeUndefined();
  });
});

// ─── 1, 2, 6a. Full pipeline over a real DST week — no blending, honest reasons, boundary correctness ─

describe('full pipeline over a real DST week (fall-back, Nov 1 2026) — no cross-provider blending, honest reasons, exact DST bucketing', () => {
  const weekly = buildWeeklyHealthAggregates({
    records: ALL_FIVE_PROVIDERS_WEEK_RECORDS,
    activeDirectProviders: ALL_FIVE_PROVIDERS_ACTIVE_DIRECT,
    days: 7,
    timezoneOffsetMin: 0, // ignored — dayBoundariesMs below takes precedence
    dayBoundariesMs: [...NY_FALL_BACK_WEEK_BOUNDARIES],
    nowMs: ALL_FIVE_WEEK_NOW_MS,
  });

  it('steps: cross-provider race resolves to the ladder winner alone, and the DST boundary-edge record lands in exactly one day', () => {
    expect(weekly.steps.status).toBe('ok');
    if (weekly.steps.status === 'ok') {
      // Day 0 (apple 8000 vs google 6000) must resolve to 8000, never 14000 —
      // proven by the exact mean, which a summed day0 would shift by 2000.
      expect(weekly.steps.mean).toBeCloseTo((8000 + 18999 + 10500) / 3, 6);
      expect(weekly.steps.min).toBe(8000);
      expect(weekly.steps.max).toBe(18999); // day4's 9000 + the boundary-edge 9999, ONE origin, never split
      expect(weekly.steps.daysCovered).toBe(3);
      expect([...weekly.steps.coverage.missingDays].sort((a, b) => a - b)).toEqual([1, 2, 3, 5]);
      // Only apple_health ever appears — google_health's day-0 candidate never surfaces anywhere.
      expect(weekly.steps.sources).toEqual([{ source: 'apple_health', aggregator: undefined, daysCount: 3 }]);
      expect(weekly.steps.freshness).toBe('fresh'); // most recent covered day (6) was resolved at age 0
    }
  });

  it('day 3 (the real 25h fall-back day) has honestly NO steps data of its own — the edge record did not leak backward into it', () => {
    // Re-resolve day 3's own bucket directly to inspect its reason (the
    // weekly aggregate's `missingDays` alone does not carry a reason).
    const day3Records = ALL_FIVE_PROVIDERS_WEEK_RECORDS.filter(
      (r) =>
        Date.parse(r.observedAt) >= NY_FALL_BACK_WEEK_BOUNDARIES[3] &&
        Date.parse(r.observedAt) < NY_FALL_BACK_WEEK_BOUNDARIES[4] &&
        r.metricType === 'steps',
    );
    expect(day3Records).toHaveLength(0);
    const signals = resolveHealthSignals({
      biometrics: undefined,
      records: day3Records,
      activeDirectProviders: ALL_FIVE_PROVIDERS_ACTIVE_DIRECT,
      nowMs: NY_FALL_BACK_WEEK_BOUNDARIES[4],
    });
    expect(signals.steps.available).toBe(false);
    if (!signals.steps.available) expect(signals.steps.reason).toBe('no_data');
  });

  it('hrv: dominant method (sdnn, 3 days) is aggregated; the minority (rmssd, day 6) is excluded, never averaged in', () => {
    expect(weekly.hrv.status).toBe('ok');
    if (weekly.hrv.status === 'ok') {
      expect(weekly.hrv.hrvMethod).toBe('sdnn');
      expect(weekly.hrv.mean).toBeCloseTo((42 + 44 + 46) / 3, 6);
      expect(weekly.hrv.min).toBe(42);
      expect(weekly.hrv.max).toBe(46);
      expect(weekly.hrv.methodConflict).toBe(true);
      expect(weekly.hrv.excludedMethodConflictDays).toBe(1);
      expect(weekly.hrv.excludedMethodConflictDayIndexes).toEqual([6]);
      expect([...weekly.hrv.coverage.missingDays].sort((a, b) => a - b)).toEqual([1, 3, 5]);
      expect(weekly.hrv.freshness).toBe('aging'); // most recent DOMINANT-method day is day 4, aged 12h at its own day-end anchor
    }
  });

  it('sleep: day 1\'s cross-provider race (whoop vs oura) resolves to the ladder winner alone — verified directly since the weekly rollup is insufficient_data here', () => {
    expect(weekly.sleepDuration.status).toBe('insufficient_data');
    if (weekly.sleepDuration.status === 'insufficient_data') {
      expect(weekly.sleepDuration.daysCovered).toBe(2); // days 1 and 6 only — an honest, non-blended count
    }
    const day1Signals = resolveHealthSignals({
      biometrics: undefined,
      records: ALL_FIVE_PROVIDERS_DAY1_RECORDS,
      activeDirectProviders: ALL_FIVE_PROVIDERS_ACTIVE_DIRECT,
      nowMs: ALL_FIVE_PROVIDERS_DAY1_ANCHOR_MS,
    });
    expect(day1Signals.sleepDuration.available).toBe(true);
    if (day1Signals.sleepDuration.available) {
      expect(day1Signals.sleepDuration.source).toBe('whoop');
      expect(day1Signals.sleepDuration.value.totalSleepHours).toBe(6.2); // never oura's 7.9, never ~7.05 averaged
    }
  });

  it('provider scores: distinct (provider, kind) pairs stay independently attributed and independently covered', () => {
    const whoopRecovery = weekly.providerScores.find((s) => s.provider === 'whoop' && s.kind === 'whoop_recovery');
    const ouraReadiness = weekly.providerScores.find((s) => s.provider === 'oura' && s.kind === 'oura_readiness');
    expect(whoopRecovery?.status).toBe('ok');
    if (whoopRecovery?.status === 'ok') {
      expect(whoopRecovery.mean).toBeCloseTo((60 + 63 + 58) / 3, 6);
      expect(whoopRecovery.min).toBe(58);
      expect(whoopRecovery.max).toBe(63);
      expect(whoopRecovery.daysCovered).toBe(3);
    }
    // A single-day score honestly reports insufficient_data — never a fabricated mean from one point.
    expect(ouraReadiness?.status).toBe('insufficient_data');
    if (ouraReadiness?.status === 'insufficient_data') expect(ouraReadiness.daysCovered).toBe(1);
  });
});

// ─── 3, 4. HRV method + provider-score attribution survive into the readiness adapter, at the "today" bucket ─

describe('full pipeline, single day — HRV method and provider-score attribution survive resolveHealthSignals → toReadinessBiometrics', () => {
  const day6Signals = resolveHealthSignals({
    biometrics: undefined,
    records: ALL_FIVE_PROVIDERS_DAY6_RECORDS,
    activeDirectProviders: ALL_FIVE_PROVIDERS_ACTIVE_DIRECT,
    nowMs: ALL_FIVE_WEEK_NOW_MS,
  });
  const bio = toReadinessBiometrics(day6Signals);

  it('HRV method (rmssd) is preserved into the method-true field — never coerced into hrvSdnnMs', () => {
    expect(day6Signals.hrv.available).toBe(true);
    if (day6Signals.hrv.available) expect(day6Signals.hrv.value.method).toBe('rmssd');
    expect(bio.whoop?.hrvRmssdMs).toBe(52);
    expect(bio.whoop?.hrvSdnnMs).toBeUndefined(); // the OTHER method's field must stay empty, not coerced
    expect(bio.whoop?.hrvSdnn).toBe(52); // legacy wire-compat mirror carries the same value, unconverted
  });

  it('every other today-bucket signal is attributed to its true winning origin, never blended', () => {
    expect(bio.whoop?.sleepHoursLastNight).toBe(7.1);
    expect(bio.apple_health?.stepsToday).toBe(10500);
  });

  it('the oura_readiness provider score lands only on the oura snapshot, never re-homed to whoop or apple_health', () => {
    expect(bio.oura?.readinessScore).toBe(81);
    expect(bio.whoop?.readinessScore).toBeUndefined();
    expect(bio.apple_health?.readinessScore).toBeUndefined();
  });
});

// ─── 6b. Mid-week permission revocation preserves sibling metrics ──────────

describe('invariant 6 — mid-week permission revocation preserves sibling metrics for the same provider', () => {
  const dailySignals = buildRevokedMidWeekDayInputs();
  const weekly = buildWeeklyHealthAggregates({
    records: undefined,
    days: 7,
    timezoneOffsetMin: 0,
    nowMs: Date.now(), // unused for output math — every day is fully overridden below
    dailySignals,
  });

  it('hrv is honestly missing for the 3 days after revocation, but the pre-revocation 4 days still aggregate correctly', () => {
    expect(weekly.hrv.status).toBe('ok');
    if (weekly.hrv.status === 'ok') {
      expect(weekly.hrv.hrvMethod).toBe('sdnn');
      expect(weekly.hrv.daysCovered).toBe(4);
      expect(weekly.hrv.mean).toBeCloseTo((40 + 41 + 42 + 43) / 4, 6);
      expect(weekly.hrv.min).toBe(40);
      expect(weekly.hrv.max).toBe(43);
      expect([...weekly.hrv.coverage.missingDays].sort((a, b) => a - b)).toEqual([4, 5, 6]);
    }
  });

  it('steps for the SAME provider stays fully granted across all 7 days — revoking hrv never touches its sibling', () => {
    expect(weekly.steps.status).toBe('ok');
    if (weekly.steps.status === 'ok') {
      expect(weekly.steps.daysCovered).toBe(7);
      expect(weekly.steps.coverage.missingDays).toEqual([]);
      expect(weekly.steps.mean).toBeCloseTo((5000 + 5100 + 5200 + 5300 + 5400 + 5500 + 5600) / 7, 6);
      expect(weekly.steps.min).toBe(5000);
      expect(weekly.steps.max).toBe(5600);
      expect(weekly.steps.sources).toEqual([{ source: 'apple_health', aggregator: undefined, daysCount: 7 }]);
    }
  });

  it('a denied day resolves hrv to permission_denied directly, and the forged 999 value in the raw feed never surfaces anywhere', () => {
    const day4 = dailySignals.find((d) => d.dayIndex === 4)!;
    const signals = resolveHealthSignals(day4.input!);
    expect(signals.hrv.available).toBe(false);
    if (!signals.hrv.available) expect(signals.hrv.reason).toBe('permission_denied');
    expect(signals.steps.available).toBe(true);
    if (signals.steps.available) expect(signals.steps.value).toBe(5400); // sibling family, unaffected

    // The forged 999 must never appear in the weekly hrv aggregate's numbers either.
    if (weekly.hrv.status === 'ok') {
      expect(weekly.hrv.mean).not.toBe(999);
      expect(weekly.hrv.max).not.toBe(999);
    }
  });
});
