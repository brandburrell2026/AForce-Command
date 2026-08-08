/**
 * Biometrics reconciliation — the client owns which providers are linked (its
 * key set); the server fills DATA for those keys. Server-fetched WHOOP data
 * flows in without breaking the disconnect race (a stale server echo can never
 * resurrect a provider the client removed).
 */
import { describe, it, expect } from 'vitest';
import { mergeBiometrics } from '../biometricsMerge';
import type { ProviderBiometrics, ProviderSnapshot } from '../../types';

const snap = (
  providerId: ProviderSnapshot['providerId'],
  fetchedAt: number,
  extra: Partial<ProviderSnapshot> = {},
): ProviderSnapshot => ({ providerId, fetchedAt, ...extra });

describe('mergeBiometrics — client owns keys, server fills data', () => {
  it('returns undefined when the client has no linked providers', () => {
    expect(mergeBiometrics(undefined, undefined)).toBeUndefined();
    expect(mergeBiometrics({ whoop: snap('whoop', 5_000) }, undefined)).toBeUndefined();
  });

  it('keeps a client entry when the server has no data for it', () => {
    const client: ProviderBiometrics = { apple_health: snap('apple_health', 100, { hrvSdnn: 50 }) };
    expect(mergeBiometrics(undefined, client)!.apple_health?.hrvSdnn).toBe(50);
  });

  it('fills a linked key from a STRICTLY fresher server snapshot (the unfreeze)', () => {
    // connect-time placeholder (fetchedAt 0) → real fetched data supersedes it
    const client: ProviderBiometrics = { whoop: snap('whoop', 0, { recoveryPct: null }) };
    const server: ProviderBiometrics = { whoop: snap('whoop', 2_000, { recoveryPct: 28 }) };
    const out = mergeBiometrics(server, client)!;
    expect(out.whoop?.recoveryPct).toBe(28);
    expect(out.whoop?.fetchedAt).toBe(2_000);
  });

  it('keeps the client entry when the server is not strictly fresher (on-device / tie)', () => {
    const client: ProviderBiometrics = { whoop: snap('whoop', 3_000, { recoveryPct: 55 }) };
    expect(mergeBiometrics({ whoop: snap('whoop', 3_000, { recoveryPct: 28 }) }, client)!.whoop?.recoveryPct).toBe(55);
    expect(mergeBiometrics({ whoop: snap('whoop', 1_000, { recoveryPct: 28 }) }, client)!.whoop?.recoveryPct).toBe(55);
  });

  it('DROPS a server-only provider the client has not linked (disconnect race)', () => {
    // Client disconnected oura (only whoop remains); a stale server payload
    // still echoes oura — it must NOT come back.
    const client: ProviderBiometrics = { whoop: snap('whoop', 0) };
    const server: ProviderBiometrics = { whoop: snap('whoop', 2_000, { recoveryPct: 28 }), oura: snap('oura', 2_000) };
    const out = mergeBiometrics(server, client)!;
    expect(out.oura).toBeUndefined();
    expect(out.whoop?.recoveryPct).toBe(28);
  });

  it('a full client disconnect (undefined) is never overwritten by a stale echo', () => {
    expect(mergeBiometrics({ whoop: snap('whoop', 9_999) }, undefined)).toBeUndefined();
  });

  it('preserves a disjoint client provider while filling the linked one', () => {
    const client: ProviderBiometrics = {
      whoop: snap('whoop', 0),
      apple_health: snap('apple_health', 500, { restingHeartRate: 60 }),
    };
    const server: ProviderBiometrics = { whoop: snap('whoop', 2_000, { recoveryPct: 28 }) };
    const out = mergeBiometrics(server, client)!;
    expect(out.whoop?.recoveryPct).toBe(28);
    expect(out.apple_health?.restingHeartRate).toBe(60);
  });

  // RC-2 Founder Ruling C (2026-08-06) — VERIFICATION, not a new fix.
  //
  // Ruling C's app-half brief asked: "could a client-held apple entry with
  // observedAt be overwritten by a server GET /state response lacking it?"
  // Traced end-to-end (api-server/src/lib/aforceState.ts's defaultSeed,
  // hydrationDemandStateAdapter.ts's `consider("apple_health",
  // state.appleHealth)`, and every `updateUserState` call site in
  // api-server/src/routes/**): apple_health is device-native
  // (`sync: 'push_from_device'`) and the server NEVER writes an
  // `apple_health` key into the `biometrics` jsonb blob — only server-polled
  // providers (WHOOP/Oura/Garmin/Strava) land there. `services/realApi.ts`'s
  // `fetchHome` also preserves the legacy `appleHealth` field unconditionally
  // (`userState.appleHealth ?? normalized.appleHealth`), never routing it
  // through this comparator at all.
  //
  // So `sv` (the server's biometrics entry for the `apple_health` key) is
  // always `undefined` today, and `mergeBiometrics`' `sv && ...` short-circuit
  // already keeps the client's entry whole — including any per-field
  // `fieldObservedAtMs` / snapshot-level `latestObservedAtMs` it carries
  // (RC-2 Ruling C, utils/biometricsAggregator.ts). No code change was
  // needed; this test locks the invariant so a FUTURE change that starts
  // mirroring apple_health into the server's biometrics blob doesn't
  // silently reintroduce the drop this ruling was worried about.
  it("a richer apple_health entry (fieldObservedAtMs + latestObservedAtMs) survives a merge where the server has no key for it — RC-2 Ruling C verification", () => {
    const richApple: ProviderBiometrics['apple_health'] = {
      providerId: 'apple_health',
      hrvSdnn: 64.97,
      sleepHoursLastNight: 6.7,
      fetchedAt: 1_700_000_000_000,
      fieldObservedAtMs: { hrvSdnn: 1_699_999_700_000, sleepHoursLastNight: 1_699_990_000_000 },
      latestObservedAtMs: 1_699_999_700_000,
    };
    const client: ProviderBiometrics = { apple_health: richApple };
    // Server's biometrics blob genuinely has no apple_health key at all —
    // the documented, verified real-world shape (see comment above), not a
    // contrived absence.
    const out = mergeBiometrics(undefined, client)!;
    expect(out.apple_health).toEqual(richApple);
    expect(out.apple_health?.fieldObservedAtMs).toEqual({
      hrvSdnn: 1_699_999_700_000,
      sleepHoursLastNight: 1_699_990_000_000,
    });
    expect(out.apple_health?.latestObservedAtMs).toBe(1_699_999_700_000);
  });

  // RC-2 #595 verdict, item N1 — the real "future change" case the test
  // above only gestures at. That test passes `server = undefined`, so the
  // adoption branch (`sv && sv.fetchedAt > cv.fetchedAt ? sv : cv`) never
  // evaluates `sv` at all — it proves the KEEP path, not the ADOPT path.
  // This test exercises ADOPT: the server DOES carry an `apple_health` entry
  // (the hypothetical future mirror the old comment worried about) with a
  // strictly newer `fetchedAt`, but — because that hypothetical mirror
  // pipeline hasn't been built to carry the enrichment through — no
  // `fieldObservedAtMs` / `latestObservedAtMs` of its own.
  //
  // FINDING (RC-2 #595 verdict N1 — reported prominently, not silently
  // enshrined): `mergeBiometrics` is a WHOLE-SNAPSHOT swap per provider id,
  // not a field-level merge (see this file's header: "adopt the server's
  // snapshot for a key"). When the server wins on `fetchedAt`, `out[id] = sv`
  // replaces the ENTIRE client entry — there is no per-field reconciliation
  // to fall back on, so the client's richer observation metadata is DROPPED,
  // not preserved. This test pins that as today's actual, verified behavior.
  // If `mergeBiometrics` is ever upgraded to per-field reconciliation, this
  // assertion should flip alongside the implementation — not be quietly
  // "fixed" by editing the test without touching the code.
  it('FINDING — a fresher-but-thinner server apple_health entry replaces the WHOLE client entry, dropping its richer per-field observation metadata (RC-2 #595 verdict N1)', () => {
    const richClientApple: ProviderBiometrics['apple_health'] = {
      providerId: 'apple_health',
      hrvSdnn: 64.97,
      sleepHoursLastNight: 6.7,
      fetchedAt: 1_700_000_000_000,
      fieldObservedAtMs: { hrvSdnn: 1_699_999_700_000, sleepHoursLastNight: 1_699_990_000_000 },
      latestObservedAtMs: 1_699_999_700_000,
    };
    // A hypothetical future server mirror: genuinely fresher `fetchedAt`,
    // but no per-field observation metadata at all — a thinner snapshot.
    const thinServerApple: ProviderBiometrics['apple_health'] = {
      providerId: 'apple_health',
      hrvSdnn: 58,
      fetchedAt: 1_700_000_100_000, // strictly newer than the client's
    };
    const client: ProviderBiometrics = { apple_health: richClientApple };
    const server: ProviderBiometrics = { apple_health: thinServerApple };
    const out = mergeBiometrics(server, client)!;

    // The server's thin snapshot wins wholesale — today's actual rule.
    expect(out.apple_health).toEqual(thinServerApple);
    expect(out.apple_health?.hrvSdnn).toBe(58);
    // The richer client metadata is GONE, not merged forward.
    expect(out.apple_health?.fieldObservedAtMs).toBeUndefined();
    expect(out.apple_health?.latestObservedAtMs).toBeUndefined();
    expect(out.apple_health?.sleepHoursLastNight).toBeUndefined();
  });
});
