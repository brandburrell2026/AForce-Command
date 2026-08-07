import { describe, it, expect } from 'vitest';
import { aggregateBiometrics, buildAppleHealthProviderSnapshot } from '../biometricsAggregator';
import type { ProviderBiometrics } from '../../types/biometrics';
import type { AppleHealthInputs } from '../../types';

const t = 1_700_000_000_000;

describe('aggregateBiometrics — empty / undefined', () => {
  it('returns zeros for undefined input', () => {
    const r = aggregateBiometrics(undefined);
    expect(r.recoveryDelta).toBe(0);
    expect(r.inferredActivityLevel).toBe(0);
    expect(r.sources).toEqual([]);
    expect(r.hint).toMatch(/no platforms/i);
  });

  it('returns zeros for empty record', () => {
    const r = aggregateBiometrics({});
    expect(r.recoveryDelta).toBe(0);
    expect(r.inferredActivityLevel).toBe(0);
    expect(r.sources).toEqual([]);
  });

  it('skips providers with undefined snapshots', () => {
    const r = aggregateBiometrics({ oura: undefined } as ProviderBiometrics);
    expect(r.sources).toEqual([]);
    expect(r.recoveryDelta).toBe(0);
  });
});

describe('aggregateBiometrics — recovery delta per signal', () => {
  it('rewards high HRV (≥60ms) by +5', () => {
    const r = aggregateBiometrics({
      garmin: { providerId: 'garmin', hrvSdnn: 65, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(5);
    // RC-2 Ruling C, item 3: unit-spacing sweep — 'HRV 65ms' -> 'HRV 65 ms'.
    expect(r.hint).toContain('HRV 65 ms');
  });

  it('penalizes low HRV (<30ms) by -5', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', hrvSdnn: 22, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-5);
    expect(r.hint).toContain('low');
  });

  it('mid HRV (40-59) gives +2', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 45, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(2);
  });

  it('rewards 7–9h sleep with +5', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', sleepHoursLastNight: 7.5, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(5);
  });

  it('penalizes <4h sleep with -5', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', sleepHoursLastNight: 3.5, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-5);
    expect(r.hint).toContain('deficit');
  });

  it('rewards Oura readiness ≥85 with +4', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', readinessScore: 88, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(4);
    expect(r.hint).toContain('Readiness 88');
  });

  it('penalizes Oura readiness <50 with -4', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', readinessScore: 45, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-4);
  });

  it('rewards WHOOP recovery ≥75% with +4', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 80, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(4);
    expect(r.hint).toContain('Recovery 80%');
  });

  it('penalizes WHOOP recovery <33% (red zone) with -5', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 25, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-5);
    expect(r.hint).toContain('red');
  });

  it('penalizes Garmin stress ≥76 with -4', () => {
    const r = aggregateBiometrics({
      garmin: { providerId: 'garmin', stressScore: 80, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-4);
    expect(r.hint).toContain('high');
  });

  it('rewards low Garmin stress (≤25) with +2', () => {
    const r = aggregateBiometrics({
      garmin: { providerId: 'garmin', stressScore: 18, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(2);
    expect(r.hint).toContain('rest');
  });
});

describe('aggregateBiometrics — recovery clamping & multi-signal stacking', () => {
  it('clamps total recovery delta to +10 when many positive signals stack', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 70, sleepHoursLastNight: 8, fetchedAt: t },
      oura: { providerId: 'oura', readinessScore: 90, fetchedAt: t },
      whoop: { providerId: 'whoop', recoveryPct: 85, fetchedAt: t },
    });
    // Raw would be HRV +5, sleep +5, readiness +4, recovery +4 = +18, clamped to +10.
    expect(r.recoveryDelta).toBe(10);
  });

  it('clamps total recovery delta to -10 when many negative signals stack', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 20, sleepHoursLastNight: 3, fetchedAt: t },
      oura: { providerId: 'oura', readinessScore: 40, fetchedAt: t },
      whoop: { providerId: 'whoop', recoveryPct: 20, fetchedAt: t },
      garmin: { providerId: 'garmin', stressScore: 90, fetchedAt: t },
    });
    expect(r.recoveryDelta).toBe(-10);
  });

  it('does not double-count HRV when two providers report it — picks freshest', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', hrvSdnn: 65, fetchedAt: t },
      garmin: { providerId: 'garmin', hrvSdnn: 25, fetchedAt: t + 1000 }, // newer
    });
    // Should use Garmin's 25ms (low) → -5, NOT 65 + 25 = stacked.
    expect(r.recoveryDelta).toBe(-5);
  });

  it('older provider loses to newer provider on the same metric', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', sleepHoursLastNight: 4.5, fetchedAt: t },
      oura: { providerId: 'oura', sleepHoursLastNight: 8, fetchedAt: t + 5000 }, // newer
    });
    // Oura wins → +5 (good sleep), not WHOOP -3 (short sleep).
    expect(r.recoveryDelta).toBe(5);
  });
});

