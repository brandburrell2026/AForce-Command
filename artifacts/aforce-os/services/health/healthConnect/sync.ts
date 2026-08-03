/**
 * artifacts/aforce-os/services/health/healthConnect/sync.ts
 *
 * LANE H2 — pure Health Connect sync engine. Orchestrates availability,
 * permission resolution, and changes-token incremental sync on top of the
 * LANE H1 shell (types.ts / availability.ts / permissions.ts / mapRecords.ts)
 * WITHOUT modifying any of them and WITHOUT the native dependency, which
 * lands in H5 against `HealthConnectClient` exactly as it stands in
 * types.ts today. Everything here is written against that interface's
 * CURRENT shape; every place this module has to model behavior the
 * interface doesn't expose a field for (see CHANGES-TOKEN EXPIRY below) is
 * flagged as an explicit assumption for H5 to verify against the real SDK.
 *
 * No native imports, no Date.now() (clock is injected via `nowMs`), no
 * Google Fit special-casing (mapRecords.ts already keeps Fit as
 * 'unknown_device_app' — this module adds no parallel logic for it).
 *
 * ─── CHANGES-TOKEN MODEL ───────────────────────────────────────────────────
 *
 * One changes token PER canonical metric type (not one token for the whole
 * sync), keyed the same way `changesTokens` / `nextChangesTokens` are keyed.
 * That keeps per-type failure isolation and per-type token expiry exactly
 * that — per type — rather than one bad type invalidating everyone else's
 * incremental state.
 *
 * Tokens are persisted by the caller as opaque strings. This module never
 * hands back HC's raw token directly — it wraps it in a small versioned
 * envelope (see `serializeChangesToken`) so a future change to this
 * envelope's shape is self-describing: an old or corrupt envelope simply
 * fails to parse and is treated exactly like an HC-invalidated token (full
 * honest re-read), rather than being silently misread as a valid one.
 *
 * ─── CHANGES-TOKEN EXPIRY — EXPLICIT MODELING ASSUMPTION FOR H5 ────────────
 *
 * Health Connect can invalidate a changes token (e.g. it has aged out).
 * The `HealthConnectClient` interface this lane must implement against
 * (types.ts) models `getChanges` as `Promise<{ changes; nextChangesToken }>`
 * with no explicit `expired` boolean — so the ONLY channel this interface
 * offers for signaling expiry is a rejected promise. This module therefore
 * treats a `getChanges` rejection carrying `.code ===
 * HEALTH_CONNECT_CHANGES_TOKEN_EXPIRED_CODE` as "token invalid, fall back to
 * a full re-read." H5, wiring the real `react-native-health-connect` client,
 * is responsible for normalizing whatever the native SDK actually throws
 * (or returns) for this case into that shape — or for extending
 * `HealthConnectClient` with a real `changesTokenExpired` field, at which
 * point this module's detection point (`isChangesTokenExpiredError`) is the
 * only place that needs to change.
 *
 * A full re-read after expiry is flagged `reSynced: true` (never silent) and
 * is safe to double-deliver: mapRecords.ts's dedup key is
 * `userId|metricType|origin|ext:<HC record id>` — identical whether a record
 * arrives via a full read or a changes page — so a caller upserting by that
 * key never double-counts, it only ever re-confirms. Deletions are NEVER
 * replayed by a re-read (HC full reads only return records that currently
 * exist), so a re-sync cannot resurrect something the user deleted before
 * the token expired; it can only miss a deletion that happened in that
 * window, same as the token being expired already implied.
 */

import type { CanonicalHealthMetricType, CanonicalHealthRecord } from '@workspace/health-core';

