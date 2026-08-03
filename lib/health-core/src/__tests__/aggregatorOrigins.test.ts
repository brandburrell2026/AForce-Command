/**
 * Cross-platform contract tests for aggregator origin resolution.
 *
 * The thing under test is a TRUST BOUNDARY: HealthKit and Health Connect both
 * hand us records authored by other apps, and the native origin string is the
 * only evidence of who actually measured the data. Two failures matter and are
 * pinned here:
 *   - claiming first-party when we do not know (laundering unattributed data
 *     as platform-native), and
 *   - relabelling a real upstream wearable as the aggregator (destroying hop 0).
 *
 * Every case is deterministic: pure string inputs, no clocks, no I/O.
 */
import { describe, it, expect } from 'vitest';
import type { CanonicalHealthRecord, HealthOriginId, ProvenanceHop } from '../contracts';
import {
  AGGREGATOR_FIRST_PARTY_ORIGINS,
  AGGREGATOR_NEVER_FIRST_PARTY,
  NATIVE_ORIGIN_MAP,
  buildDeduplicationKey,
  isDirect,
  originOf,
  resolveNativeOrigin,
  resolveOriginForAggregator,
  type HealthAggregatorId,
} from '../dedupe';

const AGGREGATORS: readonly HealthAggregatorId[] = ['apple_health', 'google_health'];

const GOOGLE_FIT_PKG = 'com.google.android.apps.fitness';
const OURA_IOS = 'com.ouraring.oura';
const SAMSUNG_ANDROID = 'com.sec.android.app.shealth';
const HEALTH_CONNECT_PKG = 'com.google.android.apps.healthdata';

// ─── Degenerate inputs behave IDENTICALLY on both platforms ──────────────────

describe('resolveOriginForAggregator — cross-platform degenerate-input contract', () => {
  const degenerate: { label: string; input: string | undefined }[] = [
    { label: 'undefined', input: undefined },
    { label: 'empty string', input: '' },
    { label: 'whitespace-only string', input: '   ' },
  ];

  for (const { label, input } of degenerate) {
    it(`${label} ⇒ unknown_device_app for every aggregator (never first-party)`, () => {
      const results = AGGREGATORS.map((a) => resolveOriginForAggregator(a, input));
      expect(results).toEqual(['unknown_device_app', 'unknown_device_app']);
      // The specific failure this guards: absent attribution silently becoming
      // the aggregator id, which would present unattributed data as native.
      expect(results).not.toContain('apple_health');
      expect(results).not.toContain('google_health');
    });
  }

  it('unrecognized junk ⇒ unknown_device_app on both platforms', () => {
    for (const junk of ['not-a-bundle-id', 'com.example.someapp', '💧', 'null', '0']) {
      for (const aggregator of AGGREGATORS) {
        expect(resolveOriginForAggregator(aggregator, junk)).toBe('unknown_device_app');
      }
    }
  });

  it('is pure and total — repeated calls return identical results, nothing throws', () => {
    const inputs: (string | undefined)[] = [undefined, '', '  ', OURA_IOS, GOOGLE_FIT_PKG, 'junk'];
    for (const aggregator of AGGREGATORS) {
      for (const input of inputs) {
        const first = resolveOriginForAggregator(aggregator, input);
        expect(resolveOriginForAggregator(aggregator, input)).toBe(first);
      }
    }
  });
});

// ─── First-party recognition, and its per-platform match policy ──────────────

describe('resolveOriginForAggregator — first-party recognition', () => {
  it('every listed first-party origin resolves to its own aggregator', () => {
    for (const aggregator of AGGREGATORS) {
      for (const entry of AGGREGATOR_FIRST_PARTY_ORIGINS[aggregator]) {
        expect(resolveOriginForAggregator(aggregator, entry)).toBe(aggregator);
      }
    }
  });

  it('Apple: device-sourced com.apple.health.<DEVICE-UUID> resolves apple_health (prefix limb)', () => {
    expect(
      resolveOriginForAggregator('apple_health', 'com.apple.health.4D4E1A2B-0000-4A00-9B00-1C2D3E4F5A6B'),
    ).toBe('apple_health');
    expect(resolveOriginForAggregator('apple_health', 'com.apple.Health.someSubIdentifier')).toBe(
      'apple_health',
    );
  });

  it('Apple: the prefix limb requires a dot boundary — lookalikes are not first-party', () => {
    for (const lookalike of ['com.apple.healthfake', 'com.apple.healthkit-clone', 'com.apple.healt']) {
      expect(resolveOriginForAggregator('apple_health', lookalike)).toBe('unknown_device_app');
    }
  });

  it('Google: EXACT ONLY — a dotted sub-name is NOT first-party Health Connect', () => {
    // Platform asymmetry is intentional: Android has no signing authority over
    // a namespace, so a sideloaded 'com.google.android.apps.healthdata.evil'
    // could exist. Prefix matching there would be an impersonation vector.
    expect(resolveOriginForAggregator('google_health', `${HEALTH_CONNECT_PKG}.evil`)).toBe(
      'unknown_device_app',
    );
    expect(resolveOriginForAggregator('google_health', `${HEALTH_CONNECT_PKG}x`)).toBe(
      'unknown_device_app',
    );
  });

  it('matching is case-sensitive — the safe direction is to under-claim', () => {
    expect(resolveOriginForAggregator('apple_health', 'COM.APPLE.HEALTH')).toBe('unknown_device_app');
    expect(resolveOriginForAggregator('google_health', HEALTH_CONNECT_PKG.toUpperCase())).toBe(
      'unknown_device_app',
    );
  });

  it('untrimmed input is not first-party (no leniency toward the dangerous answer)', () => {
    expect(resolveOriginForAggregator('apple_health', ' com.apple.Health ')).toBe('unknown_device_app');
  });

  it("one aggregator never claims the other's namespace", () => {
    expect(resolveOriginForAggregator('google_health', 'com.apple.Health')).toBe('unknown_device_app');
    expect(resolveOriginForAggregator('apple_health', HEALTH_CONNECT_PKG)).toBe('unknown_device_app');
  });
});

