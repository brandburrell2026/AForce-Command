import { describe, it, expect, vi } from 'vitest';

import {
  runHealthConnectSync,
  serializeChangesToken,
  HealthConnectChangesTokenExpiredError,
  HEALTH_CONNECT_CHANGES_TOKEN_EXPIRED_CODE,
  type HealthConnectSyncParams,
} from '../sync';
import { HEALTH_CONNECT_READ_PERMISSION_BY_METRIC } from '../permissions';
import { mapSleepSessionRecord, type MapContext } from '../mapRecords';
import type {
  HcSleepStage,
  HealthConnectClient,
  HealthConnectPermissionString,
  HealthConnectSdkStatus,
  SleepSessionRecord,
  HeartRateVariabilityRmssdRecord,
} from '../types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const USER_ID = 'user_1';
const SYNCED_AT = '2026-08-03T12:00:00.000Z';
const NOW_MS = Date.parse(SYNCED_AT);

const READ_SLEEP = HEALTH_CONNECT_READ_PERMISSION_BY_METRIC.sleep_session!;
const READ_STEPS = HEALTH_CONNECT_READ_PERMISSION_BY_METRIC.steps!;
const READ_HRV = HEALTH_CONNECT_READ_PERMISSION_BY_METRIC.hrv!;

function sleepRaw(id: string, packageName = 'com.google.android.apps.healthdata'): SleepSessionRecord {
  const stages: HcSleepStage[] = [
    { startTime: '2026-08-03T02:00:00.000Z', endTime: '2026-08-03T09:00:00.000Z', stage: 5 },
  ];
  return {
    metadata: { id, dataOrigin: { packageName }, lastModifiedTime: '2026-08-03T09:00:00.000Z' },
    startTime: stages[0].startTime,
    endTime: stages[stages.length - 1].endTime,
    stages,
  };
}

function hrvRaw(id: string, packageName = 'com.google.android.apps.healthdata'): HeartRateVariabilityRmssdRecord {
  return {
    metadata: { id, dataOrigin: { packageName }, lastModifiedTime: '2026-08-03T09:00:00.000Z' },
    time: '2026-08-03T09:00:00.000Z',
    heartRateVariabilityMillis: 42,
  };
}

/**
 * Test-only override shape. `readRecords` is intentionally NON-generic here
 * (`(recordType, options) => Promise<unknown[]>` instead of
 * `HealthConnectClient['readRecords']`'s `<T>(...) => Promise<T[]>`) because
 * a concrete fixture array can never literally satisfy an arbitrary `T` —
 * that's a generic-mocking limitation of the test, not of sync.ts. The single
 * cast in `makeClient` below is the standard, narrowly-scoped escape hatch
 * for this; every fixture is still a real, correctly-shaped raw HC record.
 */
interface MockClientOverrides {
  getSdkStatus?: HealthConnectClient['getSdkStatus'];
  requestPermission?: HealthConnectClient['requestPermission'];
  getGrantedPermissions?: HealthConnectClient['getGrantedPermissions'];
  readRecords?: (recordType: string, options?: unknown) => Promise<unknown[]>;
  getChangesToken?: HealthConnectClient['getChangesToken'];
  getChanges?: HealthConnectClient['getChanges'];
}

/** A client whose every method throws unless overridden — proves "NO reads" claims. */
function makeClient(overrides: MockClientOverrides = {}): HealthConnectClient {
  const unexpected = (name: string) => async () => {
    throw new Error(`unexpected call: ${name}`);
  };
  return {
    getSdkStatus: overrides.getSdkStatus ?? (unexpected('getSdkStatus') as HealthConnectClient['getSdkStatus']),
    requestPermission: overrides.requestPermission ?? (unexpected('requestPermission') as HealthConnectClient['requestPermission']),
    getGrantedPermissions:
      overrides.getGrantedPermissions ?? (unexpected('getGrantedPermissions') as HealthConnectClient['getGrantedPermissions']),
    readRecords: (overrides.readRecords ?? unexpected('readRecords')) as HealthConnectClient['readRecords'],
    getChangesToken: overrides.getChangesToken ?? (unexpected('getChangesToken') as HealthConnectClient['getChangesToken']),
    getChanges: overrides.getChanges ?? (unexpected('getChanges') as HealthConnectClient['getChanges']),
  };
}

