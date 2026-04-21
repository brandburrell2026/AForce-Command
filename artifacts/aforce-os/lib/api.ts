/**
 * AForce OS API client.
 *
 * Provides a typed fetch wrapper for talking to the @workspace/api-server.
 * Identifies the device via a persistent `deviceId` (random uuid stored in
 * AsyncStorage on first launch). Every request includes it as `x-device-id`.
 *
 * URL resolution:
 *   - Web (Expo on web preview): same-origin /api  (the workspace proxy
 *     routes /api → the api-server artifact).
 *   - Native dev: https://$EXPO_PUBLIC_DOMAIN/api  (same proxy, absolute).
 *   - Native prod: same as dev — EXPO_PUBLIC_DOMAIN is baked at build.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "aforce.deviceId";

let cachedDeviceId: string | null = null;

function generateId(): string {
  // Lightweight uuid-ish; not cryptographic, only used as an opaque stable id.
  const t = Date.now().toString(36);
  const r =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
  return `dev_${t}_${r}`;
}

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 6) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch {
    // AsyncStorage unavailable — fall back to in-memory id (still useful per session).
  }
  const fresh = generateId();
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  } catch {
    // Best-effort persistence; in-memory fallback still works for the session.
  }
  cachedDeviceId = fresh;
  return fresh;
}

function getApiBase(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/api`;
    }
    return "/api";
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    const stripped = domain.replace(/^https?:\/\//, "");
    return `https://${stripped}/api`;
  }
  // Last-resort fallback for local Expo runs without the env var.
  return "http://localhost:8080/api";
}

export interface ApiError {
  status: number;
  message: string;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const deviceId = await getDeviceId();
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-device-id": deviceId,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: ApiError = { status: res.status, message: text || res.statusText };
    throw err;
  }
  return (await res.json()) as T;
}

// ─── Scans ───────────────────────────────────────────────────────────────────
export interface ServerScan {
  id: string;
  loggedAt: string;
  source: "barcode" | "qr" | "manual" | "camera";
  rawValue: string;
  productId: string | null;
  productName: string;
  brand: string | null;
  verdict: string;
  fitScore: number;
  scoreBefore: number;
  scoreAfter: number;
  performanceState: string;
  recommendedProductId: string | null;
}

export async function fetchScans(limit = 50): Promise<ServerScan[]> {
  const data = await request<{ scans: ServerScan[] }>("GET", `/scans?limit=${limit}`);
  return data.scans;
}

export async function postScan(scan: Omit<ServerScan, "id"> & { id?: string }): Promise<ServerScan> {
  const data = await request<{ scan: ServerScan }>("POST", "/scans", scan);
  return data.scan;
}

// ─── Cycles ──────────────────────────────────────────────────────────────────
export interface ServerCycle {
  id: string;
  loggedAt: string;
  fluidType: string;
  ozAmount: number;
  scoreBefore: number;
  scoreAfter: number;
  performanceState: string;
}

export interface CycleStats {
  totalScans: number;
  totalCycles: number;
  last7DaysScans: number;
}

export async function fetchCycles(limit = 50): Promise<{ cycles: ServerCycle[]; stats: CycleStats }> {
  return request<{ cycles: ServerCycle[]; stats: CycleStats }>("GET", `/cycles?limit=${limit}`);
}

export async function postCycle(cycle: Omit<ServerCycle, "id"> & { id?: string }): Promise<ServerCycle> {
  const data = await request<{ cycle: ServerCycle }>("POST", "/cycles", cycle);
  return data.cycle;
}
