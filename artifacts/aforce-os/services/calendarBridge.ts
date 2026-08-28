/**
 * calendarBridge — least-privilege device-calendar access for AForce Moments
 * (Phase 3b, DR-011). The ONLY module that touches expo-calendar.
 *
 * DATA-MINIMIZATION CONTRACT (PR-002 Appendix A — Legal/Privacy pending;
 * activation blocked until they sign):
 *  - READ-ONLY. Never requests write access; never creates/edits events.
 *  - Reads titles + start/end times + calendar ids ONLY. Attendees, notes,
 *    locations, organizers, attachments and URLs are never read off the
 *    event objects (we map to a minimal shape immediately and drop the rest).
 *  - User-SELECTED calendars only; nothing reads until the member connects.
 *  - IN-MEMORY ONLY: fetched events are never persisted. AsyncStorage holds
 *    only the member's own preferences (connected flag, selected calendar
 *    ids, category toggles) and their prepared-marks — never event data.
 *  - Permission denial/revocation is never fatal: every call degrades to
 *    null/[] and the UI renders its honest posture; manual Moments remain a
 *    full substitute.
 *
 * Lazy dynamic import (appleHealth/pushNotifications pattern): web, older
 * binaries without the native module, and failures all no-op cleanly.
 */
import { Platform } from 'react-native';
import { scopedStorage } from './scopedStorage';

import { MOMENT_CALENDAR_HORIZON_DAYS } from '@/config/hydroStateModel';
import type { CalendarEventLike } from '@/services/momentClassification';
import type { MomentCategoryToggle } from '@/services/momentClassification';

const PREFS_KEY = '@aforce/calendarPrefs';

export type CalendarPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface DeviceCalendarInfo {
  id: string;
  title: string;
  /** Account/source name, e.g. "iCloud", "Google", "Exchange". */
  sourceName: string;
  color?: string;
}

export interface CalendarPrefs {
  connected: boolean;
  /** Calendar ids the member chose to read. Empty = read nothing. */
  selectedCalendarIds: string[];
  /** Enabled event-category toggles (work/training/travel). */
  categories: MomentCategoryToggle[];
}

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  connected: false,
  selectedCalendarIds: [],
  categories: ['work', 'training', 'travel'],
};

async function loadCalendar(): Promise<typeof import('expo-calendar') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-calendar');
  } catch {
    return null;
  }
}

export async function getCalendarPermission(): Promise<CalendarPermission> {
  const Cal = await loadCalendar();
  if (!Cal) return 'unavailable';
  try {
    const res = await Cal.getCalendarPermissionsAsync();
    if (res.granted) return 'granted';
    return res.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** Request read access (iOS may grant full or write-only-upgradable read). */
export async function requestCalendarPermission(): Promise<CalendarPermission> {
  const Cal = await loadCalendar();
  if (!Cal) return 'unavailable';
  try {
    const res = await Cal.requestCalendarPermissionsAsync();
    if (res.granted) return 'granted';
    return res.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** List device calendars (minimal shape; requires granted permission). */
export async function listDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  const Cal = await loadCalendar();
  if (!Cal) return [];
  try {
    const cals = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
    return cals.map((c) => ({
      id: c.id,
      title: c.title,
      sourceName: c.source?.name ?? 'Calendar',
      color: typeof c.color === 'string' ? c.color : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Read upcoming events from the SELECTED calendars, mapped immediately to
 * the minimal CalendarEventLike shape (titles + times + ids only) and held
 * in memory by the caller. Duplicate events across duplicate calendars are
 * de-duped by (title, startAt).
 */
export async function fetchUpcomingEvents(
  selectedCalendarIds: readonly string[],
  nowIso: string,
): Promise<CalendarEventLike[]> {
  if (selectedCalendarIds.length === 0) return [];
  const Cal = await loadCalendar();
  if (!Cal) return [];
  try {
    const start = new Date(Date.parse(nowIso) - 6 * 3_600_000); // earlier today
    const end = new Date(
      Date.parse(nowIso) + MOMENT_CALENDAR_HORIZON_DAYS * 24 * 3_600_000,
    );
    const events = await Cal.getEventsAsync([...selectedCalendarIds], start, end);
    const seen = new Set<string>();
    const out: CalendarEventLike[] = [];
    for (const e of events) {
      const startAtIso = new Date(e.startDate as string | number | Date).toISOString();
      const dedupeKey = `${(e.title ?? '').trim().toLowerCase()}|${startAtIso}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({
        id: e.id,
        title: e.title ?? null,
        startAtIso,
        endAtIso: e.endDate ? new Date(e.endDate as string | number | Date).toISOString() : undefined,
        allDay: Boolean(e.allDay),
        calendarId: e.calendarId ?? '',
      });
    }
    return out;
  } catch {
    return []; // revoked mid-session / transient errors → honest empty
  }
}

// ─── Prefs (the ONLY persisted calendar state — never event data) ─────────

export async function getCalendarPrefs(): Promise<CalendarPrefs> {
  try {
    const raw = await scopedStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_CALENDAR_PREFS;
    const p = JSON.parse(raw) as Partial<CalendarPrefs>;
    return {
      connected: p.connected === true,
      selectedCalendarIds: Array.isArray(p.selectedCalendarIds)
        ? p.selectedCalendarIds.filter((x): x is string => typeof x === 'string')
        : [],
      categories: Array.isArray(p.categories)
        ? p.categories.filter((c): c is MomentCategoryToggle =>
            c === 'work' || c === 'training' || c === 'travel')
        : DEFAULT_CALENDAR_PREFS.categories,
    };
  } catch {
    return DEFAULT_CALENDAR_PREFS;
  }
}

export async function setCalendarPrefs(prefs: CalendarPrefs): Promise<void> {
  try {
    await scopedStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort
  }
}

/**
 * Disconnect = forget prefs AND the prepared-marks (O-1). No event data ever
 * exists to delete (reads are in-memory only), but the prepared-marks record
 * is event-id-keyed and useless after disconnect; clearing it leaves no
 * calendar-derived record on disk. That key is owned by calendarMoments; a
 * dynamic import avoids a static cycle (calendarMoments imports this module).
 */
export async function disconnectCalendar(): Promise<void> {
  try {
    await scopedStorage.removeItem(PREFS_KEY);
  } catch {
    // best-effort
  }
  try {
    const { forgetPreparedMarks } = await import('./calendarMoments');
    await forgetPreparedMarks();
  } catch {
    // best-effort
  }
}
