/**
 * calendarMoments — the in-memory calendar→Moment layer (Phase 3b, DR-011).
 * Composes calendarBridge (least-privilege reads) + momentClassification
 * (pure, confidence-gated) into Moment objects the rest of Moments consumes.
 *
 * IN-MEMORY ONLY: derived moments are module state, re-fetched on demand and
 * lost on relaunch — never persisted (PR-002 Appendix A minimization). The
 * single persisted artifact is the member's own prepared-marks
 * (`@aforce/momentPrepared`, calendarEventId → ISO), which contains no event
 * data. Deleted/moved events self-heal on the next refresh (id-keyed).
 */
import { scopedStorage } from './scopedStorage';
import { subscribeUserScope } from './userScope';
import { useSyncExternalStore } from 'react';

import type { Moment } from '@/types/moments';
import {
  readUpcomingEvents,
  getCalendarPermission,
  getCalendarPrefs,
} from '@/services/calendarBridge';
import { classifyCalendarEvent } from '@/services/momentClassification';
import {
  calendarMomentId,
  dedupeCalendarEvents,
  occurrenceKey,
  preparedMarkFor,
  type CalendarSnapshot,
} from '@/services/calendarOccurrence';

const PREPARED_KEY = '@aforce/momentPrepared';
const MIN_REFRESH_GAP_MS = 60_000;

let calendarMoments: Moment[] = [];
/** What the last successful read saw, in memory only. Null = no read. */
let calendarSnapshot: CalendarSnapshot | null = null;
let lastRefreshMs = 0;
let refreshing = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

async function getPreparedMarks(): Promise<Record<string, string>> {
  try {
    const raw = await scopedStorage.getItem(PREPARED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Mark a calendar moment prepared (I'M READY). Persists the mark only.
 * Pass the occurrence's start so a recurring event marks only that
 * occurrence; without it the mark is keyed by the bare event id (the form
 * written before occurrence-specific keys existed).
 */
export async function markCalendarMomentPrepared(
  calendarEventId: string,
  startAtIso?: string,
): Promise<void> {
  const marks = await getPreparedMarks();
  const key = startAtIso ? occurrenceKey(calendarEventId, startAtIso) : calendarEventId;
  const markedAt = new Date().toISOString();
  marks[key] = markedAt;
  try {
    await scopedStorage.setItem(PREPARED_KEY, JSON.stringify(marks));
  } catch {
    // best-effort
  }
  calendarMoments = calendarMoments.map((m) =>
    m.calendarEventId === calendarEventId &&
    (!startAtIso || occurrenceKey(calendarEventId, m.startAtIso) === key)
      ? { ...m, preparedAtIso: markedAt }
      : m,
  );
  notify();
}

/**
 * O-1: forget the persisted prepared-marks. They are event-id-keyed and
 * useless once the calendar is disconnected; `disconnectCalendar()` calls this
 * so a disconnect leaves no calendar-derived record on disk. The in-memory set
 * is cleared by the disconnect refresh (prefs.connected=false → empty set).
 */
export async function forgetPreparedMarks(): Promise<void> {
  try {
    await scopedStorage.removeItem(PREPARED_KEY);
  } catch {
    // best-effort
  }
}

export function getCalendarMoments(): Moment[] {
  return calendarMoments;
}

/** What the last successful read saw (ids, titles, times). Memory only. */
export function getCalendarSnapshot(): CalendarSnapshot | null {
  return calendarSnapshot;
}

function clearDerived(): void {
  if (calendarMoments.length > 0 || calendarSnapshot) {
    calendarMoments = [];
    calendarSnapshot = null;
    notify();
  }
}

/**
 * Refresh the derived set. Throttled (60s) unless `force`. No permission /
 * not connected / no selection → empty set, honestly.
 */
export async function refreshCalendarMoments(force = false): Promise<void> {
  const now = Date.now();
  if (refreshing || (!force && now - lastRefreshMs < MIN_REFRESH_GAP_MS)) return;
  refreshing = true;
  try {
    const prefs = await getCalendarPrefs();
    if (!prefs.connected || prefs.selectedCalendarIds.length === 0) {
      clearDerived();
      return;
    }
    const permission = await getCalendarPermission();
    if (permission !== 'granted') {
      // Revoked in Settings → drop everything, render manual-only honestly.
      clearDerived();
      return;
    }
    const nowIso = new Date().toISOString();
    const [read, marks] = await Promise.all([
      readUpcomingEvents(prefs.selectedCalendarIds, nowIso),
      getPreparedMarks(),
    ]);
    const events = read ? dedupeCalendarEvents(read.events) : [];
    // A failed read is not "nothing on the calendar": no snapshot, so no
    // change is ever claimed from it.
    calendarSnapshot = read ? { events: read.events, window: read.window } : null;
    const perId = new Map<string, number>();
    for (const e of events) perId.set(e.id, (perId.get(e.id) ?? 0) + 1);
    const next: Moment[] = [];
    for (const event of events) {
      const result = classifyCalendarEvent(event, prefs.categories);
      if (result.kind !== 'moment') continue;
      next.push({
        // Occurrence-specific: recurring occurrences share `event.id`.
        id: calendarMomentId(event.id, event.startAtIso),
        source: 'calendar',
        title: result.masked ? '' : (event.title ?? '').trim(),
        masked: result.masked,
        type: result.type,
        importance: result.importance,
        startAtIso: event.startAtIso,
        endAtIso: event.endAtIso,
        calendarEventId: event.id,
        preparedAtIso: preparedMarkFor(marks, event.id, event.startAtIso, perId.get(event.id) ?? 1),
        createdAtIso: nowIso,
      });
    }
    calendarMoments = next;
    lastRefreshMs = now;
    notify();
  } finally {
    refreshing = false;
  }
}

export function subscribeCalendarMoments(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCalendarMoments(): Moment[] {
  return useSyncExternalStore(subscribeCalendarMoments, getCalendarMoments, getCalendarMoments);
}

export function useCalendarSnapshot(): CalendarSnapshot | null {
  return useSyncExternalStore(subscribeCalendarMoments, getCalendarSnapshot, getCalendarSnapshot);
}

// Wave-2 PR6: user-scope change → drop derived calendar moments + marks.
subscribeUserScope(() => {
  calendarMoments = [];
  calendarSnapshot = null;
  lastRefreshMs = 0;
  for (const l of listeners) l();
});
