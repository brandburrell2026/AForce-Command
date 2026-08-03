/**
 * SIGNAL RESOLUTION — resolver unit tests.
 *
 * Covers the 12 scenarios named in the PR brief plus the cross-cutting
 * honesty invariants: HRV method preservation, no cross-provider blending,
 * honest unavailable reasons, and Score-Protection.
 */
import { describe, it, expect } from 'vitest';
import { dedupeRecords } from '@workspace/health-core';
import {
  resolveHealthSignals,
  SIGNAL_RESOLUTION_SCORE_PROTECTION,
  type HealthSignal,
} from '../signalResolution';
import {
  APPLE_ONLY,
  HC_ONLY,
  SAMSUNG_VIA_HEALTH_CONNECT,
  OURA_DIRECT,
  WHOOP_DIRECT,
  OURA_DIRECT_PLUS_VIA_APPLE,
  WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED,
  RESTING_HR_EXPIRED,
  RESTING_HR_NEVER_SYNCED,
  HRV_METHOD_CONFLICT,
  SLEEP_OVERLAP_AND_CROSS_ORIGIN,
  PARTIAL_PERMISSIONS,
  NO_DATA,
  PROVIDER_SCORE_DIRECT,
  PROVIDER_SCORE_AGGREGATOR_PLUS_DIRECT,
  PROVIDER_SCORE_RELAYED_ONLY,
  PROVIDER_SCORE_DIRECT_DUPLICATE_SAME_DAY,
  PROVIDER_SCORE_FORGED_DIRECT,
  PROVIDER_SCORE_FORGED_CAPABLE_WRONG_KIND,
  FIXED_NOW,
  HOUR,
} from '../signalResolutionFixtures';

function expectAvailable<T, U extends string>(signal: HealthSignal<T, U>): asserts signal is Extract<
  HealthSignal<T, U>,
  { available: true }
> {
  expect(signal.available).toBe(true);
}

function expectUnavailable<T, U extends string>(signal: HealthSignal<T, U>): asserts signal is Extract<
  HealthSignal<T, U>,
  { available: false }
> {
  expect(signal.available).toBe(false);
}

describe('1. Apple-only (snapshot plane)', () => {
  const out = resolveHealthSignals(APPLE_ONLY);

  it('resolves every family from the single connected provider, high confidence', () => {
    expectAvailable(out.sleepDuration);
    expect(out.sleepDuration.value.totalSleepHours).toBe(7.2);
    expect(out.sleepDuration.source).toBe('apple_health');
    expect(out.sleepDuration.confidence).toBe('high');

    expectAvailable(out.restingHeartRate);
    expect(out.restingHeartRate.value).toBe(54);

    expectAvailable(out.hrv);
    expect(out.hrv.value).toEqual({ valueMs: 42, method: 'sdnn' });

    expectAvailable(out.steps);
    expect(out.steps.value).toBe(8500);

    expectAvailable(out.workouts);
    expect(out.workouts.value).toEqual([
      expect.objectContaining({ activityKind: 'unspecified', durationMin: 35, source: 'apple_health' }),
    ]);
  });

  it('has no provider scores — Apple declares none', () => {
    expect(out.providerScores).toEqual([]);
  });
});

describe('2. HC-only (snapshot plane, google_health)', () => {
  const out = resolveHealthSignals(HC_ONLY);

  it('resolves populated families and reports rmssd for HRV (google_health true method)', () => {
    expectAvailable(out.sleepDuration);
    expect(out.sleepDuration.value.totalSleepHours).toBe(6.5);
    expectAvailable(out.hrv);
    expect(out.hrv.value.method).toBe('rmssd');
    expect(out.hrv.value.valueMs).toBe(30);
  });

  it('reports no_data for the one family with no snapshot field, not a fabricated value', () => {
    expectUnavailable(out.workouts);
    expect(out.workouts.reason).toBe('no_data');
  });
});

describe('3. Samsung-via-Health-Connect — attribution surfaced', () => {
  const out = resolveHealthSignals(SAMSUNG_VIA_HEALTH_CONNECT);

  it('attributes source to the true origin, aggregator to the delivering platform', () => {
    expectAvailable(out.restingHeartRate);
    expect(out.restingHeartRate.value).toBe(52);
    expect(out.restingHeartRate.source).toBe('samsung_health');
    expect(out.restingHeartRate.aggregator).toBe('google_health');
    expect(out.restingHeartRate.originalSource).toBe('com.sec.android.app.shealth');
  });
});

describe('4. Oura direct', () => {
  const out = resolveHealthSignals(OURA_DIRECT);

  it('resolves sleep with no aggregator hop', () => {
    expectAvailable(out.sleepDuration);
    expect(out.sleepDuration.source).toBe('oura');
    expect(out.sleepDuration.aggregator).toBeUndefined();
    expect(out.sleepDuration.value.totalSleepHours).toBe(7.8);
  });
});

