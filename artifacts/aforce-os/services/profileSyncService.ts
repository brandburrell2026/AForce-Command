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

import { secureKV } from './secureStorage';
import { getJsonAforceApi, postJsonAforceApi } from './aforceApiClient';
import {
  decideProfileHydration,
  identityPatchFromServerSnapshot,
  type HydrationDecision,
  type ServerProfileSnapshot,
} from '../utils/profileHydration';
import {
  classifyProfileSave,
  initialConfidence,
  type ProfileSnapshot,
} from './adaptiveProfileEngine';
import {
  recalibrateTargets,
  recalibrationInputsFromIdentity,
} from './bodyRecalibrationEngine';
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
 * Map the editable identity to the major-variable snapshot. Section 19 fields
 * (training level, primary goal, sweat classification) now flow through. The
 * remaining slots (home climate, sleep schedule, connected wearables) map to
 * null/empty deterministically so they never produce a spurious diff; they
 * begin minting versions once their own sections / wearable integration land.
 */
export function profileSnapshotFromIdentity(identity: ProfileIdentity): ProfileSnapshot {
  return {
    weightLbs: identity.bodyWeightLbs,
    heightCm: identity.heightCm,
    birthYear: identity.birthYear,
    sex: identity.biologicalSex,
    activityLevel: identity.activityLevel,
    // Section 19 — these slots are now populated from the Performance Profile
    // fields, so completing onboarding / editing them mints a version.
    trainingLevel: identity.trainingLevel,
    performanceGoal: identity.primaryGoal,
    sweatClassification: identity.sweatClassification,
    // Still unset until their own sections land (climate / sleep / wearables).
    homeClimate: null,
    sleepSchedule: null,
    connectedWearables: [],
  };
}

async function loadSyncState(): Promise<ProfileSyncState> {
  try {
    // K-1 (RC-L11): sync state lives in the encrypted store; the read
    // transparently migrates any legacy plain-AsyncStorage value.
    const raw = await secureKV.getItem(SYNC_STATE_KEY);
    if (!raw) return { ...EMPTY_SYNC_STATE };
    const parsed = JSON.parse(raw) as Partial<ProfileSyncState>;
    return { ...EMPTY_SYNC_STATE, ...parsed };
  } catch {
    return { ...EMPTY_SYNC_STATE };
  }
}

async function saveSyncState(next: ProfileSyncState): Promise<void> {
  try {
    await secureKV.setItem(SYNC_STATE_KEY, JSON.stringify(next));
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
  // §20 — recompute the five go-forward targets from the §19 inputs. Stored on
  // the new baseline server-side; future-only, never touches past snapshots.
  const targets = recalibrateTargets(recalibrationInputsFromIdentity(nextIdentity));
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
      targets,
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

/* ─── Lock §7 / RC-L11 — server rehydration + reconnect flush ────────────── */

interface ProfileGetResponse {
  profile: { currentProfileVersionId: number | null; currentBaselineVersionId: number | null } | null;
  baseline: { id: number } | null;
  version: { id: number; versionNumber: number; snapshot: ServerProfileSnapshot } | null;
}

export interface HydrationResult {
  decision: HydrationDecision;
  /** Sparse identity patch to apply when `decision === 'hydrate'`. */
  patch: Partial<ProfileIdentity> | null;
}

/**
 * Restore the server-backed profile after a fresh install / new device.
 * Deterministic (see utils/profileHydration.ts): a pending local change or an
 * already-calibrated local profile is NEVER silently overwritten. On hydrate,
 * the sync state is seeded from the server snapshot + pointers so the next
 * save diffs against confirmed server truth.
 */
export async function hydrateProfileFromServer(
  localIdentity: ProfileIdentity,
): Promise<HydrationResult> {
  let res: ProfileGetResponse;
  try {
    res = await getJsonAforceApi<ProfileGetResponse>('/profile');
  } catch {
    // Offline / server error — hydration is best-effort; local state stands.
    return { decision: 'noop', patch: null };
  }

  const sync = await loadSyncState();
  const serverSnapshot = res.version?.snapshot ?? null;
  const decision = decideProfileHydration({
    localIdentity,
    hasPendingSync: sync.pendingClientChangeId != null,
    serverSnapshot,
  });
  if (decision !== 'hydrate' || !serverSnapshot || !res.version) {
    return { decision, patch: null };
  }

  // Seed sync state from server truth so the next save diffs correctly and
  // pointer stamping resumes (reinstall wiped the local pointers).
  await saveSyncState({
    lastSyncedSnapshot: serverSnapshot as ProfileSnapshot,
    profileVersionId: res.profile?.currentProfileVersionId ?? res.version.id,
    baselineVersionId: res.profile?.currentBaselineVersionId ?? res.baseline?.id ?? null,
    pendingClientChangeId: null,
  });
  return { decision, patch: identityPatchFromServerSnapshot(serverSnapshot) };
}

/**
 * Reconnect flush (§7): if a major change is still pending (POST failed
 * offline), retry it now with the SAME idempotency key via the normal save
 * path. Safe to call on app-foreground / network-regain; no-op when clean.
 */
export async function flushPendingProfileSync(
  currentIdentity: ProfileIdentity,
): Promise<boolean> {
  const sync = await loadSyncState();
  if (sync.pendingClientChangeId == null) return false;
  const result = await saveProfileVersion(currentIdentity);
  return result.synced;
}
