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
 * Endpoints (all under `/developer/v2` — WHOOP retired v1, which now 404s):
 *   GET /recovery?limit=1        -> recovery_score, hrv_rmssd_milli, resting_heart_rate
 *   GET /cycle?limit=1           -> strain
 *   GET /activity/sleep?limit=1  -> stage_summary.{total_in_bed_time_milli, total_awake_time_milli}
 *                                   sleepHoursLastNight = max(0, inBed - awake) / 3.6e6
 *
 * v1→v2 migration notes (https://developer.whoop.com/docs/developing/v1-v2-migration/):
 *   - Same paths, same OAuth flow + scopes; only the version segment changes.
 *   - The score fields we read are retained in v2 (v2's changes are record IDs
 *     long->UUID and richer sleep data). This fetcher reads only `score.*` — it
 *     never parses a record `id` — so the UUID change is a no-op here.
 *   - Mapping stays null-safe: any renamed/absent v2 field lands as null, never
 *     a throw.
 */

import type { Logger } from "pino";

// WHOOP deprecated v1 ("The v1 API is no longer supported") — v1/recovery and
// v1/activity/sleep now 404. v2 keeps the same sub-paths.
export const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";

/** Normalized snapshot — same fields the mobile aggregator consumes. */
export interface WhoopSnapshot {
  recoveryPct: number | null;
  strain: number | null;
  hrvSdnn: number | null;
  restingHeartRate: number | null;
  sleepHoursLastNight: number | null;
  /**
   * Epoch ms of the newest observation among the recovery/cycle/sleep
   * records that actually contributed a metric above (Founder Ruling I,
   * RC-2). OPTIONAL: absent whenever none of the selected records carried a
   * parseable timestamp — never fabricated or backfilled from `fetchedAt`.
   */
  latestObservedAtMs?: number;
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
  /** Pino-ish logger for per-endpoint call/warn lines. Defaults to no-op. */
  log?:
    | Pick<Logger, "warn" | "info">
    | { warn: (...args: unknown[]) => void; info: (...args: unknown[]) => void };
}

// v2 populates the score ONLY when `score_state === "SCORED"` — the most recent
// record (today's, still in progress) is typically PENDING_SCORE / UNSCORABLE.
// We fetch a small window and take the freshest SCORED record. The metric fields
// are read shape-tolerantly (see `scoreSourceOf`): whether v2 keeps them under a
// `score` object or flattens them onto the record, `score ?? record` resolves.
type WhoopRecord = {
  score_state?: string | null;
  score?: Record<string, unknown> | null;
} & Record<string, unknown>;

interface WhoopCollection {
  records?: WhoopRecord[];
}

/**
 * The field source of the freshest SCORED record. Returns `record.score` when
 * present (v1/v2 nested shape), else the record itself (defensive against a v2
 * shape that flattens the metrics onto the record). Null when no scored record
 * exists in the window.
 */
function scoreSourceOf(
  records: WhoopRecord[] | undefined,
): Record<string, unknown> | null {
  if (!records) return null;
  for (const r of records) {
    if (!r) continue;
    const scored = r.score_state === "SCORED" || r.score != null;
    if (scored) return (r.score ?? r) as Record<string, unknown>;
  }
  return null;
}

/**
 * The SAME selection predicate as `scoreSourceOf` above (kept as a literal
 * duplicate, not a refactor of that pinned function, so its parity-tested
 * behavior at whoopSnapshot.ts:91 stays untouched) — but returns the RECORD
 * itself rather than its score source. The timestamps used to derive
 * `latestObservedAtMs` (`end`/`start` phenomenon times, `created_at`
 * record-creation fallback) live on the record, not inside the nested
 * `score` object, so this needs the record, not the value `scoreSourceOf`
 * already extracted for the metric fields.
 */
function selectedRecordOf(records: WhoopRecord[] | undefined): WhoopRecord | null {
  if (!records) return null;
  for (const r of records) {
    if (!r) continue;
    const scored = r.score_state === "SCORED" || r.score != null;
    if (scored) return r;
  }
  return null;
}

/** Parse a WHOOP ISO-8601 timestamp string into epoch ms. Anything
 *  non-string or unparseable -> null; never guesses. */
function parseWhoopTimestamp(v: unknown): number | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

async function getJson<T>(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
  log:
    | Pick<Logger, "warn" | "info">
    | { warn: (...args: unknown[]) => void; info: (...args: unknown[]) => void },
): Promise<T | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Per-call visibility (task: confirm real data flow in the logs). Logs the
    // URL + HTTP status of every developer/v2 GET — never the bearer token,
    // which lives only in the Authorization header, not the URL.
    log.info({ url, status: res.status }, "whoop fetch");
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
  const log = opts.log ?? { warn: () => undefined, info: () => undefined };

  const [recovery, cycle, sleep] = await Promise.all([
    getJson<WhoopCollection>(
      `${WHOOP_API_BASE}/recovery?limit=10`,
      token,
      fetchImpl,
      log,
    ),
    getJson<WhoopCollection>(
      `${WHOOP_API_BASE}/cycle?limit=10`,
      token,
      fetchImpl,
      log,
    ),
    getJson<WhoopCollection>(
      `${WHOOP_API_BASE}/activity/sleep?limit=10`,
      token,
      fetchImpl,
      log,
    ),
  ]);

  const rec = scoreSourceOf(recovery?.records);
  const cyc = scoreSourceOf(cycle?.records);
  const slp = (scoreSourceOf(sleep?.records)?.["stage_summary"] ?? null) as
    | Record<string, unknown>
    | null;

  let sleepHoursLastNight: number | null = null;
  const inBed = num(slp?.["total_in_bed_time_milli"]);
  if (inBed !== null) {
    const awake = num(slp?.["total_awake_time_milli"]) ?? 0;
    sleepHoursLastNight = Math.max(0, inBed - awake) / (1000 * 60 * 60);
  }

  const recoveryPct = num(rec?.["recovery_score"]);
  const strain = num(cyc?.["strain"]);
  const hrvSdnn = num(rec?.["hrv_rmssd_milli"]);
  const restingHeartRate = num(rec?.["resting_heart_rate"]);

  // Observation freshness (Founder Ruling I, RC-2): only count a record's
  // `created_at` toward the max when that record actually contributed a
  // metric above — mirrors "the metrics that populate the blob", not every
  // record WHOOP happened to return.
  const recoveryContributed =
    recoveryPct !== null || hrvSdnn !== null || restingHeartRate !== null;
  const cycleContributed = strain !== null;
  const sleepContributed = sleepHoursLastNight !== null;

  // #562 verdict B1: prefer the record's PHENOMENON time (`end`, else
  // `start`) over `created_at`. `created_at` is when WHOOP's server created
  // the record — after a delayed strap sync it reads days YOUNGER than the
  // sleep/cycle it describes, which is exactly the stale-reads-fresh
  // direction §53 forbids. Recovery records carry no phenomenon timestamp
  // of their own, so `created_at` (record-creation time, inheriting the
  // sleep's sync delay) is the only available — and last-resort — proxy.
  const observedAtOf = (r: WhoopRecord | null): number | null => {
    if (!r) return null;
    return (
      parseWhoopTimestamp(r["end"]) ??
      parseWhoopTimestamp(r["start"]) ??
      parseWhoopTimestamp(r["created_at"])
    );
  };
  const recoveryObservedAtMs = recoveryContributed
    ? observedAtOf(selectedRecordOf(recovery?.records))
    : null;
  const cycleObservedAtMs = cycleContributed
    ? observedAtOf(selectedRecordOf(cycle?.records))
    : null;
  const sleepObservedAtMs = sleepContributed
    ? observedAtOf(selectedRecordOf(sleep?.records))
    : null;

  const observedCandidates = [
    recoveryObservedAtMs,
    cycleObservedAtMs,
    sleepObservedAtMs,
  ].filter((v): v is number => v != null);
  const latestObservedAtMs =
    observedCandidates.length > 0 ? Math.max(...observedCandidates) : undefined;

  return {
    recoveryPct,
    strain,
    hrvSdnn,
    restingHeartRate,
    sleepHoursLastNight,
    ...(latestObservedAtMs != null ? { latestObservedAtMs } : {}),
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
  /**
   * Epoch ms of the newest underlying WHOOP `created_at` this blob's metrics
   * came from (Founder Ruling I, RC-2) — see `WhoopSnapshot.latestObservedAtMs`.
   * OPTIONAL and additive: absent whenever the snapshot carried none.
   */
  latestObservedAtMs?: number;
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
    ...(s.latestObservedAtMs != null
      ? { latestObservedAtMs: s.latestObservedAtMs }
      : {}),
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
