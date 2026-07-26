/**
 * secureKV — pure, injectable key-value core for the encrypted profile cache
 * (Lock §7 / K-1 / RC-L11).
 *
 * WHY: the Adaptive Profile and its sync state previously lived in PLAIN
 * AsyncStorage. The Lock requires an encrypted local cache. This core is
 * framework-free (backends injected) so the migration + read/write logic runs
 * under the pure test runner; `services/secureStorage.ts` binds it to
 * expo-secure-store with an AsyncStorage fallback on web (SecureStore has no
 * web implementation — the web build is a dev surface, documented tradeoff).
 *
 * Migration contract (one-time, per key, idempotent):
 *   read: secure hit → use it. Secure miss + plain hit → MIGRATE (write
 *   secure, then delete plain only after the secure write succeeded — the
 *   plain copy is the backup until then). Both miss → null.
 */

export interface KVBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SecureKV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * SecureStore keys must match [A-Za-z0-9._-]. Our legacy AsyncStorage keys
 * ("aforce.profileIdentity") already comply; this guards future callers.
 */
export function toSecureKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function createSecureKV(secure: KVBackend, plain: KVBackend): SecureKV {
  return {
    async getItem(key) {
      const sk = toSecureKey(key);
      try {
        const hit = await secure.getItem(sk);
        if (hit != null) return hit;
      } catch {
        // Secure backend unavailable (e.g. keychain locked) — fall through to
        // the plain copy rather than reporting data loss.
      }
      const legacy = await plain.getItem(key).catch(() => null);
      if (legacy == null) return null;
      // One-time migration: secure first, delete plain only on success.
      try {
        await secure.setItem(sk, legacy);
        await plain.removeItem(key).catch(() => {});
      } catch {
        // Migration failed — keep the plain copy as source until it succeeds.
      }
      return legacy;
    },

    async setItem(key, value) {
      const sk = toSecureKey(key);
      try {
        await secure.setItem(sk, value);
        // A successful secure write supersedes any stale plain copy.
        await plain.removeItem(key).catch(() => {});
      } catch {
        // Secure backend unavailable — degrade to plain rather than losing
        // the write entirely (§7: never silently drop user data).
        await plain.setItem(key, value);
      }
    },

    async removeItem(key) {
      await Promise.allSettled([secure.removeItem(toSecureKey(key)), plain.removeItem(key)]);
    },
  };
}
