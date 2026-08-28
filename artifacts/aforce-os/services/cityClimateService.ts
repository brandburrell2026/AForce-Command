/**
 * City Climate Service.
 *
 * Returns the user's current-city climate snapshot — city name, ambient
 * temperature, relative humidity, and a hydration insight tied to that
 * humidity reading.
 *
 * Why this exists:
 *   AForce is a hydration system, and ambient humidity is one of the two
 *   biggest environmental drivers of fluid loss (alongside temperature).
 *   Low-humidity air evaporates sweat fast → invisible water loss.
 *   High-humidity air blocks evaporation → cooling fails, electrolyte loss
 *   accelerates. The Heat Risk engine already consumes `humidityPct` as a
 *   signal; this service surfaces the same value to the user-facing UI.
 *
 * Data sources (live):
 *   - Geolocation:      expo-location (permission-gated, foreground)
 *   - Reverse geocode:  expo-location's built-in reverseGeocodeAsync
 *   - Weather:          Open-Meteo (open, no API key, generous rate limits)
 *
 * Resilience:
 *   - Any failure (denied permission, no network, geocode miss, web env)
 *     transparently falls back to a deterministic daily mock so the UI
 *     never goes blank or shows a contradictory reading.
 *   - In-memory TTL cache (10 min) prevents API hammering on every render.
 */

export interface CityClimate {
  /** Display city name. */
  city: string;
  /** Region / state code (e.g. "TX", "ON"). */
  region: string;
  /** Relative humidity 0-100. */
  humidityPct: number;
  /** Ambient temperature in Fahrenheit. */
  tempF: number;
  /** One-word condition for the icon ("clear", "cloudy", "rain", etc.). */
  condition: 'clear' | 'cloudy' | 'rain' | 'humid' | 'dry' | 'storm';
  /** Humidity comfort band derived from humidityPct. */
  humidityBand: HumidityBand;
  /** Short, hydration-relevant insight tied to the current humidity. */
  hydrationInsight: string;
  /** ISO timestamp the snapshot was generated. */
  observedAt: string;
  /** Whether the snapshot came from a live source or the offline mock. */
  source: 'live' | 'mock';
}

export type HumidityBand = 'very_dry' | 'dry' | 'comfortable' | 'humid' | 'oppressive';

/** Pure helper: bucket a 0-100 RH value into a comfort band. */
export function classifyHumidity(humidityPct: number): HumidityBand {
  if (humidityPct < 25) return 'very_dry';
  if (humidityPct < 40) return 'dry';
  if (humidityPct <= 60) return 'comfortable';
  if (humidityPct <= 75) return 'humid';
  return 'oppressive';
}

/**
 * Pure helper: pick a hydration insight string keyed off the humidity band.
 * These are short, factual, and never alarmist — AForce coaches, doesn't
 * scare. Exported so the UI and tests can share the same copy source.
 *
 * COMMAND-AUTHORITY CONTAINMENT (re-plumb wave, founder-authorized): this
 * copy renders on HeatRiskScreen and ClimateLine as climate CONTEXT. It
 * previously carried a sip-cadence instruction ("Sip every 15 min") — a
 * competing hydration clock authored outside canonical seams. Insights are
 * now environmental OBSERVATION only: what the air is doing to the body,
 * never how much or how often to drink — the member's current command owns
 * that (services/__tests__/commandAuthorityContainment.test.ts).
 */
export function hydrationInsightForHumidity(band: HumidityBand): string {
  switch (band) {
    case 'very_dry':
      return 'Dry air pulls moisture out invisibly — losses build before you feel them.';
    case 'dry':
      return 'Low humidity speeds evaporation. Fluid demand runs ahead of thirst here.';
    case 'comfortable':
      return 'Humidity in the comfort band. No added load from the air today.';
    case 'humid':
      return 'Sweat evaporates slower in humid air — electrolyte demand climbs, and water alone will not cool you.';
    case 'oppressive':
      return 'Heavy humidity blocks cooling. Electrolyte demand peaks — shade and shorter work blocks matter here.';
  }
}

// ─── Cache ───────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedClimate: CityClimate | null = null;
let cachedAt = 0;

/** Test-only hook: clear the in-memory cache between cases. */
export function __resetClimateCache(): void {
  cachedClimate = null;
  cachedAt = 0;
}