import { resolveHealthConnectAvailability, type HealthConnectAvailabilityResult } from './availability';
import {
  buildHealthConnectPermissions,
  resolvePermissionGrant,
  HEALTH_CONNECT_READ_PERMISSION_BY_METRIC,
  type PermissionGrantResolution,
} from './permissions';
import {
  mapActiveCaloriesBurnedRecord,
  mapExerciseSessionRecord,
  mapHeartRateRecord,
  mapHeartRateVariabilityRmssdRecord,
  mapRespiratoryRateRecord,
  mapRestingHeartRateRecord,
  mapSleepSessionRecord,
  mapStepsRecord,
  type MapContext,
} from './mapRecords';
import type {
  ActiveCaloriesBurnedRecord,
  ExerciseSessionRecord,
  HeartRateRecord,
  HeartRateVariabilityRmssdRecord,
  HealthConnectClient,
  HealthConnectPermissionString,
  RespiratoryRateRecord,
  RestingHeartRateRecord,
  SleepSessionRecord,
  StepsRecord,
} from './types';

// ─── Public input / output shapes ──────────────────────────────────────────────

export interface HealthConnectSyncParams {
  /**
   * Deliberately `Omit<HealthConnectClient, 'requestPermission'>`, not the
   * full interface — an interface-level guarantee, not a runtime
   * convention, that no code path reachable through this sync engine (or
   * anything that only has this narrowed type) can trigger Health Connect's
   * permission dialog. This matches A2's `HealthKitQueryClient`, which
   * doesn't expose a request method AT ALL for the same reason: a
   * background sync engine must never be able to pop UI. HC's real client
   * legitimately needs `requestPermission` elsewhere (the connect flow owns
   * that call) — this field just can't see it.
   */
  client: Omit<HealthConnectClient, 'requestPermission'>;
  /** Whose records these become — passed straight through to MapContext. */
  userId: string;
  /** The canonical metric types this sync pass should cover. */
  types: readonly CanonicalHealthMetricType[];
  /**
   * Per-type persisted changes-token envelopes from the previous sync
   * (see `serializeChangesToken`). Absent or `null` for a type ⇒ that type
   * has never been synced ⇒ full read.
   */
  changesTokens: Partial<Record<CanonicalHealthMetricType, string | null>>;
  /** Injected clock, ms since epoch. This module never calls Date.now(). */
  nowMs: number;
  /** ISO-8601 UTC, stamped onto every mapped record as MapContext.syncedAt. */
  syncedAt: string;
  /**
   * Has this app EVER called `requestPermission()` for this metric-type
   * set? Caller-supplied provenance, passed straight through to
   * `resolvePermissionGrant` — see permissions.ts for why this can't be
   * inferred from the grant list alone.
   */
  hasRequested: boolean;
  /**
   * Android API level, passed straight through to
   * `resolveHealthConnectAvailability`. Omit ⇒ that resolver's documented
   * benefit-of-the-doubt tier.
   */
  androidApiLevel?: number;
}

export type HealthConnectSyncTypeStatus = 'synced' | 'error' | 'not_granted' | 'unsupported';

export interface HealthConnectSyncTypeOutcome {
  status: HealthConnectSyncTypeStatus;
  /** True only when this type's data came from an expiry-triggered full re-read. */
  reSynced: boolean;
  /** HC record ids reported deleted for this type, this pass. */
  deletedExternalIds: string[];
  /** Present only when status === 'error'. */
  error?: string;
}

export interface HealthConnectSyncResult {
  /** All newly-observed/updated records across every synced type, unmapped-to-null filtered out. */
  records: CanonicalHealthRecord[];
  /** All deletions across every synced type, flattened — see `perType` for the per-type breakdown. */
  deletedExternalIds: string[];
  /** Updated per-type token envelopes to persist. Untouched types (error / not_granted / unsupported) pass their input token through unchanged. */
  nextChangesTokens: Partial<Record<CanonicalHealthMetricType, string | null>>;
  /** True iff at least one requested, granted type failed with an error this pass. Never true merely because a type was ungranted or unsupported — that's an access state, not a failure. */
  partial: boolean;
  availability: HealthConnectAvailabilityResult;
  /**
   * True iff this pass never got past the availability gate — either HC
   * legitimately reported itself unavailable/needs_update, or the
   * `getSdkStatus()` call itself threw (see `availabilityError`). This is
   * the signal a caller keys off to tell "there is no usable Health Connect
   * here" apart from "Health Connect answered and genuinely synced zero
   * records for every type" — both shapes have `records: []`, but only the
   * former sets this `true`. `perType` is always `{}` when this is `true`.
   */
  availabilityBlocked: boolean;
  /**
   * Present only when `availabilityBlocked` is true AND the reason was
   * `getSdkStatus()` throwing rather than a legitimate SDK_UNAVAILABLE /
   * SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED status. Absent ⇒ HC itself told
   * us it's unavailable. Present ⇒ we couldn't even ask.
   */
  availabilityError?: string;
  /** Permission-string-level grant/deny/not-requested resolution — see permissions.ts. */
  permissions: PermissionGrantResolution;
  /** Per-type diagnostic breakdown — the only place `reSynced` and per-type access/error state surface. */
  perType: Partial<Record<CanonicalHealthMetricType, HealthConnectSyncTypeOutcome>>;
}

