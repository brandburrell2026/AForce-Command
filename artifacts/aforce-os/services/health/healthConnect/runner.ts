/**
 * LANE G4/G5 seam — the FOREGROUND Health Connect runner.
 *
 * Two entry points, mirroring the type-level split the sync engine enforces:
 *
 *   connectHealthData()  — the ONLY place `requestPermission` is reachable.
 *     Owns the member-initiated connect flow: availability → permission sheet
 *     (the approved read set, nothing else) → first sync.
 *
 *   syncHealthConnectNow() — permissionless by type (`Omit<…,'requestPermission'>`
 *     flows into runHealthConnectSync). Reads granted state, runs the H2
 *     incremental engine, uploads mapped records to the G2 ingest door in
 *     small chunks, persists the changes tokens. Foreground-only by founder
 *     ruling: nothing here schedules, and nothing here may pop UI.
 *
 * The runner adds NO mapping, NO dedupe, NO arbitration, NO confidence logic —
 * H2 maps, the server recomputes identity/keys, signalResolution arbitrates.
 * Uploads chunk at CHUNK_SIZE records to stay far under the server's 64kb
 * body limit.
 */
import { Platform } from 'react-native';
import { scopedStorage } from '../../scopedStorage';
import { postHealthRecordsImport } from '../../realApi';
import { createNativeHealthConnectClient } from './nativeClient';
import { buildHealthConnectPermissions } from './permissions';
import { runHealthConnectSync } from './sync';
import type {
  CanonicalHealthMetricType,
  HealthConnectClient,
} from './types';

/** The approved metric set for Phase-1 Android beta — mirrors permissions.ts. */
export const HEALTH_CONNECT_SYNC_TYPES: readonly CanonicalHealthMetricType[] = [
  'sleep_session',
  'resting_heart_rate',
  'hrv',
  'heart_rate_summary',
  'workout',
  'steps',
  'active_energy',
  'respiratory_rate',
];

const TOKENS_KEY = 'healthConnect.changesTokens.v1';
export const CHUNK_SIZE = 50;

export type ConnectHealthDataResult =
  | { status: 'connected'; granted: number; synced: number }
  | { status: 'unavailable' }
  | { status: 'update_required' }
  | { status: 'denied' }
  | { status: 'error' };

export type SyncNowResult =
  | { status: 'synced'; uploaded: number; partial: boolean }
  | { status: 'skipped_unavailable' }
  | { status: 'skipped_not_connected' }
  | { status: 'error' };

export interface RunnerDeps {
  client?: HealthConnectClient;
  userId: string;
  post?: typeof postHealthRecordsImport;
  storage?: Pick<typeof scopedStorage, 'getItem' | 'setItem'>;
  nowMs?: () => number;
  platformOs?: string;
}

async function readTokens(
  storage: Pick<typeof scopedStorage, 'getItem' | 'setItem'>,
): Promise<Partial<Record<CanonicalHealthMetricType, string | null>>> {
  try {
    const raw = await storage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<CanonicalHealthMetricType, string | null>>) : {};
  } catch {
    return {};
  }
}

async function runSyncAndUpload(
  client: HealthConnectClient,
  deps: Required<Pick<RunnerDeps, 'userId'>> & RunnerDeps,
): Promise<{ uploaded: number; partial: boolean; unavailable: boolean }> {
  const storage = deps.storage ?? scopedStorage;
  const post = deps.post ?? postHealthRecordsImport;
  const nowMs = (deps.nowMs ?? Date.now)();

  const result = await runHealthConnectSync({
    client,
    userId: deps.userId,
    types: HEALTH_CONNECT_SYNC_TYPES,
    changesTokens: await readTokens(storage),
    nowMs,
    syncedAt: new Date(nowMs).toISOString(),
    // Both runner entry points reach here only after a permission interaction
    // (connect just requested; syncNow verified a non-empty grant list), so
    // the grant state is queryable rather than never-asked.
    hasRequested: true,
  });

  if (result.availabilityBlocked) return { uploaded: 0, partial: false, unavailable: true };

  let uploaded = 0;
  for (let i = 0; i < result.records.length; i += CHUNK_SIZE) {
    const chunk = result.records.slice(i, i + CHUNK_SIZE).map((r) => {
      // The wire contract excludes identity fields — the server re-stamps
      // userId and recomputes deduplicationKey under the authenticated user.
      const { userId: _u, deduplicationKey: _k, ...wire } = r;
      return wire as Record<string, unknown>;
    });
    const res = await post(chunk);
    uploaded += res.upserted;
  }

  // Persist tokens only after every chunk landed — a failed upload rethrows
  // above and the next sync replays the same window; the server's idempotent
  // upsert makes the replay a no-op rather than a duplicate.
  await storage.setItem(TOKENS_KEY, JSON.stringify(result.nextChangesTokens));
  return { uploaded, partial: result.partial, unavailable: false };
}

/** Member-initiated connect: the ONLY requestPermission path. */
export async function connectHealthData(deps: RunnerDeps): Promise<ConnectHealthDataResult> {
  const os = deps.platformOs ?? Platform.OS;
  if (os !== 'android') return { status: 'unavailable' };
  const client = deps.client ?? createNativeHealthConnectClient();
  try {
    const sdk = await client.getSdkStatus();
    if (sdk === 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED') return { status: 'update_required' };
    if (sdk !== 'SDK_AVAILABLE') return { status: 'unavailable' };

    const { permissions } = buildHealthConnectPermissions(HEALTH_CONNECT_SYNC_TYPES);
    const granted = await client.requestPermission(permissions);
    if (granted.length === 0) return { status: 'denied' };

    const sync = await runSyncAndUpload(client, deps as Required<Pick<RunnerDeps, 'userId'>> & RunnerDeps);
    return { status: 'connected', granted: granted.length, synced: sync.uploaded };
  } catch {
    return { status: 'error' };
  }
}

/** Foreground refresh: permissionless, never pops UI, never schedules. */
export async function syncHealthConnectNow(deps: RunnerDeps): Promise<SyncNowResult> {
  const os = deps.platformOs ?? Platform.OS;
  if (os !== 'android') return { status: 'skipped_unavailable' };
  const client = deps.client ?? createNativeHealthConnectClient();
  try {
    const grantedNow = await client.getGrantedPermissions();
    if (grantedNow.length === 0) return { status: 'skipped_not_connected' };
    const sync = await runSyncAndUpload(client, deps as Required<Pick<RunnerDeps, 'userId'>> & RunnerDeps);
    if (sync.unavailable) return { status: 'skipped_unavailable' };
    return { status: 'synced', uploaded: sync.uploaded, partial: sync.partial };
  } catch {
    return { status: 'error' };
  }
}
