/**
 * scopedStorage — drop-in AsyncStorage/secureKV facades that key durable
 * personal data to the current user scope.
 *
 * ── THE DECISION THIS FILE MAKES ───────────────────────────────────────────
 *
 * Every durable operation asks `resolveNamespace()` exactly once and obeys the
 * answer. That function is TOTAL, so there is no input for which this file
 * quietly falls back to the shared global key:
 *
 *   member        → `${base}:${userId}` (AsyncStorage) / `${base}.${userId}` (secureKV)
 *   legacy-global → the pre-isolation bare key. ONLY while the isolation flag
 *                   is off; both the flag and this branch die at cutover.
 *   none          → affirmatively signed out. Reads resolve null, writes are
 *                   dropped. Definite outcomes, not deferrals.
 *   pending       → identity not yet known. WAIT for `scopeResolved()` — which
 *                   is bounded by the watchdog — then ask again and get a
 *                   definite answer. Never a bare key.
 *   unavailable   → identity cannot be known. Throw `ScopeUnavailableError`.
 *
 * The previous version turned a null suffix into the bare key, which meant a
 * read issued before Clerk answered was served from — and a write landed in —
 * the namespace shared by every member on the device.
 *
 * ── THE KEY IS BOUND ONCE THE ANSWER IS DEFINITE ───────────────────────────
 *
 * After the namespace is definite the key is computed and captured BEFORE any
 * further await, so an operation that began under scope A can never
 * materialize under scope B's key if the scope switches mid-flight. A write
 * issued by A lands under A — that is the correct outcome, not a bug.
 *
 * This is only one of the barriers the race needs. It protects
 * facade-entry-to-issue. It does NOT protect the window between the native
 * call completing and a store publishing the value into RAM — a read issued
 * under A can still RESOLVE after the switch and be published into B's memory
 * by a store that does not check. That barrier, and the enqueue-time barrier
 * above it, are PR B; they are named here so the gap is documented rather than
 * assumed closed.
 *
 * ── RAM IS THE STORE'S, DISK IS OURS ───────────────────────────────────────
 *
 * Stores that cache in memory must also `subscribeUserScope` and reset to
 * un-hydrated on a scope change. Account-scoped disk without account-scoped
 * RAM is not isolation. PR B replaces this sentence with a structural
 * guarantee; until then it is a convention and is marked as one.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SecureKV } from '@/utils/secureKV';
import {
  resolveNamespace,
  scopeResolved,
  migrationSettled,
  ScopeUnavailableError,
  MIGRATION_CLAIMED_BY_KEY,
  getUserScopeSuffix,
} from './userScope';

/** `null` means "no durable home" — read as empty, drop the write. */
type ResolvedKey = string | null;

/**
 * Turn the current scope into a concrete key, waiting at most once for
 * identity to become definite. Throws only for UNVERIFIABLE.
 *
 * Terminates in every case: the sole deferral is `pending`, and
 * `scopeResolved()` is released by the bounded watchdog even if the auth
 * authority never answers.
 */
async function resolveKey(base: string, separator: ':' | '.'): Promise<ResolvedKey> {
  let ns = resolveNamespace();
  if (ns.kind === 'pending') {
    // Bounded: the watchdog guarantees this settles.
    await scopeResolved();
    ns = resolveNamespace();
    // `pending` cannot repeat — the machine never returns to UNRESOLVED.
  }
  switch (ns.kind) {
    case 'member':
      return `${base}${separator}${ns.suffix}`;
    case 'legacy-global':
      return base;
    case 'none':
      return null;
    case 'unavailable':
      throw new ScopeUnavailableError(ns.reason);
    case 'pending':
      // Unreachable: the machine leaves UNRESOLVED exactly once and never
      // re-enters it. Fail closed rather than fall through to a bare key.
      throw new ScopeUnavailableError('watchdog');
  }
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
  async getItem(base: string): Promise<string | null> {
    const key = await resolveKey(base, ':');
    if (key === null) return null; // signed out: definitely empty
    await migrationSettled();
    return AsyncStorage.getItem(key);
  },
  async setItem(base: string, value: string): Promise<void> {
    const key = await resolveKey(base, ':');
    if (key === null) return; // signed out: nowhere to durably put it
    await migrationSettled();
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(base: string): Promise<void> {
    const key = await resolveKey(base, ':');
    if (key === null) return;
    await migrationSettled();
    return AsyncStorage.removeItem(key);
  },
};

export const scopedSecureKV = {
  async getItem(base: string): Promise<string | null> {
    const key = await resolveKey(base, '.');
    if (key === null) return null;
    await migrationSettled();
    const secure = await kv();
    // Unscoped (flag off): the legacy bare key, exactly as before.
    if (key === base) return secure.getItem(base);
    const scoped = await secure.getItem(key);
    if (scoped !== null) return scoped;
    // Read-through migration for the claiming scope: scoped miss + global
    // hit → move under the scoped key. FIRST-USER-CLAIMS — the founder has
    // ruled this must go; it is deleted in the cutover PR, together with
    // `migrateLegacyGlobals`, and is left byte-identical here because PR A
    // moves no data.
    const claimedBy = await AsyncStorage.getItem(MIGRATION_CLAIMED_BY_KEY);
    if (claimedBy !== getUserScopeSuffix()) return null;
    const legacy = await secure.getItem(base);
    if (legacy !== null) {
      await secure.setItem(key, legacy);
      await secure.removeItem(base);
    }
    return legacy;
  },
  async setItem(base: string, value: string): Promise<void> {
    const key = await resolveKey(base, '.');
    if (key === null) return;
    await migrationSettled();
    return (await kv()).setItem(key, value);
  },
  async removeItem(base: string): Promise<void> {
    const key = await resolveKey(base, '.');
    if (key === null) return;
    await migrationSettled();
    return (await kv()).removeItem(key);
  },
};
