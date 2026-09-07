/**
 * THE PROVIDER'S ASSERTION — environmental evidence ages from when the world
 * was measured, not from when we started asking.
 *
 * The contract says `observedAt` is "when the provider says the value was
 * true" (environmentalEvidence.ts). Both producers were substituting a device
 * clock:
 *
 *   locationIntelligenceService  captured `now` BEFORE the permission prompt,
 *                                the GPS fix and three network fetches
 *   cityClimateService           stamped at response-parse time
 *
 * and both requested `&current=…`, whose response carries Open-Meteo's own
 * `current.time` — which neither declared nor read.
 *
 * The error ran one direction ALWAYS: every reading aged from an instant
 * earlier than its own measurement, so permission and network latency made
 * evidence look FRESHER than it was. On a slow cold start — an OS dialog, a
 * GPS acquisition, three round trips — that is not milliseconds.
 *
 * The repair separates two facts that were one field:
 *
 *   observedAt          the DEVICE instant we looked — travel anchoring only
 *   providerObservedAt  the PROVIDER's instant — the only evidence anchor
 *
 * and when a provider declares nothing, the answer is null. Unageable evidence
 * cannot be called current, so it is refused rather than back-filled.
 */
import { describe, it, expect } from 'vitest';
import {
  readingsFromLocationSnapshot,
  readingsFromCityClimate,
  toLegacyReading,
} from '../environment/environmentalAdapter';
import { oldestProviderInstantMs, buildSnapshot } from '../../services/locationIntelligenceService';
import { providerInstantMs, buildMockClimate } from '../../services/cityClimateService';
import { CLOCK_SKEW_MS, lastKnownValue } from '../environment/environmentalEvidence';
import { weatherFreshWindowMs } from '../environment/weatherFreshness';

const T0 = Date.UTC(2026, 8, 7, 12, 0, 0);
const MIN = 60_000;
const WINDOW = weatherFreshWindowMs();
const sec = (ms: number) => ms / 1000;

const snapshot = (over: Record<string, unknown> = {}) => ({
  inputs: {
    temperatureC: 24, humidityPct: 55, uvIndex: 6,
    airQualityIndex: 30, altitudeMeters: 1609,
    latitude: 39.74, longitude: -104.99,
  },
  source: 'live' as const,
  // The DEVICE instant. Deliberately "now" in most fixtures, so a test that
  // passes only because the two happen to agree cannot hide here.
  observedAt: new Date(T0).toISOString(),
  providerObservedAt: T0,
  ...over,
});

const climate = (over: Record<string, unknown> = {}) => ({
  tempF: 75.2, humidityPct: 40,
  observedAt: new Date(T0).toISOString(),
  providerObservedAt: T0,
  source: 'live' as const,
  ...over,
});

// ── 1 · the provider's timestamp is consumed ────────────────────────────────

describe('LAW 1 — the provider timestamp is what ages the evidence', () => {
  it('LOCATION: the provider instant is the anchor, not the device instant', () => {
    // Device says "just now"; the provider says the reading is 40 minutes old.
    // The evidence must age from the provider.
    const r = readingsFromLocationSnapshot(
      snapshot({ observedAt: new Date(T0).toISOString(), providerObservedAt: T0 - 40 * MIN }),
      T0,
    );
    expect(r.temperature.kind).toBe('observed');
    expect(r.temperature.kind !== 'unobserved' && r.temperature.observedAt).toBe(T0 - 40 * MIN);
  });

  it('CITY: same — parse time never becomes the anchor', () => {
    const r = readingsFromCityClimate(
      climate({ observedAt: new Date(T0).toISOString(), providerObservedAt: T0 - 40 * MIN }),
      T0,
    );
    expect(r.temperature.kind !== 'unobserved' && r.temperature.observedAt).toBe(T0 - 40 * MIN);
  });

  it('the two facts are genuinely independent — moving one does not move the other', () => {
    const a = readingsFromLocationSnapshot(
      snapshot({ observedAt: new Date(T0 - 5 * MIN).toISOString(), providerObservedAt: T0 - 20 * MIN }), T0);
    const b = readingsFromLocationSnapshot(
      snapshot({ observedAt: new Date(T0 - 90 * MIN).toISOString(), providerObservedAt: T0 - 20 * MIN }), T0);
    // Device capture instant differs wildly; the evidence is identical.
    expect(JSON.stringify(a.temperature)).toBe(JSON.stringify(b.temperature));
  });
});

// ── 2 · network delay cannot make evidence look fresher ─────────────────────

