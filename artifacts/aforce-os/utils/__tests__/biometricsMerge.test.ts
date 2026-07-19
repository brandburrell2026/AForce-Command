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
});
