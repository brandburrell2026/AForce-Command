/**
 * Make encrypted storage enumerable, so what it holds can be deleted.
 *
 * The trainer caches hold note bodies and availability reasons, which belong
 * in `secureKV` (expo-secure-store) rather than plain AsyncStorage. But
 * SecureStore has no `getAllKeys`: there is no way to ask it what it is
 * holding. That is fine for a single profile record written under a known
 * key, and not fine here, where the keys include an athlete id that the code
 * doing the clearing does not have.
 *
 * Encrypting the data and then being unable to delete it would be a worse
 * outcome than either alone — a sideline tablet that keeps a clinical record
 * forever because nothing can name the key it is under.
 *
 * So writes record their key in a manifest, and the manifest is what a clear
 * enumerates. The manifest holds KEYS ONLY — no values, nothing clinical —
 * which is why it can sit in ordinary storage alongside the encrypted
 * entries.
 *
 * SELF-HEALING, IN THE DIRECTION THAT MATTERS. A key in the manifest that no
 * longer exists is harmless: deleting it is a no-op and it is dropped. A key
 * that exists and is NOT in the manifest is the dangerous case, so a clear
 * also sweeps the underlying store when it can enumerate (web, where the
 * fallback is AsyncStorage) — belt and braces, because the cost of missing
 * one is a medical record left on a shared device.
 */
import type { CacheStorage } from "./trainerRecordCache";

export const MANIFEST_KEY = "@aforce/trainer-key-manifest";

/** Storage that can list what it holds. */
export interface EnumerableStorage extends CacheStorage {
  getAllKeys(): Promise<readonly string[]>;
}

function parseManifest(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === "string" && k.length > 0);
  } catch {
    return [];
  }
}

/**
 * Wrap a store so every key it writes is remembered.
 *
 * @param inner    where values go — `secureKV` in the app
 * @param registry where the manifest goes. Defaults to `inner`; pass plain
 *                 storage to keep the manifest out of the secure enclave,
 *                 which has a small item budget on iOS.
 */
export function withKeyManifest(
  inner: CacheStorage,
  registry: CacheStorage = inner,
): EnumerableStorage {
  async function readManifest(): Promise<string[]> {
    try {
      return parseManifest(await registry.getItem(MANIFEST_KEY));
    } catch {
      return [];
    }
  }

  async function writeManifest(keys: readonly string[]): Promise<void> {
    try {
      await registry.setItem(MANIFEST_KEY, JSON.stringify([...new Set(keys)]));
    } catch {
      // A manifest we could not write means a key we may not be able to
      // clear later. That is worth knowing and not worth crashing over; the
      // sweep below is the backstop.
    }
  }

  return {
    async getItem(key) {
      return inner.getItem(key);
    },

    async setItem(key, value) {
      // The VALUE is written first. A manifest entry for a key that failed to
      // write is a harmless no-op on clear; a written value missing from the
      // manifest is the leak.
      await inner.setItem(key, value);
      const keys = await readManifest();
      if (!keys.includes(key)) await writeManifest([...keys, key]);
    },

    async removeItem(key) {
      await inner.removeItem(key);
      const keys = await readManifest();
      if (keys.includes(key)) await writeManifest(keys.filter((k) => k !== key));
    },

    async getAllKeys() {
      const fromManifest = await readManifest();

      // If the underlying store CAN enumerate, trust it as well: a key
      // written before the manifest existed, or by an older build, is
      // exactly the one a clear must not miss.
      const maybeEnumerable = inner as Partial<EnumerableStorage>;
      if (typeof maybeEnumerable.getAllKeys === "function") {
        try {
          const actual = await maybeEnumerable.getAllKeys();
          return [...new Set([...fromManifest, ...actual])];
        } catch {
          return fromManifest;
        }
      }
      return fromManifest;
    },
  };
}

/** Forget the manifest itself. Called after a full clear. */
export async function clearManifest(registry: CacheStorage): Promise<void> {
  await registry.removeItem(MANIFEST_KEY).catch(() => undefined);
}
