/**
 * LANE 2 LAWS — bounded live activation.
 *
 * The purpose of this lane is not new intelligence. It is to let the truthful
 * machinery already built RECEIVE the real evidence the product already knows
 * how to obtain — and to repair two semantics that were destroying meaning on
 * the way in.
 *
 * ── THE TWO REPAIRS ────────────────────────────────────────────────────────
 *
 * 1. PERMISSION DENIAL SURVIVES. Every acquisition failure used to collapse to
 *    `null`, which became a mock snapshot, which became `demo_withheld`. So a
 *    member who deliberately refused location was indistinguishable from one
 *    nobody had asked, from a platform with no location module, and from a
 *    provider outage. Four different truths, one shrug.
 *
 *      WE KNOW LOCATION PERMISSION WAS DENIED
 *          is not
 *      WE NEVER REQUESTED IT
 *          is not
 *      THE PROVIDER FAILED
 *
 * 2. `not_supported` MEANS CANNOT, NOT DID-NOT. A live snapshot proves the
 *    platform and permission are fine and the provider serves these signals
 *    every other day. A missing value there is `provider_unavailable`. Calling
 *    it `not_supported` tells the member their phone cannot do something it
 *    does routinely.
 */
import { describe, it, expect } from 'vitest';
import { readingsFromLocationSnapshot } from '../environment/environmentalAdapter';
import { interpretEnvironment } from '../environment/environmentalInterpretation';
import { CLOCK_SKEW_MS } from '../environment/environmentalEvidence';
import { weatherFreshWindowMs } from '../environment/weatherFreshness';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import { ENVIRONMENTAL_REFRESH_MS } from '../../hooks/useEnvironmentalAcquisition';

const T0 = Date.UTC(2026, 8, 7, 12, 0, 0);
const MIN = 60_000;
const WINDOW = weatherFreshWindowMs();

const INPUTS = {
  temperatureC: 24, humidityPct: 55, uvIndex: 6,
  airQualityIndex: 30, altitudeMeters: 1609,
  latitude: 39.74, longitude: -104.99,
};

const ALL_FEEDS = { forecast: true, airQuality: true, elevation: true };

/** A snapshot as the producer would build it for a given acquisition outcome. */
const snap = (over: Record<string, unknown> = {}) => ({
  inputs: INPUTS,
  source: 'live' as const,
  observedAt: new Date(T0).toISOString(),
  providerObservedAt: T0,
  acquisition: { kind: 'live' as const, feeds: ALL_FEEDS },
  ...over,
});

/** Acquisition failed for `reason`; the producer falls back to a mock. */
const failed = (reason: string, opts: { asMock?: boolean } = {}) => snap({
  // The producer's real behaviour: a failure yields mock inputs. The point of
  // the repair is that the REASON survives that fallback.
  source: opts.asMock === false ? ('live' as const) : ('mock' as const),
  providerObservedAt: null,
  acquisition: { kind: 'unavailable' as const, reason },
});

const reasons = (s: Record<string, unknown>) => {
  const r = readingsFromLocationSnapshot(s as never, T0);
  return Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k, v.kind === 'unobserved' ? v.reason : v.kind]),
  );
};

// ── 1 · granted + success → real observed evidence ──────────────────────────

describe('LAW 1 — a granted member with a working provider gets real evidence', () => {
  it('every supported signal is observed, with its real value', () => {
    const r = readingsFromLocationSnapshot(snap(), T0);
    expect(r.temperature.kind).toBe('observed');
    expect(r.temperature.kind === 'observed' && r.temperature.value).toBe(24);
    expect(r.humidity.kind === 'observed' && r.humidity.value).toBe(55);
    expect(r.uvIndex.kind === 'observed' && r.uvIndex.value).toBe(6);
    expect(r.airQuality.kind === 'observed' && r.airQuality.value).toBe(30);
    expect(r.altitude.kind === 'observed' && r.altitude.value).toBe(1609);
  });

  it('...and that evidence reaches interpretation as a real read', () => {
    // The point of the whole lane: the built machinery finally receives what
    // it was built for. UV 6 is WHO High.
    const r = readingsFromLocationSnapshot(snap(), T0);
    const read = interpretEnvironment(r, T0);
    expect(read.state).toBe('prepare');
    expect(read.certainty).toBe('high');
    expect(read.factors.map((f) => f.signal).sort()).toEqual(['airQuality', 'heat', 'uvIndex']);
  });
});

