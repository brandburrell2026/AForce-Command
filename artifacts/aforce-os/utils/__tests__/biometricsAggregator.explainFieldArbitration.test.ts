/**
 * `explainFieldArbitration` — RC-2 founder logging order (build-49 device
 * finding, 2026-08-07). The crown-jewel diagnostic: `freshestNonNull` (this
 * module's private per-field arbitration function) returns only the WINNING
 * VALUE, discarding which provider supplied it and why. This is the read-
 * only, pure explainer that makes that arbitration observable — WHICH
 * provider won `sleepHoursLastNight` / `hrvSdnn`, at what tier
 * ('fieldObservedAt' | 'latestObservedAt' | 'fetchedAt'), and at what
 * timestamp — plus every losing candidate's value/tier/timestamp.
 *
 * PARITY is the whole point: `explainFieldArbitration` must always agree
 * with `freshestNonNull`'s actual winner, because it is a read-only
 * introspection layer over the SAME comparator (`resolveComparisonTimestamp`,
 * reused verbatim, never re-derived). `freshestNonNull` itself is
 * intentionally NOT exported (this file's only new export is
 * `explainFieldArbitration` — see its own doc comment), so parity is proven
 * the way a black-box characterization test proves two code paths agree:
 * through `aggregateBiometrics`'s only observable surface for these two
 * fields — the `hint` string, which embeds `freshestNonNull`'s raw winning
 * value formatted with a known, fixed rule (`Math.round` for HRV,
 * `toFixed(1)` for sleep). Every fixture below picks values that survive
 * that formatting losslessly, so an exact string match IS an exact value
 * match.
 *
 * Every fixture is drawn from (or is a direct variant of) a scenario already
 * proven correct in `biometricsAggregator.test.ts` — this file adds no new
 * arbitration semantics, only a new lens onto existing, already-tested
 * behavior.
 */
import { describe, it, expect } from 'vitest';
import { aggregateBiometrics, explainFieldArbitration } from '../biometricsAggregator';
import type { ProviderBiometrics } from '../../types/biometrics';

/**
 * Assert that `explainFieldArbitration`'s winner agrees with
 * `freshestNonNull`'s winner, observed through `aggregateBiometrics`'s hint
 * text (see file header for why this is a sound black-box parity check).
 * `format` must be the EXACT formatting rule `aggregateBiometrics` applies
 * to this field's value in its hint (Math.round for hrv, toFixed(1) for
 * sleep) — fixtures are chosen so that formatting is lossless.
 */
const FIELD_HINT_PREFIX: Record<'hrvSdnn' | 'sleepHoursLastNight', string> = {
  hrvSdnn: 'HRV',
  sleepHoursLastNight: 'Sleep',
};

function expectParity(
  biometrics: ProviderBiometrics,
  field: 'hrvSdnn' | 'sleepHoursLastNight',
  now: number,
  format: (n: number) => string,
) {
  const explanation = explainFieldArbitration(biometrics, field, now);
  const agg = aggregateBiometrics(biometrics, now);
  const prefix = FIELD_HINT_PREFIX[field];
  expect(explanation.winner).not.toBeNull();
  const formatted = format(explanation.winner!.value);
  expect(agg.hint).toContain(`${prefix} ${formatted}`);
  // Every losing candidate's formatted value must NOT be the value that
  // drove the hint — i.e. explainFieldArbitration's non-winners really did
  // lose, not merely "also happen to be listed".
  for (const c of explanation.candidates) {
    if (c.providerId === explanation.winner!.providerId) continue;
    const losingFormatted = format(c.value);
    if (losingFormatted === formatted) continue; // coincidentally-equal values are not a discriminating case
    expect(agg.hint).not.toContain(`${prefix} ${losingFormatted}`);
  }
}

const roundFmt = (n: number) => String(Math.round(n));
const oneDecimalFmt = (n: number) => n.toFixed(1);

describe('explainFieldArbitration — empty / undefined inputs', () => {
  it('returns { winner: null, candidates: [] } for undefined biometrics', () => {
    expect(explainFieldArbitration(undefined, 'hrvSdnn', Date.now())).toEqual({
      winner: null,
      candidates: [],
    });
  });

  it('returns { winner: null, candidates: [] } for an empty record', () => {
    expect(explainFieldArbitration({}, 'hrvSdnn', Date.now())).toEqual({
      winner: null,
      candidates: [],
    });
  });

  it('skips providers with an undefined snapshot and providers that never report the field', () => {
    const now = 1_000_000;
    const result = explainFieldArbitration(
      {
        oura: undefined,
        strava: { providerId: 'strava', fetchedAt: now }, // connected, but no hrvSdnn field at all
      } as ProviderBiometrics,
      'hrvSdnn',
      now,
    );
    expect(result).toEqual({ winner: null, candidates: [] });
  });
});