// ─── Changes-token expiry signal ───────────────────────────────────────────────

export const HEALTH_CONNECT_CHANGES_TOKEN_EXPIRED_CODE = 'changes_token_expired' as const;

/**
 * Thrown/matched when a persisted changes token can no longer be trusted —
 * either HC itself invalidated it (see file header) or the persisted
 * envelope failed to parse (`deserializeChangesToken`). Both cases get the
 * identical, honest response: a full re-read, flagged `reSynced: true`.
 */
export class HealthConnectChangesTokenExpiredError extends Error {
  readonly code = HEALTH_CONNECT_CHANGES_TOKEN_EXPIRED_CODE;
  constructor(reason: string) {
    super(`Health Connect changes token expired or invalid: ${reason}`);
    this.name = 'HealthConnectChangesTokenExpiredError';
  }
}

/**
 * Duck-typed on `.code` rather than `instanceof` so an error thrown across a
 * different copy of this module (e.g. H5's native bridge normalizing its own
 * error into this shape) is still recognized.
 */
function isChangesTokenExpiredError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === HEALTH_CONNECT_CHANGES_TOKEN_EXPIRED_CODE
  );
}

// ─── Changes-token envelope (serialized + versioned) ───────────────────────────

const CHANGES_TOKEN_ENVELOPE_VERSION = 1;

interface ChangesTokenEnvelope {
  v: number;
  token: string;
}

/** Wrap HC's opaque token string in a versioned envelope for persistence. */
export function serializeChangesToken(rawToken: string): string {
  const envelope: ChangesTokenEnvelope = { v: CHANGES_TOKEN_ENVELOPE_VERSION, token: rawToken };
  return JSON.stringify(envelope);
}

/**
 * Unwrap a persisted envelope back to HC's raw token string. Anything that
 * doesn't parse as our current envelope version — corrupt JSON, a future
 * version we don't understand yet, a stray raw string — is NOT guessed at;
 * it is treated exactly like HC invalidating the token, so the caller falls
 * back to an honest full re-read instead of handing garbage to
 * `client.getChanges()`.
 */
function deserializeChangesToken(serialized: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new HealthConnectChangesTokenExpiredError('persisted token envelope is not valid JSON');
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as Partial<ChangesTokenEnvelope>).v === CHANGES_TOKEN_ENVELOPE_VERSION &&
    typeof (parsed as Partial<ChangesTokenEnvelope>).token === 'string'
  ) {
    return (parsed as ChangesTokenEnvelope).token;
  }
  throw new HealthConnectChangesTokenExpiredError('persisted token envelope is an unrecognized shape or version');
}

// ─── HC changes-page shape (modeled — see file header) ─────────────────────────

/**
 * Health Connect's real changes API emits a page of upsertion/deletion
 * change records; `HealthConnectClient.getChanges` types that page as
 * `changes: unknown[]` (types.ts has no native SDK import to shape it
 * against). This is H2's documented modeling of that page's per-entry shape,
 * named after Android's own `UpsertionChange` / `DeletionChange` split — H5
 * verifies it against the real SDK's actual objects when the dependency
 * lands.
 */
interface HcUpsertionChange {
  changeType: 'upsert';
  record: unknown;
}
interface HcDeletionChange {
  changeType: 'delete';
  /** The deleted record's HC id — identical to `metadata.id` / our `externalId`. */
  recordId: string;
}

