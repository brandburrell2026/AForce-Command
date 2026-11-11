/**
 * AForce Concierge — local reminders.
 *
 * A concierge reminder is a ONE-OFF or DAILY local notification scheduled on
 * this device through expo-notifications (the same mechanism Moments prep
 * notifications use — there is no remote push in the app). Rules:
 *   - quiet hours 22:00–07:00 (MOMENT_NOTIFY_QUIET_*) shift a fire time to
 *     07:00 and tell the member so;
 *   - a per-day cap (CONCIERGE_REMINDER_MAX_PER_DAY) keeps the global 6/day
 *     reminder ceiling intact;
 *   - the notification body is the member-confirmed title only — no engine
 *     numbers, no claims; it still passes the §42 runtime scan before scheduling;
 *   - scheduled ids are tracked in account-scoped storage so a reminder can be
 *     undone and so a different member on the same device never sees them.
 *
 * Pure planning (`planReminder`) is separated from the native side effect so
 * the quiet-hours / cap behaviour is unit-tested without a device.
 */
import { Platform } from 'react-native';
import {
  CONCIERGE_REMINDER_MAX_PER_DAY,
  MOMENT_NOTIFY_QUIET_END_HOUR,
  MOMENT_NOTIFY_QUIET_START_HOUR,
} from '@/config/hydroStateModel';
import { consumerCopyBlocked } from '@/utils/intelligence/languageGate/runtimeClaimScan';
import { scopedStorage } from '@/services/scopedStorage';
import { primePushPermission } from '@/services/pushNotifications';

export const CONCIERGE_REMINDER_TAG_PREFIX = 'aforce.concierge.reminder.';
const STORAGE_KEY = 'aforce.concierge.reminders';

export interface ReminderRequest {
  /** Stable action id — scheduling twice with the same id is a no-op. */
  actionId: string;
  title: string;
  timeLocal: string; // HH:MM
  dateLocal: string; // YYYY-MM-DD
  recurrence: 'once' | 'daily';
}

export interface PlannedReminder {
  identifier: string;
  fireAt: Date;
  /** True when quiet hours moved the time; the UI tells the member. */
  shifted: boolean;
  timeLocal: string;
  recurrence: 'once' | 'daily';
}

export type PlanReminderResult =
  | { ok: true; plan: PlannedReminder }
  | { ok: false; reason: 'invalid' | 'in_past' | 'limit_reached' };

export interface StoredReminder {
  actionId: string;
  identifier: string;
  fireAtIso: string;
  title: string;
  recurrence: 'once' | 'daily';
  scheduledDate: string; // YYYY-MM-DD of the day it was created (cap accounting)
}

function parseLocal(dateLocal: string, timeLocal: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateLocal);
  const tm = /^(\d{2}):(\d{2})$/.exec(timeLocal);
  if (!dm || !tm) return null;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0, 0);
  if (!Number.isFinite(d.getTime())) return null;
  if (d.getHours() !== Number(tm[1]) || d.getMinutes() !== Number(tm[2])) return null; // DST gap
  return d;
}

export function inQuietHours(d: Date): boolean {
  const h = d.getHours();
  // 22:00–07:00 wraps midnight.
  return h >= MOMENT_NOTIFY_QUIET_START_HOUR || h < MOMENT_NOTIFY_QUIET_END_HOUR;
}

