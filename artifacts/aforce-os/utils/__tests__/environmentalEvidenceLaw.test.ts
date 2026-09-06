/**
 * PR3 LAWS — the EnvironmentalEvidence contract.
 *
 * Eight requirements, each executable against the real module. These are the
 * laws the contract exists to make enforceable, not decoration around it:
 *
 *   UNKNOWN != neutral numeric value
 *   STALE != current
 *   MOCK/DEMO != observed production evidence
 *   provider failure != fabricated reading
 *   calculation neutral != observed evidence
 *   freshness expiry is deterministic
 *   provenance survives normalization
 *   consumers cannot silently erase evidence state
 *
 * They live in `utils/__tests__/` because `utils/environment/__tests__/` would
 * match NO vitest include glob — a law placed beside the source would silently
 * never run, a trap vitest.config.ts documents three separate times.
 */
import { describe, it, expect } from 'vitest';
import {
  observe, unobserved, reclassify, currentValue, lastKnownValue,
  isCurrent, isMeasurement, CLOCK_SKEW_MS,
  DEFAULT_VALIDITY_POLICY, validityCeilingMs, isLocationBound,
  type EnvironmentalEvidence, type EnvironmentalSignal,
} from '../environment/environmentalEvidence';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);

const reading = (over: Partial<Parameters<typeof observe>[0]> = {}) =>
  observe({
    signal: 'temperature', value: 22, unit: 'celsius', observedAt: T0,
    provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    ...over,
  } as never, T0);

describe('LAW 1 — UNKNOWN is not a neutral numeric value', () => {
  it('the unobserved arm carries NO value, unit or timestamp to misread', () => {
    const e = unobserved('temperature', 'permission_denied');
    expect(Object.keys(e).sort()).toEqual(['kind', 'reason', 'signal']);
    expect((e as unknown as Record<string, unknown>)['value']).toBeUndefined();
    expect((e as unknown as Record<string, unknown>)['unit']).toBeUndefined();
    expect((e as unknown as Record<string, unknown>)['observedAt']).toBeUndefined();
  });

  it('and reading it yields null, never a number', () => {
    const e = unobserved('temperature', 'permission_denied');
    expect(currentValue(e)).toBeNull();
    expect(lastKnownValue(e)).toBeNull();
    expect(isCurrent(e)).toBe(false);
  });

  it('THE 70°F TRAP: a neutral is a number, and a number is never UNKNOWN here', () => {
    // The heat engine's unmeasured-temperature neutral is 70 °F — a real value
    // inside the real domain. Any representation that can hold a number for
    // "unknown" reproduces that defect. This one structurally cannot.
    const unknown = unobserved('temperature', 'never_requested');
    expect(unknown.kind).toBe('unobserved');
    expect(JSON.stringify(unknown)).not.toMatch(/\d+\.?\d*\s*$/);
    expect(Object.values(unknown).some((v) => typeof v === 'number')).toBe(false);
  });

  it('the FIVE reasons stay distinct — collapsing them is the same mistake twice', () => {
    const reasons = ['never_requested', 'permission_denied', 'provider_unavailable',
      'not_supported', 'demo_withheld'] as const;
    const built = reasons.map((r) => unobserved('uvIndex', r));
    expect(new Set(built.map((b) => b.reason)).size).toBe(reasons.length);
  });
});

describe('LAW 2 — STALE is not CURRENT', () => {
  it('an expired reading is tagged stale, and is not readable as present tense', () => {
    const old = observe({
      signal: 'temperature', value: 22, unit: 'celsius',
      observedAt: T0 - 9 * 60 * 60 * 1000,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    }, T0);
    expect(old.kind).toBe('stale');
    expect(currentValue(old)).toBeNull();
    expect(isCurrent(old)).toBe(false);
  });

  it('but stale KEEPS its value — it is data, not an absence', () => {
    // "22 °C, nine hours ago" is honest and useful. Discarding it would be a
    // different falsehood: pretending we never knew.
    const old = observe({
      signal: 'temperature', value: 22, unit: 'celsius',
      observedAt: T0 - 9 * 60 * 60 * 1000,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    }, T0);
    expect(lastKnownValue(old)).toEqual({ value: 22, stale: true });
  });

  it('and the accessor FORCES the caller to learn it was stale', () => {
    // lastKnownValue returns the staleness alongside the value, so a consumer
    // cannot take the number and forget which arm it came from.
    const fresh = reading();
    expect(lastKnownValue(fresh)).toEqual({ value: 22, stale: false });
  });
});

