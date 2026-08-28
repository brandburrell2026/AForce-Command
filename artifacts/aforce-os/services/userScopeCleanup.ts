/**
 * userScopeCleanup — the cross-account artifacts that key-namespacing
 * alone cannot isolate (Wave-2 PR6). Wired once by ClerkAuthBridge
 * (flag-gated); fires on EVERY user-scope change:
 *
 *  1. WHOOP OAuth token — a LIVE third-party data connection stored
 *     under a single global SecureStore key. It is WIPED (never
 *     migrated, never retained per user): the next account must
 *     re-link WHOOP itself.
 *  2. Scheduled OS notifications — `aforce.moment.*` (Moments prep)
 *     and `aforce.cadence.day*` (welcome cadence) live in the OS
 *     scheduler, outside AsyncStorage. Without a cancel, USER A's
 *     moment notifications would fire — with A's event content — during
 *     USER B's session.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeUserScope, getUserScopeSuffix } from './userScope';

const WHOOP_TOKEN_KEY = 'aforce.whoop.tokens.v1';
const SCHEDULED_TAG_PREFIXES = ['aforce.moment.', 'aforce.cadence.day'];

// O-2: calendar local data is DELETED on sign-out, not merely isolated. These
// are the base keys the calendar surface persists (scopedStorage suffixes them
// with `:${userId}`); on sign-out the signing-out user's scoped copies are
// removed for shared-device hygiene (founder decision, DR-011 close-out).
const CALENDAR_SCOPED_KEYS = ['@aforce/calendarPrefs', '@aforce/momentPrepared'] as const;

async function wipeWhoopTokens(): Promise<void> {
  try {
    const mod: unknown = await Function('s', 'return import(s)')('expo-secure-store');
    const SecureStore = (mod as { default?: unknown }).default ?? mod;
    const api = SecureStore as { deleteItemAsync?(key: string): Promise<void> };
    if (typeof api.deleteItemAsync === 'function') {
      await api.deleteItemAsync(WHOOP_TOKEN_KEY);
    }
  } catch {
    // Best-effort: Expo Go / web has no SecureStore; nothing to wipe there.
  }
}

async function cancelScopedNotifications(): Promise<void> {
  try {
    const mod: unknown = await Function('s', 'return import(s)')('expo-notifications');
    const Notif = mod as {
      getAllScheduledNotificationsAsync?(): Promise<Array<{ identifier?: string }>>;
      cancelScheduledNotificationAsync?(id: string): Promise<void>;
    };
    if (
      typeof Notif.getAllScheduledNotificationsAsync !== 'function' ||
      typeof Notif.cancelScheduledNotificationAsync !== 'function'
    ) {
      return;
    }
    const scheduled = await Notif.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => SCHEDULED_TAG_PREFIXES.some((p) => n.identifier?.startsWith(p)))
        .map((n) => Notif.cancelScheduledNotificationAsync!(n.identifier!).catch(() => {})),
    );
  } catch {
    // Best-effort: notifications module unavailable (web/tests).
  }
}

/**
 * O-2: delete the signing-out user's scoped calendar keys. The scope-change
 * listener fires AFTER the scope changed, so we address the previous user's
 * scoped keys directly (`${base}:${prevUserId}`) — scopedStorage would target
 * the new, now-null scope. Another user's keys are untouched.
 */
async function purgeScopedCalendarData(prevUserId: string): Promise<void> {
  try {
    for (const base of CALENDAR_SCOPED_KEYS) {
      await AsyncStorage.removeItem(`${base}:${prevUserId}`);
    }
  } catch {
    // best-effort
  }
}

let wired = false;
// The scope active before the most recent change — the cleanup listener needs
// the SIGNING-OUT user's id, which is gone from getUserScopeSuffix() by the
// time it fires. Maintained here so userScope.ts's contract stays unchanged.
let previousScope: string | null = null;

/** Idempotent — call once from ClerkAuthBridge when isolation is enabled. */
export function wireUserScopeCleanup(): void {
  if (wired) return;
  wired = true;
  previousScope = getUserScopeSuffix();
  subscribeUserScope(() => {
    const prev = previousScope;
    const current = getUserScopeSuffix();
    previousScope = current;
    void wipeWhoopTokens();
    void cancelScopedNotifications();
    // Sign-out only (scope → null) with a real prior user. A sign-in
    // (null → user) or a same-user re-scope purges nothing.
    if (prev !== null && current === null) void purgeScopedCalendarData(prev);
  });
}

/** TEST-ONLY. */
export function __resetUserScopeCleanupForTests(): void {
  wired = false;
  previousScope = null;
}
