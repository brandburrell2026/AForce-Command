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
 * Production wiring:
 *   The real implementation will:
 *     1. Resolve location via `expo-location` (lat/lon → reverse geocode).
 *     2. Hit a weather API (OpenWeather, Tomorrow.io, etc.) for live humidity.
 *     3. Cache for ~10 min to avoid hammering the API on every render.
 *   That work is gated behind a real API key + integration; until then this
 *   module returns a deterministic mock so the UI is fully wired and the
 *   shape never changes when we cut over.
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
 * These are short, actionable, and never alarmist — AForce coaches, doesn't
 * scare. Exported so the UI and tests can share the same copy source.
 */
export function hydrationInsightForHumidity(band: HumidityBand): string {
  switch (band) {
    case 'very_dry':
      return 'Dry air pulls moisture out invisibly. Sip every 15 min — you will not feel the loss.';
    case 'dry':
      return 'Low humidity speeds evaporation. Stay ahead of thirst, not behind it.';
    case 'comfortable':
      return 'Humidity in the comfort band. Maintain your normal cadence.';
    case 'humid':
      return 'Sweat evaporates slower in humid air. Lean into electrolytes — water alone will not cool you.';
    case 'oppressive':
      return 'Heavy humidity blocks cooling. Prioritize electrolytes, shade, and shorter work blocks.';
  }
}

/**
 * Deterministic mock keyed off the date, so the same day shows the same
 * reading (no jitter that makes the UI look broken). Production replaces
 * this with a real geocode + weather call.
 */
function mockClimate(): CityClimate {
  // Default city for demo: rotate across a small set so the UI doesn't
  // feel static across days. The "user is here" feel comes from showing
  // a single city consistently, not from precision.
  const CITIES: { city: string; region: string; baseHumidity: number; baseTempF: number }[] = [
    { city: 'Austin',   region: 'TX', baseHumidity: 68, baseTempF: 88 },
    { city: 'Phoenix',  region: 'AZ', baseHumidity: 22, baseTempF: 102 },
    { city: 'Miami',    region: 'FL', baseHumidity: 78, baseTempF: 86 },
    { city: 'Denver',   region: 'CO', baseHumidity: 35, baseTempF: 78 },
    { city: 'Seattle',  region: 'WA', baseHumidity: 72, baseTempF: 64 },
    { city: 'New York', region: 'NY', baseHumidity: 58, baseTempF: 74 },
  ];
  // Day-of-year index so the city is stable for a full day, then rotates.
  const day = Math.floor(Date.now() / 86_400_000);
  const pick = CITIES[day % CITIES.length];
  // Tiny within-day variation so the number doesn't look frozen but never
  // crosses a band boundary unfairly.
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
  };
}

/**
 * Returns the current-city climate. Async signature so the production
 * implementation (geolocation + network) can drop in without changing
 * call sites. The mock resolves synchronously-fast.
 */
export async function getCurrentCityClimate(): Promise<CityClimate> {
  return mockClimate();
}

/** Synchronous accessor for components that mount without an effect. */
export function getCurrentCityClimateSync(): CityClimate {
  return mockClimate();
}