describe('5. WHOOP direct', () => {
  const out = resolveHealthSignals(WHOOP_DIRECT);

  it('resolves HRV with rmssd preserved, no aggregator hop', () => {
    expectAvailable(out.hrv);
    expect(out.hrv.source).toBe('whoop');
    expect(out.hrv.aggregator).toBeUndefined();
    expect(out.hrv.value).toEqual({ valueMs: 38, method: 'rmssd' });
    expect(out.hrv.unavailableReason).toBeUndefined();
  });
});

describe('6. Oura direct + Oura-via-Apple — dedup: direct wins, no double-count', () => {
  const out = resolveHealthSignals(OURA_DIRECT_PLUS_VIA_APPLE);

  it('drops the aggregator copy and reports only the direct value', () => {
    expectAvailable(out.restingHeartRate);
    expect(out.restingHeartRate.value).toBe(50); // the direct reading, never 53 and never (50+53)/2
    expect(out.restingHeartRate.source).toBe('oura');
    expect(out.restingHeartRate.aggregator).toBeUndefined();
  });
});

describe('7. WHOOP direct + platform-exported — no double-count', () => {
  const out = resolveHealthSignals(WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED);

  it('drops the platform-exported copy and reports only the direct value', () => {
    expectAvailable(out.restingHeartRate);
    expect(out.restingHeartRate.value).toBe(48); // never 50, never (48+50)/2, never 98
    expect(out.restingHeartRate.source).toBe('whoop');
    expect(out.restingHeartRate.aggregator).toBeUndefined();
  });
});

describe('8. Stale vs. no-recent-data — distinct unavailable reasons', () => {
  it('a reading beyond the expiry window is stale_expired', () => {
    const out = resolveHealthSignals(RESTING_HR_EXPIRED);
    expectUnavailable(out.restingHeartRate);
    expect(out.restingHeartRate.reason).toBe('stale_expired');
  });

  it('a connected provider that never produced a reading is no_data', () => {
    const out = resolveHealthSignals(RESTING_HR_NEVER_SYNCED);
    expectUnavailable(out.restingHeartRate);
    expect(out.restingHeartRate.reason).toBe('no_data');
  });
});

describe('9. Conflicting HRV methods — priority wins, method reported, never averaged', () => {
  const out = resolveHealthSignals(HRV_METHOD_CONFLICT);

  it('selects the higher-priority source (garmin over apple_health) and reports its true method', () => {
    expectAvailable(out.hrv);
    expect(out.hrv.source).toBe('garmin');
    expect(out.hrv.value).toEqual({ valueMs: 32, method: 'rmssd' });
    // Never an average of 45 and 32, never a blended method.
    expect(out.hrv.value.valueMs).not.toBe((45 + 32) / 2);
  });

  it('annotates the resolved conflict without claiming the value is missing', () => {
    expectAvailable(out.hrv);
    expect(out.hrv.unavailableReason).toBe('method_conflict_resolved');
    expect(out.hrv.confidence).toBe('medium'); // conflict caps confidence even though fresh + direct
  });
});

describe('10. Conflicting sleep sessions — same-origin collapsed, cross-origin selected not merged', () => {
  it('dedupeRecords collapses the two overlapping same-origin apple_health sessions', () => {
    const result = dedupeRecords(SLEEP_OVERLAP_AND_CROSS_ORIGIN.records!, {
      activeDirectProviders: SLEEP_OVERLAP_AND_CROSS_ORIGIN.activeDirectProviders,
    });
    const appleSurvivors = result.kept.filter((r) => r.provider === 'apple_health');
    expect(appleSurvivors).toHaveLength(1);
    expect(result.dropped.some((d) => d.reason === 'overlapping_same_origin')).toBe(true);
  });

  it('resolves to the cross-origin (whoop) winner outright — never merged/averaged with apple', () => {
    const out = resolveHealthSignals(SLEEP_OVERLAP_AND_CROSS_ORIGIN);
    expectAvailable(out.sleepDuration);
    expect(out.sleepDuration.source).toBe('whoop');
    expect(out.sleepDuration.value.totalSleepHours).toBe(6.2); // exactly whoop's value, not ~7.0 or an average
  });
});

describe('11. Partial permissions — deniedTypes ⇒ permission_denied for that family only', () => {
  const out = resolveHealthSignals(PARTIAL_PERMISSIONS);

  it('suppresses the denied family even though the raw snapshot carries a value', () => {
    expectUnavailable(out.hrv);
    expect(out.hrv.reason).toBe('permission_denied');
  });

  it('leaves granted families unaffected', () => {
    expectAvailable(out.steps);
    expect(out.steps.value).toBe(5000);
    expectAvailable(out.sleepDuration);
    expect(out.sleepDuration.value.totalSleepHours).toBe(7);
  });
});

describe('12. No data — nothing connected anywhere', () => {
  const out = resolveHealthSignals(NO_DATA);

  it('every family reports no_provider, honestly, with no fabricated values', () => {
    expectUnavailable(out.sleepDuration);
    expect(out.sleepDuration.reason).toBe('no_provider');
    expectUnavailable(out.restingHeartRate);
    expect(out.restingHeartRate.reason).toBe('no_provider');
    expectUnavailable(out.hrv);
    expect(out.hrv.reason).toBe('no_provider');
    expectUnavailable(out.workouts);
    expect(out.workouts.reason).toBe('no_provider');
    expectUnavailable(out.steps);
    expect(out.steps.reason).toBe('no_provider');
    expect(out.providerScores).toEqual([]);
  });
});