describe('LAW 2 — latency cannot buy freshness', () => {
  it('THE DEFECT: a slow cold start no longer makes a reading look current', () => {
    // The old behaviour, reconstructed: `now` captured at request start, then
    // a long prompt + GPS + three fetches. The provider's reading was already
    // near the edge of its window when we asked.
    const requestStart = T0 - 50 * MIN;          // when we began looking
    const providerMeasured = T0 - 58 * MIN;      // when the world was measured
    const r = readingsFromLocationSnapshot(
      snapshot({
        observedAt: new Date(requestStart).toISOString(),
        providerObservedAt: providerMeasured,
      }),
      T0,
    );
    // Aged from the provider: 58 min < 60 + 5 skew, so still current — but by
    // eight minutes less margin than the device stamp would have claimed.
    expect(r.temperature.kind !== 'unobserved' && r.temperature.observedAt).toBe(providerMeasured);
  });

  it('and at the boundary the difference decides the verdict', () => {
    // Provider measured just past the window; we asked comfortably inside it.
    // Under the old anchor this read as CURRENT. It must now read as stale.
    const providerMeasured = T0 - (WINDOW + CLOCK_SKEW_MS + MIN);
    const r = readingsFromLocationSnapshot(
      snapshot({
        observedAt: new Date(T0 - MIN).toISOString(),   // "we just looked"
        providerObservedAt: providerMeasured,
      }),
      T0,
    );
    expect(r.temperature.kind).toBe('stale');
    expect(toLegacyReading(r.temperature)).toBeNull();
  });

  it('the anchor is independent of HOW LONG the round trip took', () => {
    // Same provider instant, three different device capture instants: one
    // verdict. Latency is not an input to freshness.
    const verdicts = [0, 10 * MIN, 45 * MIN].map((latency) =>
      JSON.stringify(readingsFromLocationSnapshot(
        snapshot({
          observedAt: new Date(T0 - latency).toISOString(),
          providerObservedAt: T0 - 30 * MIN,
        }), T0).temperature));
    expect(new Set(verdicts).size).toBe(1);
  });
});

// ── 3 · bad and missing provider timestamps fail safe ───────────────────────

describe('LAW 3 — an anchor we cannot trust is refused, never invented', () => {
  it('NO provider timestamp — the reading is unageable, therefore not current', () => {
    for (const missing of [null, undefined]) {
      const r = readingsFromLocationSnapshot(snapshot({ providerObservedAt: missing }), T0);
      expect(r.temperature.kind, String(missing)).toBe('unobserved');
      expect(r.temperature.kind === 'unobserved' && r.temperature.reason)
        .toBe('provider_unavailable');
      expect(toLegacyReading(r.temperature)).toBeNull();
    }
  });

  it('...and the device instant is NOT quietly substituted for it', () => {
    // The whole defect in one assertion: a perfectly good device stamp sits
    // right there, and must not be used.
    const r = readingsFromLocationSnapshot(
      snapshot({ observedAt: new Date(T0).toISOString(), providerObservedAt: null }), T0);
    expect(r.temperature.kind).toBe('unobserved');
    expect(lastKnownValue(r.temperature)).toBeNull();
  });

  it('a NON-FINITE or NON-POSITIVE provider instant is refused', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      const r = readingsFromLocationSnapshot(snapshot({ providerObservedAt: bad }), T0);
      expect(r.temperature.kind, String(bad)).toBe('unobserved');
    }
  });

  it('a provider instant implausibly in the FUTURE is refused', () => {
    const r = readingsFromLocationSnapshot(
      snapshot({ providerObservedAt: T0 + CLOCK_SKEW_MS + MIN }), T0);
    expect(r.temperature.kind).toBe('unobserved');
    // ...while ordinary drift inside tolerance is still accepted.
    const drifting = readingsFromLocationSnapshot(
      snapshot({ providerObservedAt: T0 + CLOCK_SKEW_MS - MIN }), T0);
    expect(drifting.temperature.kind).toBe('observed');
  });

  it('CITY: the same refusals, at the same boundaries', () => {
    expect(readingsFromCityClimate(climate({ providerObservedAt: null }), T0).temperature.kind)
      .toBe('unobserved');
    expect(readingsFromCityClimate(climate({ providerObservedAt: Number.NaN }), T0).temperature.kind)
      .toBe('unobserved');
    expect(readingsFromCityClimate(
      climate({ providerObservedAt: T0 + CLOCK_SKEW_MS + MIN }), T0).temperature.kind)
      .toBe('unobserved');
  });

  it('a MOCK snapshot is still refused first, on provenance', () => {
    // Two independent refusals now guard demo data: source, and the absent
    // anchor. Provenance must win, so the reason stays demo_withheld.
    const r = readingsFromLocationSnapshot(
      snapshot({ source: 'mock', providerObservedAt: null }), T0);
    expect(r.temperature.kind === 'unobserved' && r.temperature.reason).toBe('demo_withheld');
  });
});