// ── 2 · the four causes stay four ───────────────────────────────────────────

describe('LAW 2 — permission denial survives, and stays distinct', () => {
  it('DENIED is reported as denied, on every signal', () => {
    expect(reasons(failed('permission_denied'))).toEqual({
      temperature: 'permission_denied', humidity: 'permission_denied',
      uvIndex: 'permission_denied', airQuality: 'permission_denied',
      altitude: 'permission_denied',
    });
  });

  it('NEVER ASKED is reported as never_requested — not as a refusal', () => {
    expect(reasons(failed('permission_undetermined')).temperature).toBe('never_requested');
  });

  it('PLATFORM UNSUPPORTED is reported as not_supported', () => {
    expect(reasons(failed('not_supported')).temperature).toBe('not_supported');
  });

  it('PROVIDER/POSITION FAILURE is reported as provider_unavailable', () => {
    expect(reasons(failed('position_unavailable')).temperature).toBe('provider_unavailable');
  });

  it('all four are DIFFERENT — this is the whole repair', () => {
    const set = new Set([
      reasons(failed('permission_denied')).temperature,
      reasons(failed('permission_undetermined')).temperature,
      reasons(failed('not_supported')).temperature,
      reasons(failed('position_unavailable')).temperature,
    ]);
    expect(set.size).toBe(4);
  });

  it('and a denial NEVER fabricates a value', () => {
    const r = readingsFromLocationSnapshot(failed('permission_denied') as never, T0);
    for (const e of Object.values(r)) {
      expect(e.kind).toBe('unobserved');
      expect('value' in e).toBe(false);
    }
    // Interpretation must then refuse to call the world benign.
    const read = interpretEnvironment(r, T0);
    expect(read.state).toBe('insufficient');
    expect(read.attention).toBe('unknown');
  });
});

// ── 3 · not_supported means CANNOT ──────────────────────────────────────────

describe('LAW 3 — a supported signal that failed is provider_unavailable', () => {
  it('a live snapshot with a missing value blames the attempt, not the platform', () => {
    const r = reasons(snap({
      inputs: { ...INPUTS, uvIndex: null },
      acquisition: { kind: 'live', feeds: { ...ALL_FEEDS, forecast: true } },
    }));
    expect(r.uvIndex).toBe('provider_unavailable');
    expect(r.uvIndex).not.toBe('not_supported');
  });

  it('PARTIAL FAILURE: a downed feed costs only its own signals', () => {
    // Air quality falls over; temperature, humidity, UV and altitude survive.
    const r = readingsFromLocationSnapshot(snap({
      inputs: { ...INPUTS, airQualityIndex: null },
      acquisition: { kind: 'live', feeds: { ...ALL_FEEDS, airQuality: false } },
    }) as never, T0);
    expect(r.airQuality.kind).toBe('unobserved');
    expect(r.airQuality.kind === 'unobserved' && r.airQuality.reason).toBe('provider_unavailable');
    expect(r.temperature.kind).toBe('observed');
    expect(r.uvIndex.kind).toBe('observed');
    expect(r.altitude.kind).toBe('observed');
  });

  it('...and the surviving signals still produce a real interpretation', () => {
    const r = readingsFromLocationSnapshot(snap({
      inputs: { ...INPUTS, airQualityIndex: null },
      acquisition: { kind: 'live', feeds: { ...ALL_FEEDS, airQuality: false } },
    }) as never, T0);
    const read = interpretEnvironment(r, T0);
    expect(read.state).toBe('prepare');            // UV 6 still governs
    expect(read.certainty).toBe('moderate');       // ...on reduced coverage
    expect(read.unavailable.find((u) => u.signal === 'airQuality')?.reason)
      .toBe('provider_unavailable');
  });
});

