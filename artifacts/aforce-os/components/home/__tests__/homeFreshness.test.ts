/**
 * homeFreshness — pure resolver coverage (RC-2 ruling E, item 1 — Home
 * truthfulness fix). See `../homeFreshness.ts`'s header for the full trace
 * of why "freshest biometrics fetchedAt" is the honest signal and why the
 * verb is "Checked", not "Updated".
 */
import { describe, it, expect } from 'vitest';
import { freshestBiometricsFetchedAt, resolveHomeFreshness } from '../homeFreshness';
import type { HomeFreshness } from '../homeFreshness';
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

  // #586 verdict: ProfileScreenV2 seeds a client-owned WHOOP merge-key
  // sentinel `{ providerId: 'whoop', fetchedAt: 0, ...all null }` BEFORE the
  // real server snapshot lands (see ProfileScreenV2.tsx's whoopState effect).
  // `fetchedAt: 0` is finite, so a `Number.isFinite`-only guard let it win as
  // if epoch-0 (1970-01-01) were a genuine fetch — rendering as "Checked
  // ~20,672d ago" on an ordinary WHOOP-connected, no-Apple-Health, before-
  // first-sync Home screen.
  it('ignores the fetchedAt:0 merge-key sentinel — epoch-0 is not a real fetch', () => {
    const biometrics: ProviderBiometrics = {
      whoop: {
        providerId: 'whoop',
        fetchedAt: 0,
        recoveryPct: null,
        strain: null,
        sleepHoursLastNight: null,
        hrvSdnn: null,
        restingHeartRate: null,
      },
    };
    expect(freshestBiometricsFetchedAt(undefined, biometrics)).toBeNull();
    expect(freshestBiometricsFetchedAt({ fetchedAt: 0 }, undefined)).toBeNull();
  });

  it('mixed sentinel + one real stamp: the real stamp wins, not the epoch-0 sentinel', () => {
    const biometrics: ProviderBiometrics = {
      whoop: {
        providerId: 'whoop',
        fetchedAt: 0,
        recoveryPct: null,
        strain: null,
        sleepHoursLastNight: null,
        hrvSdnn: null,
        restingHeartRate: null,
      },
      oura: { providerId: 'oura', fetchedAt: NOW - 15 * MINUTE },
    };
    expect(freshestBiometricsFetchedAt(undefined, biometrics)).toBe(NOW - 15 * MINUTE);
  });

  it('a negative fetchedAt (clock corruption / bad restore) is ignored, same as the sentinel', () => {
    expect(freshestBiometricsFetchedAt({ fetchedAt: -1 }, undefined)).toBeNull();
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

  // #586 verdict regression: the client-seeded WHOOP merge-key sentinel
  // (ProfileScreenV2.tsx) passes `fetchedAt: 0` straight through in the
  // WHOOP-connected / no-Apple-Health / before-first-server-snapshot case.
  // `Number.isFinite(0)` is true, so the old guard accepted it as a real
  // stamp: `ageMs = now - 0`, which for this file's fixed `NOW` buckets to
  // `days_ago` with `count` 20,671 — the same order of magnitude as the
  // live-reported "Checked 20672d ago" (that report was taken against the
  // real wall-clock `Date.now()`, one day later than this file's frozen
  // `NOW`; the mechanism, not the exact digit, is what's under test). This
  // must resolve to `unavailable`, never a rendered age.
  it('#586: fetchedAtMs of 0 (the sentinel epoch) resolves to "unavailable", NOT a tens-of-thousands-of-days rendered age', () => {
    const result = resolveHomeFreshness(NOW, 0);
    expect(result).toEqual({ key: 'home.v2.freshness.unavailable' });
    // Guard the regression itself: prove 0 would in fact bucket to a
    // multi-thousand-day defect if the epoch-0 guard were absent, so this
    // test is actually exercising the reported symptom and not a strawman.
    expect(Math.floor(NOW / (24 * HOUR))).toBe(20671);
  });

  it('a negative fetchedAtMs (clock corruption / bad restore) also resolves to "unavailable"', () => {
    expect(resolveHomeFreshness(NOW, -1)).toEqual({ key: 'home.v2.freshness.unavailable' });
    expect(resolveHomeFreshness(NOW, -86_400_000)).toEqual({ key: 'home.v2.freshness.unavailable' });
  });
});

describe('mutation-verify: reverting to the static-freshness bug', () => {
  it('a resolver that ignores fetchedAtMs and always returns just_now would fail every non-just_now case above', () => {
    const staticBug = (_now: number, _fetchedAtMs: number | null) => ({ key: 'home.v2.freshness.just_now' as const });
    expect(staticBug(NOW, NOW - 30 * MINUTE)).not.toEqual(resolveHomeFreshness(NOW, NOW - 30 * MINUTE));
    expect(staticBug(NOW, NOW - 5 * HOUR)).not.toEqual(resolveHomeFreshness(NOW, NOW - 5 * HOUR));
    expect(staticBug(NOW, null)).not.toEqual(resolveHomeFreshness(NOW, null));
  });

  // #586 mutation-verify: a resolver with ONLY the pre-fix `Number.isFinite`
  // guard (no `<= 0` check) reproduces the exact rendered-age defect for the
  // sentinel. This encodes "revert the guard → this exact assertion fails"
  // from the fix's own mutation table.
  it('a resolver missing the epoch-0 guard would render the sentinel as a multi-thousand-day age, not "unavailable"', () => {
    const preFixResolver = (now: number, fetchedAtMs: number | null): HomeFreshness => {
      if (fetchedAtMs == null || !Number.isFinite(fetchedAtMs)) {
        return { key: 'home.v2.freshness.unavailable' };
      }
      const ageMs = Math.max(0, now - fetchedAtMs);
      const days = Math.floor(ageMs / (24 * HOUR));
      return { key: 'home.v2.freshness.days_ago', params: { count: days } };
    };
    const buggyResult = preFixResolver(NOW, 0);
    expect(buggyResult).toEqual({ key: 'home.v2.freshness.days_ago', params: { count: 20671 } });
    // The fixed resolver must NOT reproduce that — this is the assertion a
    // reverted guard is expected to fail.
    expect(resolveHomeFreshness(NOW, 0)).not.toEqual(buggyResult);
    expect(resolveHomeFreshness(NOW, 0)).toEqual({ key: 'home.v2.freshness.unavailable' });
  });
});