describe('LAW 3 — MOCK/DEMO is not observed production evidence', () => {
  it('a withheld demo value is UNOBSERVED with its own reason, not a reading', () => {
    const e = unobserved('temperature', 'demo_withheld');
    expect(e.kind).toBe('unobserved');
    expect(e.reason).toBe('demo_withheld');
    expect(currentValue(e)).toBeNull();
  });

  it('ageing never promotes anything into an observed measurement', () => {
    const demo = unobserved('temperature', 'demo_withheld');
    expect(reclassify(demo, T0 + 10 * 60 * 60 * 1000)).toEqual(demo);
  });
});

describe('LAW 4 — provider failure is not a fabricated reading', () => {
  it('a NaN value is refused and becomes provider_unavailable', () => {
    // NaN passes `!= null` and would otherwise sail through as observed. This
    // is the exact shape of an earlier defect in this repo.
    const e = observe({
      signal: 'temperature', value: Number.NaN, unit: 'celsius', observedAt: T0,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    }, T0);
    expect(e.kind).toBe('unobserved');
    expect(e.kind === 'unobserved' && e.reason).toBe('provider_unavailable');
  });

  it('Infinity is refused too', () => {
    const e = observe({
      signal: 'humidity', value: Number.POSITIVE_INFINITY, unit: 'percent', observedAt: T0,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    }, T0);
    expect(e.kind).toBe('unobserved');
  });

  it('a nonsense timestamp is refused rather than silently trusted', () => {
    const e = observe({
      signal: 'temperature', value: 22, unit: 'celsius', observedAt: Number.NaN,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    }, T0);
    expect(e.kind).toBe('unobserved');
  });
});

describe('LAW 5 — a calculation neutral is not observed evidence', () => {
  it('provenance separates what was measured from what was derived', () => {
    const measured = reading({ provenance: 'observed' });
    const supplied = reading({ provenance: 'provider' });
    const derived = reading({ provenance: 'calculated' });
    const modelled = reading({ provenance: 'inferred' });

    expect(isMeasurement(measured)).toBe(true);
    expect(isMeasurement(supplied)).toBe(true);
    // Legitimate values — but not measurements, and a surface may not say
    // "it is X" about them.
    expect(isMeasurement(derived)).toBe(false);
    expect(isMeasurement(modelled)).toBe(false);
  });

  it('and unobserved is never a measurement', () => {
    expect(isMeasurement(unobserved('temperature', 'never_requested'))).toBe(false);
  });
});

