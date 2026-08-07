import { describe, it, expect } from 'vitest';
import {
  normalizeProviderSnapshot,
  normalizeProviderBiometrics,
  resolveHrv,
  HRV_METHOD_BY_PROVIDER,
} from '../normalize';
import { HEALTH_RECORD_SCHEMA_VERSION } from '../contracts';

const T = 1_754_000_000_000; // fixed clock — no Date.now() anywhere

describe('HRV method preservation (D1: RMSSD is never presented as SDNN)', () => {
  it('WHOOP legacy hrvSdnn (actually RMSSD) lands in hrvRmssdMs, never hrvSdnnMs', () => {
    const s = normalizeProviderSnapshot('whoop', { hrvSdnn: 58, fetchedAt: T })!;
    expect(s.hrvRmssdMs).toBe(58);
    expect(s.hrvSdnnMs).toBeNull();
    expect(s.hrvSdnn).toBe(58); // legacy passthrough byte-identical
  });

  it('Oura legacy hrvSdnn (average_hrv, RMSSD-based) → hrvRmssdMs', () => {
    const s = normalizeProviderSnapshot('oura', { hrvSdnn: 42, fetchedAt: T })!;
    expect(s.hrvRmssdMs).toBe(42);
    expect(s.hrvSdnnMs).toBeNull();
  });

  it('Apple Health HRV is true SDNN → hrvSdnnMs, never hrvRmssdMs', () => {
    const s = normalizeProviderSnapshot('apple_health', { hrvSdnn: 61, fetchedAt: T })!;
    expect(s.hrvSdnnMs).toBe(61);
    expect(s.hrvRmssdMs).toBeNull();
  });

  it('the method table covers every provider and Strava has no HRV', () => {
    expect(Object.keys(HRV_METHOD_BY_PROVIDER).sort()).toEqual([
      'apple_health', 'garmin', 'google_health', 'oura', 'samsung_health', 'strava', 'whoop',
    ]);
    expect(HRV_METHOD_BY_PROVIDER.strava).toBeNull();
  });
});

describe('shipped shape drift is resolved at the boundary', () => {
  it("Garmin `hrvMs` (previously dropped by typed readers) → hrvRmssdMs; legacy hrvSdnn stays null — no NEW mislabel", () => {
    const s = normalizeProviderSnapshot('garmin', { hrvMs: 47, stress: 33, fetchedAt: T })!;
    expect(s.hrvRmssdMs).toBe(47);
    expect(s.hrvSdnn).toBeNull(); // we never copy RMSSD into the SDNN-named legacy field
    expect(s.hrvSdnnMs).toBeNull();
  });

  it('Garmin `stress` → stressScore; declared stressScore wins when both exist', () => {
    expect(normalizeProviderSnapshot('garmin', { stress: 33, fetchedAt: T })!.stressScore).toBe(33);
    expect(
      normalizeProviderSnapshot('garmin', { stress: 33, stressScore: 40, fetchedAt: T })!.stressScore,
    ).toBe(40);
  });

  it('Garmin `steps` (vs stepsToday) is accepted', () => {
    expect(normalizeProviderSnapshot('garmin', { steps: 8100, fetchedAt: T })!.stepsToday).toBe(8100);
    expect(normalizeProviderSnapshot('oura', { stepsToday: 9000, fetchedAt: T })!.stepsToday).toBe(9000);
  });

  it('providerId is re-stamped from the map key; schemaVersion stamped', () => {
    const s = normalizeProviderSnapshot('whoop', { providerId: 'oura', fetchedAt: T })!;
    expect(s.providerId).toBe('whoop');
    expect(s.schemaVersion).toBe(HEALTH_RECORD_SCHEMA_VERSION);
  });

  it('malformed entries are dropped: unknown provider, missing/non-finite fetchedAt', () => {
    expect(normalizeProviderSnapshot('fitbit', { fetchedAt: T })).toBeNull();
    expect(normalizeProviderSnapshot('whoop', { hrvSdnn: 58 })).toBeNull();
    expect(normalizeProviderSnapshot('whoop', { fetchedAt: Number.NaN })).toBeNull();
    expect(normalizeProviderSnapshot('whoop', null)).toBeNull();
  });

  it('non-finite metric values become null — absent stays absent, never a placeholder', () => {
    const s = normalizeProviderSnapshot('whoop', {
      restingHeartRate: Number.POSITIVE_INFINITY, sleepHoursLastNight: 'bad', fetchedAt: T,
    })!;
    expect(s.restingHeartRate).toBeNull();
    expect(s.sleepHoursLastNight).toBeNull();
  });

  it('whole-blob normalization keeps only well-formed entries (realApi parity)', () => {
    const out = normalizeProviderBiometrics({
      whoop: { hrvSdnn: 58, fetchedAt: T },
      junk: { fetchedAt: T },
      oura: { fetchedAt: 'no' },
    })!;
    expect(Object.keys(out)).toEqual(['whoop']);
    expect(normalizeProviderBiometrics({})).toBeUndefined();
    expect(normalizeProviderBiometrics(null)).toBeUndefined();
  });
});

