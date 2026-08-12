/**
 * Live cruise environment fetcher.
 *
 * Hits the api-server `/cruise/environment` endpoint, which proxies
 * OpenWeather. Returns a typed object the Cruise Mode screen merges into
 * the active demo session before scoring.
 *
 * Falls back gracefully — the api-server itself returns a deterministic
 * Caribbean baseline when upstream is unavailable, so the orb is never
 * blank.
 */

import { API_BASE } from "@/lib/apiBase";

export type CruiseEnvSource = "openweather" | "fallback";

export interface CruiseLiveEnvironment {
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
  fetchedAt: string;
  source: CruiseEnvSource;
}

export interface CruisePortMeta {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
}

// Wave-3 PR1: canonical resolver (lib/apiBase) — was one of five copies.
const BASE = API_BASE;

export async function fetchCruisePorts(): Promise<CruisePortMeta[]> {
  const res = await fetch(`${BASE}/cruise/ports`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`cruise/ports ${res.status}`);
  const data = (await res.json()) as { ports: CruisePortMeta[] };
  return Array.isArray(data?.ports) ? data.ports : [];
}

export async function fetchCruiseEnvironment(
  portId: string,
): Promise<CruiseLiveEnvironment> {
  const url = `${BASE}/cruise/environment?port=${encodeURIComponent(portId)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`cruise/environment ${res.status}`);
  return (await res.json()) as CruiseLiveEnvironment;
}
