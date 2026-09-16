/**
 * Encrypted storage that can still be emptied.
 *
 * `secureKV` is where the clinical values belong, and SecureStore has no
 * `getAllKeys` — there is no way to ask it what it holds. Encrypting a
 * medical record and then being unable to delete it is a worse outcome than
 * either alone: a sideline tablet that keeps the record forever because
 * nothing can name the key it is under.
 */
import { describe, expect, it } from "vitest";

import { clearAllTrainerCaches } from "../trainerCacheReset";
import { MANIFEST_KEY, clearManifest, withKeyManifest } from "../trainerKeyManifest";
import { cacheKey } from "../trainerRecordCache";

/** A store that cannot enumerate — SecureStore's shape. */
function opaqueStore(opts: { failWrite?: string[] } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    store: {
      async getItem(k: string) {
        return map.get(k) ?? null;
      },
      async setItem(k: string, v: string) {
        if (opts.failWrite?.includes(k)) throw new Error("secure write failed");
        map.set(k, v);
      },
      async removeItem(k: string) {
        map.delete(k);
      },
    },
  };
}

/** A store that can — AsyncStorage's shape, and the web fallback. */
function enumerableStore() {
  const map = new Map<string, string>();
  return {
    map,
    store: {
      async getAllKeys() {
        return [...map.keys()];
      },
      async getItem(k: string) {
        return map.get(k) ?? null;
      },
      async setItem(k: string, v: string) {
        map.set(k, v);
      },
      async removeItem(k: string) {
        map.delete(k);
      },
    },
  };
}

describe("a manifest makes an opaque store enumerable", () => {
  it("remembers every key written through it", async () => {
    const { store } = opaqueStore();
    const wrapped = withKeyManifest(store);

    await wrapped.setItem(cacheKey("trainer_a", "athlete_1"), "v");
    await wrapped.setItem(cacheKey("trainer_a", "athlete_2"), "v");

    expect([...(await wrapped.getAllKeys())].sort()).toEqual(
      [cacheKey("trainer_a", "athlete_1"), cacheKey("trainer_a", "athlete_2")].sort(),
    );
  });

  it("reads and writes pass straight through", async () => {
    const { store, map } = opaqueStore();
    const wrapped = withKeyManifest(store);

    await wrapped.setItem("k", "the value");
    expect(await wrapped.getItem("k")).toBe("the value");
    expect(map.get("k")).toBe("the value");
  });

  it("forgets a key when it is removed", async () => {
    const { store } = opaqueStore();
    const wrapped = withKeyManifest(store);

    await wrapped.setItem("k1", "v");
    await wrapped.setItem("k2", "v");
    await wrapped.removeItem("k1");

    expect(await wrapped.getAllKeys()).toEqual(["k2"]);
  });

  it("does not record duplicates", async () => {
    const { store } = opaqueStore();
    const wrapped = withKeyManifest(store);
    await wrapped.setItem("k", "1");
    await wrapped.setItem("k", "2");
    expect(await wrapped.getAllKeys()).toEqual(["k"]);
  });

  it("can keep the manifest out of the secure enclave", async () => {
    // iOS SecureStore has a small item budget; the manifest is keys only and
    // carries nothing clinical, so it can live in ordinary storage.
    const secure = opaqueStore();
    const plain = enumerableStore();
    const wrapped = withKeyManifest(secure.store, plain.store);

    await wrapped.setItem(cacheKey("t", "a"), "v");

    expect(secure.map.has(cacheKey("t", "a"))).toBe(true);
    expect(secure.map.has(MANIFEST_KEY)).toBe(false);
    expect(plain.map.has(MANIFEST_KEY)).toBe(true);
  });

  it("survives a corrupt manifest rather than losing the ability to clear", async () => {
    const { store, map } = opaqueStore();
    map.set(MANIFEST_KEY, "{not json");
    const wrapped = withKeyManifest(store);

    await expect(wrapped.getAllKeys()).resolves.toEqual([]);
    // And it recovers: the next write starts a fresh manifest.
    await wrapped.setItem("k", "v");
    expect(await wrapped.getAllKeys()).toEqual(["k"]);
  });

  /**
   * The dangerous direction. A key that EXISTS and is not in the manifest is
   * a record a clear would miss — so where the store can enumerate, both
   * sources are used.
   */
  it("sweeps the underlying store too, catching keys written before the manifest", async () => {
    const { store, map } = enumerableStore();
    map.set(cacheKey("old_trainer", "athlete_9"), "written by an older build");

    const wrapped = withKeyManifest(store);
    await wrapped.setItem(cacheKey("trainer_a", "athlete_1"), "v");

    const keys = await wrapped.getAllKeys();
    expect(keys).toContain(cacheKey("old_trainer", "athlete_9"));
    expect(keys).toContain(cacheKey("trainer_a", "athlete_1"));
  });

  it("a stale manifest entry is harmless", async () => {
    const { store, map } = opaqueStore();
    const wrapped = withKeyManifest(store);
    await wrapped.setItem("k", "v");
    map.delete("k"); // vanished underneath us

    await expect(clearAllTrainerCaches(wrapped)).resolves.toBeTruthy();
  });

  it("clearManifest forgets the manifest itself", async () => {
    const { store, map } = opaqueStore();
    const wrapped = withKeyManifest(store);
    await wrapped.setItem("k", "v");
    await clearManifest(store);
    expect(map.has(MANIFEST_KEY)).toBe(false);
  });
});

describe("end to end: an encrypted cache is fully cleared on sign-out", () => {
  it("removes every trainer key from a store that cannot list itself", async () => {
    const secure = opaqueStore();
    const plain = enumerableStore();
    const wrapped = withKeyManifest(secure.store, plain.store);

    await wrapped.setItem(cacheKey("trainer_a", "athlete_1"), "notes");
    await wrapped.setItem(cacheKey("trainer_a", "athlete_2"), "notes");
    await wrapped.setItem(cacheKey("trainer_b", "athlete_1"), "notes");
    await wrapped.setItem("@aforce/unrelated", "keep me");

    const result = await clearAllTrainerCaches(wrapped);

    expect(result.removed).toBe(3);
    expect(result.failed).toBe(0);
    // Nothing clinical left behind...
    expect([...secure.map.keys()].filter((k) => k.includes("trainer-"))).toEqual([]);
    // ...and unrelated app data untouched.
    expect(secure.map.get("@aforce/unrelated")).toBe("keep me");
  });
});
