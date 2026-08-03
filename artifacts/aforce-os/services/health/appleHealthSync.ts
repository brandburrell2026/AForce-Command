/**
 * artifacts/aforce-os/services/health/appleHealthSync.ts
 *
 * LANE A2 — Apple HealthKit incremental/anchored sync ENGINE. Pure
 * orchestration layer: it drives a caller-supplied, native-agnostic query
 * client through HealthKit's anchored-query pagination model and turns
 * whatever comes back into `CanonicalHealthRecord[]` via the EXISTING
 * mappers in `./appleHealthRecords` (imported, never modified — that file is
 * Lane-1 territory and this lane only consumes its current exports).
 *
 * RUNTIME ACTIVATION STAYS OFF. This module is not imported by any screen,
 * store, or flag-gated bridge as of this lane — that wiring (behind
 * `healthkit_native_enabled`) is a deliberately separate, un-taken step for
 * a later lane. Nothing in this file makes that call for you: there is no
 * flag import, no store import, no React Native import, and no native
 * module import anywhere below. A module that is never reachable from any
 * entry point cannot violate "activation stays off" — this file enforces
 * that by construction, not by a runtime guard that could be forgotten or
 * bypassed. See appleHealthSync.test.ts's "never invoked" describe block,
 * which asserts this file's own source text carries none of those imports.
 *
 * WHAT A5 IMPLEMENTS (not this lane): a `HealthKitQueryClient` over
 * `@kingstinct/react-native-healthkit`'s `queryQuantitySamplesWithAnchor` /
 * `queryCategorySamplesWithAnchor` / `queryWorkoutSamplesWithAnchor` family,
 * serializing the native `HKQueryAnchor` to/from the opaque
 * `AppleHealthAnchorToken` string this module treats as a black box.
 *
 * HONESTY RULES (this module's own, on top of the mapper-layer rules
 * documented in appleHealthRecords.ts — both apply end-to-end)
 *
 *   - READ-ONLY, NO REQUEST PATH: `HealthKitQueryClient` has exactly two
 *     methods — `getAuthorizationStatus` and `queryAnchored`. Neither this
 *     interface nor `runAppleHealthSync` can trigger HealthKit's permission
 *     sheet. Requesting permission is a product surface (see
 *     `requestAppleHealthPermissions` in `../appleHealth.ts`, off-limits to
 *     this lane) — a background sync engine must never be able to pop UI.
 *
 *   - PARTIAL PERMISSIONS ARE HONEST, NOT ALL-OR-NOTHING: each requested
 *     type is authorized independently. A type that isn't `'authorized'`
 *     (whether `'denied'` or `'notDetermined'` — HealthKit's read-status
 *     ambiguity is inherited from appleHealthRecords.ts's documented
 *     read-authorization-is-indeterminate-by-design stance, so both collapse
 *     to the same honest `'not_authorized'` outcome here) is skipped
 *     entirely: no query is issued for it, its anchor is passed through
 *     UNCHANGED, and its `authorization[type]` entry says so. Other
 *     requested types are completely unaffected.
 *
 *   - NO FABRICATION ON EMPTY: zero samples from a page produces zero
 *     records for that page — never a synthesized value. The anchor this
 *     module persists for a type is always exactly what the client reported
 *     (`page.newAnchor`), even when that's identical to the anchor that went
 *     in. This module never invents forward progress.
 *
 *   - PER-TYPE ISOLATION: one type throwing (auth-status check, a page
 *     fetch, or a native anchor error) never drops another type's records
 *     or aborts the run. `runAppleHealthSync` never rejects because of a
 *     single type's failure — every failure is captured as that type's
 *     `authorization[type]` entry. Samples already fetched for a type
 *     BEFORE it failed are still mapped and returned — a mid-batch failure
 *     doesn't retroactively discard real data, and the anchor persisted for
 *     that type is the last one a successful page actually returned, never
 *     an anchor from the page that failed.
 *
 *   - UNAVAILABLE CLIENT: `client: null` (native module not linked, or the
 *     platform isn't iOS) short-circuits every requested type to
 *     `{ status: 'unavailable' }` with zero query calls and zero records —
 *     the same shape family a denied/undetermined type gets, distinguished
 *     by status, never silently merged into "denied".
 *
 *   - DETERMINISTIC / CLOCKLESS: no `Date.now()` anywhere in this file.
 *     `syncedAt` (ISO-8601 UTC) is threaded straight into the mappers'
 *     `MapOptions`, exactly as it is in appleHealthRecords.ts. `nowMs` is
 *     accepted and echoed back as `syncRunStartedAtMs` for caller-side
 *     logging/telemetry only — it never drives branching logic in this
 *     module, so a fixture clock and a real clock produce identical sync
 *     decisions for the same inputs.
 *
 *   - ANCHOR PERSISTENCE CONTRACT: this module never touches storage. The
 *     caller owns persisting `nextAnchors` (AsyncStorage, SQLite, wherever)
 *     and feeding it back in as `anchors` on the next run. `AppleHealthAnchorState`
 *     carries an explicit `version` field; an anchor blob with a mismatched
 *     or absent version is treated as "no anchor" (a fresh incremental
 *     baseline) rather than trusted blindly — a schema change downstream
 *     should never crash a sync run or silently mis-page against a
 *     native anchor format it no longer understands.
 *
 * Pure: no I/O, no native imports, no flag/store imports, no clocks.
 */

