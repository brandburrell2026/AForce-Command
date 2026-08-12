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

import { subscribeUserScope } from './userScope';

const WHOOP_TOKEN_KEY = 'aforce.whoop.tokens.v1';
const SCHEDULED_TAG_PREFIXES = ['aforce.moment.', 'aforce.cadence.day'];

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

let wired = false;

/** Idempotent — call once from ClerkAuthBridge when isolation is enabled. */
export function wireUserScopeCleanup(): void {
  if (wired) return;
  wired = true;
  subscribeUserScope(() => {
    void wipeWhoopTokens();
    void cancelScopedNotifications();
  });
}

/** TEST-ONLY. */
export function __resetUserScopeCleanupForTests(): void {
  wired = false;
}
