/**
 * Strava = activity contributor only; never a recovery/sleep/readiness
 * source.
 *
 * Strava snapshot fetcher + pure normalization. Server-side mirror of
 * the WHOOP / Garmin / Oura snapshot modules. Pure HTTP — no token
 * management, no persistence. Caller obtains a valid access token via
 * `StravaTokenManager.getValidAccessToken()` first.
 *
 * Contract (matches WHOOP/Garmin/Oura):
 *   - Empty / blank token -> empty snapshot, no network call.
 *   - Non-2xx / network throw -> empty snapshot, logged, never throws.
 *
 * Strava only has ONE endpoint this integration needs (there's no
 * separate recovery/sleep/readiness endpoint to fan out to — Strava's
 * API simply doesn't expose those signals), so there's no
 * per-endpoint partial-failure matrix like Oura/WHOOP have; a single
 * failure empties the whole snapshot.
 *
 * Endpoint + fields — verified against Strava's official API
 * reference (https://developers.strava.com/docs/reference/, 2026-07):
 *
 *   GET https://www.strava.com/api/v3/athlete/activities
 *     ?after=<epoch seconds>&per_page=<n>
 *     -> SummaryActivity[] (a bare JSON array, NOT wrapped in an
 *        envelope like Oura's `{data: [...]}`)
 *     Fields used: `moving_time` (seconds), `suffer_score` (integer,
 *     "when available" per Strava's docs — this is Strava's relative-
 *     effort / perceived-exertion metric).
 *   `after` is a documented epoch-timestamp filter ("filtering
 *   activities that have taken place after a certain time"); `page`/
 *   `per_page` paginate (default page=1, per_page=30). Only the first
 *   page is read here — the request window is narrow (last 24h), so a
 *   second page would be pathological, not a steady-state case (same
 *   reasoning as `ouraSnapshot.ts`).
 *
 * Field mapping / documented choices:
 *   - workoutMinutesToday = sum of `moving_time` (seconds -> minutes)
 *     across every activity in the fetch window. The window is a
 *     ROLLING 24h anchored on `nowMs`, not a timezone-aware "local
 *     day" — Strava's activities list has no per-athlete timezone
 *     context available to this fetcher, so this mirrors
 *     `ouraSnapshot.ts`'s same rolling-window approximation for
 *     "today". Documented assumption, not a verified Strava contract.
 *   - trainingLoad = SUM of `suffer_score` across the window, not the
 *     latest single value. Choice: `ProviderSnapshot.trainingLoad` is
 *     documented as a "7-day acute training load (arbitrary CTL/ATL
 *     units)" — an accumulated-stress signal, not a point-in-time
 *     score like Oura's daily readiness. Summing each activity's
 *     relative-effort contribution over the window is the closer
 *     analog to a training-load aggregate; "latest" would just reflect
 *     one workout and throw away every other activity in the window.
 *     Activities with a missing/non-finite `suffer_score` contribute
 *     zero to the sum rather than being dropped (Strava's docs mark
 *     the field as present "when available", so most activities won't
 *     have it — most windows will legitimately sum to 0, not null,
 *     when at least one activity exists but none report a score).
 *   - restingHeartRate, hrvSdnn, sleepHoursLastNight, stepsToday,
 *     strain, recoveryPct, readinessScore, stressScore are NEVER
 *     populated by this module — Strava's API has no such data.
 */

import type { Logger } from "pino";

export const STRAVA_API_BASE = "https://www.strava.com/api/v3";

/** Normalized snapshot — the fields AForce consumes from Strava.
 *  Deliberately does NOT list the recovery/sleep/readiness fields
 *  Strava never contributes (see module doc comment) — mirrors the
 *  per-provider-subset convention `whoopSnapshot.ts` / `ouraSnapshot.ts`
 *  use rather than padding out the full cross-provider shape. */
export interface StravaSnapshot {
  workoutMinutesToday: number | null;
  /** Summed relative-effort (`suffer_score`) signal — see module doc
   *  comment for why SUM was chosen over "latest". */
  trainingLoad: number | null;
}