// ─── The Google Fit defect ───────────────────────────────────────────────────

describe('Google Fit is not first-party Health Connect', () => {
  it('com.google.android.apps.fitness ⇒ unknown_device_app on both platforms', () => {
    for (const aggregator of AGGREGATORS) {
      expect(resolveOriginForAggregator(aggregator, GOOGLE_FIT_PKG)).toBe('unknown_device_app');
    }
  });

  it('Fit is absent from the first-party sets and from NATIVE_ORIGIN_MAP', () => {
    for (const aggregator of AGGREGATORS) {
      expect(AGGREGATOR_FIRST_PARTY_ORIGINS[aggregator]).not.toContain(GOOGLE_FIT_PKG);
    }
    expect(Object.keys(NATIVE_ORIGIN_MAP)).not.toContain(GOOGLE_FIT_PKG);
    expect(AGGREGATOR_NEVER_FIRST_PARTY).toContain(GOOGLE_FIT_PKG);
  });

  it('the guard outranks the allow list — Fit stays non-first-party even if wrongly listed', () => {
    // Simulates the exact regression this guard exists to stop: someone adds
    // Fit to the google_health allow list. The guard is consulted first, so
    // the resolution is unchanged.
    const tampered: Record<HealthAggregatorId, readonly string[]> = {
      apple_health: AGGREGATOR_FIRST_PARTY_ORIGINS.apple_health,
      google_health: [...AGGREGATOR_FIRST_PARTY_ORIGINS.google_health, GOOGLE_FIT_PKG],
    };
    expect(tampered.google_health).toContain(GOOGLE_FIT_PKG);
    expect(resolveOriginForAggregator('google_health', GOOGLE_FIT_PKG)).toBe('unknown_device_app');
  });
});

// ─── Upstream providers survive the aggregator hop ───────────────────────────

describe('third-party upstream origins are preserved, never relabelled', () => {
  it('Oura bundle delivered via apple_health ⇒ oura', () => {
    expect(resolveOriginForAggregator('apple_health', OURA_IOS)).toBe('oura');
  });

  it('Samsung package delivered via google_health ⇒ samsung_health', () => {
    expect(resolveOriginForAggregator('google_health', SAMSUNG_ANDROID)).toBe('samsung_health');
  });

  it('EVERY mapped native origin resolves identically through both aggregator paths', () => {
    for (const [nativeOrigin, provider] of Object.entries(NATIVE_ORIGIN_MAP)) {
      for (const aggregator of AGGREGATORS) {
        const resolved = resolveOriginForAggregator(aggregator, nativeOrigin);
        expect(resolved).toBe(provider);
        expect(resolved).not.toBe(aggregator);
      }
    }
  });

  it('delegates to resolveNativeOrigin for everything outside the first-party sets', () => {
    const nonFirstParty = [...Object.keys(NATIVE_ORIGIN_MAP), GOOGLE_FIT_PKG, 'com.example.app'];
    for (const nativeOrigin of nonFirstParty) {
      for (const aggregator of AGGREGATORS) {
        expect(resolveOriginForAggregator(aggregator, nativeOrigin)).toBe(
          resolveNativeOrigin(nativeOrigin),
        );
      }
    }
  });
});

// ─── Existing surface is unchanged ───────────────────────────────────────────

