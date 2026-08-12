/**
 * scopedStorage — drop-in AsyncStorage/secureKV facades that key durable
 * personal data to the current user scope (Wave-2 PR6).
 *
 * Unscoped (flag OFF, or signed out): the GLOBAL base key is used, so
 * behavior is byte-identical to the pre-isolation app. Scoped: keys are
 * `${base}:${userId}` (AsyncStorage) / `${base}.${userId}` (secureKV —
 * Keychain charset, see userScope.ts). Every read awaits the one-shot
 * legacy migration so a store can never hydrate mid-migration.
 *
 * Stores that cache in memory must also `subscribeUserScope` and reset
 * to un-hydrated on scope change — the facade isolates the DISK; the
 * store owns its RAM.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SecureKV } from '@/utils/secureKV';
import { getUserScopeSuffix, migrationSettled, MIGRATION_CLAIMED_BY_KEY } from './userScope';

function asyncKey(base: string): string {
  const suffix = getUserScopeSuffix();
  return suffix == null ? base : `${base}:${suffix}`;
}

function secureKey(base: string): string {
  const suffix = getUserScopeSuffix();
  return suffix == null ? base : `${base}.${suffix}`;
}

// secureStorage pulls the Expo native-module graph — loaded lazily so the
// (many) AsyncStorage-only stores importing this facade never touch it
// (keeps their node/vitest suites Expo-free).
let kvPromise: Promise<SecureKV> | null = null;
function kv(): Promise<SecureKV> {
  kvPromise ??= import('./secureStorage').then((m) => m.secureKV);
  return kvPromise;
}

export const scopedStorage = {
  // The key is captured SYNCHRONOUSLY at call entry — before any await —
  // so an operation that began under scope A can never materialize under
  // scope B's key if the scope switches mid-flight (TOCTOU guard; caught
  // by the isolation suite's cross-account persist race).
  async getItem(base: string): Promise<string | null> {
    const key = asyncKey(base);
    await migrationSettled();
    return AsyncStorage.getItem(key);
  },
  async setItem(base: string, value: string): Promise<void> {
    const key = asyncKey(base);
    await migrationSettled();
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(base: string): Promise<void> {
    const key = asyncKey(base);
    await migrationSettled();
    return AsyncStorage.removeItem(key);
  },
};

export const scopedSecureKV = {
  async getItem(base: string): Promise<string | null> {
    const suffix = getUserScopeSuffix();
    const key = suffix == null ? base : secureKey(base);
    await migrationSettled();
    if (suffix == null) return (await kv()).getItem(base);
    // Read-through migration for the claiming scope: scoped miss +
    // global hit → move under the scoped key (secureKV's own contract:
    // delete legacy only after the new write succeeds).
    const secure = await kv();
    const scoped = await secure.getItem(key);
    if (scoped !== null) return scoped;
    // First-user-claims: only the account that claimed the device's
    // legacy namespace may absorb a legacy secure value.
    const claimedBy = await AsyncStorage.getItem(MIGRATION_CLAIMED_BY_KEY);
    if (claimedBy !== suffix) return null;
    const legacy = await secure.getItem(base);
    if (legacy !== null) {
      await secure.setItem(secureKey(base), legacy);
      await secure.removeItem(base);
    }
    return legacy;
  },
  async setItem(base: string, value: string): Promise<void> {
    const key = secureKey(base);
    await migrationSettled();
    return (await kv()).setItem(key, value);
  },
  async removeItem(base: string): Promise<void> {
    const key = secureKey(base);
    await migrationSettled();
    return (await kv()).removeItem(key);
  },
};
