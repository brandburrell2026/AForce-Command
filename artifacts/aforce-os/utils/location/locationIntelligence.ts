/**
 * Location Intelligence™ — pure, HEADLESS context engine.
 *
 * "Headless" = it normalizes raw environmental + positional inputs into
 * structured bands, a routing manifest, an advisory note key, and a
 * capped, target-side hydration adder — but renders NOTHING and calls
 * NO downstream engine. It is a routing layer: it describes what the
 * user's current location means for performance and which downstream
 * engines (Hydration Demand, Brain Energy, Recovery, Fuel Timing,
 * Forecasting, Performance Memory, Command Confidence) would care,
 * leaving the actual consumption to those engines.
 *
 * Score-Protection: advisory only. The single numeric output that can
 * influence anything — `environmentalAdderOz` — is routed to the
 * hydration-demand (TARGET) side, additive and capped, never to the
 * score and never to the live per-event points engine. Bands, routes,
 * and notes are descriptors; they never award or mutate score.
 *
 * Pure: same inputs → same outputs. No I/O, no Date.now(), no random,
 * no platform imports — fully unit-testable in node.
 */

// ─── Bands ────────────────────────────────────────────────────────────────────

export type UvBand = 'low' | 'moderate' | 'high' | 'very_high' | 'extreme';
export type AirQualityBand =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'hazardous';
export type AltitudeBand = 'sea_level' | 'elevated' | 'high' | 'very_high';
export type HeatBand = 'cold' | 'mild' | 'warm' | 'hot' | 'extreme';
export type HumidityBand =
  | 'very_dry'
  | 'dry'
  | 'comfortable'
  | 'humid'
  | 'oppressive';

export interface LocationBands {
  uv: UvBand | null;
  airQuality: AirQualityBand | null;
  altitude: AltitudeBand | null;
  heat: HeatBand | null;
  humidity: HumidityBand | null;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface LocationInputs {
  /** Decimal degrees, or null when unknown. */
  latitude: number | null;
  /** Decimal degrees, or null when unknown. */
  longitude: number | null;
  /** IANA time zone (e.g. "America/New_York"), or null when unknown. */
  timezone: string | null;
  /** Ground elevation in metres, or null when unknown. */
  altitudeMeters: number | null;
  /** Ambient temperature in °C, or null when unknown. */
  temperatureC: number | null;
  /** Relative humidity 0..100, or null when unknown. */
  humidityPct: number | null;
  /** UV index (0..~12+), or null when unknown. */
  uvIndex: number | null;
  /** US Air Quality Index (0..500), or null when unknown. */
  airQualityIndex: number | null;
}

// ─── Routing manifest (the seven named consumers) ──────────────────────────────

export interface LocationRoutes {
  /** Environment raises the daily water target (altitude / UV / heat). */
  hydrationDemand: boolean;
  /** Hypoxia / poor air can colour the cognitive read. */
  brainEnergy: boolean;
  /** Altitude / poor air load recovery. */
  recovery: boolean;
  /** Environment shifts fuel needs (altitude / extreme heat). */
  fuelTiming: boolean;
  /** Environment is an input to any forecast. */
  forecasting: boolean;
  /** The day's environmental context is worth remembering. */
  performanceMemory: boolean;
  /** Knowing the environment sharpens recommendation confidence. */
  commandConfidence: boolean;
}

/** Stable advisory-note identifiers — the UI resolves these via i18n. */
export type LocationNoteKey =
  | 'altitude'
  | 'uv'
  | 'air'
  | 'heat_humid'
  | 'baseline';

export interface LocationContext {
  /** True when at least one environmental metric is usable. */
  available: boolean;
  bands: LocationBands;
  /**
   * Additive, capped hydration-demand adder (oz). Score-Protection:
   * routed to the TARGET side only. Always 0 when not `available`.
   */
  environmentalAdderOz: number;
  routes: LocationRoutes;
  /** Water-First advisory note key, or null when nothing notable. */
  noteKey: LocationNoteKey | null;
}

// ─── Travel detection ──────────────────────────────────────────────────────────

export interface LocationAnchor {
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  /** ISO timestamp the anchor was captured (optional; not used in math). */
  capturedAt?: string;
}

export interface TravelSignal {
  /** True when the user has moved far enough or crossed a time zone. */
  isTraveling: boolean;
  /** True when the IANA time zone changed between anchors. */
  timezoneShifted: boolean;
  /** Great-circle distance between anchors (km), or null when unknown. */
  distanceKm: number | null;
  /** 'travel_protocol' when traveling, else null. UI resolves via i18n. */
  protocolKey: 'travel_protocol' | null;
}

// ─── Tunable thresholds & adders ───────────────────────────────────────────────

/** Altitude additive (oz/day) — dry, thin air raises fluid loss. */
export const ALTITUDE_ELEVATED_M = 800;
export const ALTITUDE_HIGH_M = 1800;
export const ALTITUDE_VERY_HIGH_M = 2800;
export const ALTITUDE_ADDER_OZ: Record<AltitudeBand, number> = {
  sea_level: 0,
  elevated: 3,
  high: 7,
  very_high: 11,
};

/** UV additive (oz/day) — strong sun adds modest evaporative loss. */
export const UV_ADDER_OZ: Record<UvBand, number> = {
  low: 0,
  moderate: 0,
  high: 2,
  very_high: 4,
  extreme: 6,
};

/**
 * Combined location adder cap. A location can raise — but never
 * dominate — the daily target. Air quality is intentionally NOT a water
 * adder (poor air is not a fluid-loss driver); it routes to Recovery /
 * Brain Energy and the advisory note only.
 */
export const LOCATION_DEMAND_CAP_OZ = 14;

/** Heat band thresholds (°C). */
export const HEAT_HOT_C = 30;
export const HEAT_EXTREME_C = 35;

/** Travel is detected at/above this great-circle distance (km). */
export const TRAVEL_DISTANCE_KM = 250;

const EARTH_RADIUS_KM = 6371;

// ─── Pure band classifiers ─────────────────────────────────────────────────────

export function classifyUv(uvIndex: number | null): UvBand | null {
  if (uvIndex == null || !Number.isFinite(uvIndex)) return null;
  if (uvIndex < 3) return 'low';
  if (uvIndex < 6) return 'moderate';
  if (uvIndex < 8) return 'high';
  if (uvIndex < 11) return 'very_high';
  return 'extreme';
}

export function classifyAirQuality(aqi: number | null): AirQualityBand | null {
  if (aqi == null || !Number.isFinite(aqi)) return null;
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'sensitive';
  if (aqi <= 200) return 'unhealthy';
  return 'hazardous';
}

export function classifyAltitude(meters: number | null): AltitudeBand | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < ALTITUDE_ELEVATED_M) return 'sea_level';
  if (meters < ALTITUDE_HIGH_M) return 'elevated';
  if (meters < ALTITUDE_VERY_HIGH_M) return 'high';
  return 'very_high';
}

