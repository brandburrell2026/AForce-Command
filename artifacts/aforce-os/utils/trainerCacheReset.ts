/**
 * Getting cached medical content OFF a device.
 *
 * The caches were built with per-viewer keys and a `clearRecord` helper, and
 * then nothing ever called it. Nothing cleared on sign-out, nothing cleared
 * when a staff member lost access to a program, and nothing cleared when an
 * athlete revoked consent. A cached record carries note bodies and
 * availability reasons, so "the trainer signed out" left a full clinical
 * picture on a shared sideline tablet indefinitely.
 *
 * Three events, three different scopes, and they are genuinely different:
 *
 *   1. SIGN-OUT — everything this device holds for the trainer surface. The
 *      next person to pick the tablet up is not necessarily staff.
 *
 *   2. MEMBERSHIP LOST — one viewer's cached data. They may still be signed
 *      in and legitimately using the rest of the app; what they lost is this
 *      program, and a 404 from the server must not leave yesterday's roster
 *      readable offline.
 *
 *   3. CONSENT REVOKED — one athlete, across every viewer on the device. The
 *      server stops disclosing immediately (Step 1); this is the other half,
 *      because a cache that keeps answering is a disclosure the audit log
 *      never sees.
 *
 * Clearing is BEST EFFORT AND TOTAL-ATTEMPT: one key that will not delete
 * must not abandon the rest. The count of failures is returned rather than
 * thrown, so a caller can decide whether to warn — but no caller should treat
 * a failure as a reason to keep going as though nothing happened.
 */
import { boardCacheKey } from "./trainerBoardCache";
import { outboxKey } from "./trainerOutboxStore";
import type { EnumerableStorage } from "./trainerKeyManifest";
import { cacheKey, type CacheStorage } from "./trainerRecordCache";

/**
 * Storage that can enumerate.
 *
 * The narrow `CacheStorage` the caches were written against cannot, because
 * reading and writing one entry never needed it — and `secureKV`, where the
 * clinical values now live, genuinely cannot: SecureStore has no
 * `getAllKeys`. `withKeyManifest` is what supplies this, by remembering the
 * keys it writes. See `trainerKeyManifest.ts`.
 */
export type { EnumerableStorage } from "./trainerKeyManifest";

/**
 * Every key prefix this surface owns.
 *
 * Listed in one place so that a cache added later is added HERE too, and so a
 * reviewer can see at a glance what a sign-out is claiming to remove. The
 * matching test asserts the real key builders all start with one of these.
 */
export const TRAINER_KEY_PREFIXES = [
  "@aforce/trainer-record",
  "@aforce/trainer-board",
  "@aforce/trainer-outbox",
] as const;

export interface ClearResult {
  removed: number;
  failed: number;
}

function isTrainerKey(key: string): boolean {
  return TRAINER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function removeAll(
  storage: CacheStorage,
  keys: readonly string[],
): Promise<ClearResult> {
  let removed = 0;
  let failed = 0;
  for (const key of keys) {
    try {
      await storage.removeItem(key);
      removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { removed, failed };
}

/**
 * SIGN-OUT. Everything the trainer surface has written, for anyone.
 *
 * Deliberately not scoped to the departing viewer. A shared sideline device
 * accumulates keys for every trainer who has used it, and "sign out" on that
 * device has to mean the device is clean — not that one person's slice is.
 */
export async function clearAllTrainerCaches(
  storage: EnumerableStorage,
): Promise<ClearResult> {
  let keys: readonly string[];
  try {
    keys = await storage.getAllKeys();
  } catch {
    return { removed: 0, failed: 0 };
  }
  return removeAll(storage, keys.filter(isTrainerKey));
}

/** MEMBERSHIP LOST, or a viewer switch. One viewer, every athlete. */
export async function clearViewerCaches(
  storage: EnumerableStorage,
  viewerUserId: string,
): Promise<ClearResult> {
  let keys: readonly string[];
  try {
    keys = await storage.getAllKeys();
  } catch {
    return { removed: 0, failed: 0 };
  }

  // Suffix-matched on the viewer segment rather than by rebuilding every
  // possible key: the record cache is keyed per athlete and the set of
  // athletes is exactly what is not known here.
  const mine = keys.filter(
    (k) => isTrainerKey(k) && k.split(":")[1] === viewerUserId,
  );
  return removeAll(storage, mine);
}

/**
 * CONSENT REVOKED. One athlete, every viewer on this device.
 *
 * Also clears every BOARD cache, because a board row carries that athlete's
 * tier and availability and there is no way to remove one row from a cached
 * roster without re-deriving it. Dropping the roster is the honest move: the
 * next load fetches a board the server has already redacted.
 */
export async function clearAthleteCaches(
  storage: EnumerableStorage,
  athleteUserId: string,
): Promise<ClearResult> {
  let keys: readonly string[];
  try {
    keys = await storage.getAllKeys();
  } catch {
    return { removed: 0, failed: 0 };
  }

  const affected = keys.filter((k) => {
    if (!isTrainerKey(k)) return false;
    if (k.startsWith("@aforce/trainer-board")) return true;
    // record keys are `<prefix>:<viewer>:<athlete>`
    return k.startsWith("@aforce/trainer-record") && k.split(":")[2] === athleteUserId;
  });
  return removeAll(storage, affected);
}

/**
 * The keys one viewer/athlete pair occupies. Exported so the test can prove
 * the prefix list above actually covers what the cache modules write, rather
 * than the two drifting apart silently.
 */
export function knownKeysFor(viewerUserId: string, athleteUserId: string, programId: string): string[] {
  return [
    cacheKey(viewerUserId, athleteUserId),
    boardCacheKey(viewerUserId, programId),
    outboxKey(viewerUserId),
  ];
}
