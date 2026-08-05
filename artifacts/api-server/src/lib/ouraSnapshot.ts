/**
 * Oura Ring snapshot fetcher + pure normalization.
 *
 * Server-side mirror of the WHOOP / Garmin snapshot modules. Pure
 * HTTP — no token management, no persistence. Caller obtains a valid
 * access token via `OuraTokenManager.getValidAccessToken()` first.
 *
 * Contract (matches WHOOP/Garmin):
 *   - Empty / blank token  -> empty snapshot, no network call.
 *   - Per-endpoint 4xx/5xx -> that endpoint's fields stay null. Other
 *     endpoints still contribute. Never throws on per-call failure.
 *   - Per-endpoint network throw -> caught + logged, fields stay null.
 *   - Oura wire shape stays inside this module — the rest of the
 *     server consumes the normalized `OuraSnapshot` only.
 *
 * Endpoints + fields — verified against Oura API v2 usercollection
 * docs (https://cloud.ouraring.com/v2/docs, 2026-07) and cross-checked
 * against the response examples documented by the `oura-ring` Python
 * client (a maintained third-party wrapper around the same v2 API):
 *
 *   GET /v2/usercollection/daily_readiness?start_date=&end_date=
 *     -> { data: [{ score, contributors: {...} }] }
 *     readinessScore = latest record's `score` (0-100).
 *
 *   GET /v2/usercollection/sleep?start_date=&end_date=
 *     (the DETAILED sleep-period resource, distinct from
 *     `daily_sleep` which only carries a score + contributors)
 *     -> { data: [{ total_sleep_duration, average_hrv,
 *                    lowest_heart_rate, type, bedtime_end, ... }] }
 *     sleepHoursLastNight = latest record's `total_sleep_duration`
 *       (seconds) / 3600.
 *     hrvSdnn = latest record's `average_hrv`. NOTE: despite the
 *       shared field name (kept for parity with the cross-provider
 *       `ProviderSnapshot.hrvSdnn` shape), Oura's `average_hrv` is an
 *       RMSSD-based statistic in MILLISECONDS, not true SDNN — same
 *       caveat WHOOP's `hrv_rmssd_milli` carries and Garmin documents
 *       separately as `hrvMs`. Never treat this as a true SDNN value.
 *     restingHeartRate = latest record's `lowest_heart_rate` (bpm).
 *       Oura's v2 API has no field literally named "resting heart
 *       rate"; `lowest_heart_rate` (the lowest HR observed during the
 *       sleep period) is the closest documented analog and is what
 *       Oura's own apps surface as the resting-HR-equivalent metric.
 *       Documented assumption — not a verified 1:1 field mapping.
 *
 *   GET /v2/usercollection/daily_activity?start_date=&end_date=
 *     -> { data: [{ steps, active_calories, ... }] }
 *     stepsToday = latest record's `steps`.
 *
 *   GET /v2/usercollection/workout?start_date=&end_date=
 *     -> { data: [{ start_datetime, end_datetime, activity, ... }] }
 *     workoutMinutesToday = sum of (end_datetime - start_datetime) in
 *       minutes across every workout record in the fetch window.
 *
 * All four endpoints return an envelope of `{ data: T[], next_token }`
 * (Oura v2's pagination shape). Only the first page is read here — the
 * request window is narrow (yesterday..today), so a second page would
 * be pathological, not a steady-state case.
 */

import type { Logger } from "pino";

export const OURA_API_BASE = "https://api.ouraring.com/v2/usercollection";

/** Normalized snapshot — the fields AForce consumes from Oura. */
export interface OuraSnapshot {
  readinessScore: number | null;
  sleepHoursLastNight: number | null;
  /** RMSSD-based HRV in milliseconds — see the module doc comment. */
  hrvSdnn: number | null;
  restingHeartRate: number | null;
  stepsToday: number | null;
  workoutMinutesToday: number | null;
  /**
   * Epoch ms of the newest observation timestamp among the readiness/sleep/
   * activity/workout records that actually contributed a metric above
   * (Founder Ruling I, RC-2): sleep prefers `bedtime_end` (full instant),
   * everything else falls back to the endpoint's `day` (date-only, so the
   * derived ms lands at UTC midnight of that day — coarser, never fabricated
   * finer than the source). OPTIONAL: absent when nothing usable was found.
   */
  latestObservedAtMs?: number;
}