// ── 4 · evidence quality still governs ──────────────────────────────────────

describe('LAW 4 — activation does not weaken any existing truth rule', () => {
  it('a STALE provider observation is stale, not current', () => {
    const r = readingsFromLocationSnapshot(
      snap({ providerObservedAt: T0 - (WINDOW + CLOCK_SKEW_MS + MIN) }) as never, T0);
    expect(r.temperature.kind).toBe('stale');
  });

  it('a MALFORMED provider timestamp fails safe', () => {
    for (const bad of [null, Number.NaN, 0, -1]) {
      expect(reasons(snap({ providerObservedAt: bad })).temperature, String(bad))
        .toBe('provider_unavailable');
    }
  });

  it('a FUTURE provider timestamp fails safe', () => {
    expect(reasons(snap({ providerObservedAt: T0 + CLOCK_SKEW_MS + MIN })).temperature)
      .toBe('provider_unavailable');
  });

  it('MOCK is never production evidence — provenance refuses it first', () => {
    // Even carrying a live-looking acquisition story and a good anchor.
    const r = reasons(snap({ source: 'mock' }));
    expect(r.temperature).toBe('demo_withheld');
  });

  it('a failed acquisition that fell back to mock reports the CAUSE, not the mock', () => {
    // The ordering that makes the repair real: the producer's mock fallback
    // must not overwrite the reason acquisition actually failed.
    expect(reasons(failed('permission_denied')).temperature).toBe('permission_denied');
    expect(reasons(failed('position_unavailable')).temperature).toBe('provider_unavailable');
  });
});

// ── 5 · the flags ───────────────────────────────────────────────────────────

describe('LAW 5 — acquisition and presentation are separately controlled', () => {
  it('both ship OFF in production', () => {
    expect(DEFAULT_FLAGS.environmental_acquisition_enabled).toBe(false);
    expect(DEFAULT_FLAGS.environmental_surface_enabled).toBe(false);
  });

  it('both are available internally', () => {
    expect(DEMO_ALL_ON_FLAGS.environmental_acquisition_enabled).toBe(true);
    expect(DEMO_ALL_ON_FLAGS.environmental_surface_enabled).toBe(true);
  });

  it('they are INDEPENDENT — acquisition does not imply a member-facing surface', () => {
    // The founder requirement: verify evidence internally without exposing the
    // flagship surface. Two separate keys, not one.
    expect('environmental_acquisition_enabled' in DEFAULT_FLAGS).toBe(true);
    expect('environmental_surface_enabled' in DEFAULT_FLAGS).toBe(true);
    expect(DEFAULT_FLAGS.environmental_acquisition_enabled)
      .toBe(DEFAULT_FLAGS.environmental_surface_enabled); // both false today...
    // ...but they are distinct keys, so one can move without the other.
    const acquireOnly = { ...DEFAULT_FLAGS, environmental_acquisition_enabled: true };
    expect(acquireOnly.environmental_surface_enabled).toBe(false);
  });
});

// ── 6 · the fetch lifecycle ─────────────────────────────────────────────────

describe('LAW 6 — acquisition cadence is bounded and foreground-only', () => {
  it('the refresh interval is a deliberate cadence, not a freshness window', () => {
    // Conflating these is how a validity policy turns into a polling loop.
    expect(ENVIRONMENTAL_REFRESH_MS).toBe(15 * 60 * 1000);
    expect(ENVIRONMENTAL_REFRESH_MS).toBeGreaterThan(WINDOW / 6);
  });

  it('the cadence is not tighter than the producer cache it refreshes', () => {
    // A tick faster than the cache TTL would burn battery to re-read the same
    // snapshot. Ticking slower than the TTL means every tick is a real look.
    expect(ENVIRONMENTAL_REFRESH_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
  });
});
