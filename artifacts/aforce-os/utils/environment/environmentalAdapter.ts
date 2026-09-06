/**
 * ENVIRONMENTAL ADAPTER — the adoption seam between existing producers and the
 * EnvironmentalEvidence contract.
 *
 * This PR changes ARCHITECTURE, not BEHAVIOUR. Nothing a member sees moves, no
 * score changes, and Core is not touched. The seam exists so producers can start
 * speaking evidence while every current consumer keeps its present types.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────────────
 *
 * The server OpenWeather -> `UserState.weather*` path is UNTOUCHED. That is the
 * one pipeline that reaches Core (`breakdown.ts` reads `state.weatherTempC` and
 * `state.weatherHumidity` directly), so migrating it is behaviour-sensitive and
 * belongs in its own reviewed change. Because this adapter never touches it,
 * Core parity is preserved BY CONSTRUCTION rather than by careful matching.
 *
 * `cruiseEnvService` is untouched for the same reason of restraint: it has its
 * own fallback semantics and no environmental ambition.
 *
 * ── THE ONE-WAY RULE ──────────────────────────────────────────────────────
 *
 * `toLegacyReading` is intentionally lossy in ONE direction only: it collapses
 * three epistemic states into `number | null` because that is what today's
 * consumers can hold. It must never do the reverse — manufacture a reading
 * from an absence. Concretely, none of these may ever produce a number:
 *
 *     unobserved  ·  stale  ·  demo/mock  ·  location-invalidated altitude
 *
 * That is the whole safety property of this file, and `environmentalAdapterLaw`
 * mutation-tests each arm of it.
 *
 * ── AND THE ASSUMPTION THAT IS NOT EVIDENCE ───────────────────────────────
 *
 * `heatLoad` ships as a seeded constant 4 that NO code path writes from an
 * observation. It is an assumption the current calculation depends on, and it
 * stays available for exactly that. What it may not do is enter the evidence
 * system wearing a provenance tag — see `legacyHeatLoadAssumption`.
 */
import {
  observe,
  unobserved,
  reclassify,
  isLocationBound,
  type EnvironmentalEvidence,
  type EnvironmentalSignal,
  type LocationPrecision,
  type UnobservedReason,
  type ValidityPolicy,
} from './environmentalEvidence';

// ─── The one-way conversion ─────────────────────────────────────────────────

/**
 * Evidence -> the `number | null` shape existing consumers already handle.
 *
 * ONLY a current, first-hand-or-provider reading yields a number. Everything
 * else is null, because everything else would be a claim we cannot support:
 *   - `unobserved` has no value at all;
 *   - `stale` has one, but presenting it as current is the defect this whole
 *     contract exists to prevent;
 *   - `calculated` / `inferred` are legitimate values that are not measurements.
 *
 * A consumer that legitimately needs a calculation neutral must produce it
 * ITSELF, at its own boundary, where the assumption is visible in its own code.
 * This adapter will not supply one — a neutral handed over silently here is
 * indistinguishable downstream from a reading, which is exactly how the 70 °F
 * heat-index defect happened.
 */
export function toLegacyReading(evidence: EnvironmentalEvidence<number>): number | null {
  if (evidence.kind !== 'observed') return null;
  if (evidence.provenance !== 'observed' && evidence.provenance !== 'provider') return null;
  return evidence.value;
}

/**
 * The same one-way rule, re-checked against the CURRENT clock and location.
 *
 * Evidence captured earlier in a render may have expired, or the member may
 * have moved — and a location-bound signal read somewhere else is not evidence
 * about here at all. Consumers that hold evidence across time should read
 * through this rather than `toLegacyReading` alone.
 */
export function toLegacyReadingAt(
  evidence: EnvironmentalEvidence<number>,
  now: number,
  ctx: { locationKey?: string; policy?: ValidityPolicy } = {},
): number | null {
  return toLegacyReading(reclassify(evidence, now, ctx));
}

// ─── heatLoad: an assumption, and labelled as one ───────────────────────────