function baseParams(overrides: Partial<HealthConnectSyncParams> = {}): HealthConnectSyncParams {
  return {
    client: makeClient(),
    userId: USER_ID,
    types: ['sleep_session'],
    changesTokens: {},
    nowMs: NOW_MS,
    syncedAt: SYNCED_AT,
    hasRequested: true,
    androidApiLevel: 34,
    ...overrides,
  };
}

// ─── Availability short-circuit ────────────────────────────────────────────

describe('runHealthConnectSync — availability short-circuit', () => {
  it.each<HealthConnectSdkStatus>(['SDK_UNAVAILABLE', 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED'])(
    '%s makes zero reads and honestly reports every permission as notRequested',
    async (sdkStatus) => {
      const client = makeClient({ getSdkStatus: vi.fn(async () => sdkStatus) });
      const result = await runHealthConnectSync(
        baseParams({ client, types: ['sleep_session', 'steps'], hasRequested: true }),
      );

      expect(result.records).toEqual([]);
      expect(result.deletedExternalIds).toEqual([]);
      expect(result.availability.availability).not.toBe('available');
      expect(result.permissions).toEqual({
        granted: [],
        denied: [],
        notRequested: [READ_SLEEP, READ_STEPS],
      });
      expect(result.perType).toEqual({});
      expect(result.partial).toBe(false);
      // getSdkStatus is the only call this made — everything else would have
      // thrown via makeClient's `unexpected` default.
      expect(client.getSdkStatus).toHaveBeenCalledTimes(1);
    },
  );

  it('passes every input changes token through unchanged when unavailable', async () => {
    const client = makeClient({ getSdkStatus: vi.fn(async () => 'SDK_UNAVAILABLE' as const) });
    const existingToken = serializeChangesToken('raw-preexisting');
    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: existingToken } }),
    );
    expect(result.nextChangesTokens).toEqual({ sleep_session: existingToken });
  });
});

// ─── Changes-token flow: initial null token ⇒ full read then token ─────────

describe('runHealthConnectSync — initial sync (no prior token)', () => {
  it('reads records, fetches a token BEFORE reading, and returns a serialized+versioned token', async () => {
    const raw = sleepRaw('hc_sleep_1');
    const getChangesToken = vi.fn(async () => 'raw-token-1');
    const readRecords = vi.fn(async () => [raw]);
    const callOrder: string[] = [];
    getChangesToken.mockImplementation(async () => {
      callOrder.push('getChangesToken');
      return 'raw-token-1';
    });
    readRecords.mockImplementation(async () => {
      callOrder.push('readRecords');
      return [raw];
    });

    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChangesToken,
      readRecords,
    });

    const result = await runHealthConnectSync(baseParams({ client }));

    expect(callOrder).toEqual(['getChangesToken', 'readRecords']); // token-before-read, see fullRead doc
    expect(getChangesToken).toHaveBeenCalledWith(['SleepSessionRecord']);
    expect(readRecords).toHaveBeenCalledWith('SleepSessionRecord', {});

    expect(result.records).toHaveLength(1);
    expect(result.records[0].externalId).toBe('hc_sleep_1');
    expect(result.perType.sleep_session).toEqual({ status: 'synced', reSynced: false, deletedExternalIds: [] });

    const token = result.nextChangesTokens.sleep_session!;
    expect(JSON.parse(token)).toEqual({ v: 1, token: 'raw-token-1' });
  });

  it('zero records is honestly reported as an empty array, not an error', async () => {
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChangesToken: vi.fn(async () => 'raw-token-empty'),
      readRecords: vi.fn(async () => []),
    });
    const result = await runHealthConnectSync(baseParams({ client }));
    expect(result.records).toEqual([]);
    expect(result.perType.sleep_session?.status).toBe('synced');
    expect(result.partial).toBe(false);
  });
});

// ─── Changes-token flow: token present ⇒ incremental upserts + deletions ───