describe('latestObservedAtMs passthrough (Founder Ruling I, RC-2)', () => {
  it('passes through when present and finite on the raw blob', () => {
    const s = normalizeProviderSnapshot('whoop', {
      fetchedAt: T,
      latestObservedAtMs: T - 60_000,
    })!;
    expect(s.latestObservedAtMs).toBe(T - 60_000);
  });

  it('is absent (not null, not fabricated from fetchedAt) when missing on the raw blob — legacy-blob fallback case', () => {
    const s = normalizeProviderSnapshot('whoop', { fetchedAt: T })!;
    expect(s.latestObservedAtMs).toBeUndefined();
    expect('latestObservedAtMs' in s).toBe(false);
  });

  it('non-finite raw values (NaN, string, null) normalize to absent, never leak through', () => {
    expect(
      normalizeProviderSnapshot('whoop', { fetchedAt: T, latestObservedAtMs: Number.NaN })!
        .latestObservedAtMs,
    ).toBeUndefined();
    expect(
      normalizeProviderSnapshot('whoop', {
        fetchedAt: T,
        latestObservedAtMs: '1754000000000' as unknown as number,
      })!.latestObservedAtMs,
    ).toBeUndefined();
  });

  it('does not require latestObservedAtMs to equal or precede fetchedAt — normalize never cross-validates the two', () => {
    // The contract's job is passthrough, not sanity-checking provider clocks;
    // any provider-side skew is a data-quality question for the caller, not
    // something this boundary silently "fixes" by clamping or dropping.
    const s = normalizeProviderSnapshot('oura', {
      fetchedAt: T,
      latestObservedAtMs: T + 1_000,
    })!;
    expect(s.latestObservedAtMs).toBe(T + 1_000);
  });
});

describe('fieldObservedAtMs passthrough (Founder Ruling C, RC-2)', () => {
  it('passes through known keys with finite values', () => {
    const s = normalizeProviderSnapshot('apple_health', {
      fetchedAt: T,
      fieldObservedAtMs: {
        hrvSdnn: T - 5_000,
        restingHeartRate: T - 6_000,
        sleepHoursLastNight: T - 7_000,
        stepsToday: T - 8_000,
      },
    })!;
    expect(s.fieldObservedAtMs).toEqual({
      hrvSdnn: T - 5_000,
      restingHeartRate: T - 6_000,
      sleepHoursLastNight: T - 7_000,
      stepsToday: T - 8_000,
    });
  });

  it('is absent (not an empty object) when missing on the raw blob — legacy-blob fallback case', () => {
    const s = normalizeProviderSnapshot('whoop', { fetchedAt: T })!;
    expect(s.fieldObservedAtMs).toBeUndefined();
    expect('fieldObservedAtMs' in s).toBe(false);
  });

  it('drops unknown keys — an explicit whitelist, not a blind passthrough', () => {
    const s = normalizeProviderSnapshot('apple_health', {
      fetchedAt: T,
      fieldObservedAtMs: { hrvSdnn: T - 1_000, notARealField: T - 2_000, __proto__: 'x' },
    })!;
    expect(s.fieldObservedAtMs).toEqual({ hrvSdnn: T - 1_000 });
  });

  it('drops non-finite per-field values but keeps the well-formed siblings', () => {
    const s = normalizeProviderSnapshot('apple_health', {
      fetchedAt: T,
      fieldObservedAtMs: { hrvSdnn: Number.NaN, stepsToday: T - 1_000, sleepHoursLastNight: 'bad' },
    })!;
    expect(s.fieldObservedAtMs).toEqual({ stepsToday: T - 1_000 });
  });

  it('a non-object fieldObservedAtMs (string, number, null) normalizes to absent, never throws', () => {
    expect(
      normalizeProviderSnapshot('apple_health', { fetchedAt: T, fieldObservedAtMs: 'nope' })!.fieldObservedAtMs,
    ).toBeUndefined();
    expect(
      normalizeProviderSnapshot('apple_health', { fetchedAt: T, fieldObservedAtMs: null })!.fieldObservedAtMs,
    ).toBeUndefined();
  });

  it('an object with every value non-finite normalizes to absent (not an empty object)', () => {
    const s = normalizeProviderSnapshot('apple_health', {
      fetchedAt: T,
      fieldObservedAtMs: { hrvSdnn: Number.NaN },
    })!;
    expect(s.fieldObservedAtMs).toBeUndefined();
  });
});

describe('resolveHrv — the one legacy-compatible HRV read path', () => {
  it('prefers canonical fields and reports no translation', () => {
    const r = resolveHrv({ providerId: 'whoop', hrvRmssdMs: 58, hrvSdnn: 999, fetchedAt: T });
    expect(r).toEqual({ valueMs: 58, method: 'rmssd', legacyTranslated: false });
  });

  it('translates the legacy field per provider method table, flagged as translated', () => {
    expect(resolveHrv({ providerId: 'oura', hrvSdnn: 42, fetchedAt: T })).toEqual({
      valueMs: 42, method: 'rmssd', legacyTranslated: true,
    });
    expect(resolveHrv({ providerId: 'apple_health', hrvSdnn: 61, fetchedAt: T })).toEqual({
      valueMs: 61, method: 'sdnn', legacyTranslated: true,
    });
  });

  it('refuses to guess: no HRV method for the provider ⇒ null (never mislabeled)', () => {
    expect(resolveHrv({ providerId: 'strava', hrvSdnn: 50, fetchedAt: T })).toBeNull();
    expect(resolveHrv({ providerId: 'whoop', fetchedAt: T })).toBeNull();
  });
});