export const EMPTY_OURA_SNAPSHOT: OuraSnapshot = {
  readinessScore: null,
  sleepHoursLastNight: null,
  hrvSdnn: null,
  restingHeartRate: null,
  stepsToday: null,
  workoutMinutesToday: null,
};

export interface FetchOuraSnapshotOptions {
  /** OAuth2 bearer token. Null / blank = no fetch, empty snapshot. */
  accessToken: string | null;
  fetchImpl?: typeof fetch;
  /** Override the API base (defaults to the documented Oura v2 base). */
  apiBase?: string;
  /** Defaults to `Date.now`. Used to compute the start_date/end_date window. */
  nowMs?: () => number;
  /** Pino-ish logger for per-endpoint warnings. Defaults to no-op. */
  log?: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void };
}

/** Oura v2 pagination envelope, shared by every usercollection endpoint. */
interface OuraEnvelope<T> {
  data?: T[];
  next_token?: string | null;
}

interface OuraDailyReadinessRecord {
  day?: string;
  score?: number | null;
}

interface OuraSleepPeriodRecord {
  day?: string;
  bedtime_end?: string;
  total_sleep_duration?: number | null;
  average_hrv?: number | null;
  lowest_heart_rate?: number | null;
}

interface OuraDailyActivityRecord {
  day?: string;
  steps?: number | null;
}

interface OuraWorkoutRecord {
  day?: string;
  start_datetime?: string;
  end_datetime?: string;
}

async function getJson<T>(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
  log: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void },
): Promise<OuraEnvelope<T> | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      log.warn({ url, status: res.status }, "oura fetch non-ok");
      return null;
    }
    return (await res.json()) as OuraEnvelope<T>;
  } catch (err) {
    log.warn({ url, err }, "oura fetch threw");
    return null;
  }
}

/** Coerce only finite numbers; everything else -> null. Guards against
 *  Oura returning NaN/strings/undefined leaking into the persisted
 *  biometrics blob. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Records within a window come back in ascending date order per
 *  Oura's v2 pagination contract; the most recent entry is the last
 *  element. Empty/missing array -> null. */