describe('runHealthConnectSync — incremental sync via changes token', () => {
  it('calls getChanges with the unwrapped raw token and reports upserts + deletions separately', async () => {
    const existingToken = serializeChangesToken('raw-token-prev');
    const upsertRaw = sleepRaw('hc_sleep_2');
    const getChanges = vi.fn(async (token: string) => {
      expect(token).toBe('raw-token-prev'); // envelope unwrapped before reaching the client
      return {
        changes: [
          { changeType: 'upsert', record: upsertRaw },
          { changeType: 'delete', recordId: 'hc_sleep_old' },
        ],
        nextChangesToken: 'raw-token-next',
      };
    });
    const readRecords = vi.fn(async () => {
      throw new Error('must not full-read when a token is present');
    });
    const getChangesToken = vi.fn(async () => {
      throw new Error('must not fetch a new baseline token on the incremental path');
    });

    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChanges,
      readRecords,
      getChangesToken,
    });

    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: existingToken } }),
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].externalId).toBe('hc_sleep_2');
    expect(result.deletedExternalIds).toEqual(['hc_sleep_old']);
    expect(result.perType.sleep_session).toEqual({
      status: 'synced',
      reSynced: false,
      deletedExternalIds: ['hc_sleep_old'],
    });
    expect(JSON.parse(result.nextChangesTokens.sleep_session!)).toEqual({ v: 1, token: 'raw-token-next' });
  });
});

// ─── Token expiry ⇒ honest full re-read, never a silent double-count ───────

describe('runHealthConnectSync — changes-token expiry falls back to a full re-read', () => {
  it('an HC-thrown expiry error triggers reSynced:true and a fresh baseline token', async () => {
    const existingToken = serializeChangesToken('raw-token-expired');
    const raw = sleepRaw('hc_sleep_1');
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChanges: vi.fn(async () => {
        throw new HealthConnectChangesTokenExpiredError('simulated HC invalidation');
      }),
      getChangesToken: vi.fn(async () => 'raw-token-fresh'),
      readRecords: vi.fn(async () => [raw]),
    });

    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: existingToken } }),
    );

    expect(result.perType.sleep_session).toEqual({ status: 'synced', reSynced: true, deletedExternalIds: [] });
    expect(JSON.parse(result.nextChangesTokens.sleep_session!)).toEqual({ v: 1, token: 'raw-token-fresh' });
    expect(result.records).toHaveLength(1);
  });

  it('recognizes expiry by duck-typed .code, not only its own error class (H5 cross-module tolerance)', async () => {
    const existingToken = serializeChangesToken('raw-token-expired');
    const foreignExpiryError = Object.assign(new Error('native SDK says expired'), {
      code: HEALTH_CONNECT_CHANGES_TOKEN_EXPIRED_CODE,
    });
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChanges: vi.fn(async () => {
        throw foreignExpiryError;
      }),
      getChangesToken: vi.fn(async () => 'raw-token-fresh'),
      readRecords: vi.fn(async () => []),
    });

    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: existingToken } }),
    );
    expect(result.perType.sleep_session?.status).toBe('synced');
    expect(result.perType.sleep_session?.reSynced).toBe(true);
  });

  it('an unparseable/garbage persisted token is treated exactly like expiry, not passed to getChanges', async () => {
    const getChanges = vi.fn(async () => {
      throw new Error('must never receive a garbage token');
    });
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChanges,
      getChangesToken: vi.fn(async () => 'raw-token-fresh'),
      readRecords: vi.fn(async () => []),
    });

    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: 'not-json-at-all' } }),
    );
    expect(getChanges).not.toHaveBeenCalled();
    expect(result.perType.sleep_session).toEqual({ status: 'synced', reSynced: true, deletedExternalIds: [] });
  });

  it('a token envelope from a future/unrecognized version is also treated as expired', async () => {
    const futureEnvelope = JSON.stringify({ v: 99, token: 'raw-token-future-format' });
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChanges: vi.fn(async () => {
        throw new Error('must never receive an unversioned token');
      }),
      getChangesToken: vi.fn(async () => 'raw-token-fresh'),
      readRecords: vi.fn(async () => []),
    });
    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: futureEnvelope } }),
    );
    expect(result.perType.sleep_session?.reSynced).toBe(true);
  });

  it('dedup keys make the re-synced full read idempotent with the original record (never a silent double-count)', async () => {
    const raw = sleepRaw('hc_sleep_1');
    const ctx: MapContext = { userId: USER_ID, syncedAt: SYNCED_AT };
    const directlyMapped = mapSleepSessionRecord(raw, ctx);

    const existingToken = serializeChangesToken('raw-token-expired');
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChanges: vi.fn(async () => {
        throw new HealthConnectChangesTokenExpiredError('simulated');
      }),
      getChangesToken: vi.fn(async () => 'raw-token-fresh'),
      readRecords: vi.fn(async () => [raw]),
    });

    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: existingToken } }),
    );

    expect(result.records[0].deduplicationKey).toBe(directlyMapped.deduplicationKey);
  });
});

