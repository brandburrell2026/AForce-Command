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
 * That is barrier W2 of four. On its own it is not enough, and the reads below
 * carry W3: the generation is captured before the native call and re-checked
 * AFTER it, because a check placed before the call cannot fire for a read whose
 * native call is already in flight — which is precisely the read that returns
 * the departing member's bytes after a switch. A stale read throws
 * `ScopeChangedError` rather than returning the value.
 *
 * W1 (capture at write-enqueue) and W4 (publish only if still current) live in
 * `services/scopedWriteQueue.ts`, which documents all four windows together.
 *
 * ── RAM IS THE STORE'S, DISK IS OURS ───────────────────────────────────────
 *
 * Stores that cache in memory must also `subscribeUserScope` and reset to
 * un-hydrated on a scope change. Account-scoped disk without account-scoped
 * RAM is not isolation — the founder's ruling, and the reason W3 refuses to
 * hand back a value rather than trusting each store to notice.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SecureKV } from '@/utils/secureKV';
import {
  resolveNamespace,
  scopeResolved,
  migrationSettled,
  ScopeUnavailableError,
  ScopeChangedError,
  MIGRATION_CLAIMED_BY_KEY,
  getUserScopeSuffix,
} from './userScope';
import { captureScope, isScopeCurrent } from './scopedWriteQueue';

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
    // W3 — capture BEFORE the native call, re-check AFTER it. A check placed
    // before the call cannot fire for a read whose native call is already in
    // flight, which is exactly the read that returns the departing member's
    // bytes after the switch.
    const token = captureScope();
    await migrationSettled();
    const value = await AsyncStorage.getItem(key);
    if (!isScopeCurrent(token)) throw new ScopeChangedError();
    return value;
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
    const token = captureScope(); // W3 — see the AsyncStorage read above
    await migrationSettled();
    const secure = await kv();
    // Unscoped (flag off): the legacy bare key, exactly as before.
    if (key === base) {
      const legacyValue = await secure.getItem(base);
      if (!isScopeCurrent(token)) throw new ScopeChangedError();
      return legacyValue;
    }
    const scoped = await secure.getItem(key);
    if (scoped !== null) {
      if (!isScopeCurrent(token)) throw new ScopeChangedError();
      return scoped;
    }
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
    if (!isScopeCurrent(token)) throw new ScopeChangedError();
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