function latest<T>(records: T[] | undefined): T | null {
  if (!records || records.length === 0) return null;
  return records[records.length - 1] ?? null;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Parse an Oura `day` (date-only, "YYYY-MM-DD") or full ISO datetime
 *  (`bedtime_end`, `start_datetime`, `end_datetime`) into epoch ms. Anything
 *  non-string, empty, or unparseable -> null; never guesses. */
function parseObservationMs(v: unknown): number | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Pull a snapshot of the Oura metrics AForce consumes. Returns the
 * empty snapshot when no access token is available — never fabricates.
 */
export async function fetchOuraSnapshot(
  opts: FetchOuraSnapshotOptions,
): Promise<OuraSnapshot> {
  const token = opts.accessToken?.trim();
  if (!token) return { ...EMPTY_OURA_SNAPSHOT };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? { warn: () => undefined };
  const apiBase = opts.apiBase ?? OURA_API_BASE;
  const now = opts.nowMs ?? ((): number => Date.now());

  const endDate = isoDate(now());
  const startDate = isoDate(now() - 24 * 60 * 60 * 1000);
  const win = `start_date=${startDate}&end_date=${endDate}`;

  const [readiness, sleep, activity, workouts] = await Promise.all([
    getJson<OuraDailyReadinessRecord>(
      `${apiBase}/daily_readiness?${win}`,
      token,
      fetchImpl,
      log,
    ),
    getJson<OuraSleepPeriodRecord>(`${apiBase}/sleep?${win}`, token, fetchImpl, log),
    getJson<OuraDailyActivityRecord>(
      `${apiBase}/daily_activity?${win}`,
      token,
      fetchImpl,
      log,
    ),
    getJson<OuraWorkoutRecord>(`${apiBase}/workout?${win}`, token, fetchImpl, log),
  ]);

  const readinessRec = latest(readiness?.data);
  const sleepRec = latest(sleep?.data);
  const activityRec = latest(activity?.data);

  let workoutMinutesToday: number | null = null;
  let workoutObservedAtMs: number | null = null;
  const workoutRecords = workouts?.data;
  if (workoutRecords && workoutRecords.length > 0) {
    let totalMs = 0;
    let sawValid = false;
    for (const w of workoutRecords) {
      if (!w.start_datetime || !w.end_datetime) continue;
      const start = Date.parse(w.start_datetime);
      const end = Date.parse(w.end_datetime);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const durationMs = end - start;
      if (durationMs <= 0) continue;
      totalMs += durationMs;
      sawValid = true;
      const endMs = parseObservationMs(w.end_datetime);
      if (endMs != null && (workoutObservedAtMs == null || endMs > workoutObservedAtMs)) {
        workoutObservedAtMs = endMs;
      }
    }
    if (sawValid) workoutMinutesToday = totalMs / (1000 * 60);
  }

  let sleepHoursLastNight: number | null = null;
  const sleepSec = num(sleepRec?.total_sleep_duration);
  if (sleepSec !== null) {
    sleepHoursLastNight = Math.max(0, sleepSec) / 3600;
  }

  const readinessScore = num(readinessRec?.score);
  const hrvSdnn = num(sleepRec?.average_hrv);
  const restingHeartRate = num(sleepRec?.lowest_heart_rate);
  const stepsToday = num(activityRec?.steps);

  // Observation freshness (Founder Ruling I, RC-2): only count a record's
  // timestamp toward the max when it actually contributed a metric above.
  const readinessObservedAtMs =
    readinessScore !== null ? parseObservationMs(readinessRec?.day) : null;
  const sleepContributed =
    sleepHoursLastNight !== null || hrvSdnn !== null || restingHeartRate !== null;
  const sleepObservedAtMs = sleepContributed
    ? (parseObservationMs(sleepRec?.bedtime_end) ?? parseObservationMs(sleepRec?.day))
    : null;
  const activityObservedAtMs =
    stepsToday !== null ? parseObservationMs(activityRec?.day) : null;

  const observedCandidates = [
    readinessObservedAtMs,
    sleepObservedAtMs,
    activityObservedAtMs,
    workoutMinutesToday !== null ? workoutObservedAtMs : null,
  ].filter((v): v is number => v != null);
  const latestObservedAtMs =
    observedCandidates.length > 0 ? Math.max(...observedCandidates) : undefined;

  return {
    readinessScore,
    sleepHoursLastNight,
    hrvSdnn,
    restingHeartRate,
    stepsToday,
    workoutMinutesToday,
    ...(latestObservedAtMs != null ? { latestObservedAtMs } : {}),
  };
}

/** Provider snapshot blob shape, mirroring the per-provider value under
 *  `aforce_user_state` biometrics (Oura subset — see
 *  `artifacts/aforce-os/types/biometrics.ts` for the shared shape). */
export interface OuraProviderBlob {
  providerId: "oura";
  readinessScore: number | null;
  sleepHoursLastNight: number | null;
  hrvSdnn: number | null;
  restingHeartRate: number | null;
  stepsToday: number | null;
  workoutMinutesToday: number | null;
  fetchedAt: number;
  /**
   * Epoch ms of the newest underlying Oura observation this blob's metrics
   * came from (Founder Ruling I, RC-2) — see `OuraSnapshot.latestObservedAtMs`.
   * OPTIONAL and additive: absent whenever the snapshot carried none.
   */
  latestObservedAtMs?: number;
}

/** Pure: lift an OuraSnapshot into the persisted biometrics-blob entry. */
export function ouraSnapshotToProviderBlob(
  s: OuraSnapshot,
  fetchedAt: number,
): OuraProviderBlob {
  return {
    providerId: "oura",
    readinessScore: s.readinessScore,
    sleepHoursLastNight: s.sleepHoursLastNight,
    hrvSdnn: s.hrvSdnn,
    restingHeartRate: s.restingHeartRate,
    stepsToday: s.stepsToday,
    workoutMinutesToday: s.workoutMinutesToday,
    fetchedAt,
    ...(s.latestObservedAtMs != null
      ? { latestObservedAtMs: s.latestObservedAtMs }
      : {}),
  };
}

/**
 * Pure: merge an Oura provider snapshot into an existing biometrics
 * blob, preserving every other provider's entry untouched.
 * `existing === null` returns a blob containing only Oura.
 */
export function mergeOuraIntoBiometrics(
  existing: Record<string, unknown> | null | undefined,
  oura: OuraProviderBlob,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  next["oura"] = oura;
  return next;
}