function isHcUpsertionChange(candidate: unknown): candidate is HcUpsertionChange {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    (candidate as Record<string, unknown>).changeType === 'upsert' &&
    'record' in candidate
  );
}

function isHcDeletionChange(candidate: unknown): candidate is HcDeletionChange {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    (candidate as Record<string, unknown>).changeType === 'delete' &&
    typeof (candidate as Record<string, unknown>).recordId === 'string'
  );
}

/**
 * Split a raw changes page into upserted raw records and deleted ids.
 * Anything that matches neither modeled shape is skipped, not guessed at —
 * an unrecognized change means the real SDK's shape has drifted from the
 * model above and this file needs updating, not a silent cast.
 */
function splitChanges(changes: readonly unknown[]): { upserts: unknown[]; deletions: string[] } {
  const upserts: unknown[] = [];
  const deletions: string[] = [];
  for (const change of changes) {
    if (isHcUpsertionChange(change)) {
      upserts.push(change.record);
    } else if (isHcDeletionChange(change)) {
      deletions.push(change.recordId);
    }
  }
  return { upserts, deletions };
}

// ─── Per-metric-type HC dispatch table ─────────────────────────────────────────

interface HcTypeConfig {
  /**
   * Health Connect record type identifier. Modeled here as the same string
   * as this lane's local interface names in types.ts (SleepSessionRecord,
   * StepsRecord, ...) — H5 confirms these against
   * `react-native-health-connect`'s actual record-type constants.
   */
  hcRecordType: string;
  map: (raw: unknown, ctx: MapContext) => CanonicalHealthRecord | null;
}

/**
 * Deliberately the same key set as HEALTH_CONNECT_READ_PERMISSION_BY_METRIC
 * in permissions.ts — 'provider_score' has no Health Connect equivalent and
 * is intentionally absent from both, never guessed at.
 */
const HC_TYPE_CONFIG: Partial<Record<CanonicalHealthMetricType, HcTypeConfig>> = {
  sleep_session: {
    hcRecordType: 'SleepSessionRecord',
    map: (raw, ctx) => mapSleepSessionRecord(raw as SleepSessionRecord, ctx),
  },
  steps: {
    hcRecordType: 'StepsRecord',
    map: (raw, ctx) => mapStepsRecord(raw as StepsRecord, ctx),
  },
  heart_rate_summary: {
    hcRecordType: 'HeartRateRecord',
    map: (raw, ctx) => mapHeartRateRecord(raw as HeartRateRecord, ctx),
  },
  resting_heart_rate: {
    hcRecordType: 'RestingHeartRateRecord',
    map: (raw, ctx) => mapRestingHeartRateRecord(raw as RestingHeartRateRecord, ctx),
  },
  hrv: {
    hcRecordType: 'HeartRateVariabilityRmssdRecord',
    map: (raw, ctx) => mapHeartRateVariabilityRmssdRecord(raw as HeartRateVariabilityRmssdRecord, ctx),
  },
  workout: {
    hcRecordType: 'ExerciseSessionRecord',
    map: (raw, ctx) => mapExerciseSessionRecord(raw as ExerciseSessionRecord, ctx),
  },
  active_energy: {
    hcRecordType: 'ActiveCaloriesBurnedRecord',
    map: (raw, ctx) => mapActiveCaloriesBurnedRecord(raw as ActiveCaloriesBurnedRecord, ctx),
  },
  respiratory_rate: {
    hcRecordType: 'RespiratoryRateRecord',
    map: (raw, ctx) => mapRespiratoryRateRecord(raw as RespiratoryRateRecord, ctx),
  },
};

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Establish (or re-establish) a type's incremental baseline: fetch a fresh
 * changes token BEFORE reading records, then read.
 *
 * ORDER IS DELIBERATE. Token-then-read means a record modified in the gap
 * between the two calls is safe to see again on the NEXT incremental
 * `getChanges` — harmless, because mapRecords.ts's dedup key makes that
 * re-delivery idempotent (see file header). Read-then-token would risk the
 * opposite: a record modified in that same gap could be missed by both this
 * read AND the new token's baseline — a real, unrecoverable gap, not a
 * merely-redundant one. Given a choice between "might re-confirm a record"
 * and "might silently lose one," this always takes the re-confirm side.
 */