describe('aggregateBiometrics — activity inference', () => {
  it('infers ~7 activity from 10k steps (Google Health Connect)', () => {
    const r = aggregateBiometrics({
      google_health: { providerId: 'google_health', stepsToday: 10000, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
    expect(r.inferredActivityLevel).toBeLessThanOrEqual(7.5);
  });

  it('infers ~5 activity from 7,500 steps', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', stepsToday: 7500, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeCloseTo(5, 1);
  });

  it('infers high activity from WHOOP strain of 14 (≈ strenuous)', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', strain: 14, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThan(6);
  });

  it('infers high activity from a long Strava workout (60min)', () => {
    const r = aggregateBiometrics({
      strava: { providerId: 'strava', workoutMinutesToday: 60, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
  });

  it('takes MAX activity across providers (Strava workout > Apple steps)', () => {
    const r = aggregateBiometrics({
      apple_health: { providerId: 'apple_health', stepsToday: 4000, fetchedAt: t }, // ≈ 2.5
      strava: { providerId: 'strava', workoutMinutesToday: 90, fetchedAt: t },     // ≈ 8.5
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(8);
  });

  it('takes MAX activity across signals on the same provider', () => {
    const r = aggregateBiometrics({
      apple_health: {
        providerId: 'apple_health',
        stepsToday: 1000,
        workoutMinutesToday: 60,
        fetchedAt: t,
      },
    });
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
  });

  it('Strava high training load nudges activity floor (half weight)', () => {
    const r = aggregateBiometrics({
      strava: { providerId: 'strava', trainingLoad: 100, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeGreaterThan(0);
    expect(r.inferredActivityLevel).toBeLessThanOrEqual(5);
  });

  it('clamps inferred activity to 10', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', strain: 21, fetchedAt: t },
      strava: { providerId: 'strava', workoutMinutesToday: 240, fetchedAt: t },
      apple_health: { providerId: 'apple_health', stepsToday: 25000, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBeLessThanOrEqual(10);
  });

  it('returns 0 activity when no activity-related signals are present', () => {
    const r = aggregateBiometrics({
      oura: { providerId: 'oura', hrvSdnn: 55, sleepHoursLastNight: 7, fetchedAt: t },
    });
    expect(r.inferredActivityLevel).toBe(0);
  });
});

describe('aggregateBiometrics — sources & hint', () => {
  it('lists all providers that contributed at least one snapshot', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 70, fetchedAt: t },
      oura: { providerId: 'oura', readinessScore: 80, fetchedAt: t },
      garmin: { providerId: 'garmin', hrvSdnn: 50, fetchedAt: t },
    });
    expect(r.sources.sort()).toEqual(['garmin', 'oura', 'whoop']);
  });

  it('hint summarizes the contributing metrics', () => {
    const r = aggregateBiometrics({
      whoop: { providerId: 'whoop', recoveryPct: 78, sleepHoursLastNight: 7.5, fetchedAt: t },
    });
    expect(r.hint).toContain('Recovery 78%');
    // RC-2 Ruling C, item 3: unit-spacing sweep — 'Sleep 7.5h' -> 'Sleep 7.5 h'.
    expect(r.hint).toContain('Sleep 7.5 h');
  });

  it('shows awaiting-data hint when provider connected but no metric values', () => {
    const r = aggregateBiometrics({
      strava: { providerId: 'strava', fetchedAt: t },
    });
    expect(r.hint).toMatch(/awaiting/i);
    expect(r.recoveryDelta).toBe(0);
  });
});

describe('aggregateBiometrics — realistic multi-provider scenarios', () => {
  it('AForce demo profile (Oura + WHOOP + Strava) — surfaces a coherent recovery boost', () => {
    const r = aggregateBiometrics({
      oura: {
        providerId: 'oura', hrvSdnn: 58, sleepHoursLastNight: 7.4,
        readinessScore: 82, fetchedAt: t,
      },
      whoop: {
        providerId: 'whoop', strain: 14.2, recoveryPct: 71,
        sleepHoursLastNight: 7.1, fetchedAt: t + 1000,
      },
      strava: {
        providerId: 'strava', workoutMinutesToday: 62, trainingLoad: 78, fetchedAt: t,
      },
    });
    expect(r.sources).toContain('oura');
    expect(r.sources).toContain('whoop');
    expect(r.sources).toContain('strava');
    // Strava 62-min workout → activity level ≥ 7 (well above sedentary).
    expect(r.inferredActivityLevel).toBeGreaterThanOrEqual(7);
    // Recovery should be net positive: HRV 58 (+2 mid), sleep 7.1h freshest (+5),
    // readiness 82 (+2), recovery 71 (+1) = +10 clamped.
    expect(r.recoveryDelta).toBeGreaterThan(0);
  });

  it('Bad-night scenario (poor sleep + low HRV across providers) — net negative', () => {
    const r = aggregateBiometrics({
      apple_health: {
        providerId: 'apple_health', hrvSdnn: 25, sleepHoursLastNight: 4.5, fetchedAt: t,
      },
      garmin: {
        providerId: 'garmin', stressScore: 78, fetchedAt: t,
      },
    });
    expect(r.recoveryDelta).toBeLessThan(0);
  });
});

// ─── RC-2 Founder Ruling C — observation-time arbitration ──────────────────
//
// `freshestNonNull` used to compare candidates by `fetchedAt` (sync time)
// alone. A provider whose server merely re-polled and re-stamped UNCHANGED
// data could regain per-field priority purely by having synced more
// recently — exactly what happened on-device: the founder's WHOOP blob (a
// real last-night observation) outvoted a just-synced Apple reading because
// WHOOP's `fetchedAt` had been "restamped" newer, even though WHOOP's own
// underlying observation was hours older. `resolveComparisonTimestamp` now
// resolves each candidate through observedAt -> latestObservedAtMs ->
// fetchedAt before comparing. Every test below passes an explicit `now` as
// `aggregateBiometrics`' second argument for determinism.

describe('aggregateBiometrics — THE DEVICE SCENARIO (Ruling C)', () => {
  it('a just-synced Apple reading beats a WHOOP blob merely re-stamped newer — per FIELD, not per provider', () => {
    const T = 1_700_000_000_000;
    const now = T + 30_000; // WHOOP's server re-polled and restamped fetchedAt to "just now"
    const lastNight = T - 8 * 60 * 60 * 1000; // WHOOP's REAL observation: last night
    const fiveMinAgo = now - 5 * 60 * 1000; // Apple's real HRV observation
    const thisMorning = T - 2 * 60 * 60 * 1000; // Apple's real sleep-end observation

    const r = aggregateBiometrics(
      {
        whoop: {
          providerId: 'whoop',
          hrvSdnn: 59,
          sleepHoursLastNight: 7.8,
          recoveryPct: 95,
          fetchedAt: now, // restamped — but this is SYNC time, not observation time
          latestObservedAtMs: lastNight,
        },
        apple_health: {
          providerId: 'apple_health',
          hrvSdnn: 64.97,
          sleepHoursLastNight: 13.33,
          fetchedAt: T,
          fieldObservedAtMs: {
            hrvSdnn: fiveMinAgo,
            sleepHoursLastNight: thisMorning,
          },
        },
      },
      now,
    );

    // Apple wins hrvSdnn AND sleepHoursLastNight (its per-field observedAt
    // beats WHOOP's snapshot-level latestObservedAtMs on both fields).
    expect(r.hint).toContain('HRV 65 ms (high)'); // Math.round(64.97)
    expect(r.hint).toContain('Sleep 13.3 h');
    expect(r.hint).not.toContain('HRV 59');
    expect(r.hint).not.toContain('Sleep 7.8');

    // WHOOP keeps recoveryPct — Apple never supplied that field, so there
    // is no contest on it; per-field arbitration never touches it.
    expect(r.hint).toContain('Recovery 95%');

    expect(r.sources.sort()).toEqual(['apple_health', 'whoop']);
    // HRV +5 (>=60) + sleep +2 (13.33 lands in the >=6 band) + recovery +4
    // (>=75) = +11, clamped to +10.
    expect(r.recoveryDelta).toBe(10);
  });
});

// #595 verdict, S1: probe G. No prior fixture gave ONE snapshot both a
// per-field observedAt AND a snapshot-level latestObservedAtMs that
// disagree with each other — exactly the real Apple Health shape, where
// `latestObservedAtMs` is the MAX over all of that snapshot's per-field
// times and so is >= any individual field's own observedAt. Tier 1
// (per-field observedAt) must be consulted BEFORE tier 2
// (latestObservedAtMs) in `resolveComparisonTimestamp` — inverting the
// two lets a snapshot's own fresher latestObservedAtMs (driven by some
// OTHER field, e.g. steps) mask a genuinely staler observation on THIS
// field, which is precisely the bug class Ruling C exists to kill (a
// just-synced axis outvoting a real-but-older reading on a different
// axis of the SAME snapshot).
describe('aggregateBiometrics — precedence tier lock (own per-field observedAt beats own latestObservedAtMs)', () => {
  it("a snapshot's per-field observedAt beats its OWN fresher latestObservedAtMs", () => {
    const now = 2_000_000;
    const r = aggregateBiometrics(
      {
        apple_health: {
          providerId: 'apple_health',
          hrvSdnn: 65,
          fetchedAt: now,
          latestObservedAtMs: now, // fresher than WHOOP's below...
          fieldObservedAtMs: { hrvSdnn: now - 500_000 }, // ...but THIS field's own observation is not
        },
        whoop: {
          providerId: 'whoop',
          hrvSdnn: 25,
          fetchedAt: now - 900_000,
          latestObservedAtMs: now - 1_000,
        },
      },
      now,
    );
    // WHOOP wins: its latestObservedAtMs (now - 1_000) is fresher than
    // Apple's own per-field hrvSdnn observedAt (now - 500_000). Under the
    // tier inversion, Apple's snapshot-level latestObservedAtMs (now) would
    // be consulted first and Apple would incorrectly win instead.
    expect(r.hint).toContain('HRV 25 ms'); // WHOOP wins: Apple's per-field HRV is older
    expect(r.hint).not.toContain('HRV 65');
  });
});

// PR #617 follow-up review, S1: the characterization suite was borrowing its
// ordering guarantee from `biometricsAggregator.explainFieldArbitration.test.ts`
// — a tier-1 off-by-one inside `resolveComparisonAxis`
// (`Math.min(fieldObservedAt, now) - 1`) flips a real arbitration winner while
// every test above stays green, because none of them puts a tier-1 candidate
// and a tier-2 candidate exactly 1ms apart. These two tests close that gap
// directly through `aggregateBiometrics`'s own observable output (hint +
// recoveryDelta), so the scoring path locks its own cross-tier ordering
// instead of depending on the diagnostics explainer suite to catch a
// regression here.
//
// Both fixtures list the PRE-mutation LOSER first in the object literal on
// purpose: `freshestNonNull`'s tie rule keeps whichever candidate it meets
// FIRST when two comparison timestamps end up equal. The `-1` mutation drags
// the tier-1 (or tier-2) winner's timestamp down to exactly tie the other
// candidate's — so if the mutation lands, the tie-break silently hands the
// win to the first-listed (correctly-losing) candidate instead of raising an
// error, which is exactly why an assertion on the OUTCOME (not merely "some
// value changed") is required to catch it.
describe('aggregateBiometrics — cross-tier 1ms boundary lock (PR #617 follow-up, S1)', () => {
  it('a tier-1 fieldObservedAt exactly 1ms fresher than a competing tier-2 latestObservedAt still wins', () => {
    const T = 1_700_000_000_000;
    const now = T + 10_000;
    const r = aggregateBiometrics(
      {
        // Listed FIRST: tier-2 candidate, genuinely 1ms staler, must lose.
        garmin: {
          providerId: 'garmin',
          sleepHoursLastNight: 3.5, // deficit band -> -5, distinguishable from apple_health's value/band
          fetchedAt: T,
          latestObservedAtMs: T - 1,
        },
        // Listed SECOND: tier-1 candidate, genuinely 1ms fresher, must win.
        apple_health: {
          providerId: 'apple_health',
          sleepHoursLastNight: 8, // good-sleep band -> +5
          fetchedAt: T,
          fieldObservedAtMs: { sleepHoursLastNight: T },
        },
      },
      now,
    );
    // apple_health's tier-1 T beats garmin's tier-2 T-1 by exactly 1ms.
    expect(r.hint).toContain('Sleep 8.0 h');
    expect(r.hint).not.toContain('Sleep 3.5');
    expect(r.recoveryDelta).toBe(5);
  });

  it('a tier-2 latestObservedAt exactly 1ms fresher than a competing tier-3 fetchedAt still wins', () => {
    const T = 1_700_000_000_000;
    const now = T + 10_000;
    const r = aggregateBiometrics(
      {
        // Listed FIRST: tier-3 (fetchedAt-only) candidate, 1ms staler, must lose.
        oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: T - 1 }, // low HRV -> -5
        // Listed SECOND: tier-2 candidate, 1ms fresher, must win.
        whoop: { providerId: 'whoop', hrvSdnn: 65, fetchedAt: T, latestObservedAtMs: T }, // high HRV -> +5
      },
      now,
    );
    // whoop's tier-2 T beats oura's tier-3 T-1 by exactly 1ms.
    expect(r.hint).toContain('HRV 65 ms (high)');
    expect(r.hint).not.toContain('HRV 20');
    expect(r.recoveryDelta).toBe(5);
  });
});

describe('aggregateBiometrics — per-field split is preserved, never winner-takes-all', () => {
  it('provider A wins one field via observedAt while provider B keeps the other field it alone reports', () => {
    const now = 2_000_000;
    const r = aggregateBiometrics(
      {
        garmin: {
          providerId: 'garmin',
          hrvSdnn: 25, // low -> -5, but should LOSE to oura below
          stressScore: 80, // high -> -4, garmin is the ONLY source for this field
          fetchedAt: now,
          latestObservedAtMs: now - 100_000, // stale real observation
        },
        oura: {
          providerId: 'oura',
          hrvSdnn: 70, // high -> +5, should WIN via a fresher real observation
          fetchedAt: now - 500_000, // older sync time...
          fieldObservedAtMs: { hrvSdnn: now - 1_000 }, // ...but a much fresher observation
        },
      },
      now,
    );
    expect(r.hint).toContain('HRV 70 ms (high)');
    expect(r.hint).not.toContain('HRV 25');
    expect(r.hint).toContain('Stress 80 (high)');
  });

  it('a provider fresher on ONE field only wins only that field — the sibling field is untouched', () => {
    const now = 3_000_000;
    const r = aggregateBiometrics(
      {
        whoop: {
          providerId: 'whoop',
          sleepHoursLastNight: 8, // should win: fresher
          recoveryPct: 20, // WHOOP's only recoveryPct source — always "wins" by default
          fetchedAt: now,
          fieldObservedAtMs: { sleepHoursLastNight: now - 10_000 },
        },
        oura: {
          providerId: 'oura',
          sleepHoursLastNight: 3, // should lose: staler real observation
          fetchedAt: now, // same fetchedAt as WHOOP — would have tied pre-Ruling-C
          fieldObservedAtMs: { sleepHoursLastNight: now - 500_000 },
        },
      },
      now,
    );
    expect(r.hint).toContain('Sleep 8.0 h');
    expect(r.hint).not.toContain('Sleep 3.0');
    expect(r.hint).toContain('Recovery 20%');
  });
});

describe('aggregateBiometrics — fallback chain regression lock (no observation data anywhere)', () => {
  it('behaves EXACTLY as the pre-Ruling-C fetchedAt-only comparator when no snapshot carries observation data', () => {
    // `now` must be at or after both fetchedAt values, or the clamp itself
    // would (correctly, but not what this test is isolating) start
    // affecting the comparison — see the future-timestamp-clamp suite for
    // that behavior on its own.
    const now = t + 10_000;
    // Byte-identical fixture to the pre-existing "older provider loses to
    // newer provider" test above — neither snapshot has fieldObservedAtMs
    // or latestObservedAtMs, so resolveComparisonTimestamp's fallback chain
    // collapses to plain fetchedAt, exactly as before this change.
    const r = aggregateBiometrics(
      {
        whoop: { providerId: 'whoop', sleepHoursLastNight: 4.5, fetchedAt: t },
        oura: { providerId: 'oura', sleepHoursLastNight: 8, fetchedAt: t + 5000 },
      },
      now,
    );
    expect(r.recoveryDelta).toBe(5); // Oura (newer fetchedAt) wins -> +5, not WHOOP's -3
  });
});

describe('aggregateBiometrics — mixed availability (one candidate has observation data, the other only fetchedAt)', () => {
  it('a fetchedAt-only candidate beats a candidate whose OWN latestObservedAtMs is staler than that fetchedAt', () => {
    const now = 5_000_000;
    const r = aggregateBiometrics(
      {
        garmin: { providerId: 'garmin', hrvSdnn: 65, fetchedAt: 4_000_000 }, // no observation fields at all
        oura: {
          providerId: 'oura',
          hrvSdnn: 20,
          fetchedAt: 4_900_000, // a NEWER raw fetchedAt than garmin's...
          latestObservedAtMs: 1_000_000, // ...but a much STALER real observation
        },
      },
      now,
    );
    // Without Ruling C, Oura's larger fetchedAt (4.9M > 4M) would win.
    // With it, Oura's comparison timestamp is its OWN latestObservedAtMs
    // (1M), which loses to Garmin's fetchedAt-only 4M.
    expect(r.hint).toContain('HRV 65 ms (high)');
    expect(r.hint).not.toContain('HRV 20');
  });

  it('a candidate with a fresher latestObservedAtMs beats a fetchedAt-only candidate despite a lower raw fetchedAt', () => {
    const now = 5_000_000;
    const r = aggregateBiometrics(
      {
        garmin: { providerId: 'garmin', hrvSdnn: 65, fetchedAt: 500_000 }, // no observation fields, genuinely old sync
        oura: {
          providerId: 'oura',
          hrvSdnn: 20,
          fetchedAt: 100_000, // a LOWER raw fetchedAt than garmin's...
          latestObservedAtMs: 4_800_000, // ...but a much FRESHER real observation
        },
      },
      now,
    );
    expect(r.hint).toContain('HRV 20 ms (low)');
    expect(r.hint).not.toContain('HRV 65');
  });
});

describe('aggregateBiometrics — ties are deterministic (stable provider order)', () => {
  it('equal comparison timestamps: the FIRST-listed provider wins', () => {
    const now = 1_000_000;
    const r = aggregateBiometrics(
      {
        garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: now, latestObservedAtMs: 900_000 },
        oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now, latestObservedAtMs: 900_000 },
      },
      now,
    );
    // Both resolve to the identical comparison timestamp (900_000). Strict
    // `>` means the first-encountered candidate (garmin, by object key
    // order) keeps the tie.
    expect(r.hint).toContain('HRV 70 ms (high)');
    expect(r.hint).not.toContain('HRV 20');
  });

  it('reversing insertion order flips which provider wins the same tie — proves it is order, not identity', () => {
    const now = 1_000_000;
    const r = aggregateBiometrics(
      {
        oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now, latestObservedAtMs: 900_000 },
        garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: now, latestObservedAtMs: 900_000 },
      },
      now,
    );
    expect(r.hint).toContain('HRV 20 ms (low)');
    expect(r.hint).not.toContain('HRV 70');
  });
});

