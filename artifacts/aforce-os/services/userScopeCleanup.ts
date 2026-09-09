/**
 * userScopeCleanup — the cross-account artifacts that key-namespacing alone
 * cannot isolate. Runs as PHASE 2 of an identity transition:
 *
 *  1. WHOOP OAuth token — a LIVE third-party data connection stored under a
 *     single global SecureStore key. It is WIPED (never migrated, never
 *     retained per user): the next account must re-link WHOOP itself.
 *  2. Scheduled OS notifications — `aforce.moment.*` (Moments prep) and
 *     `aforce.cadence.day*` (welcome cadence) live in the OS scheduler,
 *     outside AsyncStorage. Without a cancel, USER A's moment notifications
 *     would fire — with A's event content — during USER B's session.
 *  3. O-2: calendar local data is DELETED on sign-out, not merely isolated
 *     (founder decision, DR-011 close-out).
 *
 * ── WHY THIS FILE NO LONGER TRACKS THE SCOPE ───────────────────────────────
 *
 * It used to keep its own `previousScope` module variable, because the old
 * zero-argument listener fired AFTER the scope had already changed and could
 * not see who was leaving. That made this file a SECOND source of truth for
 * identity — the failure this codebase keeps reproducing, here sitting on the
 * security boundary. The coordinator now passes `prev` and `next` as
 * arguments, so this file holds no scope state at all and cannot disagree
 * with `userScope`.
 *
 * ── WHY THIS IS PHASE 2, AND WHY IT MUST NOT BLOCK ANYTHING ────────────────
 *
 * `cancelScopedNotifications` makes an OS round trip of unbounded duration.
 * If the transition awaited it before invalidating RAM, there would be a long
 * window in which the scope reads B while every store still holds A — and any
 * write during it would be approved by the generation guard, because both the
 * capture and the check would sit on B's side of the boundary. So phase 1
 * (generation, state, listeners) completes synchronously first, and nothing on
 * the durable read/write path ever awaits this file.
 *
 * ── AN UNVERIFIABLE HOP IS NOT A SIGN-OUT ──────────────────────────────────
 *
 * These are destructive, irreversible-for-the-member actions (a WHOOP re-link,
 * a cancelled notification). A transport failure or a slow Clerk answer must
 * never trigger them, so cleanup runs only when the INCOMING state is a real
 * answer — AUTHENTICATED or ANONYMOUS. Passing through UNVERIFIABLE destroys
 * nothing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerScopeCleanup, type ScopeState } from './userScope';

const WHOOP_TOKEN_KEY = 'aforce.whoop.tokens.v1';
const SCHEDULED_TAG_PREFIXES = ['aforce.moment.', 'aforce.cadence.day'];

// O-2: the base keys the calendar surface persists (scopedStorage suffixes
// them with `:${userId}`); on sign-out the signing-out user's scoped copies
// are removed for shared-device hygiene.
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
 * O-2: delete the SIGNING-OUT user's scoped calendar keys. `prev` is supplied
 * by the coordinator, so this addresses the departing member's keys directly
 * (`${base}:${prevUserId}`) rather than the incoming scope. Another user's
 * keys are untouched.
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

/**
 * The destructive steps this pipeline can take. Returned so a law can assert
 * WHICH actions ran.
 *
 * Without this, the two OS-level steps are invisible to a test: both reach
 * their targets through `Function('s','return import(s)')(...)`, which
 * deliberately evades the module registry, so they no-op silently under vitest
 * and a law watching only storage keys passes even when they DID run. That is
 * how a "nothing was destroyed" law ends up satisfied by a different element
 * — the calendar purge, which has its own separate guard.
 */
export type CleanupAction = 'whoop-wipe' | 'notifications-cancel' | 'calendar-purge';

/** The phase-2 pipeline. Exported for direct testing. */
export async function runUserScopeCleanup(
  prev: ScopeState,
  next: ScopeState,
): Promise<CleanupAction[]> {
  // Only a real answer may destroy anything. An UNVERIFIABLE hop must not.
  if (next.status !== 'AUTHENTICATED' && next.status !== 'ANONYMOUS') return [];
  const performed: CleanupAction[] = [];
  await wipeWhoopTokens();
  performed.push('whoop-wipe');
  await cancelScopedNotifications();
  performed.push('notifications-cancel');
  // Sign-out only: a real prior member, affirmatively leaving.
  if (prev.status === 'AUTHENTICATED' && next.status === 'ANONYMOUS') {
    await purgeScopedCalendarData(prev.userId);
    performed.push('calendar-purge');
  }
  return performed;
}

let wired = false;

/** Idempotent — call once from ClerkAuthBridge when isolation is enabled. */
export function wireUserScopeCleanup(): void {
  if (wired) return;
  wired = true;
  registerScopeCleanup(runUserScopeCleanup);
}

/** TEST-ONLY. */
export function __resetUserScopeCleanupForTests(): void {
  wired = false;
}
