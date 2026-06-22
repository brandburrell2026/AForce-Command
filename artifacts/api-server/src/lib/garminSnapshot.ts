/**
 * Garmin Connect snapshot fetcher + pure normalization.
 *
 * Server-side mirror of the WHOOP snapshot module. Pure HTTP — no token
 * management, no persistence. Caller obtains a valid access token via
 * `GarminTokenManager.getValidAccessToken()` first.
 *
 * Contract (matches WHOOP):
 *   - Empty / blank token  -> empty snapshot, no network call.
 *   - Per-endpoint 4xx/5xx -> that endpoint's fields stay null. Other
 *     endpoints still contribute. Never throws on per-call failure.
 *   - Per-endpoint network throw -> caught + logged, fields stay null.
 *   - Garmin wire shape stays inside this module — the rest of the
 *     server consumes the normalized `GarminSnapshot` only.
 *
 * Garmin domains normalized: activity (steps), sleep (hours), HR
 * (resting HR + HRV), stress (avg stress level).
 *
 * NOTE ON ENDPOINTS: `GARMIN_API_BASE` and the per-domain paths are the
 * documented Garmin Health API REST summary endpoints. They are
 * overridable via `FetchGarminSnapshotOptions.apiBase` so the exact
 * values / query contract can be confirmed against the official Garmin
 * Developer Program portal once credentials are provisioned, without a
 * code change. The module is DORMANT regardless.
 */

import type { Logger } from "pino";

export const GARMIN_API_BASE = "https://apis.garmin.com/wellness-api/rest";

/** Default lookback window for "last night / today" summaries: 24h. */
export const GARMIN_SNAPSHOT_WINDOW_SECONDS = 24 * 60 * 60;

/** Normalized snapshot. Fields are honest to what Garmin reports — no
 *  forced one-to-one mapping onto WHOOP's metric set. */
export interface GarminSnapshot {
  /** Resting heart rate (bpm). */
  restingHeartRate: number | null;
  /** Overnight HRV average in milliseconds (Garmin reports RMSSD-based
   *  ms, not SDNN — named explicitly so it is never mistaken for the
   *  WHOOP SDNN field). */
  hrvMs: number | null;
  /** Last night's sleep in hours. */
  sleepHoursLastNight: number | null;
  /** Average stress level (Garmin 0–100 scale). */
  stress: number | null;
  /** Daily step count. */
  steps: number | null;
}

export const EMPTY_GARMIN_SNAPSHOT: GarminSnapshot = {
  restingHeartRate: null,
  hrvMs: null,
  sleepHoursLastNight: null,
  stress: null,
  steps: null,
};

export interface FetchGarminSnapshotOptions {
  /** OAuth2 bearer token. Null / blank = no fetch, empty snapshot. */
  accessToken: string | null;
  fetchImpl?: typeof fetch;
  /** Override the API base (defaults to the documented Garmin base). */
  apiBase?: string;
  /** Defaults to `Date.now`. Used to compute the summary time window. */
  nowMs?: () => number;
  /** Pino-ish logger for per-endpoint warnings. Defaults to no-op. */
  log?: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void };
}

/** Garmin "dailies" summary record (subset). */
interface GarminDailyRecord {
  restingHeartRateInBeatsPerMinute?: number | null;
  steps?: number | null;
  averageStressLevel?: number | null;
}

/** Garmin "sleeps" summary record (subset). */
interface GarminSleepRecord {
  /** Total measurable sleep in seconds. */
  sleepTimeInSeconds?: number | null;
  /** Alternative field some summaries use. */
  durationInSeconds?: number | null;
}

/** Garmin "hrv" summary record (subset). */
interface GarminHrvRecord {
  lastNightAvg?: number | null;
}

async function getJsonArray<T>(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
  log: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void },
): Promise<T[] | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      log.warn({ url, status: res.status }, "garmin fetch non-ok");
      return null;
    }
    const json = (await res.json()) as unknown;
    // Garmin Health API summary endpoints return a top-level array.
    if (Array.isArray(json)) return json as T[];
    return null;
  } catch (err) {
    log.warn({ url, err }, "garmin fetch threw");
    return null;
  }
}

/** Coerce only finite numbers; everything else -> null. Guards against
 *  Garmin returning NaN/strings/undefined leaking into the persisted
 *  biometrics blob. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Pull a snapshot of the Garmin metrics AForce consumes. Returns the
 * empty snapshot when no access token is available — never fabricates.
 */
export async function fetchGarminSnapshot(
  opts: FetchGarminSnapshotOptions,
): Promise<GarminSnapshot> {
  const token = opts.accessToken?.trim();
  if (!token) return { ...EMPTY_GARMIN_SNAPSHOT };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? { warn: () => undefined };
  const apiBase = opts.apiBase ?? GARMIN_API_BASE;
  const now = opts.nowMs ?? ((): number => Date.now());

  const endSec = Math.floor(now() / 1000);
  const startSec = endSec - GARMIN_SNAPSHOT_WINDOW_SECONDS;
  const win = `uploadStartTimeInSeconds=${startSec}&uploadEndTimeInSeconds=${endSec}`;

  const [dailies, sleeps, hrv] = await Promise.all([
    getJsonArray<GarminDailyRecord>(
      `${apiBase}/dailies?${win}`,
      token,
      fetchImpl,
      log,
    ),
    getJsonArray<GarminSleepRecord>(
      `${apiBase}/sleeps?${win}`,
      token,
      fetchImpl,
      log,
    ),
    getJsonArray<GarminHrvRecord>(
      `${apiBase}/hrv?${win}`,
      token,
      fetchImpl,
      log,
    ),
  ]);

  const daily = dailies?.[0] ?? null;
  const sleep = sleeps?.[0] ?? null;
  const hrvRec = hrv?.[0] ?? null;

  let sleepHoursLastNight: number | null = null;
  const sleepSec =
    num(sleep?.sleepTimeInSeconds) ?? num(sleep?.durationInSeconds);
  if (sleepSec !== null) {
    sleepHoursLastNight = Math.max(0, sleepSec) / 3600;
  }

  return {
    restingHeartRate: num(daily?.restingHeartRateInBeatsPerMinute),
    hrvMs: num(hrvRec?.lastNightAvg),
    sleepHoursLastNight,
    stress: num(daily?.averageStressLevel),
    steps: num(daily?.steps),
  };
}

/** Provider snapshot blob shape, mirroring the per-provider value under
 *  `aforce_user_state` biometrics (Garmin subset). */
export interface GarminProviderBlob {
  providerId: "garmin";
  restingHeartRate: number | null;
  hrvMs: number | null;
  sleepHoursLastNight: number | null;
  stress: number | null;
  steps: number | null;
  fetchedAt: number;
}

/** Pure: lift a GarminSnapshot into the persisted biometrics-blob entry. */
export function garminSnapshotToProviderBlob(
  s: GarminSnapshot,
  fetchedAt: number,
): GarminProviderBlob {
  return {
    providerId: "garmin",
    restingHeartRate: s.restingHeartRate,
    hrvMs: s.hrvMs,
    sleepHoursLastNight: s.sleepHoursLastNight,
    stress: s.stress,
    steps: s.steps,
    fetchedAt,
  };
}

/**
 * Pure: merge a Garmin provider snapshot into an existing biometrics
 * blob, preserving every other provider's entry untouched.
 * `existing === null` returns a blob containing only Garmin.
 */
export function mergeGarminIntoBiometrics(
  existing: Record<string, unknown> | null | undefined,
  garmin: GarminProviderBlob,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  next["garmin"] = garmin;
  return next;
}
