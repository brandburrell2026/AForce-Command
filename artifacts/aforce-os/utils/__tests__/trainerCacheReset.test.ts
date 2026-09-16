/**
 * Cached medical content leaves the device when it should.
 *
 * The caches shipped with per-viewer keys and a `clearRecord` helper that had
 * zero callers. Nothing cleared on sign-out, nothing cleared when a staff
 * member lost a program, and nothing cleared when an athlete revoked. A
 * cached record carries note bodies and availability reasons, so signing out
 * of a shared sideline tablet left a full clinical picture on it.
 */
import { describe, expect, it } from "vitest";

import { boardCacheKey } from "../trainerBoardCache";
import {
  TRAINER_KEY_PREFIXES,
  clearAllTrainerCaches,
  clearAthleteCaches,
  clearViewerCaches,
  knownKeysFor,
  type EnumerableStorage,
} from "../trainerCacheReset";
import { outboxKey } from "../trainerOutboxStore";
import { cacheKey } from "../trainerRecordCache";

const TRAINER_A = "trainer_a";
const TRAINER_B = "trainer_b";
const ATHLETE_1 = "athlete_1";
const ATHLETE_2 = "athlete_2";
const PROGRAM = "prog_1";

function storageWith(entries: string[], opts: { failOn?: string[]; failEnumerate?: boolean } = {}) {
  const map = new Map<string, string>(entries.map((k) => [k, "x"]));
  const storage: EnumerableStorage = {
    async getAllKeys() {
      if (opts.failEnumerate) throw new Error("unavailable");
      return [...map.keys()];
    },
    async getItem(k) {
      return map.get(k) ?? null;
    },
    async setItem(k, v) {
      map.set(k, v);
    },
    async removeItem(k) {
      if (opts.failOn?.includes(k)) throw new Error("locked");
      map.delete(k);
    },
  };
  return { storage, map };
}

/** A device two trainers have both used, plus unrelated app data. */
function sharedDevice() {
  return storageWith([
    cacheKey(TRAINER_A, ATHLETE_1),
    cacheKey(TRAINER_A, ATHLETE_2),
    cacheKey(TRAINER_B, ATHLETE_1),
    boardCacheKey(TRAINER_A, PROGRAM),
    boardCacheKey(TRAINER_B, PROGRAM),
    outboxKey(TRAINER_A),
    outboxKey(TRAINER_B),
    "@aforce/profileIdentity",
    "@aforce/hydration-history",
  ]);
}

describe("the prefix list covers what the caches actually write", () => {
  /**
   * The failure this prevents: a cache added later whose keys no clear path
   * knows about, so it quietly survives every reset.
   */
  it("every key builder produces a key the reset logic recognises", () => {
    for (const key of knownKeysFor(TRAINER_A, ATHLETE_1, PROGRAM)) {
      expect(
        TRAINER_KEY_PREFIXES.some((p) => key.startsWith(p)),
        `"${key}" matches no prefix in TRAINER_KEY_PREFIXES`,
      ).toBe(true);
    }
  });
});

describe("sign-out clears the device", () => {
  it("removes every trainer key, for every viewer", async () => {
    const { storage, map } = sharedDevice();
    const result = await clearAllTrainerCaches(storage);

    expect(result.failed).toBe(0);
    expect(result.removed).toBe(7);
    expect([...map.keys()].some((k) => k.includes("trainer-"))).toBe(false);
  });

  it("leaves the rest of the app alone", async () => {
    const { storage, map } = sharedDevice();
    await clearAllTrainerCaches(storage);
    expect(map.has("@aforce/profileIdentity")).toBe(true);
    expect(map.has("@aforce/hydration-history")).toBe(true);
  });

  it("keeps going when one key will not delete, and reports it", async () => {
    const { storage, map } = storageWith(
      [cacheKey(TRAINER_A, ATHLETE_1), cacheKey(TRAINER_A, ATHLETE_2), outboxKey(TRAINER_A)],
      { failOn: [cacheKey(TRAINER_A, ATHLETE_1)] },
    );
    const result = await clearAllTrainerCaches(storage);

    expect(result.failed).toBe(1);
    expect(result.removed).toBe(2);
    // One stubborn key did not stop the other two going.
    expect(map.has(cacheKey(TRAINER_A, ATHLETE_2))).toBe(false);
  });

  it("does not throw when storage cannot be enumerated", async () => {
    const { storage } = storageWith([cacheKey(TRAINER_A, ATHLETE_1)], { failEnumerate: true });
    await expect(clearAllTrainerCaches(storage)).resolves.toEqual({ removed: 0, failed: 0 });
  });
});

describe("losing a program clears that viewer, and only that viewer", () => {
  it("removes the departing viewer's records, board and queue", async () => {
    const { storage, map } = sharedDevice();
    await clearViewerCaches(storage, TRAINER_A);

    expect(map.has(cacheKey(TRAINER_A, ATHLETE_1))).toBe(false);
    expect(map.has(cacheKey(TRAINER_A, ATHLETE_2))).toBe(false);
    expect(map.has(boardCacheKey(TRAINER_A, PROGRAM))).toBe(false);
    expect(map.has(outboxKey(TRAINER_A))).toBe(false);
  });

  it("leaves the other trainer on the shared device untouched", async () => {
    const { storage, map } = sharedDevice();
    await clearViewerCaches(storage, TRAINER_A);

    expect(map.has(cacheKey(TRAINER_B, ATHLETE_1))).toBe(true);
    expect(map.has(boardCacheKey(TRAINER_B, PROGRAM))).toBe(true);
    expect(map.has(outboxKey(TRAINER_B))).toBe(true);
  });
});

describe("revocation clears that athlete everywhere on the device", () => {
  it("removes the athlete's record for EVERY viewer, not just the current one", async () => {
    const { storage, map } = sharedDevice();
    await clearAthleteCaches(storage, ATHLETE_1);

    expect(map.has(cacheKey(TRAINER_A, ATHLETE_1))).toBe(false);
    expect(map.has(cacheKey(TRAINER_B, ATHLETE_1))).toBe(false);
  });

  it("leaves other athletes' records in place", async () => {
    const { storage, map } = sharedDevice();
    await clearAthleteCaches(storage, ATHLETE_1);
    expect(map.has(cacheKey(TRAINER_A, ATHLETE_2))).toBe(true);
  });

  /**
   * A board row carries the athlete's tier and availability, and there is no
   * way to remove one row from a cached roster without re-deriving it.
   * Dropping the roster is the honest move — the next load fetches a board
   * the server has already redacted.
   */
  it("drops cached boards, because a board row is about that athlete too", async () => {
    const { storage, map } = sharedDevice();
    await clearAthleteCaches(storage, ATHLETE_1);

    expect(map.has(boardCacheKey(TRAINER_A, PROGRAM))).toBe(false);
    expect(map.has(boardCacheKey(TRAINER_B, PROGRAM))).toBe(false);
  });

  it("does not clear the outbox — an unsent entry is a trainer's work", async () => {
    // Revocation governs disclosure, not a clinician's record of care. Same
    // ruling as the server-side write paths.
    const { storage, map } = sharedDevice();
    await clearAthleteCaches(storage, ATHLETE_1);
    expect(map.has(outboxKey(TRAINER_A))).toBe(true);
  });
});