// ── 4 · stale stays stale ───────────────────────────────────────────────────

describe('LAW 4 — the repair does not resurrect stale evidence', () => {
  it('a genuinely old provider reading is stale, and keeps its value', () => {
    const r = readingsFromLocationSnapshot(
      snapshot({ providerObservedAt: T0 - 9 * 3_600_000 }), T0);
    expect(r.temperature.kind).toBe('stale');
    expect(toLegacyReading(r.temperature)).toBeNull();
    expect(lastKnownValue(r.temperature)).toEqual({ value: 24, stale: true });
  });

  it('a FRESH device stamp cannot rescue a stale provider reading', () => {
    // The mirror image of LAW 2: latency cannot buy freshness, and neither can
    // asking again without the world having been re-measured.
    const r = readingsFromLocationSnapshot(
      snapshot({ observedAt: new Date(T0).toISOString(), providerObservedAt: T0 - 9 * 3_600_000 }),
      T0,
    );
    expect(r.temperature.kind).toBe('stale');
  });
});

// ── 4b · a mock has no provider, so it has no provider anchor ──────────────

describe('LAW 4b — synthetic data never carries a provider assertion', () => {
  it('the CITY mock emits a null anchor', () => {
    // Provenance already refuses demo data at the adapter, so this is belt AND
    // braces — but a mock that ASSERTS a provider observation time is a lie in
    // the object itself, independent of who reads it.
    expect(buildMockClimate().providerObservedAt).toBeNull();
    expect(buildMockClimate().source).toBe('mock');
  });

  it('the LOCATION mock snapshot emits a null anchor', () => {
    const mock = buildSnapshot(
      { latitude: 39.7, longitude: -105, timezone: 'UTC', altitudeMeters: 1609,
        temperatureC: 24, humidityPct: 55, uvIndex: 6, airQualityIndex: 30 } as never,
      null, 'mock', new Date(T0).toISOString(),
    );
    expect(mock.providerObservedAt).toBeNull();
  });
});

// ── 4c · seconds -> milliseconds, at the city boundary ──────────────────────

describe('LAW 4c — the city provider instant is converted, not trusted raw', () => {
  it('epoch SECONDS become epoch ms', () => {
    expect(providerInstantMs(sec(T0))).toBe(T0);
  });

  it('a missing or unusable instant is null, never a number', () => {
    for (const bad of [undefined, Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(providerInstantMs(bad as never), String(bad)).toBeNull();
    }
  });

  it('an unconverted value would be refused downstream, not silently ancient', () => {
    // Guards the conversion end-to-end: raw seconds (~1.79e9) read as ms is
    // 1970, which the freshness classifier must treat as long stale rather
    // than as a plausible reading.
    const raw = sec(T0);
    const r = readingsFromCityClimate(climate({ providerObservedAt: raw }), T0);
    expect(r.temperature.kind).toBe('stale');
  });
});

// ── 5 · the weakest-link anchor across providers ────────────────────────────

describe('LAW 5 — one snapshot, two feeds, the older instant governs', () => {
  it('the OLDEST declared instant is chosen', () => {
    // Forecast and air quality answer independently. A single anchor must not
    // claim the fresher of them for the other feed's values.
    expect(oldestProviderInstantMs([sec(T0), sec(T0 - 20 * MIN)])).toBe(T0 - 20 * MIN);
    expect(oldestProviderInstantMs([sec(T0 - 20 * MIN), sec(T0)])).toBe(T0 - 20 * MIN);
  });

  it('seconds are converted to milliseconds', () => {
    expect(oldestProviderInstantMs([sec(T0)])).toBe(T0);
  });

  it('a feed that declares nothing is skipped, not treated as now', () => {
    expect(oldestProviderInstantMs([undefined, sec(T0 - 5 * MIN)])).toBe(T0 - 5 * MIN);
    expect(oldestProviderInstantMs([null, sec(T0 - 5 * MIN)])).toBe(T0 - 5 * MIN);
  });

  it('when NO feed declares one, the answer is null', () => {
    expect(oldestProviderInstantMs([])).toBeNull();
    expect(oldestProviderInstantMs([undefined, null])).toBeNull();
  });

  it('junk instants are discarded rather than dragging the anchor to 1970', () => {
    expect(oldestProviderInstantMs([0, -1, Number.NaN, sec(T0 - MIN)])).toBe(T0 - MIN);
    expect(oldestProviderInstantMs([0, -1, Number.NaN])).toBeNull();
  });
});