describe('aggregateBiometrics — future-timestamp clamp', () => {
  it('a far-future observedAt is clamped to `now` — it ties (not beats) a candidate already at `now`, letting insertion order decide', () => {
    const now = 1_000_000;
    // Without the clamp, garmin's raw 900_000_000 timestamp would dwarf
    // oura's now+1 and win regardless of listing order. With the clamp,
    // BOTH collapse to exactly `now` (a tie), so the FIRST-listed
    // candidate (oura) wins — proving the clamp, not raw magnitude,
    // decided this.
    const r = aggregateBiometrics(
      {
        oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now + 1 }, // barely future
        garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: 900_000_000 }, // wildly future (bogus clock)
      },
      now,
    );
    expect(r.hint).toContain('HRV 20 ms (low)');
    expect(r.hint).not.toContain('HRV 70');
  });

  it('a clamped future timestamp can still tie the freshest genuine reading, but never strictly exceeds `now`', () => {
    const now = 1_000_000;
    const r = aggregateBiometrics(
      {
        // Bogus far-future latestObservedAtMs clamps to exactly `now`.
        garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: 1, latestObservedAtMs: 999_999_999 },
        // A genuinely-fresh-right-now real reading also resolves to `now`.
        oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now },
      },
      now,
    );
    // Tie (both clamp to `now`) -> first-listed (garmin) wins. This is the
    // clamp's honest limit: it neutralizes the bogus value's raw-magnitude
    // ADVANTAGE (it can no longer out-rank a genuine `now` reading by
    // sheer epoch size), but a persistent clock-skew bug that keeps
    // re-clamping to a fresh `now` on every call is not detected or
    // repaired here — see this module's header comment.
    expect(r.hint).toContain('HRV 70 ms (high)');
  });
});

