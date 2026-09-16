/**
 * The one storage binding the trainer surface uses.
 *
 * Every trainer cache and the outbox go through here, so there is a single
 * answer to "where is this written and how is it cleared" — and so a cache
 * added later gets the encryption and the clearability without its author
 * having to know about either.
 *
 * VALUES GO IN `secureKV` (expo-secure-store on device, AsyncStorage on the
 * web dev surface). A cached athlete record carries note bodies and
 * availability reasons; the Lock already requires an encrypted local cache
 * for profile-class data, and a medical note is not a lesser class than a
 * profile.
 *
 * THE KEY MANIFEST GOES IN AsyncStorage. SecureStore cannot enumerate, so
 * without a manifest the encrypted entries could be written and never found
 * again to be deleted — which on a shared sideline tablet is worse than not
 * encrypting them. The manifest holds key names only: no values, nothing
 * clinical, so ordinary storage is the right place for it, and iOS's secure
 * enclave has a small item budget that a growing list would eat.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { secureKV } from "./secureStorage";
import {
  clearAllTrainerCaches,
  clearAthleteCaches,
  clearViewerCaches,
  type ClearResult,
} from "@/utils/trainerCacheReset";
import { withKeyManifest, type EnumerableStorage } from "@/utils/trainerKeyManifest";

const manifestRegistry = {
  getItem: (k: string) => AsyncStorage.getItem(k),
  setItem: (k: string, v: string) => AsyncStorage.setItem(k, v),
  removeItem: (k: string) => AsyncStorage.removeItem(k),
};

/** Encrypted, enumerable, clearable. Use this and nothing else. */
export const trainerStorage: EnumerableStorage = withKeyManifest(secureKV, manifestRegistry);

/**
 * SIGN-OUT. Everything the trainer surface holds, for every viewer.
 *
 * Call this BEFORE the session ends, while there is still a session: on a
 * shared device the next person to pick it up is not necessarily staff, and
 * a cached record is a full clinical picture.
 *
 * Never throws. A clear that partly failed is worth surfacing, but it must
 * not be a reason to leave someone signed in.
 */
export async function clearTrainerDataOnSignOut(): Promise<ClearResult> {
  return clearAllTrainerCaches(trainerStorage);
}

/** MEMBERSHIP LOST, or a viewer switch on a shared device. */
export async function clearTrainerDataForViewer(viewerUserId: string): Promise<ClearResult> {
  return clearViewerCaches(trainerStorage, viewerUserId);
}

/**
 * CONSENT REVOKED for one athlete.
 *
 * The server stops disclosing immediately; this is the other half. A cache
 * that keeps answering after a revocation is a disclosure the access log
 * never sees, which is the one kind this system cannot account for.
 */
export async function clearTrainerDataForAthlete(athleteUserId: string): Promise<ClearResult> {
  return clearAthleteCaches(trainerStorage, athleteUserId);
}
