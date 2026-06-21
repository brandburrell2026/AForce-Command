/**
 * Location Intelligence™ — data layer.
 *
 * Turns the device's physical position into the normalized environmental
 * context the performance engines consume. This is the ONLY layer that does
 * I/O (geolocation, network, persistence); all classification, capping, and
 * travel math lives in the pure `utils/location/locationIntelligence` engine,
 * which this service simply feeds.
 *
 * Data sources (live, all keyless):
 *   - Geolocation:  expo-location (permission-gated, foreground)
 *   - Weather/UV:   Open-Meteo forecast API (temperature, humidity, uv_index)
 *   - Air quality:  Open-Meteo air-quality API (us_aqi)
 *   - Elevation:    Open-Meteo elevation API (ground altitude in metres)
 *   - Time zone:    device IANA zone via Intl (reflects auto-tz on travel)
 *
 * Resilience (mirrors cityClimateService):
 *   - Any failure (denied permission, no network, web env, missing native
 *     module) transparently falls back to a deterministic daily mock so the
 *     demo never goes blank.
 *   - In-memory TTL cache (10 min) prevents API hammering / battery drain.
 *   - The last position is persisted as a LocationAnchor (AsyncStorage) so
 *     travel detection can compare across app launches.
 *
 * Score-Protection: this service only MEASURES. The context it returns is
 * advisory; the only number that touches scoring is the capped, target-side
 * `environmentalAdderOz` produced by the pure engine.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deriveLocationContext,
  detectTravel,
  type LocationAnchor,
  type LocationContext,
  type LocationInputs,
  type TravelSignal,
} from '../utils/location/locationIntelligence';

export interface LocationSnapshot {
  /** The normalized environmental inputs (raw, pre-classification). */
  inputs: LocationInputs;
  /** Pure-engine derived context (bands, routes, capped adder, note). */
  context: LocationContext;
  /** Travel signal vs. the previously persisted anchor. */
  travel: TravelSignal;
  /** Whether the snapshot came from a live source or the offline mock. */
  source: 'live' | 'mock';
  /** ISO timestamp the snapshot was generated. */
  observedAt: string;
}

// v2: the v1 key may hold a synthetic MOCK anchor persisted by the pre-fix
// behavior (which wrote anchors for every source). Reading such a stale mock
// baseline lets a later LIVE reading fabricate a trip the user never took, so
// we deliberately bump the namespace — legacy anchors are ignored and the
// first post-upgrade live reading simply has no baseline (safe: no travel).
const STORAGE_KEY = 'aforce.location.anchor.v2';
const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedSnapshot: LocationSnapshot | null = null;
let cachedAt = 0;

/** Test-only hook: clear the in-memory cache between cases. */
export function __resetLocationCache(): void {
  cachedSnapshot = null;
  cachedAt = 0;
}

// ─── Device time zone ──────────────────────────────────────────────────────────

/** Best-effort IANA time zone from the JS runtime; null when unavailable. */
export function readDeviceTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}

// ─── Anchor persistence ────────────────────────────────────────────────────────

/** Read the last persisted anchor, or null when none / unreadable. */
export async function readLastAnchor(): Promise<LocationAnchor | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocationAnchor>;
    return {
      latitude: typeof parsed.latitude === 'number' ? parsed.latitude : null,
      longitude: typeof parsed.longitude === 'number' ? parsed.longitude : null,
      timezone: typeof parsed.timezone === 'string' ? parsed.timezone : null,
      capturedAt: typeof parsed.capturedAt === 'string' ? parsed.capturedAt : undefined,
    };
  } catch {
    return null;
  }
}

/** Persist the current anchor for next-launch travel comparison. */
async function writeLastAnchor(anchor: LocationAnchor): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(anchor));
  } catch {
    // non-fatal — travel detection simply won't have a prior anchor.
  }
}

// ─── Pure mappers (node-safe, unit-tested) ─────────────────────────────────────

/** Empty inputs — used as the base for both live and mock builders. */
export function emptyLocationInputs(): LocationInputs {
  return {
    latitude: null,
    longitude: null,
    timezone: null,
    altitudeMeters: null,
    temperatureC: null,
    humidityPct: null,
    uvIndex: null,
    airQualityIndex: null,
  };
}