/** Shift a quiet-hours fire time forward to the end of quiet hours. */
export function shiftOutOfQuietHours(d: Date): Date {
  if (!inQuietHours(d)) return d;
  const shifted = new Date(d);
  if (d.getHours() >= MOMENT_NOTIFY_QUIET_START_HOUR) shifted.setDate(shifted.getDate() + 1);
  shifted.setHours(MOMENT_NOTIFY_QUIET_END_HOUR, 0, 0, 0);
  return shifted;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function planReminder(
  req: ReminderRequest,
  existing: readonly StoredReminder[],
  now: Date = new Date(),
): PlanReminderResult {
  const at = parseLocal(req.dateLocal, req.timeLocal);
  if (!at || !req.title.trim()) return { ok: false, reason: 'invalid' };
  const already = existing.find((r) => r.actionId === req.actionId);
  if (already) {
    return {
      ok: true,
      plan: {
        identifier: already.identifier,
        fireAt: new Date(already.fireAtIso),
        shifted: false,
        timeLocal: hhmm(new Date(already.fireAtIso)),
        recurrence: already.recurrence,
      },
    };
  }
  const today = dayKey(now);
  const scheduledToday = existing.filter((r) => r.scheduledDate === today).length;
  if (scheduledToday >= CONCIERGE_REMINDER_MAX_PER_DAY) return { ok: false, reason: 'limit_reached' };

  let fireAt = shiftOutOfQuietHours(at);
  const shifted = fireAt.getTime() !== at.getTime();
  if (req.recurrence === 'daily' && fireAt.getTime() <= now.getTime()) {
    // Daily reminders start at the next occurrence.
    fireAt = new Date(fireAt);
    while (fireAt.getTime() <= now.getTime()) fireAt.setDate(fireAt.getDate() + 1);
  }
  if (fireAt.getTime() <= now.getTime()) return { ok: false, reason: 'in_past' };
  return {
    ok: true,
    plan: {
      identifier: `${CONCIERGE_REMINDER_TAG_PREFIX}${req.actionId}`,
      fireAt,
      shifted,
      timeLocal: hhmm(fireAt),
      recurrence: req.recurrence,
    },
  };
}

/* ─── Device side ─────────────────────────────────────────────────────────── */

async function loadNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function readStoredReminders(): Promise<StoredReminder[]> {
  try {
    const raw = await scopedStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredReminder[]) : [];
  } catch {
    return [];
  }
}

async function writeStoredReminders(list: StoredReminder[]): Promise<void> {
  try {
    await scopedStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage is best-effort; the OS keeps the schedule */
  }
}

export type ScheduleReminderResult =
  | { ok: true; plan: PlannedReminder }
  | { ok: false; reason: 'invalid' | 'in_past' | 'limit_reached' | 'permission' | 'unsupported' | 'blocked_copy' | 'failed' };

export async function scheduleConciergeReminder(
  req: ReminderRequest,
  now: Date = new Date(),
): Promise<ScheduleReminderResult> {
  const existing = await readStoredReminders();
  const planned = planReminder(req, existing, now);
  if (!planned.ok) return planned;
  if (existing.some((r) => r.actionId === req.actionId)) return planned; // idempotent

  if (consumerCopyBlocked(req.title)) return { ok: false, reason: 'blocked_copy' };

  const Notif = await loadNotifications();
  if (!Notif) return { ok: false, reason: 'unsupported' };
  const granted = await primePushPermission();
  if (!granted) return { ok: false, reason: 'permission' };

  try {
    const { plan } = planned;
    const daily: import('expo-notifications').DailyTriggerInput = {
      type: Notif.SchedulableTriggerInputTypes.DAILY,
      hour: plan.fireAt.getHours(),
      minute: plan.fireAt.getMinutes(),
    };
    const once: import('expo-notifications').DateTriggerInput = {
      type: Notif.SchedulableTriggerInputTypes.DATE,
      date: plan.fireAt,
    };
    const trigger: import('expo-notifications').NotificationTriggerInput = plan.recurrence === 'daily' ? daily : once;
    await Notif.scheduleNotificationAsync({
      identifier: plan.identifier,
      content: { title: 'AForce OS', body: req.title.trim(), sound: false },
      trigger,
    });
    await writeStoredReminders([
      ...existing,
      {
        actionId: req.actionId,
        identifier: plan.identifier,
        fireAtIso: plan.fireAt.toISOString(),
        title: req.title.trim(),
        recurrence: plan.recurrence,
        scheduledDate: dayKey(now),
      },
    ]);
    return planned;
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function cancelConciergeReminder(actionId: string): Promise<boolean> {
  const existing = await readStoredReminders();
  const target = existing.find((r) => r.actionId === actionId);
  if (!target) return false;
  const Notif = await loadNotifications();
  try {
    await Notif?.cancelScheduledNotificationAsync(target.identifier);
  } catch {
    /* already gone */
  }
  await writeStoredReminders(existing.filter((r) => r.actionId !== actionId));
  return true;
}
