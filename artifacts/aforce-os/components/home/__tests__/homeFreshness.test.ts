/**
 * homeFreshness — pure resolver coverage (RC-2 ruling E, item 1 — Home
 * truthfulness fix). See `../homeFreshness.ts`'s header for the full trace
 * of why "freshest biometrics fetchedAt" is the honest signal and why the
 * verb is "Checked", not "Updated".
 */
import { describe, it, expect } from 'vitest';
import { freshestBiometricsFetchedAt, resolveHomeFreshness } from '../homeFreshness';
import type { ProviderBiometrics } from '@/types';

const NOW = new Date('2026-08-06T12:00:00.000Z').getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('freshestBiometricsFetchedAt', () => {
  it('null when neither appleHealth nor biometrics have ever synced', () => {
    expect(freshestBiometricsFetchedAt(undefined, undefined)).toBeNull();
    expect(freshestBiometricsFetchedAt(null, null)).toBeNull();
    expect(freshestBiometricsFetchedAt(undefined, {})).toBeNull();
  });

  it('uses the legacy appleHealth mirror when biometrics is absent', () => {
    expect(freshestBiometricsFetchedAt({ fetchedAt: NOW - 5 * MINUTE }, undefined)).toBe(NOW - 5 * MINUTE);
  });

  it('uses the freshest of MULTIPLE connected providers, not the first or last', () => {
    const biometrics: ProviderBiometrics = {
      oura: { providerId: 'oura', fetchedAt: NOW - 3 * HOUR },
      whoop: { providerId: 'whoop', fetchedAt: NOW - 10 * MINUTE }, // freshest
      garmin: { providerId: 'garmin', fetchedAt: NOW - 1 * DAY },
    };
    expect(freshestBiometricsFetchedAt(undefined, biometrics)).toBe(NOW - 10 * MINUTE);
  });

  it('takes the max across appleHealth AND biometrics when both are populated independently', () => {
    const biometrics: ProviderBiometrics = {
      whoop: { providerId: 'whoop', fetchedAt: NOW - 2 * HOUR },
    };
    // appleHealth mirror is staler than the direct WHOOP snapshot here.
    expect(freshestBiometricsFetchedAt({ fetchedAt: NOW - 6 * HOUR }, biometrics)).toBe(NOW - 2 * HOUR);
    // ...and the reverse: appleHealth is the freshest.
    expect(freshestBiometricsFetchedAt({ fetchedAt: NOW - 1 * MINUTE }, biometrics)).toBe(NOW - 1 * MINUTE);
  });

  it('ignores non-finite / missing fetchedAt values rather than letting them win as Infinity/NaN', () => {
    const biometrics: ProviderBiometrics = {
      oura: { providerId: 'oura', fetchedAt: Number.NaN as unknown as number },
      whoop: { providerId: 'whoop', fetchedAt: NOW - 20 * MINUTE },
    };
    expect(freshestBiometricsFetchedAt(undefined, biometrics)).toBe(NOW - 20 * MINUTE);
  });
});

describe('resolveHomeFreshness — graduated, never-fabricated copy', () => {
  it('never fabricates: null fetchedAtMs → the honest "unavailable" state, never an age', () => {
    expect(resolveHomeFreshness(NOW, null)).toEqual({ key: 'home.v2.freshness.unavailable' });
  });

  it('<2 min → "just_now" (ruling E\'s explicit threshold, wider than the 1-min convention used elsewhere in this codebase)', () => {
    expect(resolveHomeFreshness(NOW, NOW)).toEqual({ key: 'home.v2.freshness.just_now' });
    expect(resolveHomeFreshness(NOW, NOW - 1 * MINUTE)).toEqual({ key: 'home.v2.freshness.just_now' });
    expect(resolveHomeFreshness(NOW, NOW - (2 * MINUTE - 1))).toEqual({ key: 'home.v2.freshness.just_now' });
  });

  it('boundary: exactly 2 minutes old is ALREADY "minutes_ago", not "just_now"', () => {
    expect(resolveHomeFreshness(NOW, NOW - 2 * MINUTE)).toEqual({
      key: 'home.v2.freshness.minutes_ago',
      params: { count: 2 },
    });
  });

  it('minutes bucket up to (not including) 60', () => {
    expect(resolveHomeFreshness(NOW, NOW - 30 * MINUTE)).toEqual({
      key: 'home.v2.freshness.minutes_ago',
      params: { count: 30 },
    });
    expect(resolveHomeFreshness(NOW, NOW - 59 * MINUTE)).toEqual({
      key: 'home.v2.freshness.minutes_ago',
      params: { count: 59 },
    });
  });

  it('boundary: exactly 60 minutes rolls over to hours', () => {
    expect(resolveHomeFreshness(NOW, NOW - 60 * MINUTE)).toEqual({
      key: 'home.v2.freshness.hours_ago',
      params: { count: 1 },
    });
  });

  it('hours bucket up to (not including) 24', () => {
    expect(resolveHomeFreshness(NOW, NOW - 5 * HOUR)).toEqual({
      key: 'home.v2.freshness.hours_ago',
      params: { count: 5 },
    });
    expect(resolveHomeFreshness(NOW, NOW - 23 * HOUR)).toEqual({
      key: 'home.v2.freshness.hours_ago',
      params: { count: 23 },
    });
  });

  it('boundary: exactly 24 hours rolls over to days', () => {
    expect(resolveHomeFreshness(NOW, NOW - 24 * HOUR)).toEqual({
      key: 'home.v2.freshness.days_ago',
      params: { count: 1 },
    });
  });

  it('days bucket for very stale data (e.g. permission revoked, no sync in a week) — never an absurd raw hour count', () => {
    expect(resolveHomeFreshness(NOW, NOW - 9 * DAY)).toEqual({
      key: 'home.v2.freshness.days_ago',
      params: { count: 9 },
    });
  });

  it('a future fetchedAtMs (clock skew) clamps to "just_now" rather than a negative/garbage age', () => {
    expect(resolveHomeFreshness(NOW, NOW + 5 * MINUTE)).toEqual({ key: 'home.v2.freshness.just_now' });
  });

  it('deterministic: never reaches for Date.now() — identical (now, fetchedAtMs) always resolves identically', () => {
    const a = resolveHomeFreshness(NOW, NOW - 47 * MINUTE);
    const b = resolveHomeFreshness(NOW, NOW - 47 * MINUTE);
    expect(a).toEqual(b);
  });
});

describe('mutation-verify: reverting to the static-freshness bug', () => {
  it('a resolver that ignores fetchedAtMs and always returns just_now would fail every non-just_now case above', () => {
    const staticBug = (_now: number, _fetchedAtMs: number | null) => ({ key: 'home.v2.freshness.just_now' as const });
    expect(staticBug(NOW, NOW - 30 * MINUTE)).not.toEqual(resolveHomeFreshness(NOW, NOW - 30 * MINUTE));
    expect(staticBug(NOW, NOW - 5 * HOUR)).not.toEqual(resolveHomeFreshness(NOW, NOW - 5 * HOUR));
    expect(staticBug(NOW, null)).not.toEqual(resolveHomeFreshness(NOW, null));
  });
});