// ─── Per-type failure isolation ─────────────────────────────────────────────

describe('runHealthConnectSync — per-type failure isolation', () => {
  it('one type throwing does not affect a sibling type, and leaves the failed type\'s token untouched', async () => {
    const stepsToken = serializeChangesToken('raw-steps-token');
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP, READ_STEPS]),
      getChangesToken: vi.fn(async () => 'raw-sleep-token'),
      readRecords: vi.fn(async (recordType: string) => {
        if (recordType === 'SleepSessionRecord') return [sleepRaw('hc_sleep_1')];
        throw new Error('boom: steps backend unreachable');
      }),
      // Steps goes through the incremental path (it has a token) and fails inside getChanges.
      getChanges: vi.fn(async (token: string) => {
        expect(token).toBe('raw-steps-token');
        throw new Error('boom: steps changes endpoint down');
      }),
    });

    const result = await runHealthConnectSync(
      baseParams({
        client,
        types: ['sleep_session', 'steps'],
        changesTokens: { steps: stepsToken },
      }),
    );

    expect(result.partial).toBe(true);
    expect(result.perType.sleep_session).toEqual({ status: 'synced', reSynced: false, deletedExternalIds: [] });
    expect(result.perType.steps).toEqual({
      status: 'error',
      reSynced: false,
      deletedExternalIds: [],
      error: 'boom: steps changes endpoint down',
    });
    // Failed type's token must be exactly what the caller supplied — never advanced.
    expect(result.nextChangesTokens.steps).toBe(stepsToken);
    // Successful sibling still produced records.
    expect(result.records).toHaveLength(1);
    expect(result.records[0].metricType).toBe('sleep_session');
  });

  it('a non-expiry error from getChanges is NOT treated as expiry (no silent fallback re-read)', async () => {
    const existingToken = serializeChangesToken('raw-token');
    const readRecords = vi.fn(async () => {
      throw new Error('must not fall back to a full read for a generic error');
    });
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChanges: vi.fn(async () => {
        throw new Error('network timeout');
      }),
      readRecords,
    });

    const result = await runHealthConnectSync(
      baseParams({ client, changesTokens: { sleep_session: existingToken } }),
    );

    expect(readRecords).not.toHaveBeenCalled();
    expect(result.partial).toBe(true);
    expect(result.perType.sleep_session).toEqual({
      status: 'error',
      reSynced: false,
      deletedExternalIds: [],
      error: 'network timeout',
    });
    expect(result.nextChangesTokens.sleep_session).toBe(existingToken);
  });
});

// ─── not-requested vs denied vs granted, preserved end-to-end ──────────────

describe('runHealthConnectSync — permission distinction preserved end-to-end', () => {
  it('hasRequested:false ⇒ everything lands in notRequested, and nothing requested is read', async () => {
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => []), // irrelevant on this path, per permissions.ts
    });
    const result = await runHealthConnectSync(
      baseParams({ client, types: ['sleep_session', 'steps'], hasRequested: false }),
    );
    expect(result.permissions).toEqual({
      granted: [],
      denied: [],
      notRequested: [READ_SLEEP, READ_STEPS],
    });
    expect(result.perType.sleep_session?.status).toBe('not_granted');
    expect(result.perType.steps?.status).toBe('not_granted');
    expect(result.records).toEqual([]);
  });

  it('hasRequested:true with a partial grant set distinguishes granted vs denied per type', async () => {
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]), // steps was requested, not granted
      getChangesToken: vi.fn(async () => 'raw-token'),
      readRecords: vi.fn(async () => [sleepRaw('hc_sleep_1')]),
    });
    const result = await runHealthConnectSync(
      baseParams({ client, types: ['sleep_session', 'steps'], hasRequested: true }),
    );
    expect(result.permissions.granted).toEqual([READ_SLEEP]);
    expect(result.permissions.denied).toEqual([READ_STEPS]);
    expect(result.permissions.notRequested).toEqual([]);
    expect(result.perType.sleep_session?.status).toBe('synced');
    expect(result.perType.steps?.status).toBe('not_granted');
  });

  it('an unsupported metric type (provider_score) is reported distinctly from not_granted, no permission guessed', async () => {
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => []),
    });
    const result = await runHealthConnectSync(
      baseParams({ client, types: ['provider_score'], hasRequested: true }),
    );
    expect(result.perType.provider_score).toEqual({ status: 'unsupported', reSynced: false, deletedExternalIds: [] });
    expect(result.permissions).toEqual({ granted: [], denied: [], notRequested: [] });
  });
});