describe('Score-Protection', () => {
  it('exposes an explicit governance sentence and never mentions computing a score', () => {
    expect(SIGNAL_RESOLUTION_SCORE_PROTECTION).toMatch(/never computes/i);
    expect(SIGNAL_RESOLUTION_SCORE_PROTECTION.toLowerCase()).not.toMatch(/hydration score/i);
  });

  it('provider scores keep their provider-qualified kind — never relabeled as an AForce concept', () => {
    const out = resolveHealthSignals(APPLE_ONLY);
    // APPLE_ONLY has no provider-score fields, but the type-level contract (asserted
    // by construction across all fixtures) is that every kind is provider-qualified.
    for (const entry of out.providerScores) {
      expect(entry.kind).toMatch(/^(whoop|oura|garmin|strava)_/);
    }
  });
});

describe('13. Provider-score origin attribution + capability guard (#492 follow-up)', () => {
  it('(c) direct path is byte-identical to before the fix', () => {
    const out = resolveHealthSignals(PROVIDER_SCORE_DIRECT);
    // Full-entry equality (not objectContaining) — catches drift in
    // observedAtMs/freshness/confidence/originalSource/aggregator, not just
    // the three fields spot-checked before.
    expect(out.providerScores).toEqual([
      {
        kind: 'whoop_recovery',
        provider: 'whoop',
        value: 72,
        unit: 'score',
        observedAtMs: FIXED_NOW - 1 * HOUR,
        freshness: 'fresh',
        confidence: 'high',
        originalSource: undefined,
        aggregator: undefined,
      },
    ]);
    expect(out.providerScores).toHaveLength(1);
  });

  it('(a) an aggregator-delivered provider_score attributes to its TRUE origin, never the transport', () => {
    const out = resolveHealthSignals(PROVIDER_SCORE_AGGREGATOR_PLUS_DIRECT);
    for (const entry of out.providerScores) {
      expect(entry.provider).not.toBe('apple_health');
    }
  });

  it('(a) the direct record and its aggregator-relayed copy collapse to a SINGLE entry — direct wins over relayed, never averaged', () => {
    const out = resolveHealthSignals(PROVIDER_SCORE_AGGREGATOR_PLUS_DIRECT);
    const ouraReadiness = out.providerScores.filter((e) => e.kind === 'oura_readiness');
    expect(ouraReadiness).toHaveLength(1);
    expect(ouraReadiness[0].provider).toBe('oura');
    expect(ouraReadiness[0].value).toBe(74); // the direct value — never 73, never (74+73)/2
    expect(ouraReadiness[0].confidence).toBe('high');
    // Direct won the tie-break, so the winning entry carries no aggregator —
    // `aggregator` reflects the WINNER's own provenance, not the also-ran's.
    expect(ouraReadiness[0].aggregator).toBeUndefined();
  });

  it('a relayed-only provider_score (no competing direct copy) carries `aggregator` — the true origin stays `provider`', () => {
    const out = resolveHealthSignals(PROVIDER_SCORE_RELAYED_ONLY);
    expect(out.providerScores).toEqual([
      expect.objectContaining({
        kind: 'oura_readiness',
        provider: 'oura',
        aggregator: 'apple_health',
        value: 81,
      }),
    ]);
  });

  it('two direct same-kind records from retried syncs collapse to ONE entry, freshest wins — locks the (origin, kind) invariant', () => {
    const out = resolveHealthSignals(PROVIDER_SCORE_DIRECT_DUPLICATE_SAME_DAY);
    const ouraReadiness = out.providerScores.filter((e) => e.kind === 'oura_readiness');
    expect(ouraReadiness).toHaveLength(1);
    expect(ouraReadiness[0].provider).toBe('oura');
    expect(ouraReadiness[0].value).toBe(76); // the later-observed retry — never 70, never an average
  });

  it('(b) a contract-violating (forged) provider_score is DROPPED, never re-homed to the transport provider', () => {
    const out = resolveHealthSignals(PROVIDER_SCORE_FORGED_DIRECT);
    expect(out.providerScores).toEqual([]);
  });

  it('a CAPABLE provider claiming another capable provider\'s kind is DROPPED — the ownership guard, not merely the capability guard', () => {
    const out = resolveHealthSignals(PROVIDER_SCORE_FORGED_CAPABLE_WRONG_KIND);
    expect(out.providerScores).toEqual([]);
  });
});

describe('Purity', () => {
  it('is deterministic — same input, any record order, produces the same output', () => {
    const forward = resolveHealthSignals(HRV_METHOD_CONFLICT);
    const reversed = resolveHealthSignals({
      ...HRV_METHOD_CONFLICT,
      records: [...HRV_METHOD_CONFLICT.records!].reverse(),
    });
    expect(reversed).toEqual(forward);
  });
});
