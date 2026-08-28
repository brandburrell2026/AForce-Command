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

describe('freshestBiometricsFetchedAt — S2 observation-axis conservatism (#586 verdict)', () => {
  // The S2 acceptance case, verbatim from the verdict: Apple's HealthKit
  // holds nothing new for two days, but the app re-checked it five minutes
  // ago. The OLD resolver took max(fetchedAt) only and rendered "Checked
  // just now" — the flattering-timestamp inference `providerPresentation.ts`'s
  // honesty rule forbids. The fix must report the OBSERVATION age (2 days),
  // not the sync age (5 minutes).
  it('apple: a fresh sync of a 2-day-old observation reports the observation age, not the sync age', () => {
    const appleHealth = { fetchedAt: NOW - 5 * MINUTE, latestObservedAtMs: NOW - 2 * DAY };
    expect(freshestBiometricsFetchedAt(appleHealth, undefined)).toBe(NOW - 2 * DAY);
  });

  it('apple: the reverse case — a stale sync of fresh-enough observation data still reports honestly (the sync axis is what is old here, so it wins as the conservative/staler bound)', () => {
    // fetchedAt older than latestObservedAtMs would be a data anomaly (you
    // cannot observe something before syncing it), but the resolver stays
    // conservative regardless of which axis is the offender: it always picks
    // the OLDER of the two, never the newer.
    const appleHealth = { fetchedAt: NOW - 3 * DAY, latestObservedAtMs: NOW - 1 * MINUTE };
    expect(freshestBiometricsFetchedAt(appleHealth, undefined)).toBe(NOW - 3 * DAY);
  });

  it('a server provider whose OWN observation axis is fresher than Apple\'s honest recency wins the cross-provider max (aggregation is unaffected by the per-provider axis fix)', () => {
    const appleHealth = { fetchedAt: NOW, latestObservedAtMs: NOW - 2 * DAY }; // honest recency: NOW - 2 * DAY
    const biometrics: ProviderBiometrics = {
      // Sync is an hour old, but the underlying observation is recent —
      // honest recency is min(fetchedAt, observedAt) = NOW - 1 * HOUR here
      // (fetchedAt is the staler of the two for this provider).
      whoop: { providerId: 'whoop', fetchedAt: NOW - 1 * HOUR, latestObservedAtMs: NOW - 5 * MINUTE },
    };
    // Whoop's honest recency (NOW - 1h) is fresher than Apple's (NOW - 2d) —
    // it wins the cross-provider max, exactly like the pre-S2 aggregation
    // already did for raw fetchedAt.
    expect(freshestBiometricsFetchedAt(appleHealth, biometrics)).toBe(NOW - 1 * HOUR);
  });

  it('ProviderSnapshot.fieldObservedAtMs: the best (freshest) populated field wins, not the first or an average', () => {
    const biometrics: ProviderBiometrics = {
      apple_health: {
        providerId: 'apple_health',
        fetchedAt: NOW,
        fieldObservedAtMs: {
          hrvSdnn: NOW - 3 * HOUR,
          sleepHoursLastNight: NOW - 1 * HOUR, // freshest field
          stepsToday: NOW - 5 * HOUR,
        },
      },
    };
    expect(freshestBiometricsFetchedAt(undefined, biometrics)).toBe(NOW - 1 * HOUR);
  });

  it('a provider with fieldObservedAtMs present but ALL entries invalid (sentinel/negative/non-finite) falls back to latestObservedAtMs, then fetchedAt', () => {
    const biometrics: ProviderBiometrics = {
      apple_health: {
        providerId: 'apple_health',
        fetchedAt: NOW - 10 * MINUTE,
        fieldObservedAtMs: { hrvSdnn: 0, stepsToday: -1 },
        latestObservedAtMs: NOW - 1 * HOUR,
      },
    };
    // fieldObservedAtMs entries are all sentinel/negative → ignored →
    // falls back to latestObservedAtMs (NOW - 1h), the staler axis vs.
    // fetchedAt (NOW - 10min).
    expect(freshestBiometricsFetchedAt(undefined, biometrics)).toBe(NOW - 1 * HOUR);
  });

  // Regression-lock: a provider with NEITHER fieldObservedAtMs NOR
  // latestObservedAtMs — i.e. no observation axis at all — must resolve
  // EXACTLY as before this fix: fetchedAt alone. (Already exercised by the
  // plain oura/whoop/garmin fixtures in the describe block above; restated
  // here, explicitly, as the S2 ticket's own named acceptance case.)
  it('a provider with no observation axis at all falls back to fetchedAt, unchanged from pre-S2 behavior', () => {
    const biometrics: ProviderBiometrics = {
      oura: { providerId: 'oura', fetchedAt: NOW - 45 * MINUTE },
    };
    expect(freshestBiometricsFetchedAt(undefined, biometrics)).toBe(NOW - 45 * MINUTE);
  });

  it('the sentinel guard extends to the observation axis: latestObservedAtMs of 0 is rejected exactly like fetchedAt of 0, not treated as epoch-0', () => {
    const appleHealth = { fetchedAt: NOW - 2 * MINUTE, latestObservedAtMs: 0 };
    // observation axis sentinel is rejected → falls back to fetchedAt alone.
    expect(freshestBiometricsFetchedAt(appleHealth, undefined)).toBe(NOW - 2 * MINUTE);
  });

  it('mutation-verify: a resolver reverted to max(fetchedAt)-only reproduces the exact S2 bug on the acceptance fixture', () => {
    // The pre-S2 implementation: ignores every observation axis entirely.
    const preS2 = (
      appleHealth: { fetchedAt: number; latestObservedAtMs?: number } | undefined,
      biometrics: ProviderBiometrics | undefined,
    ): number | null => {
      let freshest: number | null = null;
      const consider = (c: number | null | undefined) => {
        if (c == null || !Number.isFinite(c) || c <= 0) return;
        if (freshest == null || c > freshest) freshest = c;
      };
      consider(appleHealth?.fetchedAt);
      if (biometrics) {
        for (const snap of Object.values(biometrics)) consider(snap?.fetchedAt);
      }
      return freshest;
    };

    const appleHealth = { fetchedAt: NOW - 5 * MINUTE, latestObservedAtMs: NOW - 2 * DAY };
    // The bug: reverted resolver reports the flattering sync age (5 min).
    expect(preS2(appleHealth, undefined)).toBe(NOW - 5 * MINUTE);
    // The fix: honest resolver reports the real observation age (2 days).
    expect(freshestBiometricsFetchedAt(appleHealth, undefined)).toBe(NOW - 2 * DAY);
    expect(freshestBiometricsFetchedAt(appleHealth, undefined)).not.toBe(preS2(appleHealth, undefined));
  });
});

