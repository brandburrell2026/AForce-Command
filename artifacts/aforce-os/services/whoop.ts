/**
 * WHOOP bridge for AForce OS.
 *
 * WHOOP exposes data via OAuth2 cloud API — there's no native
 * platform restriction, so this module works on iOS, Android, and
 * web (unlike Apple Health / Samsung Health which are platform-
 * gated). Real integration calls the WHOOP REST API with a stored
 * access token; this module isolates the call shape so the rest of
 * the app can request a snapshot without caring about HTTP details.
 *
 * Contract:
 *   - If no access token is stored, every field stays null. We
 *     never fabricate data.
 *   - Sleep: a non-positive `inBed - awake` net reports as null, not
 *     0 — see the derivation in `fetchWhoopSnapshot`. This rule is
 *     MIRRORED in the server lane (`api-server/src/lib/whoopSnapshot.ts`);
 *     the two must change together or the lanes disagree about the
 *     same night.
 *   - WHOOP's primary signals are strain (0–21), recovery % (0–100),
 *     HRV (ms), and sleep duration (hours). The aggregator already
 *     consumes all four.
 */

import type { ProviderSnapshot } from '../types/biometrics';

export interface WhoopSnapshot {
  /** WHOOP recovery percentage (0–100, higher = more recovered). */
  recoveryPct: number | null;
  /** WHOOP strain score (0–21). */
  strain: number | null;
  /** HRV — RMSSD on WHOOP, mapped onto SDNN for cross-provider use. */
  hrvSdnn: number | null;
  /** Most recent resting HR (bpm). */
  restingHeartRate: number | null;
  /** Total sleep duration for the prior night (hours). */
  sleepHoursLastNight: number | null;
}

const EMPTY_SNAPSHOT: WhoopSnapshot = {
  recoveryPct: null,
  strain: null,
  hrvSdnn: null,
  restingHeartRate: null,
  sleepHoursLastNight: null,
};

export const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';

export interface WhoopFetchOptions {
  /** OAuth2 bearer token. Null / missing = no fetch, empty snapshot. */
  accessToken: string | null;
  /** Override for tests / DI. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
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
    score?: { stage_summary?: { total_in_bed_time_milli?: number | null; total_awake_time_milli?: number | null } | null } | null;
  }>;
}

async function getJson<T>(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<T | null> {
  try {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn('[WHOOP] fetch non-ok', url, res.status);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[WHOOP] fetch failed', url, err);
    return null;
  }
}

/**
 * Pull a snapshot of the metrics AForce consumes. Returns the empty
 * snapshot when no access token is available — never fabricates.
 */
export async function fetchWhoopSnapshot(
  opts: WhoopFetchOptions,
): Promise<WhoopSnapshot> {
  const token = opts.accessToken?.trim();
  if (!token) return EMPTY_SNAPSHOT;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const [recovery, cycle, sleep] = await Promise.all([
    getJson<WhoopRecoveryPayload>(`${WHOOP_API_BASE}/recovery?limit=1`, token, fetchImpl),
    getJson<WhoopCyclePayload>(`${WHOOP_API_BASE}/cycle?limit=1`, token, fetchImpl),
    getJson<WhoopSleepPayload>(`${WHOOP_API_BASE}/activity/sleep?limit=1`, token, fetchImpl),
  ]);

  const rec = recovery?.records?.[0]?.score ?? null;
  const cyc = cycle?.records?.[0]?.score ?? null;
  const slp = sleep?.records?.[0]?.score?.stage_summary ?? null;

  let sleepHoursLastNight: number | null = null;
  if (slp && typeof slp.total_in_bed_time_milli === 'number') {
    const inBed = slp.total_in_bed_time_milli;
    const awake = slp.total_awake_time_milli ?? 0;
    // A non-positive net is never a measured night: awake >= inBed is a WHOOP
    // data glitch, and inBed <= 0 is a zeroed/placeholder stage_summary. The
    // old `Math.max(0, …)` clamp published both as a confident 0h, which
    // downstream reads as a maximal sleep deficit. Report unknown instead.
    const netMs = inBed - awake;
    sleepHoursLastNight = netMs > 0 ? netMs / (1000 * 60 * 60) : null;
  }

  return {
    recoveryPct: rec?.recovery_score ?? null,
    strain: cyc?.strain ?? null,
    hrvSdnn: rec?.hrv_rmssd_milli ?? null,
    restingHeartRate: rec?.resting_heart_rate ?? null,
    sleepHoursLastNight,
  };
}

/**
 * Pure: lift a WhoopSnapshot into the cross-provider
 * `ProviderSnapshot` shape consumed by the aggregator.
 */
export function toProviderSnapshot(s: WhoopSnapshot, fetchedAt: number): ProviderSnapshot {
  return {
    providerId: 'whoop',
    restingHeartRate: s.restingHeartRate,
    hrvSdnn: s.hrvSdnn,
    sleepHoursLastNight: s.sleepHoursLastNight,
    strain: s.strain,
    recoveryPct: s.recoveryPct,
    fetchedAt,
  };
}
