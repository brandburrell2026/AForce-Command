/**
 * Cruise Mode environment route.
 *
 * Pulls live conditions for a known cruise port from the OpenWeather
 * Current Weather API and shapes them for the AForce OS Cruise Mode
 * screen. Caches each port for 10 minutes to stay well under free-tier
 * quota and to give the orb a stable signal between scrolls.
 *
 * GET /api/cruise/environment?port=<id>
 *   200 → { port, portName, lat, lon, ambientTempF, humidityPct,
 *           windKts, sunExposureHours, conditions, iconCode,
 *           fetchedAt, source }
 *   400 → { error: "unknown port" }
 *   503 → { error: "weather upstream unavailable", port, portName, ... fallback }
 *
 * GET /api/cruise/ports
 *   200 → { ports: [{ id, name, line, region, lat, lon }, ...] }
 */

import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

interface CruisePort {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
}

const PORTS: ReadonlyArray<CruisePort> = [
  { id: "miami", name: "Miami, FL", region: "US East Coast", lat: 25.7617, lon: -80.1918 },
  { id: "cozumel", name: "Cozumel, MX", region: "Western Caribbean", lat: 20.5083, lon: -86.9458 },
  { id: "nassau", name: "Nassau, BS", region: "Bahamas", lat: 25.0480, lon: -77.3554 },
  { id: "st_thomas", name: "St. Thomas, USVI", region: "Eastern Caribbean", lat: 18.3358, lon: -64.9307 },
  { id: "cayman", name: "Grand Cayman, KY", region: "Western Caribbean", lat: 19.3133, lon: -81.2546 },
  { id: "juneau", name: "Juneau, AK", region: "Alaska", lat: 58.3019, lon: -134.4197 },
  { id: "barcelona", name: "Barcelona, ES", region: "Mediterranean", lat: 41.3851, lon: 2.1734 },
];

const PORT_BY_ID = new Map(PORTS.map((p) => [p.id, p]));

interface OpenWeatherResponse {
  main?: { temp?: number; humidity?: number };
  wind?: { speed?: number };
  clouds?: { all?: number };
  weather?: Array<{ main?: string; description?: string; icon?: string }>;
}

interface CruiseEnvironment {
  port: string;
  portName: string;
  lat: number;
  lon: number;
  ambientTempF: number;
  humidityPct: number;
  windKts: number;
  sunExposureHours: number;
  conditions: string;
  iconCode: string | null;
  fetchedAt: string | null;
  source: "openweather" | "fallback";
}

/** Estimate hours of meaningful direct sun a guest is likely to get. */
function deriveSunHours(cloudsPct: number, conditionMain: string): number {
  const c = (conditionMain || "").toLowerCase();
  if (c.includes("rain") || c.includes("storm") || c.includes("snow")) return 0.5;
  if (cloudsPct >= 85) return 1;
  if (cloudsPct >= 60) return 2.5;
  if (cloudsPct >= 30) return 5;
  return 7;
}

const CACHE = new Map<string, { exp: number; payload: CruiseEnvironment }>();
const TTL_MS = 10 * 60 * 1000;

function fallbackFor(port: CruisePort): CruiseEnvironment {
  // Realistic warm-Caribbean baseline so the orb still has signal if upstream fails.
  return {
    port: port.id,
    portName: port.name,
    lat: port.lat,
    lon: port.lon,
    ambientTempF: 84,
    humidityPct: 72,
    windKts: 8,
    sunExposureHours: 5,
    conditions: "Partly cloudy",
    iconCode: null,
    // Wave-3 PR10: these values were never fetched — a fresh stamp on
    // fabricated data is FRESH-TIMESTAMP-ON-STALE-DATA. null + the
    // explicit 'fallback' source is the honest wire truth.
    fetchedAt: null,
    source: "fallback",
  };
}

router.get("/cruise/ports", (_req, res) => {
  res.json({ ports: PORTS });
});

router.get("/cruise/environment", async (req: Request, res: Response) => {
  const portId = String(req.query.port ?? "").trim();
  if (!portId) {
    res.status(400).json({ error: "missing port query parameter" });
    return;
  }
  const port = PORT_BY_ID.get(portId);
  if (!port) {
    res.status(400).json({ error: "unknown port", port: portId });
    return;
  }

  const cached = CACHE.get(port.id);
  if (cached && cached.exp > Date.now()) {
    res.json(cached.payload);
    return;
  }

  const apiKey = process.env["OPENWEATHER_API_KEY"];
  if (!apiKey) {
    req.log.warn({ portId }, "OPENWEATHER_API_KEY not set; using fallback");
    res.status(200).json(fallbackFor(port));
    return;
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(port.lat));
  url.searchParams.set("lon", String(port.lon));
  url.searchParams.set("units", "imperial");
  url.searchParams.set("appid", apiKey);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const upstream = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!upstream.ok) {
      req.log.warn(
        { portId, status: upstream.status },
        "OpenWeather upstream non-200; using fallback",
      );
      res.status(200).json(fallbackFor(port));
      return;
    }

    const data = (await upstream.json()) as OpenWeatherResponse;
    const tempF = Math.round(data.main?.temp ?? 84);
    const humidity = Math.round(data.main?.humidity ?? 72);
    const windMph = data.wind?.speed ?? 9;
    const windKts = Math.round(windMph * 0.868976 * 10) / 10;
    const cloudsPct = data.clouds?.all ?? 40;
    const conditionMain = data.weather?.[0]?.main ?? "Clear";
    const conditionDesc =
      data.weather?.[0]?.description ?? conditionMain.toLowerCase();
    const iconCode = data.weather?.[0]?.icon ?? null;

    const payload: CruiseEnvironment = {
      port: port.id,
      portName: port.name,
      lat: port.lat,
      lon: port.lon,
      ambientTempF: tempF,
      humidityPct: humidity,
      windKts,
      sunExposureHours: deriveSunHours(cloudsPct, conditionMain),
      conditions: conditionDesc.replace(/\b\w/g, (c) => c.toUpperCase()),
      iconCode,
      fetchedAt: new Date().toISOString(),
      source: (data.main?.temp == null || data.main?.humidity == null) ? "fallback" as const : "openweather" as const,
    };

    CACHE.set(port.id, { exp: Date.now() + TTL_MS, payload });
    res.json(payload);
  } catch (err) {
    req.log.warn({ portId, err: String(err) }, "OpenWeather fetch failed; using fallback");
    res.status(200).json(fallbackFor(port));
  }
});

export default router;