/**
 * `heatLoad` is NOT environmental evidence, and this type exists so it can
 * never be mistaken for it.
 *
 * The value is seeded at 4 and no code path ever writes it from an observation
 * (`heatLoadToTempC` back-fills a temperature from it when no weather reading
 * exists). The current scoring contribution depends on that behaviour and is
 * deliberately NOT changed here — behaviour may remain legacy; the truth
 * classification may not lie.
 *
 * Note the shape: no `provenance`, no `observedAt`, no `expiresAt`. It cannot
 * be passed anywhere `EnvironmentalEvidence` is expected, which is the point.
 */
export interface LegacyCalculationAssumption {
  readonly kind: 'assumption';
  readonly of: 'heatLoad';
  readonly value: number;
  /** Why this is not evidence, carried with it so it is never re-litigated. */
  readonly because: string;
}

export function legacyHeatLoadAssumption(heatLoad: number): LegacyCalculationAssumption {
  return {
    kind: 'assumption',
    of: 'heatLoad',
    value: heatLoad,
    because:
      'Seeded constant; no code path writes heatLoad from an observation. Retained ' +
      'for backward-compatible calculation only, never as environmental evidence.',
  };
}

/**
 * What the EVIDENCE system says about ambient heat when the only thing we have
 * is `heatLoad`: nothing was observed.
 *
 * This is the honest answer even though the calculation still uses the seed —
 * the two are allowed to differ precisely because one is behaviour and the
 * other is truth.
 */
export function heatEvidenceFromLegacyState(
  weatherTempC: number | null | undefined,
  observedAtMs: number | null | undefined,
  now: number,
): EnvironmentalEvidence<number> {
  if (weatherTempC == null || !Number.isFinite(weatherTempC)) {
    return unobserved('temperature', 'never_requested');
  }
  if (observedAtMs == null || !Number.isFinite(observedAtMs)) {
    // A reading with no timestamp cannot be aged, so it cannot be called
    // current. Refusing it is safer than assuming it is fresh.
    return unobserved('temperature', 'provider_unavailable');
  }
  return observe({
    signal: 'temperature',
    value: weatherTempC,
    unit: 'celsius',
    observedAt: observedAtMs,
    provenance: 'provider',
    source: 'aforce-server/openweather',
    locationPrecision: 'city',
  }, now);
}

// ─── Producer adapters ──────────────────────────────────────────────────────

/** The signals a snapshot can carry, keyed for consumers. */
export interface EnvironmentalReadings {
  readonly temperature: EnvironmentalEvidence<number>;
  readonly humidity: EnvironmentalEvidence<number>;
  readonly uvIndex: EnvironmentalEvidence<number>;
  readonly airQuality: EnvironmentalEvidence<number>;
  readonly altitude: EnvironmentalEvidence<number>;
}

interface LocationSnapshotLike {
  readonly inputs: {
    readonly temperatureC: number | null;
    readonly humidityPct: number | null;
    readonly uvIndex: number | null;
    readonly airQualityIndex: number | null;
    readonly altitudeMeters: number | null;
    readonly latitude?: number;
    readonly longitude?: number;
  };
  readonly source: 'live' | 'mock';
  readonly observedAt: string;
}

/** Stable, coarse key for "is this the same place?". ~11 km at the equator. */
export function coarseLocationKey(lat?: number, lon?: number): string | undefined {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return undefined;
  }
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

/**
 * `locationIntelligenceService` — the CANONICAL entry point — to evidence.
 *
 * A `mock` snapshot yields `demo_withheld` for every signal. Not a stale
 * reading, not a low-quality one: demo data is not a weaker observation, it is
 * not an observation.
 */