export const EMPTY_STRAVA_SNAPSHOT: StravaSnapshot = {
  workoutMinutesToday: null,
  trainingLoad: null,
};

export interface FetchStravaSnapshotOptions {
  /** OAuth2 bearer token. Null / blank = no fetch, empty snapshot. */
  accessToken: string | null;
  fetchImpl?: typeof fetch;
  /** Override the API base (defaults to the documented Strava v3 base). */
  apiBase?: string;
  /** Defaults to `Date.now`. Used to compute the `after` window. */
  nowMs?: () => number;
  /** Pino-ish logger for warnings. Defaults to no-op. */
  log?: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void };
}

interface StravaSummaryActivity {
  moving_time?: number | null;
  suffer_score?: number | null;
}

/** Coerce only finite numbers; everything else -> null/0. Guards
 *  against Strava returning NaN/strings/undefined leaking into the
 *  persisted biometrics blob. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Pull a snapshot of the Strava activity metrics AForce consumes.
 * Returns the empty snapshot when no access token is available —
 * never fabricates.
 */
export async function fetchStravaSnapshot(
  opts: FetchStravaSnapshotOptions,
): Promise<StravaSnapshot> {
  const token = opts.accessToken?.trim();
  if (!token) return { ...EMPTY_STRAVA_SNAPSHOT };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? { warn: () => undefined };
  const apiBase = opts.apiBase ?? STRAVA_API_BASE;
  const now = opts.nowMs ?? ((): number => Date.now());

  const afterEpochSeconds = Math.floor((now() - 24 * 60 * 60 * 1000) / 1000);
  const url = `${apiBase}/athlete/activities?after=${afterEpochSeconds}&per_page=50`;

  let activities: StravaSummaryActivity[] | null = null;
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      log.warn({ url, status: res.status }, "strava fetch non-ok");
      return { ...EMPTY_STRAVA_SNAPSHOT };
    }
    const json = (await res.json()) as unknown;
    activities = Array.isArray(json) ? (json as StravaSummaryActivity[]) : null;
    if (activities === null) {
      log.warn({ url }, "strava fetch: unexpected non-array payload");
      return { ...EMPTY_STRAVA_SNAPSHOT };
    }
  } catch (err) {
    log.warn({ url, err }, "strava fetch threw");
    return { ...EMPTY_STRAVA_SNAPSHOT };
  }

  if (activities.length === 0) {
    return { ...EMPTY_STRAVA_SNAPSHOT };
  }

  let movingTimeSeconds = 0;
  let sufferScoreSum = 0;
  for (const activity of activities) {
    movingTimeSeconds += num(activity.moving_time) ?? 0;
    sufferScoreSum += num(activity.suffer_score) ?? 0;
  }

  return {
    workoutMinutesToday: movingTimeSeconds / 60,
    trainingLoad: sufferScoreSum,
  };
}

/** Provider snapshot blob shape, mirroring the per-provider value under
 *  `aforce_user_state` biometrics (Strava subset — see
 *  `artifacts/aforce-os/types/biometrics.ts` for the shared shape). */
export interface StravaProviderBlob {
  providerId: "strava";
  workoutMinutesToday: number | null;
  trainingLoad: number | null;
  fetchedAt: number;
}

/** Pure: lift a StravaSnapshot into the persisted biometrics-blob entry. */
export function stravaSnapshotToProviderBlob(
  s: StravaSnapshot,
  fetchedAt: number,
): StravaProviderBlob {
  return {
    providerId: "strava",
    workoutMinutesToday: s.workoutMinutesToday,
    trainingLoad: s.trainingLoad,
    fetchedAt,
  };
}

/**
 * Pure: merge a Strava provider snapshot into an existing biometrics
 * blob, preserving every other provider's entry untouched.
 * `existing === null` returns a blob containing only Strava.
 */
export function mergeStravaIntoBiometrics(
  existing: Record<string, unknown> | null | undefined,
  strava: StravaProviderBlob,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  next["strava"] = strava;
  return next;
}
