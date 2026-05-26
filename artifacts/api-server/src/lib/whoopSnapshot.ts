/**
 * WHOOP snapshot fetcher — server-side mirror of the mobile
 * `services/whoop.ts`. Pure HTTP — no token management, no
 * persistence. Caller is expected to have obtained a valid access
 * token via `WhoopTokenManager.getValidAccessToken()`.
 *
 * Contract (matches mobile):
 *   - Empty / blank token  -> empty snapshot, no network call.
 *   - Per-endpoint 4xx/5xx -> that endpoint's fields stay null.
 *     Other endpoints still contribute. Never throws on per-call
 *     failure; the worker treats partial data as valid.
 *   - Per-endpoint network throw -> caught + logged via the
 *     injected logger, that endpoint's fields stay null.
 *   - WHOOP wire shape stays inside this module — the rest of the
 *     server consumes the normalized `WhoopSnapshot` only.
 *
 * Endpoints (all under `/developer/v1`):
 *   GET /recovery?limit=1        -> recovery_score, hrv_rmssd_milli, resting_heart_rate
 *   GET /cycle?limit=1           -> strain
 *   GET /activity/sleep?limit=1  -> stage_summary.{total_in_bed_time_milli, total_awake_time_milli}
 *                                   sleepHoursLastNight = max(0, inBed - awake) / 3.6e6
 */

import type { Logger } from "pino";

export const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v1";

/** Normalized snapshot — same fields the mobile aggregator consumes. */
export interface WhoopSnapshot {
  recoveryPct: number | null;
  strain: number | null;
  hrvSdnn: number | null;
  restingHeartRate: number | null;
  sleepHoursLastNight: number | null;
}

export const EMPTY_WHOOP_SNAPSHOT: WhoopSnapshot = {
  recoveryPct: null,
  strain: null,
  hrvSdnn: null,
  restingHeartRate: null,
  sleepHoursLastNight: null,
};

export interface FetchWhoopSnapshotOptions {
  /** OAuth2 bearer token. Null / blank = no fetch, empty snapshot. */
  accessToken: string | null;
  fetchImpl?: typeof fetch;
  /** Pino-ish logger for per-endpoint warnings. Defaults to no-op. */
  log?: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void };
}

interface WhoopRecoveryPayload {
  records?: Array<{
    score?: {
      recovery_score?: number | null;
      hrv_rmssd_milli?: number | null;
      resting_heart_rate?: number | null;
    } | null;
  }>;
}

interface WhoopCyclePayload {
  records?: Array<{ score?: { strain?: number | null } | null }>;
}

interface WhoopSleepPayload {
  records?: Array<{
    score?: {
      stage_summary?: {
        total_in_bed_time_milli?: number | null;
        total_awake_time_milli?: number | null;
      } | null;
    } | null;
  }>;
}

async function getJson<T>(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
  log: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void },
): Promise<T | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      log.warn({ url, status: res.status }, "whoop fetch non-ok");
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log.warn({ url, err }, "whoop fetch threw");
    return null;
  }
}

/** Coerce only finite numbers; everything else -> null. Guards against
 *  WHOOP returning NaN/strings/`undefined` which would otherwise leak
 *  into the persisted biometrics blob. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Pull a snapshot of the metrics AForce consumes. Returns the empty
 * snapshot when no access token is available — never fabricates.
 */
export async function fetchWhoopSnapshot(
  opts: FetchWhoopSnapshotOptions,
): Promise<WhoopSnapshot> {
  const token = opts.accessToken?.trim();
  if (!token) return { ...EMPTY_WHOOP_SNAPSHOT };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? { warn: () => undefined };

  const [recovery, cycle, sleep] = await Promise.all([
    getJson<WhoopRecoveryPayload>(
      `${WHOOP_API_BASE}/recovery?limit=1`,
      token,
      fetchImpl,
      log,
    ),
    getJson<WhoopCyclePayload>(
      `${WHOOP_API_BASE}/cycle?limit=1`,
      token,
      fetchImpl,
      log,
    ),
    getJson<WhoopSleepPayload>(
      `${WHOOP_API_BASE}/activity/sleep?limit=1`,
      token,
      fetchImpl,
      log,
    ),
  ]);

  const rec = recovery?.records?.[0]?.score ?? null;
  const cyc = cycle?.records?.[0]?.score ?? null;
  const slp = sleep?.records?.[0]?.score?.stage_summary ?? null;

  let sleepHoursLastNight: number | null = null;
  const inBed = num(slp?.total_in_bed_time_milli);
  if (inBed !== null) {
    const awake = num(slp?.total_awake_time_milli) ?? 0;
    sleepHoursLastNight = Math.max(0, inBed - awake) / (1000 * 60 * 60);
  }

  return {
    recoveryPct: num(rec?.recovery_score),
    strain: num(cyc?.strain),
    hrvSdnn: num(rec?.hrv_rmssd_milli),
    restingHeartRate: num(rec?.resting_heart_rate),
    sleepHoursLastNight,
  };
}

/** Provider snapshot blob shape, mirroring
 *  `aforce_user_state.biometrics`'s per-provider value (subset of
 *  fields WHOOP populates). */
export interface WhoopProviderBlob {
  providerId: "whoop";
  restingHeartRate: number | null;
  hrvSdnn: number | null;
  sleepHoursLastNight: number | null;
  strain: number | null;
  recoveryPct: number | null;
  fetchedAt: number;
}

/** Pure: lift a WhoopSnapshot into the persisted biometrics-blob entry. */
export function whoopSnapshotToProviderBlob(
  s: WhoopSnapshot,
  fetchedAt: number,
): WhoopProviderBlob {
  return {
    providerId: "whoop",
    restingHeartRate: s.restingHeartRate,
    hrvSdnn: s.hrvSdnn,
    sleepHoursLastNight: s.sleepHoursLastNight,
    strain: s.strain,
    recoveryPct: s.recoveryPct,
    fetchedAt,
  };
}

/**
 * Pure: merge a WHOOP provider snapshot into an existing biometrics
 * blob, preserving every other provider's entry untouched.
 * `existing === null` (no providers yet) is fine — returns a blob
 * containing only WHOOP.
 */
export function mergeWhoopIntoBiometrics(
  existing: Record<string, unknown> | null | undefined,
  whoop: WhoopProviderBlob,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  next["whoop"] = whoop;
  return next;
}
