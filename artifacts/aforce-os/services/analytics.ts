/**
 * Analytics service — Priority #4 (Analytics Layer).
 *
 * The persisted "underneath" half of the analytics layer. It owns a
 * small, capped event log in AsyncStorage and exposes deduped recorders
 * that the existing event sources (session open, onboarding finish,
 * daily win, reminder banner, streak changes) call directly. No new UI,
 * no new navigation — analytics only powers the engine internally.
 *
 * Mirrors the persistence pattern in `services/notifications.ts`:
 * `@aforce/*` key, async, best-effort (storage failures are non-fatal).
 *
 * Recorders are idempotent / deduped so callers can fire freely from
 * render-driven effects without spamming the log.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  computeAnalyticsMetrics,
  type AnalyticsEvent,
  type AnalyticsMetrics,
} from '@/utils/analytics/metrics';

const STORAGE_KEY = '@aforce/analytics';
/** Keep the log bounded — retain the most recent N events. */
const MAX_EVENTS = 500;

export interface AnalyticsSnapshot {
  firstSeenAt: string;
  events: AnalyticsEvent[];
}

function isSnapshot(v: unknown): v is AnalyticsSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return typeof s.firstSeenAt === 'string' && Array.isArray(s.events);
}

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function setAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* non-fatal */
  }
}

/**
 * Serializes every read-modify-write so concurrent recorders (the home
 * recorder fires several on mount, and NotificationBanner can fire too)
 * cannot read the same snapshot and clobber each other's appends. All
 * writes go through this single in-module queue → linearizable appends.
 */
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function ensureAnalyticsSnapshot(
  nowIso: string,
): Promise<AnalyticsSnapshot> {
  const existing = await getAnalyticsSnapshot();
  if (existing) return existing;
  const fresh: AnalyticsSnapshot = { firstSeenAt: nowIso, events: [] };
  await setAnalyticsSnapshot(fresh);
  return fresh;
}

/**
 * Append an event only when `shouldAppend(existingEvents)` is true.
 * Returns the (possibly unchanged) snapshot. The predicate is how each
 * recorder dedupes — e.g. "no session yet today", "no win for this id
 * today", "streak value actually changed".
 */
function appendIf(
  event: AnalyticsEvent,
  shouldAppend: (events: AnalyticsEvent[]) => boolean,
): Promise<AnalyticsSnapshot> {
  return enqueue(async () => {
    const snap = await ensureAnalyticsSnapshot(event.at);
    if (!shouldAppend(snap.events)) return snap;
    const next: AnalyticsSnapshot = {
      firstSeenAt: snap.firstSeenAt,
      events: [...snap.events, event].slice(-MAX_EVENTS),
    };
    await setAnalyticsSnapshot(next);
    return next;
  });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** One session per calendar day — exactly what retention needs. */
export function recordSessionOpen(nowIso: string): Promise<AnalyticsSnapshot> {
  const key = dayKey(nowIso);
  return appendIf(
    { type: 'session_open', at: nowIso },
    (events) =>
      !events.some((e) => e.type === 'session_open' && dayKey(e.at) === key),
  );
}

/** Recorded once, ever. */
export function recordOnboardingCompleted(
  nowIso: string,
): Promise<AnalyticsSnapshot> {
  return appendIf(
    { type: 'onboarding_completed', at: nowIso },
    (events) => !events.some((e) => e.type === 'onboarding_completed'),
  );
}

/** One win per id per calendar day — first win anchors Time To First Win. */
export function recordWin(
  winId: string,
  nowIso: string,
): Promise<AnalyticsSnapshot> {
  const key = dayKey(nowIso);
  return appendIf(
    { type: 'win', at: nowIso, meta: { winId } },
    (events) =>
      !events.some(
        (e) =>
          e.type === 'win' &&
          e.meta?.winId === winId &&
          dayKey(e.at) === key,
      ),
  );
}

/** One "shown" per reminder slot. */
export function recordReminderShown(
  reminderDay: string | number,
  nowIso: string,
): Promise<AnalyticsSnapshot> {
  const slot = String(reminderDay);
  return appendIf(
    { type: 'reminder_shown', at: nowIso, meta: { reminderDay: slot } },
    (events) =>
      !events.some(
        (e) => e.type === 'reminder_shown' && String(e.meta?.reminderDay) === slot,
      ),
  );
}

/** One "response" per reminder slot. */
export function recordReminderResponse(
  reminderDay: string | number,
  nowIso: string,
): Promise<AnalyticsSnapshot> {
  const slot = String(reminderDay);
  return appendIf(
    { type: 'reminder_response', at: nowIso, meta: { reminderDay: slot } },
    (events) =>
      !events.some(
        (e) =>
          e.type === 'reminder_response' && String(e.meta?.reminderDay) === slot,
      ),
  );
}

/** Recorded only when the streak value actually changes. */
export function recordStreakChanged(
  value: number,
  nowIso: string,
): Promise<AnalyticsSnapshot> {
  return appendIf(
    { type: 'streak_changed', at: nowIso, meta: { value } },
    (events) => {
      for (let i = events.length - 1; i >= 0; i -= 1) {
        if (events[i].type === 'streak_changed') {
          return Number(events[i].meta?.value) !== value;
        }
      }
      return true;
    },
  );
}

/** Load the log and compute the five engine-facing metrics. */
export async function getAnalyticsMetrics(): Promise<AnalyticsMetrics> {
  const snap = await getAnalyticsSnapshot();
  return computeAnalyticsMetrics(snap?.events ?? []);
}
