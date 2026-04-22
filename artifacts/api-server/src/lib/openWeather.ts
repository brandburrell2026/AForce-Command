/**
 * Server-side OpenWeather client.
 *
 * The API key NEVER leaves the server. The Expo app calls our
 * `/api/aforce/weather` endpoint with `lat,lon`, we call OpenWeather,
 * cache the response in memory for 10 minutes per coordinate, and
 * return tempC + humidity + city.
 *
 * Why server-side caching:
 *   - OpenWeather's free tier is 60 calls/minute. The app polls
 *     periodically and we have multiple sockets — a 10-minute cache
 *     keeps us comfortably under the limit even with many users.
 *   - Coordinates are rounded to 2 decimals (~1km) for the cache key
 *     so two athletes in the same neighborhood share a cache hit.
 */

import { logger } from "./logger";

export interface WeatherSnapshot {
  tempC: number;
  humidity: number;
  city: string;
  fetchedAt: number;
}

interface CacheEntry {
  snapshot: WeatherSnapshot;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  const apiKey = process.env["OPENWEATHER_API_KEY"];
  if (!apiKey) {
    logger.warn("OPENWEATHER_API_KEY not set — weather lookup skipped");
    return null;
  }

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: body.slice(0, 200) }, "OpenWeather non-2xx");
      // Fresh keys take ~10 min to activate — don't cache failures.
      return cached?.snapshot ?? null;
    }
    const data = (await res.json()) as {
      main?: { temp?: number; humidity?: number };
      name?: string;
    };
    const tempC = data.main?.temp;
    const humidity = data.main?.humidity;
    if (typeof tempC !== "number" || typeof humidity !== "number") {
      logger.warn({ data }, "OpenWeather response missing main.temp/humidity");
      return cached?.snapshot ?? null;
    }
    const snapshot: WeatherSnapshot = {
      tempC,
      humidity,
      city: data.name ?? "Unknown",
      fetchedAt: Date.now(),
    };
    cache.set(key, { snapshot, expiresAt: Date.now() + TTL_MS });
    return snapshot;
  } catch (err) {
    logger.warn({ err }, "OpenWeather fetch failed");
    return cached?.snapshot ?? null;
  }
}