export function classifyHeat(tempC: number | null): HeatBand | null {
  if (tempC == null || !Number.isFinite(tempC)) return null;
  if (tempC < 10) return 'cold';
  if (tempC < 24) return 'mild';
  if (tempC < HEAT_HOT_C) return 'warm';
  if (tempC < HEAT_EXTREME_C) return 'hot';
  return 'extreme';
}

export function classifyHumidity(humidityPct: number | null): HumidityBand | null {
  if (humidityPct == null || !Number.isFinite(humidityPct)) return null;
  if (humidityPct < 25) return 'very_dry';
  if (humidityPct < 40) return 'dry';
  if (humidityPct <= 60) return 'comfortable';
  if (humidityPct <= 75) return 'humid';
  return 'oppressive';
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Pure great-circle distance (km) via the haversine formula. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Pure, capped, additive location demand adder (oz). Altitude + UV only;
 * air quality and heat/humidity are handled elsewhere (heat/humidity by
 * the demand engine's own ramp). Always >= 0, never subtracts.
 */
export function calculateLocationDemandAdderOz(bands: LocationBands): number {
  const altitude = bands.altitude ? ALTITUDE_ADDER_OZ[bands.altitude] : 0;
  const uv = bands.uv ? UV_ADDER_OZ[bands.uv] : 0;
  return clamp(altitude + uv, 0, LOCATION_DEMAND_CAP_OZ);
}

function pickNoteKey(
  bands: LocationBands,
  adderOz: number,
): LocationNoteKey | null {
  // Most salient factor first. Altitude / UV are the new drivers; air
  // quality is advisory; heat+humidity is the classic pairing.
  if (bands.altitude === 'high' || bands.altitude === 'very_high') {
    return 'altitude';
  }
  if (bands.uv === 'very_high' || bands.uv === 'extreme') return 'uv';
  if (
    bands.airQuality === 'unhealthy' ||
    bands.airQuality === 'hazardous' ||
    bands.airQuality === 'sensitive'
  ) {
    return 'air';
  }
  if (
    (bands.heat === 'hot' || bands.heat === 'extreme') &&
    (bands.humidity === 'humid' || bands.humidity === 'oppressive')
  ) {
    return 'heat_humid';
  }
  return adderOz > 0 ? 'baseline' : null;
}

// ─── Engine ─────────────────────────────────────────────────────────────────────

/**
 * Derive the headless location context. Pure: same inputs → same output.
 *
 * When no environmental metric is present the result is an inert "not
 * available" context with a zero adder and all routes off — so a missing
 * GPS / weather read is a no-op rather than fabricated data.
 */
export function deriveLocationContext(inputs: LocationInputs): LocationContext {
  const bands: LocationBands = {
    uv: classifyUv(inputs.uvIndex),
    airQuality: classifyAirQuality(inputs.airQualityIndex),
    altitude: classifyAltitude(inputs.altitudeMeters),
    heat: classifyHeat(inputs.temperatureC),
    humidity: classifyHumidity(inputs.humidityPct),
  };

  const available =
    bands.uv != null ||
    bands.airQuality != null ||
    bands.altitude != null ||
    bands.heat != null ||
    bands.humidity != null;

  if (!available) {
    return {
      available: false,
      bands,
      environmentalAdderOz: 0,
      routes: {
        hydrationDemand: false,
        brainEnergy: false,
        recovery: false,
        fuelTiming: false,
        forecasting: false,
        performanceMemory: false,
        commandConfidence: false,
      },
      noteKey: null,
    };
  }

  const environmentalAdderOz = calculateLocationDemandAdderOz(bands);

  const poorAir =
    bands.airQuality === 'sensitive' ||
    bands.airQuality === 'unhealthy' ||
    bands.airQuality === 'hazardous';
  const highAltitude = bands.altitude === 'high' || bands.altitude === 'very_high';
  const extremeHeat = bands.heat === 'extreme';

  const routes: LocationRoutes = {
    hydrationDemand:
      environmentalAdderOz > 0 ||
      bands.heat === 'hot' ||
      extremeHeat ||
      bands.humidity === 'oppressive',
    brainEnergy: poorAir || bands.altitude === 'very_high' || bands.uv === 'extreme',
    recovery: poorAir || highAltitude,
    fuelTiming: highAltitude || extremeHeat,
    // Always-on when we have any usable context — these engines simply
    // record / weigh the environment rather than react to a threshold.
    forecasting: true,
    performanceMemory: true,
    commandConfidence: true,
  };

  return {
    available: true,
    bands,
    environmentalAdderOz,
    routes,
    noteKey: pickNoteKey(bands, environmentalAdderOz),
  };
}

/**
 * Detect a travel event by comparing the previous anchor to the current
 * position. Pure. Travel is true when the great-circle distance is at or
 * above `TRAVEL_DISTANCE_KM` OR the IANA time zone changed.
 *
 * With no prior anchor (first observation) it reports no travel — there
 * is nothing to compare against, so nothing is fabricated.
 */
export function detectTravel(
  prev: LocationAnchor | null,
  current: LocationAnchor,
): TravelSignal {
  if (!prev) {
    return {
      isTraveling: false,
      timezoneShifted: false,
      distanceKm: null,
      protocolKey: null,
    };
  }

  const timezoneShifted =
    !!prev.timezone &&
    !!current.timezone &&
    prev.timezone !== current.timezone;

  let distanceKm: number | null = null;
  if (
    prev.latitude != null &&
    prev.longitude != null &&
    current.latitude != null &&
    current.longitude != null &&
    Number.isFinite(prev.latitude) &&
    Number.isFinite(prev.longitude) &&
    Number.isFinite(current.latitude) &&
    Number.isFinite(current.longitude)
  ) {
    distanceKm = haversineKm(
      prev.latitude,
      prev.longitude,
      current.latitude,
      current.longitude,
    );
  }

  const movedFar = distanceKm != null && distanceKm >= TRAVEL_DISTANCE_KM;
  const isTraveling = movedFar || timezoneShifted;

  return {
    isTraveling,
    timezoneShifted,
    distanceKm,
    protocolKey: isTraveling ? 'travel_protocol' : null,
  };
}