describe('explainFieldArbitration — tier classification', () => {
  it('classifies a candidate with a per-field observedAt as tier "fieldObservedAt"', () => {
    const now = 1_000_000;
    const result = explainFieldArbitration(
      {
        apple_health: {
          providerId: 'apple_health',
          hrvSdnn: 65,
          fetchedAt: now,
          fieldObservedAtMs: { hrvSdnn: now - 5_000 },
        },
      },
      'hrvSdnn',
      now,
    );
    expect(result.winner).toEqual({
      providerId: 'apple_health',
      value: 65,
      comparisonTimestampMs: now - 5_000,
      tier: 'fieldObservedAt',
    });
  });

  it('classifies a candidate with only a snapshot-level latestObservedAtMs as tier "latestObservedAt"', () => {
    const now = 1_000_000;
    const result = explainFieldArbitration(
      {
        whoop: {
          providerId: 'whoop',
          hrvSdnn: 59,
          fetchedAt: now,
          latestObservedAtMs: now - 8 * 60 * 60 * 1000,
        },
      },
      'hrvSdnn',
      now,
    );
    expect(result.winner).toEqual({
      providerId: 'whoop',
      value: 59,
      comparisonTimestampMs: now - 8 * 60 * 60 * 1000,
      tier: 'latestObservedAt',
    });
  });

  it('classifies a candidate with neither observation axis as tier "fetchedAt"', () => {
    const now = 1_000_000;
    const result = explainFieldArbitration(
      { garmin: { providerId: 'garmin', hrvSdnn: 50, fetchedAt: now - 1_000 } },
      'hrvSdnn',
      now,
    );
    expect(result.winner).toEqual({
      providerId: 'garmin',
      value: 50,
      comparisonTimestampMs: now - 1_000,
      tier: 'fetchedAt',
    });
  });

  it('clamps a comparisonTimestampMs that would exceed `now` (clock-skew guard, same clamp resolveComparisonTimestamp applies)', () => {
    const now = 1_000_000;
    const result = explainFieldArbitration(
      { garmin: { providerId: 'garmin', hrvSdnn: 50, fetchedAt: now, latestObservedAtMs: 999_999_999 } },
      'hrvSdnn',
      now,
    );
    expect(result.winner?.comparisonTimestampMs).toBe(now);
    expect(result.winner?.tier).toBe('latestObservedAt');
  });
});

describe('explainFieldArbitration — candidates list completeness', () => {
  it('includes every provider that reports the field, winner included, and excludes providers that report null for it', () => {
    const now = 1_000_000;
    const result = explainFieldArbitration(
      {
        garmin: { providerId: 'garmin', hrvSdnn: 25, fetchedAt: now },
        oura: { providerId: 'oura', hrvSdnn: null, fetchedAt: now }, // explicit null -> excluded
        whoop: { providerId: 'whoop', hrvSdnn: 59, fetchedAt: now - 1_000 },
      },
      'hrvSdnn',
      now,
    );
    expect(result.candidates.map((c) => c.providerId).sort()).toEqual(['garmin', 'whoop']);
  });
});