describe('resolveHomeFreshness — graduated, never-fabricated copy', () => {
  it('never fabricates: null fetchedAtMs → the honest "unavailable" state, never an age', () => {
    // CONSCIOUS REPIN (P1 trust set, founder-authorized): "unavailable"
    // ("Awaiting first sync") is now reserved for members WITH provider
    // artifacts and no valid fetch stamp. A never-connected member gets
    // NULL — render nothing — because "Awaiting first sync" was a
    // permanent false promise of a sync that would never come.
    expect(resolveHomeFreshness(NOW, null, true)).toEqual({ key: 'home.v2.freshness.unavailable' });
    expect(resolveHomeFreshness(NOW, null, false)).toBeNull();
    expect(resolveHomeFreshness(NOW, -5, false)).toBeNull();
    expect(resolveHomeFreshness(NOW, Number.NaN, false)).toBeNull();
  });

  it('<2 min → "just_now" (ruling E\'s explicit threshold, wider than the 1-min convention used elsewhere in this codebase)', () => {
    expect(resolveHomeFreshness(NOW, NOW, true)).toEqual({ key: 'home.v2.freshness.just_now' });
    expect(resolveHomeFreshness(NOW, NOW - 1 * MINUTE, true)).toEqual({ key: 'home.v2.freshness.just_now' });
    expect(resolveHomeFreshness(NOW, NOW - (2 * MINUTE - 1), true)).toEqual({ key: 'home.v2.freshness.just_now' });
  });

  it('boundary: exactly 2 minutes old is ALREADY "minutes_ago", not "just_now"', () => {
    expect(resolveHomeFreshness(NOW, NOW - 2 * MINUTE, true)).toEqual({
      key: 'home.v2.freshness.minutes_ago',
      params: { count: 2 },
    });
  });

  it('minutes bucket up to (not including) 60', () => {
    expect(resolveHomeFreshness(NOW, NOW - 30 * MINUTE, true)).toEqual({
      key: 'home.v2.freshness.minutes_ago',
      params: { count: 30 },
    });
    expect(resolveHomeFreshness(NOW, NOW - 59 * MINUTE, true)).toEqual({
      key: 'home.v2.freshness.minutes_ago',
      params: { count: 59 },
    });
  });

  it('boundary: exactly 60 minutes rolls over to hours', () => {
    expect(resolveHomeFreshness(NOW, NOW - 60 * MINUTE, true)).toEqual({
      key: 'home.v2.freshness.hours_ago',
      params: { count: 1 },
    });
  });

  it('hours bucket up to (not including) 24', () => {
    expect(resolveHomeFreshness(NOW, NOW - 5 * HOUR, true)).toEqual({
      key: 'home.v2.freshness.hours_ago',
      params: { count: 5 },
    });
    expect(resolveHomeFreshness(NOW, NOW - 23 * HOUR, true)).toEqual({
      key: 'home.v2.freshness.hours_ago',
      params: { count: 23 },
    });
  });

  // S3 (#586 verdict close-out): the days bucket is renamed `days_ago_stale`
  // — every case that reaches it is, by construction, already past §53's
  // wearable_sync stale boundary (24h, `config/hydroStateModel.ts`, cited
  // not imported — see this resolver's file-header "AXIS POLICY" note) —
  // so the boundary test doubles as proof the explicit-stale key fires
  // exactly where the neutral `days_ago` key used to.
  it('boundary: exactly 24 hours rolls over to the explicit-stale days bucket (S3)', () => {
    expect(resolveHomeFreshness(NOW, NOW - 24 * HOUR, true)).toEqual({
      key: 'home.v2.freshness.days_ago_stale',
      params: { count: 1 },
    });
  });

  it('23h59m59.999s is still the neutral hours bucket, NOT stale — the boundary is exact, one side only (S3)', () => {
    expect(resolveHomeFreshness(NOW, NOW - (24 * HOUR - 1), true)).toEqual({
      key: 'home.v2.freshness.hours_ago',
      params: { count: 23 },
    });
  });

  it('days bucket for very stale data (e.g. permission revoked, no sync in a week) — never an absurd raw hour count', () => {
    expect(resolveHomeFreshness(NOW, NOW - 9 * DAY, true)).toEqual({
      key: 'home.v2.freshness.days_ago_stale',
      params: { count: 9 },
    });
  });

  it('a future fetchedAtMs (clock skew) clamps to "just_now" rather than a negative/garbage age', () => {
    expect(resolveHomeFreshness(NOW, NOW + 5 * MINUTE, true)).toEqual({ key: 'home.v2.freshness.just_now' });
  });

  it('deterministic: never reaches for Date.now() — identical (now, fetchedAtMs) always resolves identically', () => {
    const a = resolveHomeFreshness(NOW, NOW - 47 * MINUTE, true);
    const b = resolveHomeFreshness(NOW, NOW - 47 * MINUTE, true);
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
    const result = resolveHomeFreshness(NOW, 0, true);
    expect(result).toEqual({ key: 'home.v2.freshness.unavailable' });
    // Guard the regression itself: prove 0 would in fact bucket to a
    // multi-thousand-day defect if the epoch-0 guard were absent, so this
    // test is actually exercising the reported symptom and not a strawman.
    expect(Math.floor(NOW / (24 * HOUR))).toBe(20671);
  });

  it('a negative fetchedAtMs (clock corruption / bad restore) also resolves to "unavailable"', () => {
    expect(resolveHomeFreshness(NOW, -1, true)).toEqual({ key: 'home.v2.freshness.unavailable' });
    expect(resolveHomeFreshness(NOW, -86_400_000, true)).toEqual({ key: 'home.v2.freshness.unavailable' });
  });

  // S3 (#586 verdict close-out): the days bucket must never again present as
  // neutrally as `days_ago` did — every case reaching it is already past
  // §53's wearable_sync stale boundary (24h). Mutation-verify: a resolver
  // that still emits the retired `days_ago` key at this exact boundary
  // reproduces the neutral-voice defect S3 closes out.
  it('mutation-verify (S3): a resolver still emitting the retired "days_ago" key at the 24h boundary reproduces the neutral-voice defect', () => {
    const preS3Resolver = (nowArg: number, fetchedAtMs: number): { key: string; params: { count: number } } => {
      const ageMs = Math.max(0, nowArg - fetchedAtMs);
      const days = Math.floor(ageMs / (24 * HOUR));
      return { key: 'home.v2.freshness.days_ago', params: { count: days } };
    };
    const buggyResult = preS3Resolver(NOW, NOW - 24 * HOUR);
    expect(buggyResult).toEqual({ key: 'home.v2.freshness.days_ago', params: { count: 1 } });
    expect(resolveHomeFreshness(NOW, NOW - 24 * HOUR, true)).not.toEqual(buggyResult);
    expect(resolveHomeFreshness(NOW, NOW - 24 * HOUR, true)).toEqual({
      key: 'home.v2.freshness.days_ago_stale',
      params: { count: 1 },
    });
  });
});