describe('pre-existing exports are behaviourally untouched', () => {
  it('NATIVE_ORIGIN_MAP still holds exactly the ten shipped entries', () => {
    expect(NATIVE_ORIGIN_MAP).toEqual({
      'com.ouraring.oura': 'oura',
      'com.garmin.connect.mobile': 'garmin',
      'com.whoop.iphone': 'whoop',
      'com.samsung.shealth': 'samsung_health',
      'com.strava.stravaride': 'strava',
      'com.ouraring.oura.android': 'oura',
      'com.garmin.android.apps.connectmobile': 'garmin',
      'com.whoop.android': 'whoop',
      'com.sec.android.app.shealth': 'samsung_health',
      'com.strava': 'strava',
    });
  });

  it('resolveNativeOrigin still knows nothing about aggregator first-party ids', () => {
    // The new policy lives entirely in the new function; the old one is
    // deliberately unaware of it.
    for (const aggregator of AGGREGATORS) {
      for (const entry of AGGREGATOR_FIRST_PARTY_ORIGINS[aggregator]) {
        expect(resolveNativeOrigin(entry)).toBe('unknown_device_app');
      }
    }
    expect(resolveNativeOrigin(undefined)).toBe('unknown_device_app');
    expect(resolveNativeOrigin(GOOGLE_FIT_PKG)).toBe('unknown_device_app');
  });

  it('no first-party origin collides with a third-party mapped origin', () => {
    for (const aggregator of AGGREGATORS) {
      for (const entry of AGGREGATOR_FIRST_PARTY_ORIGINS[aggregator]) {
        expect(NATIVE_ORIGIN_MAP[entry]).toBeUndefined();
      }
    }
  });
});

// ─── Provenance preservation (chain construction) ────────────────────────────

/**
 * How a caller is expected to use the resolver: hop 0 is whatever it returns,
 * carrying the raw native origin; hop 1 is the aggregator that delivered it.
 */
function chainViaAggregator(
  aggregator: HealthAggregatorId,
  nativeOrigin: string | undefined,
): ProvenanceHop[] {
  const origin: HealthOriginId = resolveOriginForAggregator(aggregator, nativeOrigin);
  return [
    { provider: origin, ...(nativeOrigin ? { nativeOrigin } : {}), transport: 'measured' },
    { provider: aggregator, transport: 'aggregator_export' },
  ];
}

describe('provenance preservation through the aggregator hop', () => {
  it('Oura-via-HealthKit keeps oura at hop 0, apple_health at hop 1, nativeOrigin retained', () => {
    const chain = chainViaAggregator('apple_health', OURA_IOS);
    const record: CanonicalHealthRecord = {
      schemaVersion: 1,
      userId: 'u1',
      provider: 'apple_health', // delivered BY the aggregator
      originalSource: OURA_IOS,
      metricType: 'sleep_session',
      value: { totalSleepHours: 7.5, inBedHours: 8.1, stages: null },
      startTime: '2026-08-03T02:00:00.000Z',
      endTime: '2026-08-03T09:30:00.000Z',
      observedAt: '2026-08-03T09:30:00.000Z',
      syncedAt: '2026-08-03T12:00:00.000Z',
      provenanceChain: chain,
      deduplicationKey: '',
    };
    record.deduplicationKey = buildDeduplicationKey({
      userId: record.userId,
      metricType: record.metricType,
      origin: originOf(record),
      startTime: record.startTime,
      endTime: record.endTime,
      observedAt: record.observedAt,
    });

    expect(chain[0]).toEqual({ provider: 'oura', nativeOrigin: OURA_IOS, transport: 'measured' });
    expect(chain[1]).toEqual({ provider: 'apple_health', transport: 'aggregator_export' });
    expect(originOf(record)).toBe('oura');
    expect(record.provider).toBe('apple_health');
    expect(isDirect(record)).toBe(false);
    // Identity is keyed on the ORIGIN, so the same night arriving directly from
    // Oura collapses onto this record instead of double-counting.
    expect(record.deduplicationKey).toContain('|oura|');
    expect(record.deduplicationKey).not.toContain('apple_health');
  });

  it('Fit-via-Health-Connect keeps the hop and the raw package, attributed as unknown', () => {
    const chain = chainViaAggregator('google_health', GOOGLE_FIT_PKG);
    expect(chain[0]).toEqual({
      provider: 'unknown_device_app',
      nativeOrigin: GOOGLE_FIT_PKG,
      transport: 'measured',
    });
    expect(chain[1]).toEqual({ provider: 'google_health', transport: 'aggregator_export' });
    // Kept and attributed — the raw package survives for later mapping — but
    // never presented as Health-Connect-native.
    expect(chain[0].nativeOrigin).toBe(GOOGLE_FIT_PKG);
  });

  it('first-party HC data puts google_health at hop 0 AND hop 1', () => {
    const chain = chainViaAggregator('google_health', HEALTH_CONNECT_PKG);
    expect(chain[0].provider).toBe('google_health');
    expect(chain[1].provider).toBe('google_health');
  });
});
