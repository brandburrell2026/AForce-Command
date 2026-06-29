/**
 * Profile sync service (Section 18) — the client side of Contract A.
 *
 * Bridges the live, editable client `ProfileIdentity` (AsyncStorage) to the
 * server's append-only Profile Version™ history. On save it:
 *   1. maps the identity to a `ProfileSnapshot` (the major-variable view),
 *   2. diffs it against the last-synced snapshot via the pure engine
 *      (`classifyProfileSave`),
 *   3. on a MAJOR change, POSTs the snapshot to mint a version server-side
 *      (which runs the atomic `recordMajorChange` transaction),
 *   4. persists the returned pointers as the new last-synced state.
 *
 * Contract A failure handling (see services/adaptiveProfileEngine.ts):
 *   - The local edit is NEVER rolled back here — the caller has already
 *     committed it to `ProfileIdentity`. If the POST fails (offline / 5xx),
 *     we keep the snapshot + the SAME `clientChangeId` marked pending, so the
 *     next save retries idempotently (the server dedupes on the key).
 *   - `isFirstBaseline` is derived from local sync state (V1 is single-user
 *     per the DB schema, so there is no multi-device race to reconcile).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { postJsonAforceApi } from './aforceApiClient';
import {
  classifyProfileSave,
  initialConfidence,
  type ProfileSnapshot,
} from './adaptiveProfileEngine';
import { PROFILE_SAVE_CONFIRMATION } from '../config/hydroStateModel';
import type { ProfileIdentity } from '../utils/profileIdentity';

const SYNC_STATE_KEY = 'aforce.profileSync';

/**
 * Locally-persisted sync state. `lastSyncedSnapshot` is the snapshot the
 * server last confirmed (or null before the first mint); the pointer ids are
 * stamped onto HydroState / Performance Memory writes. `pendingClientChangeId`
 * is non-null only while a major change is awaiting server confirmation.
 */
export interface ProfileSyncState {
  lastSyncedSnapshot: ProfileSnapshot | null;
  profileVersionId: number | null;
  baselineVersionId: number | null;
  pendingClientChangeId: string | null;
}

const EMPTY_SYNC_STATE: ProfileSyncState = {
  lastSyncedSnapshot: null,
  profileVersionId: null,
  baselineVersionId: null,
  pendingClientChangeId: null,
};

/** An all-unset snapshot — the diff baseline before the first sync. */
const EMPTY_SNAPSHOT: ProfileSnapshot = {
  weightLbs: null,
  heightCm: null,
  birthYear: null,
  sex: null,
  activityLevel: null,
  trainingLevel: null,
  performanceGoal: null,
  homeClimate: null,
  sleepSchedule: null,
  sweatClassification: null,
  connectedWearables: [],
};

/**
 * Map the editable identity to the major-variable snapshot. Fields not yet
 * collected by the UI (training level, primary goal, climate, sleep schedule,
 * sweat classification — all Section 19 — and connected wearables) map to
 * null/empty deterministically so they never produce a spurious diff; they
 * begin minting versions once Section 19 / wearable integration populates them.
 */
export function profileSnapshotFromIdentity(identity: ProfileIdentity): ProfileSnapshot {
  return {
    weightLbs: identity.bodyWeightLbs,
    heightCm: identity.heightCm,
    birthYear: identity.birthYear,
    sex: identity.biologicalSex,
    activityLevel: identity.activityLevel,
    trainingLevel: null,
    performanceGoal: null,
    homeClimate: null,
    sleepSchedule: null,
    sweatClassification: null,
    connectedWearables: [],
  };
}

async function loadSyncState(): Promise<ProfileSyncState> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return { ...EMPTY_SYNC_STATE };
    const parsed = JSON.parse(raw) as Partial<ProfileSyncState>;
    return { ...EMPTY_SYNC_STATE, ...parsed };
  } catch {
    return { ...EMPTY_SYNC_STATE };
  }
}

async function saveSyncState(next: ProfileSyncState): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_STATE_KEY, JSON.stringify(next));
  } catch {
    // Persistence is best-effort; a failed write just means the next save
    // re-diffs against the prior snapshot (idempotent on the server).
  }
}

function newClientChangeId(): string {
  return `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface MintResponse {
  pointers: { profileVersionId: number; baselineVersionId: number; versionNumber: number };
  minted: boolean;
}

export interface SaveProfileResult {
  changeType: 'major' | 'minor';
  /** True once the server confirmed the mint (major changes only). */
  synced: boolean;
  /** True when a NEW version was minted (false on idempotent replay/minor). */
  minted: boolean;
  /** Recalibration explanation (major only) — the spec's Evidence Engine copy. */
  explanation: string;
  /** General save confirmation copy (shown on every successful save). */
  confirmation: string;
  /** Resulting version number when known. */
  versionNumber: number | null;
}

/**
 * Persist a profile save and, on a major change, mint a server-side Profile
 * Version™. The caller is expected to have already written `nextIdentity` to
 * the local store (optimistic, local-first).
 */
export async function saveProfileVersion(
  nextIdentity: ProfileIdentity,
): Promise<SaveProfileResult> {
  const sync = await loadSyncState();
  const prev = sync.lastSyncedSnapshot ?? EMPTY_SNAPSHOT;
  const next = profileSnapshotFromIdentity(nextIdentity);

  const decision = classifyProfileSave(prev, next);

  if (decision.changeType === 'minor') {
    return {
      changeType: 'minor',
      synced: true,
      minted: false,
      explanation: '',
      confirmation: PROFILE_SAVE_CONFIRMATION,
      versionNumber: null,
    };
  }

  const isFirst = sync.profileVersionId == null;
  const confidence = initialConfidence(isFirst);
  // Reuse a pending id so a retry after a failed POST dedupes server-side.
  const clientChangeId = sync.pendingClientChangeId ?? newClientChangeId();
  // Mark pending BEFORE the network call so a crash mid-flight still retries
  // with the same idempotency key.
  await saveSyncState({ ...sync, pendingClientChangeId: clientChangeId });

  try {
    const res = await postJsonAforceApi<MintResponse>('/profile/version', {
      snapshot: next,
      changedFields: decision.changedFields,
      explanation: decision.explanation,
      initialConfidence: confidence,
      clientChangeId,
    });
    await saveSyncState({
      lastSyncedSnapshot: next,
      profileVersionId: res.pointers.profileVersionId,
      baselineVersionId: res.pointers.baselineVersionId,
      pendingClientChangeId: null,
    });
    return {
      changeType: 'major',
      synced: true,
      minted: res.minted,
      explanation: decision.explanation,
      confirmation: PROFILE_SAVE_CONFIRMATION,
      versionNumber: res.pointers.versionNumber,
    };
  } catch {
    // Offline / server error — keep the pending key for an idempotent retry.
    // The local edit stands; the engine keeps using the last-confirmed
    // baseline until the next successful sync.
    return {
      changeType: 'major',
      synced: false,
      minted: false,
      explanation: decision.explanation,
      confirmation: PROFILE_SAVE_CONFIRMATION,
      versionNumber: null,
    };
  }
}

/** The persisted active pointers, for stamping HydroState / Performance Memory. */
export async function getActivePointers(): Promise<{
  profileVersionId: number | null;
  baselineVersionId: number | null;
}> {
  const sync = await loadSyncState();
  return {
    profileVersionId: sync.profileVersionId,
    baselineVersionId: sync.baselineVersionId,
  };
}