describe('buildAppleHealthProviderSnapshot', () => {
  const baseInput: AppleHealthInputs = {
    restingHeartRate: 58,
    hrvSdnn: 45,
    sleepHoursLastNight: 7.2,
    stepsToday: 7200,
    fetchedAt: 1_700_000_000_000,
  };

  it('maps the five legacy fields verbatim and omits fieldObservedAtMs/latestObservedAtMs when absent', () => {
    const snap = buildAppleHealthProviderSnapshot(baseInput);
    expect(snap).toEqual({
      providerId: 'apple_health',
      restingHeartRate: 58,
      hrvSdnn: 45,
      sleepHoursLastNight: 7.2,
      stepsToday: 7200,
      fetchedAt: 1_700_000_000_000,
    });
    expect(snap.fieldObservedAtMs).toBeUndefined();
    expect(snap.latestObservedAtMs).toBeUndefined();
  });

  it('carries only the per-field observedAt values that are actually present', () => {
    const snap = buildAppleHealthProviderSnapshot({
      ...baseInput,
      hrvSdnnObservedAtMs: 1_699_999_000_000,
      sleepHoursLastNightObservedAtMs: 1_699_990_000_000,
      latestObservedAtMs: 1_699_999_000_000,
      // restingHeartRateObservedAtMs / stepsTodayObservedAtMs intentionally absent
    });
    expect(snap.fieldObservedAtMs).toEqual({
      hrvSdnn: 1_699_999_000_000,
      sleepHoursLastNight: 1_699_990_000_000,
    });
    expect(snap.fieldObservedAtMs).not.toHaveProperty('restingHeartRate');
    expect(snap.fieldObservedAtMs).not.toHaveProperty('stepsToday');
    expect(snap.latestObservedAtMs).toBe(1_699_999_000_000);
  });

  it('omits fieldObservedAtMs entirely (not an empty object) when every per-field time is absent', () => {
    const snap = buildAppleHealthProviderSnapshot({ ...baseInput, latestObservedAtMs: 1_699_999_000_000 });
    expect(snap.fieldObservedAtMs).toBeUndefined();
    expect(snap.latestObservedAtMs).toBe(1_699_999_000_000);
  });
});