import type { CanonicalHealthRecord } from '@workspace/health-core';

import {
  mapActiveEnergySamples,
  mapHrvSdnnSamples,
  mapRespiratoryRateSamples,
  mapRestingHeartRateSamples,
  mapSleepSamplesToRecords,
  mapStepsSamples,
  mapWorkoutSamples,
  type HKQuantitySample,
  type HKSleepCategorySample,
  type HKWorkoutSample,
  type MapOptions,
} from './appleHealthRecords';

// ─── Sample-type → raw-shape map ──────────────────────────────────────────────

/**
 * Every Apple Health sample type this sync engine knows how to page through
 * and map. Each key names an existing mapper in `./appleHealthRecords`; the
 * value is that mapper's expected raw-sample shape, ALSO imported from there
 * (never redefined) so the two files can never silently drift apart.
 */
export interface AppleHealthSampleShapeMap {
  restingHeartRate: HKQuantitySample;
  hrvSdnn: HKQuantitySample;
  steps: HKQuantitySample;
  activeEnergy: HKQuantitySample;
  respiratoryRate: HKQuantitySample;
  sleepAnalysis: HKSleepCategorySample;
  workout: HKWorkoutSample;
}

export type AppleHealthSampleType = keyof AppleHealthSampleShapeMap;

type AnyAppleHealthSample = AppleHealthSampleShapeMap[AppleHealthSampleType];

export const ALL_APPLE_HEALTH_SAMPLE_TYPES: readonly AppleHealthSampleType[] = [
  'restingHeartRate',
  'hrvSdnn',
  'steps',
  'activeEnergy',
  'respiratoryRate',
  'sleepAnalysis',
  'workout',
];

// ─── Authorization ────────────────────────────────────────────────────────────

/**
 * Mirrors `@kingstinct/react-native-healthkit`'s `HKAuthorizationStatus`
 * without importing it (this file stays native-free). See file header for
 * why `'denied'` and `'notDetermined'` both collapse to the same
 * `'not_authorized'` sync outcome — HealthKit's own read-status ambiguity,
 * not a simplification this module invents.
 */
export type AppleHealthAuthorizationStatus = 'authorized' | 'denied' | 'notDetermined';

// ─── Anchored query client (A5 implements this over the native SDK) ─────────

/**
 * Opaque, serializable representation of a native `HKQueryAnchor`. This
 * module never inspects, parses, or constructs one — it only stores what a
 * client returns and hands it back on the next call for the same type.
 */
export type AppleHealthAnchorToken = string;

