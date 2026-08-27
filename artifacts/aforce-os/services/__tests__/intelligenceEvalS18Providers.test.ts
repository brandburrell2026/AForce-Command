/**
 * §18 INTELLIGENCE EVALUATION — tranche 6: provider conflict & dedupe.
 *
 * COMPOSITIONS ONLY over the pure provider seams — the primitives are
 * owned elsewhere and deliberately not duplicated here:
 *   - lib/health-core dedupe.test.ts (keying, provenance, overlap, ladder)
 *   - signalResolution.test.ts (scenarios 6/7/10, score protection)
 *   - validationMatrixDuplicates.test.ts (pair-vs-single identical output)
 *   - biometricsAggregator*.test.ts (freshest-wins tiers, clamps, parity)
 *   - biometricsMerge.test.ts (client-owns-keys, tie strictness)
 *
 * What THIS tranche pins is the §18/§12 scenario layer: order
 * independence end-to-end, never-blend verbatim values, disconnection
 * that never silently deletes history, merge→arbitrate no-op on an old
 * server echo, an older second provider never moving the delta, a
 * connection that never scores by itself, and dedupe idempotence.
 *
 * READ-ONLY discipline: every seam is imported and exercised, never
 * modified. Provider LOGIC stays frozen (Julius's lanes) — these tests
 * observe it.
 */
import { describe, expect, it } from 'vitest';
import { resolveHealthSignals } from '../health/signalResolution';
import {
  OURA_DIRECT_PLUS_VIA_APPLE,
  WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED,
} from '../health/signalResolutionFixtures';
import { dedupeRecords } from '@workspace/health-core';
import { aggregateBiometrics } from '../../utils/biometricsAggregator';
import { mergeBiometrics } from '../../utils/biometricsMerge';
import type { ProviderBiometrics } from '../../types/biometrics';

const T = Date.UTC(2026, 7, 3, 12, 0, 0);

describe('§18 — resolution is order-independent end to end', () => {
  it('reversing the record array changes nothing anywhere in the resolved signals', () => {
    const forward = resolveHealthSignals(OURA_DIRECT_PLUS_VIA_APPLE);
    const reversed = resolveHealthSignals({
      ...OURA_DIRECT_PLUS_VIA_APPLE,
      records: [...(OURA_DIRECT_PLUS_VIA_APPLE.records ?? [])].reverse(),
    });
    expect(reversed).toEqual(forward);
  });
});

describe('§18 — never blend: a resolved value is always one candidate, verbatim', () => {
  it('Oura 50 + its Apple-relayed 53 resolves to exactly 50 — dropped, never averaged', () => {
    const out = resolveHealthSignals(OURA_DIRECT_PLUS_VIA_APPLE);
    expect(out.restingHeartRate.available).toBe(true);
    if (out.restingHeartRate.available) {
      expect(out.restingHeartRate.value).toBe(50);
      expect(out.restingHeartRate.source).toBe('oura');
    }
  });

  it('WHOOP 48 + its platform-exported 50 resolves to exactly 48', () => {
    const out = resolveHealthSignals(WHOOP_DIRECT_PLUS_PLATFORM_EXPORTED);
    expect(out.restingHeartRate.available).toBe(true);
    if (out.restingHeartRate.available) {
      expect(out.restingHeartRate.value).toBe(48);
      expect(out.restingHeartRate.source).toBe('whoop');
    }
  });
});

describe('§12 — disconnection never silently deletes history', () => {
  it('after the direct provider disconnects, the aggregator-relayed copy keeps the family AVAILABLE', () => {
    const disconnected = resolveHealthSignals({
      ...OURA_DIRECT_PLUS_VIA_APPLE,
      // The member disconnected Oura: no active direct connection remains,
      // but the Apple-relayed copy of the same measurement still exists.
      activeDirectProviders: new Set(),
    });
    expect(disconnected.restingHeartRate.available).toBe(true);
    if (disconnected.restingHeartRate.available) {
      // The relayed copy is now the only eligible source — its own sample
      // (53) surfaces, attributed to its true origin. No data hole.
      expect(disconnected.restingHeartRate.value).toBe(53);
      expect(disconnected.restingHeartRate.source).toBe('oura');
    }
  });
});

describe('§18 — a stale server echo through merge is a scoring no-op', () => {
  it('merge(serverOlder, client) then aggregate equals aggregating the client alone', () => {
    const client: ProviderBiometrics = {
      whoop: { providerId: 'whoop', hrvSdnn: 65, fetchedAt: T },
    } as ProviderBiometrics;
    const serverEcho: ProviderBiometrics = {
      whoop: { providerId: 'whoop', hrvSdnn: 22, fetchedAt: T - 3600_000 },
    } as ProviderBiometrics;
    const merged = mergeBiometrics(serverEcho, client);
    expect(aggregateBiometrics(merged, T)).toEqual(aggregateBiometrics(client, T));
  });
});

describe('§18 — a second, older provider on the same signal never moves the delta', () => {
  it('adding stale Garmin HRV beside fresh WHOOP HRV changes nothing', () => {
    const fresh: ProviderBiometrics = {
      whoop: { providerId: 'whoop', hrvSdnn: 65, fetchedAt: T },
    } as ProviderBiometrics;
    const withOlder: ProviderBiometrics = {
      ...fresh,
      garmin: { providerId: 'garmin', hrvSdnn: 22, fetchedAt: T - 6 * 3600_000 },
    } as ProviderBiometrics;
    const a = aggregateBiometrics(fresh, T);
    const b = aggregateBiometrics(withOlder, T);
    expect(b.recoveryDelta).toBe(a.recoveryDelta);
  });
});

describe('§18 — a connection alone never scores', () => {
  it('an all-null placeholder snapshot contributes no recovery delta', () => {
    const placeholder: ProviderBiometrics = {
      whoop: { providerId: 'whoop', fetchedAt: 0 },
    } as ProviderBiometrics;
    const r = aggregateBiometrics(placeholder, T);
    expect(r.recoveryDelta).toBe(0);
  });
});

describe('§18 — dedupe is idempotent on its own output', () => {
  it('running dedupeRecords over its kept set is a fixed point', () => {
    const records = OURA_DIRECT_PLUS_VIA_APPLE.records ?? [];
    const opts = { activeDirectProviders: OURA_DIRECT_PLUS_VIA_APPLE.activeDirectProviders };
    const first = dedupeRecords(records, opts);
    const second = dedupeRecords(first.kept, opts);
    expect(second.kept).toEqual(first.kept);
    expect(second.dropped).toEqual([]);
  });
});