interface OpenMeteoForecast {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    uv_index?: number;
  };
}
interface OpenMeteoAirQuality {
  current?: { us_aqi?: number };
}
interface OpenMeteoElevation {
  elevation?: number[];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Pure mapper: fold the three Open-Meteo responses + position + tz into the
 * engine's LocationInputs. Exported for direct unit testing without network.
 */
export function mapLiveInputs(args: {
  latitude: number;
  longitude: number;
  timezone: string | null;
  forecast: OpenMeteoForecast | null;
  airQuality: OpenMeteoAirQuality | null;
  elevation: OpenMeteoElevation | null;
}): LocationInputs {
  return {
    latitude: args.latitude,
    longitude: args.longitude,
    timezone: args.timezone,
    altitudeMeters: num(args.elevation?.elevation?.[0]),
    temperatureC: num(args.forecast?.current?.temperature_2m),
    humidityPct: num(args.forecast?.current?.relative_humidity_2m),
    uvIndex: num(args.forecast?.current?.uv_index),
    airQualityIndex: num(args.airQuality?.current?.us_aqi),
  };
}

/**
 * Deterministic offline mock. Rotates across a small set of locations by
 * day-of-year so the demo feels alive without flickering within a session,
 * and so the Miami→NYC travel signature is reachable from the mock alone.
 */
export function buildMockInputs(now: number = Date.now()): LocationInputs {
  const PLACES: Omit<LocationInputs, 'timezone'>[] = [
    // Denver — high altitude, clear, strong UV.
    {
      latitude: 39.7392,
      longitude: -104.9903,
      altitudeMeters: 1609,
      temperatureC: 24,
      humidityPct: 30,
      uvIndex: 8,
      airQualityIndex: 45,
    },
    // Miami — sea level, hot, humid.
    {
      latitude: 25.7617,
      longitude: -80.1918,
      altitudeMeters: 2,
      temperatureC: 31,
      humidityPct: 78,
      uvIndex: 9,
      airQualityIndex: 38,
    },
    // New York — sea level, mild, moderate air.
    {
      latitude: 40.7128,
      longitude: -74.006,
      altitudeMeters: 10,
      temperatureC: 21,
      humidityPct: 55,
      uvIndex: 5,
      airQualityIndex: 62,
    },
  ];
  const day = Math.floor(now / 86_400_000);
  const pick = PLACES[day % PLACES.length];
  return { ...pick, timezone: 'America/New_York' };
}

/** Build the anchor (the travel-relevant subset) from full inputs. */
export function anchorFromInputs(
  inputs: LocationInputs,
  capturedAt: string,
): LocationAnchor {
  return {
    latitude: inputs.latitude,
    longitude: inputs.longitude,
    timezone: inputs.timezone,
    capturedAt,
  };
}

/** Inert travel signal — what a non-live snapshot always reports. */
const INERT_TRAVEL: TravelSignal = {
  isTraveling: false,
  timezoneShifted: false,
  distanceKm: null,
  protocolKey: null,
};

/**
 * Pure assembler: given the freshly measured inputs and the previously
 * persisted anchor, produce a full snapshot via the pure engine. No I/O.
 *
 * Score-Protection / no-fabrication: travel is only ever real when the
 * CURRENT reading is live GPS. The offline mock rotates cities by
 * day-of-year, so trusting a mock reading (or a mock anchor — see
 * `getLocationSnapshot`, which never persists one) would manufacture a
 * phantom Miami→NYC "trip" from synthetic movement and light up the Travel
 * Protocol. A non-live snapshot therefore always carries an inert travel
 * signal, mirroring the way the target-side adder only applies for live.
 */
export function buildSnapshot(
  inputs: LocationInputs,
  previousAnchor: LocationAnchor | null,
  source: 'live' | 'mock',
  observedAt: string,
): LocationSnapshot {
  const context = deriveLocationContext(inputs);
  const travel =
    source === 'live'
      ? detectTravel(previousAnchor, anchorFromInputs(inputs, observedAt))
      : INERT_TRAVEL;
  return { inputs, context, travel, source, observedAt };
}

// ─── Live fetch ────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchLiveInputs(): Promise<LocationInputs | null> {
  // Dynamic import so the service stays usable in node tests where the
  // expo-location native module isn't available.
  let Location: typeof import('expo-location');
  try {
    Location = await import('expo-location');
  } catch {
    return null;
  }

  // Permission gate.
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
  } catch {
    return null;
  }

  // Position.
  let lat: number;
  let lon: number;
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  } catch {
    return null;
  }

  const latStr = lat.toFixed(4);
  const lonStr = lon.toFixed(4);

  // Fetch the three keyless Open-Meteo sources in parallel; any may be null.
  const [forecast, airQuality, elevation] = await Promise.all([
    fetchJson<OpenMeteoForecast>(
      `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latStr}&longitude=${lonStr}` +
        `&current=temperature_2m,relative_humidity_2m,uv_index`,
    ),
    fetchJson<OpenMeteoAirQuality>(
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${latStr}&longitude=${lonStr}&current=us_aqi`,
    ),
    fetchJson<OpenMeteoElevation>(
      `https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lonStr}`,
    ),
  ]);

  return mapLiveInputs({
    latitude: lat,
    longitude: lon,
    timezone: readDeviceTimezone(),
    forecast,
    airQuality,
    elevation,
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the live location snapshot, falling back to the deterministic mock
 * if any step (permission, position, network) fails. Cached for
 * `CACHE_TTL_MS`. Persists the new anchor so the next call can detect travel.
 */
export async function getLocationSnapshot(force = false): Promise<LocationSnapshot> {
  const now = Date.now();
  if (!force && cachedSnapshot && now - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const previousAnchor = await readLastAnchor();
  const live = await fetchLiveInputs();
  const source: 'live' | 'mock' = live ? 'live' : 'mock';
  const inputs = live ?? buildMockInputs(now);
  const observedAt = new Date(now).toISOString();

  const snapshot = buildSnapshot(inputs, previousAnchor, source, observedAt);

  // Persist the new anchor ONLY for live readings. A mock anchor must never
  // become a future comparison baseline: a later live reading diffed against
  // a synthetic location (or a mock diffed against yesterday's rotated mock)
  // would fabricate a travel event. Not persisting mock keeps the last real
  // anchor intact so travel detection stays live↔live (no-fabrication).
  if (source === 'live') {
    await writeLastAnchor(anchorFromInputs(inputs, observedAt));
  }

  cachedSnapshot = snapshot;
  cachedAt = now;
  return snapshot;
}

/**
 * Synchronous accessor — returns the cached snapshot if available, otherwise
 * a mock-derived snapshot with no travel signal. Use for the initial render;
 * pair with `getLocationSnapshot()` in an effect to refresh with live data.
 */
export function getLocationSnapshotSync(): LocationSnapshot {
  if (cachedSnapshot) return cachedSnapshot;
  const now = Date.now();
  return buildSnapshot(buildMockInputs(now), null, 'mock', new Date(now).toISOString());
}
