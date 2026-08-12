/**
 * userScope — the canonical per-user namespace for durable local data
 * (Wave-2 PR6: per-user local data isolation).
 *
 * PROBLEM: every persistent store was keyed globally, so USER B signing
 * in on USER A's device inherited A's command ledger, Performance
 * Memory, Moments, scan history, and more. Sign-out cleared nothing.
 *
 * DESIGN (the reviewed intakeOutbox idiom, centralized):
 *  - `ClerkAuthBridge` — the single place the Clerk userId exists — calls
 *    `setUserScope(userId | null)` on sign-in/sign-out/user-change,
 *    gated by the `per_user_storage_isolation_enabled` flag. Flag OFF →
 *    the scope is never set and every consumer below behaves
 *    byte-identically to today (global keys, no migration, no resets).
 *  - Stores derive keys through `services/scopedStorage` (AsyncStorage)
 *    or `scopedSecureKV` (Keychain-backed): `${base}:${userId}` for
 *    AsyncStorage, `${base}.${userId}` for secureKV — the Keychain
 *    sanitizer maps ':' to '_', so '.' keeps both backends' key shapes
 *    aligned (see utils/secureKV.ts toSecureKey).
 *  - A scope CHANGE is the security boundary: the generation bumps and
 *    every subscribed store drops its in-memory cache back to
 *    un-hydrated. The previous user's data stays on disk under THEIR
 *    key (device-only intelligence is retained per user); it is never
 *    readable under another scope.
 *  - MIGRATION (one-shot, first-user-claims): the first userId ever
 *    scoped on this device claims the legacy GLOBAL keys — each is
 *    copied to that user's scoped key and the global copy is deleted.
 *    Any LATER user never claims them (`claimedBy` marker), so orphaned
 *    globals cannot leak across accounts. Read-through order is
 *    guaranteed by scopedStorage awaiting `migrationSettled()` before
 *    any scoped read.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** One-shot marker: which userId claimed the legacy global keys. */
export const MIGRATION_CLAIMED_BY_KEY = 'aforce.namespaceMigration.claimedBy';

/**
 * Legacy GLOBAL AsyncStorage keys migrated into the claiming user's
 * namespace. (secureKV keys are migrated by scopedSecureKV itself, and
 * the WHOOP token is deliberately WIPED — never migrated — see below.)
 */
export const MIGRATED_GLOBAL_KEYS: readonly string[] = [
  // Tier 1 — intelligence (device-only)
  '@aforce/command-ledger',
  '@aforce/performance-memory-capture',
  '@aforce/performance-statements',
  '@aforce/hydroscan-history',
  '@aforce/voice-checkin',
  '@aforce/intent-capture',
  'aforce.location.anchor.v2',
  // Tier 2 — Moments family + third-party contact data
  '@aforce/moments',
  '@aforce/momentFeedback',
  '@aforce/momentPrepared',
  '@aforce/momentNotifyPrefs',
  '@aforce/calendarPrefs',
  '@aforce/recoveryCircle',
  // Tier 3 — server-authoritative caches (safe to re-fetch)
  'aforce.subscription',
  // Tier 4 — personal mode/session state
  '@aforce/sleepMode/targetTimeHHMM',
  '@aforce/sleepMode/sevenNightAvg',
  '@aforce/sleepMode/lastFoldedDay',
  '@aforce/cruiseMode/selfLog',
  '@aforce/socialV2/lastSession',
  'aforce_night_out_command_timer_v1',
];

type ScopeListener = () => void;

let scopedUserId: string | null = null;
let generation = 0;
let migration: Promise<void> = Promise.resolve();
const listeners = new Set<ScopeListener>();

/** Current scope suffix (Clerk user id) or null when unscoped. */
export function getUserScopeSuffix(): string | null {
  return scopedUserId;
}

/** Monotonic generation — bumps on every scope change. */
export function getUserScopeGeneration(): number {
  return generation;
}

/**
 * Resolves when any in-flight legacy migration for the current scope has
 * settled. scopedStorage awaits this before every read so a store can
 * never hydrate a scoped key that migration is still populating.
 */
export function migrationSettled(): Promise<void> {
  return migration;
}

/** Subscribe to scope changes (stores reset their in-memory caches). */
export function subscribeUserScope(listener: ScopeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function migrateLegacyGlobals(userId: string): Promise<void> {
  try {
    const claimedBy = await AsyncStorage.getItem(MIGRATION_CLAIMED_BY_KEY);
    if (claimedBy !== null && claimedBy !== userId) return; // later user: never claims
    for (const base of MIGRATED_GLOBAL_KEYS) {
      const scoped = `${base}:${userId}`;
      const [existingScoped, legacy] = await Promise.all([
        AsyncStorage.getItem(scoped),
        AsyncStorage.getItem(base),
      ]);
      if (legacy === null) continue;
      // Copy-then-delete; delete only after the scoped write succeeds
      // (the secureKV migration contract).
      if (existingScoped === null) await AsyncStorage.setItem(scoped, legacy);
      await AsyncStorage.removeItem(base);
    }
    // The FIRST user ever scoped on this device claims the legacy
    // namespace outright — even when no legacy keys existed — so a later
    // account can never claim leftovers (incl. the secureKV read-through
    // in scopedStorage, which consults this marker).
    if (claimedBy === null) {
      await AsyncStorage.setItem(MIGRATION_CLAIMED_BY_KEY, userId);
    }
  } catch {
    // Migration is best-effort: a failure leaves legacy keys in place for
    // the next attempt; scoped reads simply see empty until then.
  }
}

/**
 * THE single mutation point — called only from ClerkAuthBridge (flag-
 * gated). A change (including → null) bumps the generation and notifies
 * every store to reset to un-hydrated; a same-value call is a no-op.
 */
export function setUserScope(userId: string | null): void {
  if (userId === scopedUserId) return;
  generation += 1;
  scopedUserId = userId;
  migration = userId === null ? Promise.resolve() : migrateLegacyGlobals(userId);
  for (const l of [...listeners]) l();
}

/** TEST-ONLY: reset module state between cases. */
export function __resetUserScopeForTests(): void {
  scopedUserId = null;
  generation = 0;
  migration = Promise.resolve();
  listeners.clear();
}
