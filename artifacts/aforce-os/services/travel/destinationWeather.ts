/**
 * Travel Intelligence — destination weather (T2 data layer).
 *
 * Fetches conditions for a trip's DESTINATION from Open-Meteo (keyless, the
 * provider the app already uses). Every value carries its source:
 *  - 'live'        current conditions, aged by the provider's own timestamp;
 *  - 'forecast'    the provider's hourly forecast at the planned arrival;
 *  - 'unavailable' anything we could not get.
 *
 * There is deliberately NO mock fallback. The location service's daily mock
 * must never reach Travel: a failure is shown as unavailable, never as data.
 * Only a destination with coordinates (a featured registry city) is fetched;
 * other airports stay unavailable rather than being guessed.
 */

import {
  TRAVEL_FORECAST_HORIZON_DAYS,
  TRAVEL_WEATHER_CACHE_MS,
  TRAVEL_WEATHER_MAX_AGE_MIN,
} from '@/config/hydroStateModel';
import {
  classifyHeat,
  classifyHumidity,
  classifyUv,
} from '@/utils/location/locationIntelligence';
import type { ArrivalConditions } from '@/utils/travel/arrivalProtocol';
import type { SunTimes } from '@/utils/travel/travelTime';
import { unavailable, type Sourced, type TravelPlace } from '@/utils/travel/travelTypes';

export type WeatherFailure = 'no_coordinates' | 'network' | 'invalid_response' | 'beyond_forecast';

export interface DestinationWeather {
  temperatureC: Sourced<number>;
  humidityPct: Sourced<number>;
  uvIndex: Sourced<number>;
  /** WMO weather code (Open-Meteo `weather_code`). */
  weatherCode: Sourced<number>;
  /** Bands for the arrival plan. All null when the reading is old or missing. */
  conditions: ArrivalConditions;
  /** Provider sunrise/sunset for the destination's local day, when known. */
  sun: SunTimes | null;
  /** True when current conditions are older than TRAVEL_WEATHER_MAX_AGE_MIN. */
  stale: boolean;
  failure: WeatherFailure | null;
}

const NO_CONDITIONS: ArrivalConditions = { heat: null, humidity: null, uv: null };

export function unavailableWeather(failure: WeatherFailure): DestinationWeather {
  return {
    temperatureC: unavailable(),
    humidityPct: unavailable(),
    uvIndex: unavailable(),
    weatherCode: unavailable(),
    conditions: NO_CONDITIONS,
    sun: null,
    stale: false,
    failure,
  };
}