async function fullRead(
  client: Omit<HealthConnectClient, 'requestPermission'>,
  config: HcTypeConfig,
  ctx: MapContext,
): Promise<{ records: CanonicalHealthRecord[]; nextChangesToken: string }> {
  const rawToken = await client.getChangesToken([config.hcRecordType]);
  const rawRecords = await client.readRecords<unknown>(config.hcRecordType, {});
  const records = rawRecords
    .map((raw) => config.map(raw, ctx))
    .filter((r): r is CanonicalHealthRecord => r !== null);
  return { records, nextChangesToken: serializeChangesToken(rawToken) };
}

// ─── Orchestrator ───────────────────────────────────────────────────────────────

export async function runHealthConnectSync(params: HealthConnectSyncParams): Promise<HealthConnectSyncResult> {
  const permissionBuild = buildHealthConnectPermissions(params.types);

  let availability: HealthConnectAvailabilityResult;
  try {
    const sdkStatus = await params.client.getSdkStatus();
    availability = resolveHealthConnectAvailability(sdkStatus, 'android', params.androidApiLevel);
  } catch (err) {
    // getSdkStatus() itself throwing is NOT a legitimate SDK_UNAVAILABLE /
    // SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED signal from Health Connect —
    // it's a transport/host failure (native bridge threw, process crashed
    // mid-call, etc). Reporting this as 'available', or guessing a specific
    // needs_update tier we have no evidence for, would both be
    // fabrications. `availability: 'unavailable'` + `availabilityError` is
    // the honest shape: "we could not determine availability," which is a
    // different fact than "HC told us no" (that case never sets
    // `availabilityError`). Zero further client calls are made — the same
    // honest short-circuit as the legitimate-unavailable branch below.
    //
    // `userAction: 'retry'` — NOT 'unsupported_platform'. The pre-fix
    // behavior fabricated "this device doesn't support Health Connect,"
    // a permanent claim this catch block has zero evidence for (it only
    // knows the CHECK failed, not that HC is absent) — see the `'retry'`
    // doc in availability.ts for the full reasoning and why
    // 'temporarily_unavailable' was considered and rejected.
    return {
      records: [],
      deletedExternalIds: [],
      nextChangesTokens: { ...params.changesTokens },
      partial: false,
      availability: { availability: 'unavailable', userAction: 'retry' },
      availabilityBlocked: true,
      availabilityError: describeError(err),
      permissions: { granted: [], denied: [], notRequested: [...permissionBuild.permissions] },
      perType: {},
    };
  }

  if (availability.availability !== 'available') {
    // Honest short-circuit: unavailable/needs_update means the SDK itself
    // isn't usable, so this makes ZERO further client calls — no record
    // reads, no changes-token calls, and no `getGrantedPermissions()`
    // either. A grant query against an unusable SDK isn't a real signal, so
    // every requested permission honestly lands in `notRequested` rather
    // than being guessed at as `denied` — `hasRequested` doesn't change
    // that, because "the user was asked" and "the SDK can answer" are
    // separate facts. Every input token passes through untouched.
    return {
      records: [],
      deletedExternalIds: [],
      nextChangesTokens: { ...params.changesTokens },
      partial: false,
      availability,
      availabilityBlocked: true,
      permissions: { granted: [], denied: [], notRequested: [...permissionBuild.permissions] },
      perType: {},
    };
  }

  let grantedPermissions: HealthConnectPermissionString[];
  try {
    grantedPermissions = await params.client.getGrantedPermissions();
  } catch (err) {
    // The SDK IS available, but the grant query itself failed. This must
    // never be silently treated as "everything denied" — that would falsely
    // claim a choice the user may never have made. Every requested type
    // instead gets an honest per-type 'error' outcome (this pass could not
    // determine grant state for ANY type), every token is left completely
    // untouched (nothing was read for any type), and `permissions` falls
    // back to `notRequested` for the same reason the unavailable branch
    // above does — a failed grant query isn't a real signal either.
    const errorMessage = describeError(err);
    const perType: Partial<Record<CanonicalHealthMetricType, HealthConnectSyncTypeOutcome>> = {};
    for (const metricType of params.types) {
      perType[metricType] = { status: 'error', reSynced: false, deletedExternalIds: [], error: errorMessage };
    }
    return {
      records: [],
      deletedExternalIds: [],
      nextChangesTokens: { ...params.changesTokens },
      partial: true,
      availability,
      availabilityBlocked: false,
      permissions: { granted: [], denied: [], notRequested: [...permissionBuild.permissions] },
      perType,
    };
  }

  const permissions = resolvePermissionGrant(permissionBuild.permissions, grantedPermissions, params.hasRequested);
  const grantedSet = new Set(permissions.granted);

  const ctx: MapContext = {
    userId: params.userId,
    syncedAt: params.syncedAt,
    fetchedAt: new Date(params.nowMs).toISOString(),
  };

  const records: CanonicalHealthRecord[] = [];
  const deletedExternalIds: string[] = [];
  const nextChangesTokens: Partial<Record<CanonicalHealthMetricType, string | null>> = { ...params.changesTokens };
  const perType: Partial<Record<CanonicalHealthMetricType, HealthConnectSyncTypeOutcome>> = {};
  let partial = false;

  for (const metricType of params.types) {
    const config = HC_TYPE_CONFIG[metricType];
    if (!config) {
      // e.g. 'provider_score' — no Health Connect equivalent. Token (if any
      // was ever supplied for it, which it shouldn't be) is left untouched.
      perType[metricType] = { status: 'unsupported', reSynced: false, deletedExternalIds: [] };
      continue;
    }

    const permission = HEALTH_CONNECT_READ_PERMISSION_BY_METRIC[metricType];
    if (!permission || !grantedSet.has(permission)) {
      // Not authorized to read this type right now (denied OR never
      // requested — both are "don't read," the distinction lives in
      // `permissions` above). Token untouched: nothing was read, so nothing
      // about the sync's continuity state should move.
      perType[metricType] = { status: 'not_granted', reSynced: false, deletedExternalIds: [] };
      continue;
    }

    const existingToken = params.changesTokens[metricType] ?? null;

    try {
      if (existingToken == null) {
        const outcome = await fullRead(params.client, config, ctx);
        records.push(...outcome.records);
        nextChangesTokens[metricType] = outcome.nextChangesToken;
        perType[metricType] = { status: 'synced', reSynced: false, deletedExternalIds: [] };
        continue;
      }

      try {
        const rawToken = deserializeChangesToken(existingToken);
        const changesResp = await params.client.getChanges(rawToken);
        const { upserts, deletions } = splitChanges(changesResp.changes);
        const mapped = upserts
          .map((raw) => config.map(raw, ctx))
          .filter((r): r is CanonicalHealthRecord => r !== null);

        records.push(...mapped);
        deletedExternalIds.push(...deletions);
        nextChangesTokens[metricType] = serializeChangesToken(changesResp.nextChangesToken);
        perType[metricType] = { status: 'synced', reSynced: false, deletedExternalIds: deletions };
      } catch (err) {
        if (!isChangesTokenExpiredError(err)) throw err;
        // Expired or corrupt token: fall back to an honest full re-read,
        // never a silent double-count (see fullRead's dedup-key note).
        // Deletions are NOT replayed by a full read — HC full reads only
        // return records that currently exist — so a re-sync cannot
        // resurrect something the user deleted before the token expired.
        const outcome = await fullRead(params.client, config, ctx);
        records.push(...outcome.records);
        nextChangesTokens[metricType] = outcome.nextChangesToken;
        perType[metricType] = { status: 'synced', reSynced: true, deletedExternalIds: [] };
      }
    } catch (err) {
      // Per-type failure isolation: this type's error never stops the loop,
      // never touches its persisted token (nothing was actually synced), and
      // never gets folded into another type's result.
      partial = true;
      perType[metricType] = {
        status: 'error',
        reSynced: false,
        deletedExternalIds: [],
        error: describeError(err),
      };
    }
  }

  return {
    records,
    deletedExternalIds,
    nextChangesTokens,
    partial,
    availability,
    availabilityBlocked: false,
    permissions,
    perType,
  };
}
