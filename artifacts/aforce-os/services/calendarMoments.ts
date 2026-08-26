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
  fetchUpcomingEvents,
  getCalendarPermission,
  getCalendarPrefs,
} from '@/services/calendarBridge';
import { classifyCalendarEvent } from '@/services/momentClassification';

const PREPARED_KEY = '@aforce/momentPrepared';
const MIN_REFRESH_GAP_MS = 60_000;

let calendarMoments: Moment[] = [];
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

/** Mark a calendar moment prepared (I'M READY). Persists the mark only. */
export async function markCalendarMomentPrepared(calendarEventId: string): Promise<void> {
  const marks = await getPreparedMarks();
  marks[calendarEventId] = new Date().toISOString();
  try {
    await scopedStorage.setItem(PREPARED_KEY, JSON.stringify(marks));
  } catch {
    // best-effort
  }
  calendarMoments = calendarMoments.map((m) =>
    m.calendarEventId === calendarEventId
      ? { ...m, preparedAtIso: marks[calendarEventId] }
      : m,
  );
  notify();
}

export function getCalendarMoments(): Moment[] {
  return calendarMoments;
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
      if (calendarMoments.length > 0) {
        calendarMoments = [];
        notify();
      }
      return;
    }
    const permission = await getCalendarPermission();
    if (permission !== 'granted') {
      // Revoked in Settings → drop everything, render manual-only honestly.
      if (calendarMoments.length > 0) {
        calendarMoments = [];
        notify();
      }
      return;
    }
    const nowIso = new Date().toISOString();
    const [events, marks] = await Promise.all([
      fetchUpcomingEvents(prefs.selectedCalendarIds, nowIso),
      getPreparedMarks(),
    ]);
    const next: Moment[] = [];
    for (const event of events) {
      const result = classifyCalendarEvent(event, prefs.categories);
      if (result.kind !== 'moment') continue;
      next.push({
        id: `cal-${event.id}`,
        source: 'calendar',
        title: result.masked ? '' : (event.title ?? '').trim(),
        masked: result.masked,
        type: result.type,
        importance: result.importance,
        startAtIso: event.startAtIso,
        endAtIso: event.endAtIso,
        calendarEventId: event.id,
        preparedAtIso: marks[event.id],
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

// Wave-2 PR6: user-scope change → drop derived calendar moments + marks.
subscribeUserScope(() => {
  calendarMoments = [];
  lastRefreshMs = 0;
  for (const l of listeners) l();
});