describe('explainFieldArbitration — PARITY with freshestNonNull (via aggregateBiometrics\'s observable hint)', () => {
  it('THE DEVICE SCENARIO (Ruling C): Apple wins hrvSdnn AND sleepHoursLastNight over a WHOOP blob merely re-stamped newer', () => {
    const T = 1_700_000_000_000;
    const now = T + 30_000;
    const lastNight = T - 8 * 60 * 60 * 1000;
    const fiveMinAgo = now - 5 * 60 * 1000;
    const thisMorning = T - 2 * 60 * 60 * 1000;

    const biometrics: ProviderBiometrics = {
      whoop: {
        providerId: 'whoop',
        hrvSdnn: 59,
        sleepHoursLastNight: 7.8,
        recoveryPct: 95,
        fetchedAt: now,
        latestObservedAtMs: lastNight,
      },
      apple_health: {
        providerId: 'apple_health',
        hrvSdnn: 65, // integer, formats losslessly via Math.round
        sleepHoursLastNight: 13.3, // one decimal, formats losslessly via toFixed(1)
        fetchedAt: T,
        fieldObservedAtMs: { hrvSdnn: fiveMinAgo, sleepHoursLastNight: thisMorning },
      },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    const hrvExplanation = explainFieldArbitration(biometrics, 'hrvSdnn', now);
    expect(hrvExplanation.winner?.providerId).toBe('apple_health');
    expect(hrvExplanation.winner?.tier).toBe('fieldObservedAt');

    expectParity(biometrics, 'sleepHoursLastNight', now, oneDecimalFmt);
    const sleepExplanation = explainFieldArbitration(biometrics, 'sleepHoursLastNight', now);
    expect(sleepExplanation.winner?.providerId).toBe('apple_health');
    expect(sleepExplanation.winner?.tier).toBe('fieldObservedAt');
  });

  it('PRECEDENCE TIER LOCK — the mutation-detecting fixture: a snapshot\'s own per-field observedAt beats its OWN fresher latestObservedAtMs', () => {
    // This is the exact scenario a "prefer tier-2" bug (the founder brief's
    // named mutation) would get wrong: apple_health's latestObservedAtMs
    // (`now`) is FRESHER than its own fieldObservedAtMs.hrvSdnn (`now -
    // 500_000`) — if explainFieldArbitration ever preferred tier 2 over
    // tier 1 (instead of reusing resolveComparisonTimestamp's real
    // precedence), apple_health would incorrectly win here instead of whoop.
    const now = 2_000_000;
    const biometrics: ProviderBiometrics = {
      apple_health: {
        providerId: 'apple_health',
        hrvSdnn: 65,
        fetchedAt: now,
        latestObservedAtMs: now,
        fieldObservedAtMs: { hrvSdnn: now - 500_000 },
      },
      whoop: {
        providerId: 'whoop',
        hrvSdnn: 25,
        fetchedAt: now - 900_000,
        latestObservedAtMs: now - 1_000,
      },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    const explanation = explainFieldArbitration(biometrics, 'hrvSdnn', now);
    expect(explanation.winner?.providerId).toBe('whoop');
    expect(explanation.winner?.tier).toBe('latestObservedAt');
    expect(explanation.winner?.comparisonTimestampMs).toBe(now - 1_000);
    // Apple's LOSING candidate reports its own real tier/timestamp — tier 1,
    // not the tier-2 value a "prefer tier-2" bug would have used to win.
    const appleCandidate = explanation.candidates.find((c) => c.providerId === 'apple_health');
    expect(appleCandidate?.tier).toBe('fieldObservedAt');
    expect(appleCandidate?.comparisonTimestampMs).toBe(now - 500_000);
  });

  it('per-field split: a provider fresher on ONE field only wins only that field', () => {
    const now = 2_000_000;
    const biometrics: ProviderBiometrics = {
      garmin: {
        providerId: 'garmin',
        hrvSdnn: 25,
        stressScore: 80,
        fetchedAt: now,
        latestObservedAtMs: now - 100_000,
      },
      oura: {
        providerId: 'oura',
        hrvSdnn: 70,
        fetchedAt: now - 500_000,
        fieldObservedAtMs: { hrvSdnn: now - 1_000 },
      },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    expect(explainFieldArbitration(biometrics, 'hrvSdnn', now).winner?.providerId).toBe('oura');
  });

  it('fallback chain (no observation data anywhere): behaves exactly like the pre-Ruling-C fetchedAt-only comparator', () => {
    const t = 1_700_000_000_000;
    const now = t + 10_000;
    const biometrics: ProviderBiometrics = {
      whoop: { providerId: 'whoop', sleepHoursLastNight: 4.5, fetchedAt: t },
      oura: { providerId: 'oura', sleepHoursLastNight: 8, fetchedAt: t + 5000 },
    };

    expectParity(biometrics, 'sleepHoursLastNight', now, oneDecimalFmt);
    const explanation = explainFieldArbitration(biometrics, 'sleepHoursLastNight', now);
    expect(explanation.winner?.providerId).toBe('oura');
    expect(explanation.winner?.tier).toBe('fetchedAt');
  });

  it('mixed availability: a fetchedAt-only candidate beats a candidate whose own latestObservedAtMs is staler than that fetchedAt', () => {
    const now = 5_000_000;
    const biometrics: ProviderBiometrics = {
      garmin: { providerId: 'garmin', hrvSdnn: 65, fetchedAt: 4_000_000 },
      oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: 4_900_000, latestObservedAtMs: 1_000_000 },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    expect(explainFieldArbitration(biometrics, 'hrvSdnn', now).winner?.providerId).toBe('garmin');
  });

  it('mixed availability (reversed): a candidate with a fresher latestObservedAtMs beats a fetchedAt-only candidate despite a lower raw fetchedAt', () => {
    const now = 5_000_000;
    const biometrics: ProviderBiometrics = {
      garmin: { providerId: 'garmin', hrvSdnn: 65, fetchedAt: 500_000 },
      oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: 100_000, latestObservedAtMs: 4_800_000 },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    expect(explainFieldArbitration(biometrics, 'hrvSdnn', now).winner?.providerId).toBe('oura');
  });

  it('ties are deterministic: equal comparison timestamps -> the FIRST-listed provider wins', () => {
    const now = 1_000_000;
    const biometrics: ProviderBiometrics = {
      garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: now, latestObservedAtMs: 900_000 },
      oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now, latestObservedAtMs: 900_000 },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    const explanation = explainFieldArbitration(biometrics, 'hrvSdnn', now);
    expect(explanation.winner?.providerId).toBe('garmin');
    // Both candidates resolve to the identical comparison timestamp — the
    // tie itself, not a hidden magnitude difference, decided this.
    expect(explanation.candidates.find((c) => c.providerId === 'oura')?.comparisonTimestampMs).toBe(
      explanation.winner?.comparisonTimestampMs,
    );
  });

  it('reversing insertion order on the same tie flips the winner — proves it is order, not identity', () => {
    const now = 1_000_000;
    const biometrics: ProviderBiometrics = {
      oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now, latestObservedAtMs: 900_000 },
      garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: now, latestObservedAtMs: 900_000 },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    expect(explainFieldArbitration(biometrics, 'hrvSdnn', now).winner?.providerId).toBe('oura');
  });

  it('future-timestamp clamp: a far-future fetchedAt is clamped to `now`, ties a candidate already at `now`, and insertion order decides', () => {
    const now = 1_000_000;
    const biometrics: ProviderBiometrics = {
      oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now + 1 },
      garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: 900_000_000 },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    const explanation = explainFieldArbitration(biometrics, 'hrvSdnn', now);
    expect(explanation.winner?.providerId).toBe('oura');
    for (const c of explanation.candidates) {
      expect(c.comparisonTimestampMs).toBeLessThanOrEqual(now);
    }
  });

  it('future-timestamp clamp: a clamped future timestamp can tie the freshest genuine reading, but never strictly exceeds `now`', () => {
    const now = 1_000_000;
    const biometrics: ProviderBiometrics = {
      garmin: { providerId: 'garmin', hrvSdnn: 70, fetchedAt: 1, latestObservedAtMs: 999_999_999 },
      oura: { providerId: 'oura', hrvSdnn: 20, fetchedAt: now },
    };

    expectParity(biometrics, 'hrvSdnn', now, roundFmt);
    const explanation = explainFieldArbitration(biometrics, 'hrvSdnn', now);
    expect(explanation.winner?.providerId).toBe('garmin');
    expect(explanation.winner?.comparisonTimestampMs).toBe(now);
  });
});

describe('explainFieldArbitration — mutation sensitivity documentation', () => {
  // Not an executable mutation test (vitest doesn't run source mutants
  // in-process) — this documents, for the PR's mutation-verify table, which
  // test above catches which class of regression:
  //   - "prefer tier-2 over tier-1" bug -> caught by the PRECEDENCE TIER LOCK
  //     test above (asserts winner === 'whoop', tier === 'latestObservedAt';
  //     the bug would flip both).
  //   - dropping the strict-`>` tie rule for `>=` -> caught by the "reversing
  //     insertion order" test above (both ties would then resolve to the
  //     SAME provider regardless of listing order).
  //   - forgetting the `now` clamp -> caught by both future-timestamp-clamp
  //     tests above (`comparisonTimestampMs` would exceed `now`).
  it('is documentation only — see comment above', () => {
    expect(true).toBe(true);
  });
});