// ─── Samsung dataOrigin attribution preserved end-to-end ───────────────────

describe('runHealthConnectSync — provenance attribution passes through untouched', () => {
  it('a Samsung-origin record keeps its samsung_health provenance after syncing', async () => {
    const raw = sleepRaw('hc_sleep_samsung', 'com.sec.android.app.shealth');
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChangesToken: vi.fn(async () => 'raw-token'),
      readRecords: vi.fn(async () => [raw]),
    });
    const result = await runHealthConnectSync(baseParams({ client }));
    expect(result.records[0].provenanceChain[0]).toEqual({
      provider: 'samsung_health',
      nativeOrigin: 'com.sec.android.app.shealth',
      transport: 'measured',
    });
    expect(result.records[0].provider).toBe('google_health'); // delivering provider is always google_health
  });

  it('a Google Fit record resolves exactly as mapRecords.ts defines it — sync.ts adds no Fit-specific handling of its own', async () => {
    // mapRecords.ts (off-limits, consume-only) locally treats
    // 'com.google.android.apps.fitness' as a first-party google_health
    // package (see its GOOGLE_FIRST_PARTY_PACKAGES set) — a single measured
    // hop, no aggregator hop. This test isn't asserting that policy is
    // "right"; it asserts sync.ts doesn't layer any Fit-specific branching
    // of its own on top of whatever mapRecords.ts already decides — the raw
    // record passes straight through the same mapper every other package
    // goes through, with no Google Fit special case in this file.
    const raw = sleepRaw('hc_sleep_fit', 'com.google.android.apps.fitness');
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_SLEEP]),
      getChangesToken: vi.fn(async () => 'raw-token'),
      readRecords: vi.fn(async () => [raw]),
    });
    const result = await runHealthConnectSync(baseParams({ client }));
    // DELEGATION-RELATIVE assertion (Commander integration note): sync.ts must
    // produce EXACTLY what the mapper produces for a Fit record — no Fit
    // branching of its own. Pinning a concrete origin here would couple this
    // lane to the mapper's Fit policy, which PR #470 (L1) changes from
    // first-party google_health to unknown_device_app + aggregator hop.
    const mapped = mapSleepSessionRecord(raw, {
      userId: baseParams({ client }).userId,
      syncedAt: SYNCED_AT,
    });
    expect(result.records[0].provenanceChain).toEqual(mapped.provenanceChain);
    expect(result.records[0].provenanceChain[0].nativeOrigin).toBe('com.google.android.apps.fitness');
  });
});

// ─── RMSSD-only HRV assertion ───────────────────────────────────────────────

describe('runHealthConnectSync — HRV is always RMSSD, never SDNN', () => {
  it('a synced HRV record is stamped hrvMethod: rmssd', async () => {
    const raw = hrvRaw('hc_hrv_1');
    const client = makeClient({
      getSdkStatus: vi.fn(async () => 'SDK_AVAILABLE' as const),
      getGrantedPermissions: vi.fn(async () => [READ_HRV]),
      getChangesToken: vi.fn(async () => 'raw-token'),
      readRecords: vi.fn(async () => [raw]),
    });
    const result = await runHealthConnectSync(baseParams({ client, types: ['hrv'] }));
    expect(result.records).toHaveLength(1);
    expect(result.records[0].hrvMethod).toBe('rmssd');
  });
});