export interface AppleHealthAnchoredQueryPage<TSample> {
  samples: readonly TSample[];
  /**
   * The anchor to persist and pass back in on the NEXT call for this type
   * (whether that's the next page of this same run, or the next scheduled
   * sync run entirely). Never re-derived or adjusted by this module — see
   * "NO FABRICATION ON EMPTY" in the file header.
   */
  newAnchor: AppleHealthAnchorToken | null;
  /**
   * `true` when this page was the last one available for this type at
   * query time (the caller may stop paging). `false` means more samples
   * are waiting — `runAppleHealthSync` will call again with `newAnchor`,
   * up to `maxPagesPerType`.
   */
  done: boolean;
}

/**
 * Native-SDK-agnostic client contract A5 implements over
 * `@kingstinct/react-native-healthkit`. Deliberately READ-ONLY: there is no
 * `requestAuthorization` (or any write/share) method on this interface, so
 * nothing that only has a `HealthKitQueryClient` can ever trigger
 * HealthKit's permission UI. See file header, "READ-ONLY, NO REQUEST PATH".
 */
export interface HealthKitQueryClient {
  getAuthorizationStatus(type: AppleHealthSampleType): Promise<AppleHealthAuthorizationStatus>;
  queryAnchored<T extends AppleHealthSampleType>(
    type: T,
    anchor: AppleHealthAnchorToken | null,
    limit: number,
  ): Promise<AppleHealthAnchoredQueryPage<AppleHealthSampleShapeMap[T]>>;
}

/**
 * A5's client throws this (or a subclass) when a page fetch fails because
 * HealthKit authorization was revoked for that type mid-sync (e.g. the user
 * turned off access in Settings between this run's auth check and a later
 * page of the same run). Distinguishing this from a generic fetch error lets
 * `runAppleHealthSync` report the honest, more specific
 * `'authorization_revoked'` status instead of a generic `'error'`.
 */
export class AppleHealthKitAuthorizationRevokedError extends Error {
  constructor(message = 'HealthKit authorization was revoked mid-sync') {
    super(message);
    this.name = 'AppleHealthKitAuthorizationRevokedError';
  }
}

// ─── Anchor persistence contract (caller owns storage) ───────────────────────

export const APPLE_HEALTH_ANCHOR_SCHEMA_VERSION = 1;

/**
 * Serializable, caller-persisted sync cursor. `runAppleHealthSync` never
 * reads or writes storage itself — the caller round-trips this shape through
 * whatever persistence it uses (AsyncStorage, SQLite, ...) between runs.
 */
export interface AppleHealthAnchorState {
  version: typeof APPLE_HEALTH_ANCHOR_SCHEMA_VERSION;
  anchors: Partial<Record<AppleHealthSampleType, AppleHealthAnchorToken | null>>;
}

/** A fresh cursor for a user who has never synced — every type starts from `null` (full anchored baseline). */
export function createEmptyAppleHealthAnchorState(): AppleHealthAnchorState {
  return { version: APPLE_HEALTH_ANCHOR_SCHEMA_VERSION, anchors: {} };
}

/**
 * A version mismatch (including a totally absent/malformed blob) is treated
 * as "no anchor for any type" — a one-time honest re-baseline — rather than
 * trusting a foreign-shaped token against this schema's expectations. Never
 * throws: a corrupt or stale persisted blob must not crash a sync run.
 */
function normalizeInputAnchors(
  anchors: AppleHealthAnchorState | null | undefined,
): Partial<Record<AppleHealthSampleType, AppleHealthAnchorToken | null>> {
  if (!anchors) return {};
  if (anchors.version !== APPLE_HEALTH_ANCHOR_SCHEMA_VERSION) return {};
  return { ...anchors.anchors };
}

// ─── Per-type sync outcome ────────────────────────────────────────────────────

export type AppleHealthTypeSyncStatus =
  | 'synced'
  | 'not_authorized'
  | 'unavailable'
  | 'authorization_revoked'
  | 'error';

export interface AppleHealthTypeResult {
  status: AppleHealthTypeSyncStatus;
  /**
   * Present only for `'error'` / `'authorization_revoked'`. A short message
   * from the thrown error — never any sample payload or user health data.
   */
  message?: string;
  /**
   * `true` only when status is `'synced'` AND the `maxPagesPerType` safety
   * cap was hit before the client reported `done: true` — there is more
   * backlog for this type waiting on the NEXT sync run. This is expected,
   * bounded incremental behavior for a large first backfill, not a failure;
   * it still counts toward the top-level `partial` flag because this run
   * did not fully catch this type up to the live edge.
   */
  hasMorePages?: boolean;
}

