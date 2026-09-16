/**
 * Athlete record cache — the "renders with no network" proof.
 *
 * The Phase 3 acceptance criterion is that the whole record renders from cache
 * with no network. These tests stand in for that: a record is written, the
 * live source is then made unavailable, and the record still comes back whole.
 *
 * A fake storage stands in for AsyncStorage, which is also how the offline
 * behaviour gets tested at all — the codec never imports it.
 */
import { describe, expect, it } from "vitest";

import { buildTrainerDemoRoster } from "../../data/trainerDemoSeed";
import { buildRecord } from "../trainerRecord";
import {
  CACHE_VERSION,
  cacheKey,
  clearRecord,
  freshnessLabel,
  readRecord,
  writeRecord,
  type CacheStorage,
} from "../trainerRecordCache";

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  const storage: CacheStorage & { map: Map<string, string> } = {
    map,
    async getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
  return storage;
}

const athlete = buildTrainerDemoRoster(120)[0]!;
const record = buildRecord(athlete);

describe("write-through and read-back", () => {
  it("returns the whole record after a write", async () => {
    const storage = fakeStorage();
    await writeRecord(storage, "viewer_1", record, 1_000_000);

    const hit = await readRecord(storage, "viewer_1", record.athleteUserId, 1_000_000);
    expect(hit).not.toBeNull();
    expect(hit!.record).toEqual(record);
    expect(hit!.record.signals).toHaveLength(5);
    expect(hit!.record.trend).toHaveLength(14);
  });

  it("reports the age of what it served", async () => {
    const storage = fakeStorage();
    await writeRecord(storage, "viewer_1", record, 1_000_000);
    const hit = await readRecord(storage, "viewer_1", record.athleteUserId, 1_000_000 + 90_000);
    expect(hit!.ageMs).toBe(90_000);
  });

  it("does not discard a stale entry — offline, old beats nothing", async () => {
    const storage = fakeStorage();
    await writeRecord(storage, "viewer_1", record, 0);
    // Four days later, still served, with its age reported.
    const hit = await readRecord(storage, "viewer_1", record.athleteUserId, 4 * 24 * 3600_000);
    expect(hit).not.toBeNull();
    expect(freshnessLabel(hit!.ageMs)).toBe("Cached 4d ago");
  });

  it("is a miss for an athlete that was never cached", async () => {
    const storage = fakeStorage();
    expect(await readRecord(storage, "viewer_1", "never_seen")).toBeNull();
  });
});

describe("the cache is scoped per viewer", () => {
  it("does not serve one staff member's cache to another", async () => {
    const storage = fakeStorage();
    await writeRecord(storage, "viewer_1", record, 1000);
    expect(await readRecord(storage, "viewer_2", record.athleteUserId, 1000)).toBeNull();
    expect(await readRecord(storage, "viewer_1", record.athleteUserId, 1000)).not.toBeNull();
  });

  it("builds keys that cannot collide across viewers or athletes", () => {
    expect(cacheKey("v1", "a1")).not.toBe(cacheKey("v2", "a1"));
    expect(cacheKey("v1", "a1")).not.toBe(cacheKey("v1", "a2"));
    expect(cacheKey("v1", "a1")).toContain("@aforce/trainer-record");
  });
});

describe("a corrupt entry is a miss, never a crash", () => {
  it("survives unparseable JSON and deletes the key", async () => {
    const key = cacheKey("viewer_1", "a1");
    const storage = fakeStorage({ [key]: "{not json" });
    expect(await readRecord(storage, "viewer_1", "a1")).toBeNull();
    expect(storage.map.has(key)).toBe(false);
  });

  it("drops an entry written by an older version", async () => {
    const key = cacheKey("viewer_1", record.athleteUserId);
    const storage = fakeStorage({
      [key]: JSON.stringify({ v: CACHE_VERSION - 1, savedAtMs: 1, record }),
    });
    expect(await readRecord(storage, "viewer_1", record.athleteUserId)).toBeNull();
    expect(storage.map.has(key)).toBe(false);
  });

  it("drops an entry whose payload is not a record", async () => {
    const key = cacheKey("viewer_1", "a1");
    const storage = fakeStorage({
      [key]: JSON.stringify({ v: CACHE_VERSION, savedAtMs: 1, record: { nope: true } }),
    });
    expect(await readRecord(storage, "viewer_1", "a1")).toBeNull();
    expect(storage.map.has(key)).toBe(false);
  });

  it("returns null when storage itself throws rather than propagating", async () => {
    const broken: CacheStorage = {
      async getItem() {
        throw new Error("storage unavailable");
      },
      async setItem() {},
      async removeItem() {},
    };
    await expect(readRecord(broken, "viewer_1", "a1")).resolves.toBeNull();
  });
});

describe("clearing", () => {
  it("removes one athlete without touching the rest", async () => {
    const storage = fakeStorage();
    const other = buildRecord(buildTrainerDemoRoster(120)[1]!);
    await writeRecord(storage, "viewer_1", record, 1000);
    await writeRecord(storage, "viewer_1", other, 1000);

    await clearRecord(storage, "viewer_1", record.athleteUserId);
    expect(await readRecord(storage, "viewer_1", record.athleteUserId)).toBeNull();
    expect(await readRecord(storage, "viewer_1", other.athleteUserId)).not.toBeNull();
  });
});

describe("freshness is stated, never implied", () => {
  it.each([
    [null, "Live"],
    [0, "Cached just now"],
    [5 * 60_000, "Cached 5m ago"],
    [3 * 3600_000, "Cached 3h ago"],
    [50 * 3600_000, "Cached 2d ago"],
  ])("%s renders as %s", (age, label) => {
    expect(freshnessLabel(age as number | null)).toBe(label);
  });
});
