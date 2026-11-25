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
import {
  calendarReadWindow,
  dedupeCalendarEvents,
  type CalendarReadWindow,
} from '@/services/calendarOccurrence';

const PREFS_KEY = '@aforce/calendarPrefs';

export type CalendarPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface DeviceCalendarInfo {
  id: string;
  title: string;
  /** Account/source name, e.g. "iCloud", "Google", "Exchange". */
  sourceName: string;
  /** Account kind the OS reports (iOS: local, exchange, caldav, mobileme,
   *  subscribed, birthdays; Android: the account type, e.g.
   *  com.google). Absent when the OS gives none. Never an address. */
  sourceType?: string;
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
      sourceType:
        typeof c.source?.type === 'string' && c.source.type.length > 0
          ? c.source.type
          : c.source?.isLocalAccount
            ? 'local'
            : undefined,
      color: typeof c.color === 'string' ? c.color : undefined,
    }));
  } catch {
    return [];
  }
}

export interface CalendarRead {
  /** Every event read, one per occurrence, BEFORE the duplicate-invitation
   *  de-dupe (change detection needs the ids the de-dupe would drop). */
  events: CalendarEventLike[];
  window: CalendarReadWindow;
}

/**
 * Read upcoming events from the SELECTED calendars, mapped immediately to
 * the minimal CalendarEventLike shape (titles + times + ids only) and held
 * in memory by the caller. `null` means the read did not happen or failed,
 * which is different from a successful read that found nothing.
 */
export async function readUpcomingEvents(
  selectedCalendarIds: readonly string[],
  nowIso: string,
): Promise<CalendarRead | null> {
  if (selectedCalendarIds.length === 0) return null;
  const Cal = await loadCalendar();
  if (!Cal) return null;
  try {
    const window = calendarReadWindow(nowIso, MOMENT_CALENDAR_HORIZON_DAYS);
    const events = await Cal.getEventsAsync(
      [...selectedCalendarIds],
      new Date(window.startIso),
      new Date(window.endIso),
    );
    const out: CalendarEventLike[] = [];
    for (const e of events) {
      const startMs = new Date(e.startDate as string | number | Date).getTime();
      if (!Number.isFinite(startMs)) continue; // an unreadable start is skipped, not guessed
      const startAtIso = new Date(startMs).toISOString();
      const endMs = e.endDate ? new Date(e.endDate as string | number | Date).getTime() : NaN;
      out.push({
        id: e.id,
        title: e.title ?? null,
        startAtIso,
        endAtIso: Number.isFinite(endMs) ? new Date(endMs).toISOString() : undefined,
        allDay: Boolean(e.allDay),
        calendarId: e.calendarId ?? '',
      });
    }
    return { events: out, window };
  } catch {
    return null; // revoked mid-session / transient errors → honest "no read"
  }
}

/**
 * Upcoming events from the selected calendars with the same invitation seen
 * through more than one calendar collapsed (same title + start). Failure and
 * "nothing found" both return [] here; use readUpcomingEvents to tell apart.
 */
export async function fetchUpcomingEvents(
  selectedCalendarIds: readonly string[],
  nowIso: string,
): Promise<CalendarEventLike[]> {
  const read = await readUpcomingEvents(selectedCalendarIds, nowIso);
  return read ? dedupeCalendarEvents(read.events) : [];
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
