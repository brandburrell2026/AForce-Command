/**
 * Push notifications — native bridge for the Day 0/1/3/7 cadence.
 *
 * Spec Rule #10 keeps the cadence and copy identical to the in-app
 * banner. This module is the smallest possible OS-level bridge:
 *   - prime the local-notification permission once (no spammy prompt)
 *   - configure the foreground handler so banners surface while the
 *     app is open (we still rely on the in-app banner for UI parity)
 *   - schedule one local notification per not-yet-delivered cadence
 *     day; cancel a slot when the in-app banner records delivery
 *
 * No remote push, no device-token registration, no marketing copy —
 * everything stays on-device and verbatim from `NOTIFICATION_COPY`.
 *
 * Web + simulator: every call no-ops cleanly so the in-app banner
 * remains the only visible surface there.
 */
import { Platform } from 'react-native';

import {
  NOTIFICATION_COPY,
  deriveScheduledNotifications,
  type NotificationDay,
  type NotificationDelivery,
} from './notifications';

const SLOT_TAG_PREFIX = 'aforce.cadence.day';

function slotTag(day: NotificationDay): string {
  return `${SLOT_TAG_PREFIX}${day}`;
}

/**
 * Lazy-load `expo-notifications`. The package only ships a working
 * native module on iOS/Android; on web every API throws. We swallow
 * the import failure so callers can run unconditionally.
 */
async function loadNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

let handlerConfigured = false;

/**
 * Prime the foreground handler exactly once. Without this, iOS
 * silently drops banners while the app is in the foreground, which
 * would make the cadence feel broken to anyone testing.
 */
async function ensureForegroundHandler(): Promise<void> {
  if (handlerConfigured) return;
  const Notif = await loadNotifications();
  if (!Notif) return;
  Notif.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

/**
 * Prime the OS permission. Returns true when granted, false on web
 * / denied / simulator. Safe to call repeatedly — `expo-notifications`
 * remembers the prior answer and won't reprompt.
 */
export async function primePushPermission(): Promise<boolean> {
  const Notif = await loadNotifications();
  if (!Notif) return false;
  await ensureForegroundHandler();
  try {
    // PermissionResponse fields (status / granted / canAskAgain) come
    // through `expo`'s re-exported type; in this TS resolution the
    // shape narrows to NotificationPermissionsStatus only, so we read
    // through an interface that matches the runtime contract.
    interface PermShape {
      status?: string;
      granted?: boolean;
      canAskAgain?: boolean;
    }
    const current = (await Notif.getPermissionsAsync()) as unknown as PermShape;
    if (current.granted || current.status === 'granted') return true;
    if (current.canAskAgain === false) return false;
    const next = (await Notif.requestPermissionsAsync()) as unknown as PermShape;
    return !!(next.granted || next.status === 'granted');
  } catch {
    return false;
  }
}

/**
 * Schedule local notifications for every cadence day whose `dueAt`
 * has not yet passed and which has not yet been delivered. Idempotent:
 * cancels any existing AForce-tagged schedule first so re-seeding the
 * snapshot (e.g. after a sign-out / sign-in) doesn't double-fire.
 */
export async function scheduleCadenceNotifications(
  startAtIso: string,
  delivered: ReadonlyArray<NotificationDelivery>,
): Promise<void> {
  const Notif = await loadNotifications();
  if (!Notif) return;
  const granted = await primePushPermission();
  if (!granted) return;

  // Wipe existing AForce-tagged schedules so we can resync from
  // scratch. We only touch our own identifiers (`aforce.cadence.dayN`).
  try {
    const existing = await Notif.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((s) => s.identifier?.startsWith(SLOT_TAG_PREFIX))
        .map((s) => Notif.cancelScheduledNotificationAsync(s.identifier!).catch(() => {})),
    );
  } catch {
    // continue — scheduling below is the source of truth
  }

  const deliveredDays = new Set(delivered.map((d) => d.day));
  const now = Date.now();
  const slots = deriveScheduledNotifications(startAtIso);

  await Promise.all(
    slots.map(async (slot) => {
      if (deliveredDays.has(slot.day)) return;
      const dueMs = Date.parse(slot.dueAt);
      if (!Number.isFinite(dueMs)) return;
      // Past-due slots fire immediately so a user opening the app on
      // Day 4 still receives Day 3 (the in-app banner does the same).
      const seconds = Math.max(1, Math.round((dueMs - now) / 1000));
      try {
        await Notif.scheduleNotificationAsync({
          identifier: slotTag(slot.day),
          content: {
            title: NOTIFICATION_COPY[slot.day].title,
            body: NOTIFICATION_COPY[slot.day].body,
          },
          trigger: {
            type: Notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
          },
        });
      } catch {
        // swallow — the in-app banner remains the source of truth
      }
    }),
  );
}

/**
 * Cancel the local notification for a single cadence day. Called by
 * the in-app banner when the user dismisses it, so the OS doesn't
 * fire a redundant copy a few minutes later.
 */
export async function cancelCadenceNotification(day: NotificationDay): Promise<void> {
  const Notif = await loadNotifications();
  if (!Notif) return;
  try {
    await Notif.cancelScheduledNotificationAsync(slotTag(day));
  } catch {
    // never user-facing
  }
}