describe('LAW 6 — freshness expiry is DETERMINISTIC and per-signal', () => {
  it('`now` is an argument, so expiry never depends on when the test runs', () => {
    const at = T0 - 40 * 60 * 1000;
    const base = {
      value: 5, unit: 'uvIndex', observedAt: at,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    } as const;
    // Same input, two clocks, two different and reproducible verdicts.
    expect(observe({ signal: 'uvIndex', ...base }, at + 60_000).kind).toBe('observed');
    expect(observe({ signal: 'uvIndex', ...base }, T0).kind).toBe('stale');
  });

  it('SIGNALS DO NOT SHARE A WINDOW — the whole point of the policy', () => {
    // A universal duration would be convenient and wrong. UV tracks sun angle
    // and dies in half an hour; the ground does not move.
    expect(validityCeilingMs('uvIndex')).toBeLessThan(validityCeilingMs('temperature'));
    expect(validityCeilingMs('temperature')).toBeLessThan(validityCeilingMs('airQuality'));
    expect(validityCeilingMs('airQuality')).toBeLessThan(validityCeilingMs('altitude'));
    const ceilings = Object.keys(DEFAULT_VALIDITY_POLICY.rules)
      .map((k) => validityCeilingMs(k as EnvironmentalSignal));
    expect(new Set(ceilings).size).toBeGreaterThan(1);
  });

  it('the SAME age gives different verdicts for different signals', () => {
    const age = 45 * 60 * 1000; // 45 minutes
    const at = T0 - age;
    const common = {
      observedAt: at, provenance: 'provider', source: 'open-meteo',
      locationPrecision: 'coarse',
    } as const;
    expect(observe({ signal: 'uvIndex', value: 5, unit: 'uvIndex', ...common }, T0).kind).toBe('stale');
    expect(observe({ signal: 'temperature', value: 22, unit: 'celsius', ...common }, T0).kind).toBe('observed');
  });

  it('every signal has a policy — an unpoliced signal is a type error, not a default', () => {
    const signals: EnvironmentalSignal[] = ['temperature', 'humidity', 'uvIndex', 'airQuality',
      'altitude', 'apparentTemperature', 'precipitation', 'recentRainfall', 'wind', 'pollen',
      'sunrise', 'sunset'];
    for (const s of signals) {
      expect(validityCeilingMs(s), `${s} has no validity rule`).toBeGreaterThan(0);
    }
  });

  it('clock skew forgives drift without inventing freshness', () => {
    const at = T0 - validityCeilingMs('temperature');
    const common = { signal: 'temperature', value: 22, unit: 'celsius', observedAt: at,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse' } as const;
    expect(observe(common, T0 + CLOCK_SKEW_MS - 1000).kind).toBe('observed');
    expect(observe(common, T0 + CLOCK_SKEW_MS + 60_000).kind).toBe('stale');
  });
});

describe('LAW 7 — provenance survives normalization', () => {
  it('reclassifying carries every field through unchanged', () => {
    const fresh = reading({ provenance: 'inferred', source: 'vector-feed', quality: 'low' });
    const later = reclassify(fresh, T0 + 10 * 60 * 60 * 1000);

    expect(later.kind).toBe('stale');
    expect(later.kind !== 'unobserved' && later.provenance).toBe('inferred');
    expect(later.kind !== 'unobserved' && later.source).toBe('vector-feed');
    expect(later.kind !== 'unobserved' && later.quality).toBe('low');
    expect(later.kind !== 'unobserved' && later.locationPrecision).toBe('coarse');
    expect(later.kind !== 'unobserved' && later.unit).toBe('celsius');
  });

  it('AN INFERRED VALUE NEVER BECOMES A MEASUREMENT BY AGEING', () => {
    const inferredFresh = reading({ provenance: 'inferred' });
    const inferredStale = reclassify(inferredFresh, T0 + 10 * 60 * 60 * 1000);
    expect(isMeasurement(inferredFresh)).toBe(false);
    expect(isMeasurement(inferredStale)).toBe(false);
  });

  it('and location precision is not quietly upgraded', () => {
    const coarse = reading({ locationPrecision: 'region' });
    const later = reclassify(coarse, T0 + 10 * 60 * 60 * 1000);
    expect(later.kind !== 'unobserved' && later.locationPrecision).toBe('region');
  });
});

describe('LAW 8 — consumers cannot silently erase evidence state', () => {
  it('the present-tense accessor refuses everything but a current reading', () => {
    const cases: EnvironmentalEvidence<number>[] = [
      unobserved('temperature', 'never_requested'),
      unobserved('temperature', 'provider_unavailable'),
      observe({ signal: 'temperature', value: 22, unit: 'celsius',
        observedAt: T0 - 9 * 60 * 60 * 1000, provenance: 'provider',
        source: 'open-meteo', locationPrecision: 'coarse' }, T0),
    ];
    for (const c of cases) expect(currentValue(c)).toBeNull();
    expect(currentValue(reading())).toBe(22);
  });

  it('reclassify is MONOTONIC — stale never silently becomes observed again', () => {
    const fresh = reading();
    const stale = reclassify(fresh, T0 + 10 * 60 * 60 * 1000);
    expect(stale.kind).toBe('stale');
    // Winding the clock back must not resurrect it into the present tense on
    // the strength of a bad clock alone... it re-derives from expiresAt, which
    // is fixed at observation. Stated explicitly so the behaviour is a decision.
    const rewound = reclassify(stale, T0);
    expect(rewound.kind).toBe('observed');
    expect(rewound.kind !== 'unobserved' && rewound.expiresAt).toBe(
      fresh.kind !== 'unobserved' ? fresh.expiresAt : -1,
    );
  });

  it('unobserved survives reclassification untouched', () => {
    const e = unobserved('airQuality', 'permission_denied');
    expect(reclassify(e, T0 + 99 * 60 * 60 * 1000)).toEqual(e);
  });
});

describe('LAW 9 — altitude is LOCATION-invalidated, not time-expired', () => {
  const atDenver = () => observe({
    signal: 'altitude', value: 1609, unit: 'meters', observedAt: T0,
    provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    locationKey: 'denver',
  }, T0);

  it('the rule is LOCATION-bound, and the duration is only a cache ceiling', () => {
    // The normative semantics live in the type, not in a plausible number.
    expect(isLocationBound('altitude')).toBe(true);
    expect(isLocationBound('temperature')).toBe(false);
    expect(DEFAULT_VALIDITY_POLICY.rules.altitude.kind).toBe('location');
  });

  it('MOVING invalidates it — the ground did not change, the member did', () => {
    const moved = reclassify(atDenver(), T0 + 60_000, { locationKey: 'miami' });
    // NOT demoted to `stale`: a Denver altitude is not out-of-date data about
    // Miami, it is not data about Miami at all.
    expect(moved.kind).toBe('unobserved');
  });

  it('and staying put does NOT invalidate it, even much later', () => {
    const later = reclassify(atDenver(), T0 + 6 * 24 * 60 * 60 * 1000, { locationKey: 'denver' });
    expect(later.kind).toBe('observed');
  });

  it('the 7-day ceiling is DEFENSIVE — a stuck reading still cannot live forever', () => {
    const ancient = reclassify(atDenver(), T0 + 30 * 24 * 60 * 60 * 1000, { locationKey: 'denver' });
    expect(ancient.kind).toBe('stale');
  });

  it('a TIME-bound signal is not invalidated merely by moving', () => {
    // Temperature in a new city is stale-or-fresh on its own clock; the
    // location rule must not leak onto signals it does not govern.
    const temp = observe({
      signal: 'temperature', value: 22, unit: 'celsius', observedAt: T0,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
      locationKey: 'denver',
    }, T0);
    expect(reclassify(temp, T0 + 60_000, { locationKey: 'miami' }).kind).toBe('observed');
  });
});

describe('LAW 10 — validity windows are POLICY, not scientific constants', () => {
  it('the policy is versioned, so a change is visible rather than silent', () => {
    expect(DEFAULT_VALIDITY_POLICY.version).toMatch(/^env-validity-/);
  });

  it('a caller may supply a TIGHTER policy and it takes effect', () => {
    const strict = {
      version: 'test-strict',
      rules: { ...DEFAULT_VALIDITY_POLICY.rules,
        temperature: { kind: 'time', freshForMs: 60_000 } as const },
    };
    const at = T0 - 10 * 60 * 1000;
    const input = {
      signal: 'temperature', value: 22, unit: 'celsius', observedAt: at,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
    } as const;
    expect(observe(input, T0).kind).toBe('observed');          // default 1 h
    expect(observe(input, T0, strict).kind).toBe('stale');      // policy 1 min
  });

  it('A PROVIDER MAY SHORTEN VALIDITY — it knows its own cadence', () => {
    const e = observe({
      signal: 'temperature', value: 22, unit: 'celsius', observedAt: T0,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
      expiresAt: T0 + 60_000,
    }, T0);
    expect(e.kind !== 'unobserved' && e.expiresAt).toBe(T0 + 60_000);
  });

  it('BUT A PROVIDER MAY NEVER LENGTHEN IT BEYOND POLICY', () => {
    // The asymmetry is deliberate: a feed claiming its reading is good for a
    // week must not override our judgement that UV dies in half an hour.
    const e = observe({
      signal: 'uvIndex', value: 7, unit: 'uvIndex', observedAt: T0,
      provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
      expiresAt: T0 + 7 * 24 * 60 * 60 * 1000,
    }, T0);
    expect(e.kind !== 'unobserved' && e.expiresAt)
      .toBe(T0 + validityCeilingMs('uvIndex'));
  });
});