interface OpenMeteoResponse {
  current?: {
    time?: number;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    uv_index?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: number[];
    temperature_2m?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    uv_index?: (number | null)[];
    weather_code?: (number | null)[];
  };
  daily?: { time?: number[]; sunrise?: number[]; sunset?: number[] };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function destinationWeatherUrl(latitude: number, longitude: number): string {
  return (
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    '&current=temperature_2m,relative_humidity_2m,uv_index,weather_code' +
    '&hourly=temperature_2m,relative_humidity_2m,uv_index,weather_code' +
    '&daily=sunrise,sunset' +
    `&forecast_days=${TRAVEL_FORECAST_HORIZON_DAYS}` +
    '&timezone=auto&timeformat=unixtime'
  );
}

/** Pure: turn a provider response into sourced weather for `atMs`. */
export function parseDestinationWeather(
  body: unknown,
  nowMs: number,
  atMs: number,
): DestinationWeather {
  if (!body || typeof body !== 'object') return unavailableWeather('invalid_response');
  const r = body as OpenMeteoResponse;

  // Sun times for the local day containing `atMs`.
  let sun: SunTimes | null = null;
  const days = r.daily?.time ?? [];
  for (let i = 0; i < days.length; i++) {
    const rise = num(r.daily?.sunrise?.[i]);
    const set = num(r.daily?.sunset?.[i]);
    if (rise == null || set == null) continue;
    const riseMs = rise * 1000;
    const nextDay = num(days[i + 1]);
    const dayEndMs = nextDay != null ? nextDay * 1000 : (num(days[i]) ?? 0) * 1000 + 86_400_000;
    if (atMs < dayEndMs) {
      sun = { sunriseMs: riseMs, sunsetMs: set * 1000 };
      break;
    }
  }

  const arrivingLater = atMs - nowMs > 60 * 60_000;
  if (arrivingLater) {
    const times = r.hourly?.time ?? [];
    if (!times.length) return unavailableWeather('invalid_response');
    const target = atMs / 1000;
    const last = num(times[times.length - 1]);
    if (last == null || target > last + 3600) return { ...unavailableWeather('beyond_forecast'), sun };
    let best = 0;
    for (let i = 1; i < times.length; i++) {
      if (Math.abs((times[i] ?? 0) - target) < Math.abs((times[best] ?? 0) - target)) best = i;
    }
    const at = (times[best] ?? 0) * 1000;
    const f = <T,>(v: T | null | undefined): Sourced<number> => {
      const n = num(v);
      return n == null ? unavailable() : { value: n, source: 'forecast', observedAtMs: at };
    };
    const t = f(r.hourly?.temperature_2m?.[best]);
    const h = f(r.hourly?.relative_humidity_2m?.[best]);
    const u = f(r.hourly?.uv_index?.[best]);
    return {
      temperatureC: t,
      humidityPct: h,
      uvIndex: u,
      weatherCode: f(r.hourly?.weather_code?.[best]),
      conditions: {
        heat: classifyHeat(t.value),
        humidity: classifyHumidity(h.value),
        uv: classifyUv(u.value),
      },
      sun,
      stale: false,
      failure: null,
    };
  }

  const c = r.current;
  const observed = num(c?.time);
  if (!c || observed == null) return { ...unavailableWeather('invalid_response'), sun };
  const observedAtMs = observed * 1000;
  const stale = nowMs - observedAtMs > TRAVEL_WEATHER_MAX_AGE_MIN * 60_000;
  const l = (v: unknown): Sourced<number> => {
    const n = num(v);
    return n == null ? unavailable() : { value: n, source: 'live', observedAtMs };
  };
  const t = l(c.temperature_2m);
  const h = l(c.relative_humidity_2m);
  const u = l(c.uv_index);
  return {
    temperatureC: t,
    humidityPct: h,
    uvIndex: u,
    weatherCode: l(c.weather_code),
    conditions: stale
      ? NO_CONDITIONS
      : { heat: classifyHeat(t.value), humidity: classifyHumidity(h.value), uv: classifyUv(u.value) },
    sun,
    stale,
    failure: null,
  };
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const cache = new Map<string, { at: number; body: unknown }>();

/** Test hook: forget cached responses. */
export function resetDestinationWeatherCache(): void {
  cache.clear();
}

/**
 * Weather for `place` around `atMs` (now, or a planned arrival). One network
 * call per destination per TRAVEL_WEATHER_CACHE_MS. Never throws.
 */
export async function getDestinationWeather(
  place: TravelPlace,
  atMs: number,
  options: { fetch?: FetchLike; now?: () => number; signal?: AbortSignal } = {},
): Promise<DestinationWeather> {
  if (place.latitude == null || place.longitude == null) return unavailableWeather('no_coordinates');
  const now = options.now?.() ?? Date.now();
  const url = destinationWeatherUrl(place.latitude, place.longitude);
  const hit = cache.get(url);
  let body: unknown;
  if (hit && now - hit.at < TRAVEL_WEATHER_CACHE_MS) {
    body = hit.body;
  } else {
    try {
      const doFetch: FetchLike = options.fetch ?? ((u, init) => fetch(u, init));
      const res = await doFetch(url, { signal: options.signal });
      if (!res.ok) return unavailableWeather('network');
      body = await res.json();
    } catch {
      return unavailableWeather('network');
    }
    cache.set(url, { at: now, body });
  }
  return parseDestinationWeather(body, now, atMs);
}
