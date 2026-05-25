/**
 * Notifications — Day 0/1/3/7 welcome cadence.
 *
 * Spec Rule #10:
 *   Day 0  Welcome
 *   Day 1  Signal active
 *   Day 3  Recovery rhythm building
 *   Day 7  Recovery Story
 *   Max:   1/day
 *
 * Hidden architecture only — no native push, no permission prompts,
 * no UI. The scheduler exposes a queue and a 1/calendar-day throttle
 * that later rules can wire into `expo-notifications` or an in-app
 * banner without touching this service. Anchored to a per-user
 * "notifications start" timestamp persisted in AsyncStorage; this is
 * distinct from `recoveryCircle.startAt` because account onboarding
 * and recovery start are different events.
 *
 * No referral / invite / share copy lives here by design.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useFeatureFlags } from '@/store/useAppStore';

/** Spec cadence in days since the user's notifications start. */
export const NOTIFICATION_DAYS = [0, 1, 3, 7] as const;
export type NotificationDay = (typeof NOTIFICATION_DAYS)[number];

/** Spec cap: at most one notification delivered per calendar day. */
export const MAX_PER_DAY = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STORAGE_KEY = '@aforce/notifications';

export interface ScheduledNotification {
  day: NotificationDay;
  /** Absolute ISO timestamp at which this slot becomes due. */
  dueAt: string;
  title: string;
  body: string;
}

export interface NotificationDelivery {
  day: NotificationDay;
  /** ISO timestamp the notification was actually delivered. */
  deliveredAt: string;
}

export interface NotificationsSnapshot {
  startAt: string;
  delivered: NotificationDelivery[];
}

/**
 * Spec copy table — title + body for each cadence day. Strings are
 * verbatim from the spec; bodies expand the title to a complete
 * sentence (the spec lists the title only). Brand words unchanged
 * per Rule #16.
 */
export const NOTIFICATION_COPY: Readonly<
  Record<NotificationDay, { title: string; body: string }>
> = {
  0: { title: 'Welcome', body: 'Welcome to AForce.' },
  1: { title: 'Signal active', body: 'Your signal is active.' },
  3: { title: 'Recovery rhythm building', body: 'Recovery rhythm building.' },
  7: { title: 'Recovery Story', body: 'Your recovery story is here.' },
};

/** Pure: derive the 4 scheduled notifications from a start timestamp. */
export function deriveScheduledNotifications(startAtIso: string): ScheduledNotification[] {
  const start = Date.parse(startAtIso);
  const baseValid = Number.isFinite(start);
  return NOTIFICATION_DAYS.map((day) => {
    const copy = NOTIFICATION_COPY[day];
    return {
      day,
      dueAt: baseValid
        ? new Date(start + day * MS_PER_DAY).toISOString()
        : startAtIso,
      title: copy.title,
      body: copy.body,
    };
  });
}

/** UTC calendar-day key (YYYY-MM-DD) for throttling. */
function calendarDayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Pure: returns true when at least MAX_PER_DAY notifications have
 * already been delivered on the same UTC calendar day as `dueAt`.
 */
export function throttleByCalendarDay(
  history: ReadonlyArray<NotificationDelivery>,
  dueAtIso: string,
): boolean {
  const key = calendarDayKey(dueAtIso);
  let count = 0;
  for (const d of history) {
    if (calendarDayKey(d.deliveredAt) === key) count += 1;
  }
  return count >= MAX_PER_DAY;
}

/**
 * Pure: returns the next notification eligible to fire right now.
 *
 * Eligibility: dueAt has passed, has not already been delivered, and
 * the calendar-day quota is not yet exhausted. Returns at most one
 * (the earliest-due eligible entry) — enforces the 1/day spec cap.
 */
export function dueNotifications(
  scheduled: ReadonlyArray<ScheduledNotification>,
  now: number,
  history: ReadonlyArray<NotificationDelivery>,
): ScheduledNotification | null {
  const deliveredDays = new Set(history.map((d) => d.day));
  const nowIso = new Date(now).toISOString();
  if (throttleByCalendarDay(history, nowIso)) return null;
  for (const s of scheduled) {
    if (deliveredDays.has(s.day)) continue;
    if (Date.parse(s.dueAt) > now) continue;
    return s;
  }
  return null;
}

// ── Persistence ──────────────────────────────────────────────────────────────

function isSnapshot(v: unknown): v is NotificationsSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return typeof s.startAt === 'string' && Array.isArray(s.delivered);
}

export async function getNotificationsSnapshot(): Promise<NotificationsSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setNotificationsSnapshot(snapshot: NotificationsSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* non-fatal */
  }
}

/**
 * Create-if-missing. Anchors the cadence at `nowIso` on first call
 * per user; subsequent calls return the existing snapshot unchanged.
 */
export async function ensureNotificationsSnapshot(
  nowIso: string,
): Promise<NotificationsSnapshot> {
  const existing = await getNotificationsSnapshot();
  if (existing) return existing;
  const fresh: NotificationsSnapshot = { startAt: nowIso, delivered: [] };
  await setNotificationsSnapshot(fresh);
  return fresh;
}

/**
 * Record a delivery and persist. Returns the updated snapshot. Safe
 * to call from a later push/banner wiring layer.
 */
export async function recordDelivery(
  day: NotificationDay,
  deliveredAtIso: string,
): Promise<NotificationsSnapshot | null> {
  const snap = await getNotificationsSnapshot();
  if (!snap) return null;
  const next: NotificationsSnapshot = {
    startAt: snap.startAt,
    delivered: [...snap.delivered, { day, deliveredAt: deliveredAtIso }],
  };
  await setNotificationsSnapshot(next);
  return next;
}

// ── Hidden hook ──────────────────────────────────────────────────────────────

/**
 * Returns the stored snapshot when `spec_notifications` is on;
 * returns null otherwise. Does NOT mount any UI or request native
 * permissions; reserved for later rules that wire the queue into
 * `expo-notifications` or an in-app surface.
 */
export function useHiddenNotifications(): NotificationsSnapshot | null {
  const flags = useFeatureFlags();
  const [snapshot, setSnapshot] = useState<NotificationsSnapshot | null>(null);

  useEffect(() => {
    if (!flags.spec_notifications) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void getNotificationsSnapshot().then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [flags.spec_notifications]);

  return snapshot;
}