// ─── Mock fallback ───────────────────────────────────────────────────────────
function buildMockClimate(): CityClimate {
  // Rotate across a small set of cities by day-of-year so the demo feels
  // alive without flickering within a single session.
  const CITIES: { city: string; region: string; baseHumidity: number; baseTempF: number }[] = [
    { city: 'Austin',   region: 'TX', baseHumidity: 68, baseTempF: 88 },
    { city: 'Phoenix',  region: 'AZ', baseHumidity: 22, baseTempF: 102 },
    { city: 'Miami',    region: 'FL', baseHumidity: 78, baseTempF: 86 },
    { city: 'Denver',   region: 'CO', baseHumidity: 35, baseTempF: 78 },
    { city: 'Seattle',  region: 'WA', baseHumidity: 72, baseTempF: 64 },
    { city: 'New York', region: 'NY', baseHumidity: 58, baseTempF: 74 },
  ];
  const day = Math.floor(Date.now() / 86_400_000);
  const pick = CITIES[day % CITIES.length];
  const humidityPct = Math.max(5, Math.min(98, pick.baseHumidity + ((day % 5) - 2)));
  const tempF = Math.max(20, Math.min(115, pick.baseTempF + ((day % 3) - 1)));
  const band = classifyHumidity(humidityPct);
  const condition: CityClimate['condition'] =
    band === 'oppressive' ? 'humid' :
    band === 'very_dry'   ? 'dry' :
    'clear';

  return {
    city: pick.city,
    region: pick.region,
    humidityPct,
    tempF,
    condition,
    humidityBand: band,
    hydrationInsight: hydrationInsightForHumidity(band),
    observedAt: new Date().toISOString(),
    source: 'mock',
  };
}

// ─── Live fetch ──────────────────────────────────────────────────────────────
interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
  };
}

/** Map an Open-Meteo WMO weather code to our coarse condition vocabulary. */
function conditionFromWeatherCode(code: number | undefined, band: HumidityBand): CityClimate['condition'] {
  if (code == null) return band === 'oppressive' ? 'humid' : band === 'very_dry' ? 'dry' : 'clear';
  if (code === 0 || code === 1) return 'clear';
  if (code >= 2 && code <= 3) return 'cloudy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 95) return 'storm';
  return band === 'oppressive' ? 'humid' : 'cloudy';
}

async function fetchLiveClimate(): Promise<CityClimate | null> {
  // Dynamic imports so the service stays usable in node tests where the
  // expo-location native module isn't available.
  let Location: typeof import('expo-location');
  try {
    Location = await import('expo-location');
  } catch {
    return null;
  }

  // 1. Permission gate.
  let permissionStatus: string;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    permissionStatus = status;
  } catch {
    return null;
  }
  if (permissionStatus !== 'granted') return null;

  // 2. Position. Balanced accuracy is plenty for city-level weather.
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

  // 3. Reverse geocode (best-effort — if it fails we still have weather).
  let city = 'Your area';
  let region = '';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const place = places[0];
    if (place) {
      city = place.city ?? place.subregion ?? place.region ?? city;
      region = place.region ?? place.isoCountryCode ?? '';
    }
  } catch {
    // non-fatal
  }

  // 4. Weather from Open-Meteo (no API key).
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code` +
      `&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    const tempRaw = data.current?.temperature_2m;
    const humRaw = data.current?.relative_humidity_2m;
    if (tempRaw == null || humRaw == null) return null;
    const tempF = Math.round(tempRaw);
    const humidityPct = Math.round(humRaw);
    const band = classifyHumidity(humidityPct);
    return {
      city,
      region,
      humidityPct,
      tempF,
      condition: conditionFromWeatherCode(data.current?.weather_code, band),
      humidityBand: band,
      hydrationInsight: hydrationInsightForHumidity(band),
      observedAt: new Date().toISOString(),
      source: 'live',
    };
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the live city climate, falling back to the deterministic mock if
 * any step (permission, position, geocode, weather) fails. Cached for
 * `CACHE_TTL_MS` to avoid API hammering and battery drain.
 */
export async function getCurrentCityClimate(force = false): Promise<CityClimate> {
  const now = Date.now();
  if (!force && cachedClimate && now - cachedAt < CACHE_TTL_MS) {
    return cachedClimate;
  }
  const live = await fetchLiveClimate();
  const result = live ?? buildMockClimate();
  cachedClimate = result;
  cachedAt = now;
  return result;
}

/**
 * Synchronous accessor — returns the cached climate if available, otherwise
 * the deterministic mock. Use this for the initial render; pair with
 * `getCurrentCityClimate()` in an effect to refresh with live data.
 */
export function getCurrentCityClimateSync(): CityClimate {
  return cachedClimate ?? buildMockClimate();
}