describe('mutation-verify: reverting to the static-freshness bug', () => {
  it('a resolver that ignores fetchedAtMs and always returns just_now would fail every non-just_now case above', () => {
    const staticBug = (_now: number, _fetchedAtMs: number | null) => ({ key: 'home.v2.freshness.just_now' as const });
    expect(staticBug(NOW, NOW - 30 * MINUTE)).not.toEqual(resolveHomeFreshness(NOW, NOW - 30 * MINUTE, true));
    expect(staticBug(NOW, NOW - 5 * HOUR)).not.toEqual(resolveHomeFreshness(NOW, NOW - 5 * HOUR, true));
    expect(staticBug(NOW, null)).not.toEqual(resolveHomeFreshness(NOW, null, true));
  });

  // #586 mutation-verify: a resolver with ONLY the pre-fix `Number.isFinite`
  // guard (no `<= 0` check) reproduces the exact rendered-age defect for the
  // sentinel. This encodes "revert the guard → this exact assertion fails"
  // from the fix's own mutation table.
  it('a resolver missing the epoch-0 guard would render the sentinel as a multi-thousand-day age, not "unavailable"', () => {
    // Pre-#586, pre-S3 shape: the historical `days_ago` key name (since
    // renamed to `days_ago_stale`), so this simulated old resolver is typed
    // structurally rather than against the current `HomeFreshness` union.
    const preFixResolver = (
      now: number,
      fetchedAtMs: number | null,
    ): { key: string; params?: { count: number } } => {
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
    expect(resolveHomeFreshness(NOW, 0, true)).not.toEqual(buggyResult);
    expect(resolveHomeFreshness(NOW, 0, true)).toEqual({ key: 'home.v2.freshness.unavailable' });
  });
});