// ─── Sync entry point ─────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_MAX_PAGES_PER_TYPE = 50;

export interface RunAppleHealthSyncParams {
  /** `null` when the native module isn't linked/available (see file header, "UNAVAILABLE CLIENT"). */
  client: HealthKitQueryClient | null;
  userId: string;
  types: readonly AppleHealthSampleType[];
  /** Caller-persisted cursor from the previous run. `null`/`undefined` ⇒ fresh baseline for every type. */
  anchors: AppleHealthAnchorState | null | undefined;
  /** Injected clock (ms). Never used for branching — echoed back for caller telemetry only. */
  nowMs: number;
  /** ISO-8601 UTC. Passed straight into the mappers' `MapOptions`, same contract as appleHealthRecords.ts. */
  syncedAt: string;
  /** Samples requested per `queryAnchored` call. Default 200. */
  pageSize?: number;
  /** Safety cap on pages fetched per type in a single run. Default 50 (see `hasMorePages`). */
  maxPagesPerType?: number;
}

export interface RunAppleHealthSyncResult {
  records: CanonicalHealthRecord[];
  /** Persist this verbatim and pass it back in as `anchors` on the next run. */
  nextAnchors: AppleHealthAnchorState;
  /**
   * `true` if ANY requested type did not fully reach the live edge this run —
   * not authorized, errored, revoked, unavailable, or capped by
   * `maxPagesPerType` with more pages remaining. `false` only when every
   * requested type reports `'synced'` with no remaining pages.
   */
  partial: boolean;
  /** Per-type honest outcome. Every entry in `types` has exactly one entry here. */
  authorization: Partial<Record<AppleHealthSampleType, AppleHealthTypeResult>>;
  /** Echo of `params.nowMs` — caller telemetry only, never consulted internally. */
  syncRunStartedAtMs: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mapSamplesForType(
  type: AppleHealthSampleType,
  samples: readonly AnyAppleHealthSample[],
  opts: MapOptions,
): CanonicalHealthRecord[] {
  switch (type) {
    case 'restingHeartRate':
      return mapRestingHeartRateSamples(samples as HKQuantitySample[], opts);
    case 'hrvSdnn':
      return mapHrvSdnnSamples(samples as HKQuantitySample[], opts);
    case 'steps':
      return mapStepsSamples(samples as HKQuantitySample[], opts);
    case 'activeEnergy':
      return mapActiveEnergySamples(samples as HKQuantitySample[], opts);
    case 'respiratoryRate':
      return mapRespiratoryRateSamples(samples as HKQuantitySample[], opts);
    case 'sleepAnalysis':
      return mapSleepSamplesToRecords(samples as HKSleepCategorySample[], opts);
    case 'workout':
      return mapWorkoutSamples(samples as HKWorkoutSample[], opts);
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

interface SyncOneTypeOpts {
  userId: string;
  syncedAt: string;
  pageSize: number;
  maxPagesPerType: number;
}

interface SyncOneTypeOutcome {
  records: CanonicalHealthRecord[];
  newAnchor: AppleHealthAnchorToken | null;
  result: AppleHealthTypeResult;
}

/**
 * Drives ONE type's anchored pagination to completion (or to a stopping
 * point: not-authorized, an error, a revocation, or the page-count safety
 * cap). Never throws — every failure mode here is captured as `result`, so
 * `runAppleHealthSync`'s loop over multiple types can never have one type's
 * exception propagate and wipe out the types processed before or after it.
 */
async function syncOneType(
  client: HealthKitQueryClient,
  type: AppleHealthSampleType,
  inputAnchor: AppleHealthAnchorToken | null,
  opts: SyncOneTypeOpts,
): Promise<SyncOneTypeOutcome> {
  const mapOpts: MapOptions = { userId: opts.userId, syncedAt: opts.syncedAt };

  let authStatus: AppleHealthAuthorizationStatus;
  try {
    authStatus = await client.getAuthorizationStatus(type);
  } catch (err) {
    return { records: [], newAnchor: inputAnchor, result: { status: 'error', message: errorMessage(err) } };
  }

  if (authStatus !== 'authorized') {
    // Anchor is passed through UNTOUCHED — no query was issued, so there is
    // no new position to persist. See file header, "PARTIAL PERMISSIONS".
    return { records: [], newAnchor: inputAnchor, result: { status: 'not_authorized' } };
  }

  const collected: AnyAppleHealthSample[] = [];
  let anchor = inputAnchor;

  for (let pageCount = 0; pageCount < opts.maxPagesPerType; pageCount++) {
    let page: AppleHealthAnchoredQueryPage<AnyAppleHealthSample>;
    try {
      // eslint-disable-next-line no-await-in-loop -- anchored pagination is inherently sequential per type.
      page = await client.queryAnchored(type, anchor, opts.pageSize);
    } catch (err) {
      // Samples from pages that succeeded BEFORE this failure are still
      // real and still mapped — see file header, "PER-TYPE ISOLATION". The
      // anchor persisted is `anchor` (the last successful page's), never
      // advanced past the failure.
      const partialRecords = mapSamplesForType(type, collected, mapOpts);
      if (err instanceof AppleHealthKitAuthorizationRevokedError) {
        return {
          records: partialRecords,
          newAnchor: anchor,
          result: { status: 'authorization_revoked', message: err.message },
        };
      }
      return { records: partialRecords, newAnchor: anchor, result: { status: 'error', message: errorMessage(err) } };
    }

    collected.push(...page.samples);
    anchor = page.newAnchor;

    if (page.done) {
      return { records: mapSamplesForType(type, collected, mapOpts), newAnchor: anchor, result: { status: 'synced' } };
    }
  }

  // Safety cap reached before the client reported `done`. Every sample
  // actually fetched is still mapped and returned; `hasMorePages` tells the
  // caller this type isn't fully caught up yet, without treating a large
  // backlog as an error.
  return {
    records: mapSamplesForType(type, collected, mapOpts),
    newAnchor: anchor,
    result: { status: 'synced', hasMorePages: true },
  };
}

/**
 * Runs an incremental/anchored sync pass over `types` for `userId`. Pure
 * orchestration — see file header for the full honesty contract. Never
 * rejects: every per-type failure mode is captured in the returned
 * `authorization` map, and a `null` client resolves cleanly with empty
 * records rather than throwing.
 */
export async function runAppleHealthSync(params: RunAppleHealthSyncParams): Promise<RunAppleHealthSyncResult> {
  const { client, userId, types, syncedAt, nowMs } = params;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPagesPerType = params.maxPagesPerType ?? DEFAULT_MAX_PAGES_PER_TYPE;
  const inputAnchors = normalizeInputAnchors(params.anchors);

  const records: CanonicalHealthRecord[] = [];
  const authorization: Partial<Record<AppleHealthSampleType, AppleHealthTypeResult>> = {};
  const outputAnchors: Partial<Record<AppleHealthSampleType, AppleHealthAnchorToken | null>> = { ...inputAnchors };

  for (const type of types) {
    const inputAnchor = inputAnchors[type] ?? null;

    if (!client) {
      // Native module unavailable: zero query calls, zero records, anchor
      // untouched. See file header, "UNAVAILABLE CLIENT".
      authorization[type] = { status: 'unavailable' };
      outputAnchors[type] = inputAnchor;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- per-type isolation requires sequential handling so one type's failure can't race another's anchor write.
    const outcome = await syncOneType(client, type, inputAnchor, { userId, syncedAt, pageSize, maxPagesPerType });
    records.push(...outcome.records);
    authorization[type] = outcome.result;
    outputAnchors[type] = outcome.newAnchor;
  }

  const partial = types.some((type) => {
    const result = authorization[type];
    return !result || result.status !== 'synced' || result.hasMorePages === true;
  });

  return {
    records,
    nextAnchors: { version: APPLE_HEALTH_ANCHOR_SCHEMA_VERSION, anchors: outputAnchors },
    partial,
    authorization,
    syncRunStartedAtMs: nowMs,
  };
}