export function readingsFromLocationSnapshot(
  snapshot: LocationSnapshotLike | null,
  now: number,
  policy?: ValidityPolicy,
): EnvironmentalReadings {
  const none = (reason: UnobservedReason): EnvironmentalReadings => ({
    temperature: unobserved('temperature', reason),
    humidity: unobserved('humidity', reason),
    uvIndex: unobserved('uvIndex', reason),
    airQuality: unobserved('airQuality', reason),
    altitude: unobserved('altitude', reason),
  });

  if (snapshot == null) return none('never_requested');
  if (snapshot.source === 'mock') return none('demo_withheld');

  const observedAt = Date.parse(snapshot.observedAt);
  if (!Number.isFinite(observedAt)) return none('provider_unavailable');

  const locationKey = coarseLocationKey(snapshot.inputs.latitude, snapshot.inputs.longitude);
  const one = (
    signal: EnvironmentalSignal,
    value: number | null,
    unit: Parameters<typeof observe>[0]['unit'],
    precision: LocationPrecision,
  ): EnvironmentalEvidence<number> => {
    if (value == null) return unobserved(signal, 'not_supported');
    // A LOCATION-BOUND signal with no location is not evidence about here.
    //
    // `reclassify` can only invalidate when BOTH the evidence and the context
    // carry a key, so an altitude captured without lat/lon would never be
    // invalidated — it would follow the member across a continent looking
    // current. Refusing it at this boundary is the only honest answer: the
    // provider gave us a number, but not one we can say is about this place.
    if (isLocationBound(signal, policy) && locationKey === undefined) {
      return unobserved(signal, 'provider_unavailable');
    }
    return observe({
      signal, value, unit, observedAt,
      provenance: 'provider', source: 'open-meteo',
      locationPrecision: precision,
      ...(locationKey !== undefined ? { locationKey } : {}),
    }, now, policy) as EnvironmentalEvidence<number>;
  };

  return {
    temperature: one('temperature', snapshot.inputs.temperatureC, 'celsius', 'coarse'),
    humidity: one('humidity', snapshot.inputs.humidityPct, 'percent', 'coarse'),
    uvIndex: one('uvIndex', snapshot.inputs.uvIndex, 'uvIndex', 'coarse'),
    airQuality: one('airQuality', snapshot.inputs.airQualityIndex, 'aqiUs', 'coarse'),
    altitude: one('altitude', snapshot.inputs.altitudeMeters, 'meters', 'coarse'),
  };
}

interface CityClimateLike {
  readonly tempF: number;
  readonly humidityPct: number;
  readonly observedAt: string;
  readonly source: 'live' | 'mock';
  readonly city?: string;
}

/**
 * `cityClimateService` to evidence. After PR2 this producer already returns
 * `null` rather than a demo city in production, so `null` maps to
 * `never_requested` and a `mock` source — reachable only in demo builds — maps
 * to `demo_withheld`.
 *
 * Temperature is converted to °C here so the contract carries ONE unit for one
 * signal. The unit fragmentation (°C persisted, °F in this service) is exactly
 * what the explicit `unit` field exists to end.
 */
export function readingsFromCityClimate(
  climate: CityClimateLike | null,
  now: number,
  policy?: ValidityPolicy,
): Pick<EnvironmentalReadings, 'temperature' | 'humidity'> {
  if (climate == null) {
    return {
      temperature: unobserved('temperature', 'never_requested'),
      humidity: unobserved('humidity', 'never_requested'),
    };
  }
  if (climate.source === 'mock') {
    return {
      temperature: unobserved('temperature', 'demo_withheld'),
      humidity: unobserved('humidity', 'demo_withheld'),
    };
  }
  const observedAt = Date.parse(climate.observedAt);
  if (!Number.isFinite(observedAt)) {
    return {
      temperature: unobserved('temperature', 'provider_unavailable'),
      humidity: unobserved('humidity', 'provider_unavailable'),
    };
  }
  const locationKey = climate.city ? `city:${climate.city}` : undefined;
  const common = {
    observedAt, provenance: 'provider' as const, source: 'open-meteo',
    locationPrecision: 'city' as const,
    ...(locationKey !== undefined ? { locationKey } : {}),
  };
  return {
    temperature: observe({
      signal: 'temperature', value: (climate.tempF - 32) * (5 / 9), unit: 'celsius', ...common,
    }, now, policy) as EnvironmentalEvidence<number>,
    humidity: observe({
      signal: 'humidity', value: climate.humidityPct, unit: 'percent', ...common,
    }, now, policy) as EnvironmentalEvidence<number>,
  };
}
