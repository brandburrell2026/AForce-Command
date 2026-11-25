/**
 * calendarMoments with a mocked bridge: recurring occurrences get their own
 * Moments and marks, a moved event updates, a cancelled event disappears, and
 * a failed read is not mistaken for an empty calendar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Ev = { id: string; title: string | null; startAtIso: string; endAtIso?: string; calendarId: string };
const bridge = vi.hoisted(() => ({
  read: null as null | { events: Ev[] },
}));
const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../calendarBridge', () => ({
  getCalendarPermission: async () => 'granted',
  getCalendarPrefs: async () => ({
    connected: true,
    selectedCalendarIds: ['c1'],
    categories: ['work', 'training', 'travel'],
  }),
  readUpcomingEvents: async () =>
    bridge.read
      ? { events: bridge.read.events, window: { startIso: '2026-11-21T00:00:00.000Z', endIso: '2026-11-24T00:00:00.000Z' } }
      : null,
}));
vi.mock('../scopedStorage', () => ({
  scopedStorage: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));
vi.mock('../userScope', () => ({ subscribeUserScope: () => () => {} }));

import {
  getCalendarMoments,
  getCalendarSnapshot,
  markCalendarMomentPrepared,
  refreshCalendarMoments,
} from '../calendarMoments';
import { calendarMomentId } from '../calendarOccurrence';

const A = '2026-11-22T15:00:00.000Z';
const B = '2026-11-23T15:00:00.000Z';
const ev = (id: string, startAtIso: string, title: string | null = 'Team meeting'): Ev => ({ id, title, startAtIso, calendarId: 'c1' });

beforeEach(async () => {
  store.clear();
  bridge.read = { events: [] };
  await refreshCalendarMoments(true);
});

describe('calendar Moments by occurrence', () => {
  it('makes one Moment per occurrence of a recurring event, each with its own id', async () => {
    bridge.read = { events: [ev('series', A), ev('series', B)] };
    await refreshCalendarMoments(true);
    const ids = getCalendarMoments().map((m) => m.id);
    expect(ids).toEqual([calendarMomentId('series', A), calendarMomentId('series', B)]);
    expect(new Set(ids).size).toBe(2);
    expect(getCalendarMoments().every((m) => m.calendarEventId === 'series')).toBe(true);
  });

  it('marks only the occurrence the member prepared', async () => {
    bridge.read = { events: [ev('series', A), ev('series', B)] };
    await refreshCalendarMoments(true);
    await markCalendarMomentPrepared('series', A);
    const [first, second] = getCalendarMoments();
    expect(first.preparedAtIso).toBeTruthy();
    expect(second.preparedAtIso).toBeUndefined();
    await refreshCalendarMoments(true);
    const [again1, again2] = getCalendarMoments();
    expect(again1.preparedAtIso).toBeTruthy();
    expect(again2.preparedAtIso).toBeUndefined();
  });

  it('still honours a mark written before occurrence keys, for a single occurrence only', async () => {
    store.set('@aforce/momentPrepared', JSON.stringify({ solo: '2026-11-21T10:00:00.000Z', series: '2026-11-21T10:00:00.000Z' }));
    bridge.read = { events: [ev('solo', A, 'Solo review'), ev('series', A), ev('series', B)] };
    await refreshCalendarMoments(true);
    const byEvent = (id: string) => getCalendarMoments().filter((m) => m.calendarEventId === id);
    expect(byEvent('solo')[0].preparedAtIso).toBe('2026-11-21T10:00:00.000Z');
    expect(byEvent('series').every((m) => m.preparedAtIso === undefined)).toBe(true);
  });

  it('collapses the same invitation seen in two calendars but keeps both ids for change detection', async () => {
    bridge.read = { events: [ev('personalCopy', A, 'Board Meeting'), ev('workCopy', A, 'board meeting')] };
    await refreshCalendarMoments(true);
    expect(getCalendarMoments()).toHaveLength(1);
    expect(getCalendarSnapshot()?.events.map((e) => e.id).sort()).toEqual(['personalCopy', 'workCopy']);
  });

  it('updates a moved event and drops a cancelled one on the next read', async () => {
    bridge.read = { events: [ev('e1', A), ev('e2', B, 'Flight to Denver')] };
    await refreshCalendarMoments(true);
    expect(getCalendarMoments()).toHaveLength(2);
    const later = '2026-11-22T17:00:00.000Z';
    bridge.read = { events: [ev('e1', later)] }; // e1 moved, e2 cancelled
    await refreshCalendarMoments(true);
    const now = getCalendarMoments();
    expect(now).toHaveLength(1);
    expect(now[0].startAtIso).toBe(later);
    expect(now[0].id).toBe(calendarMomentId('e1', later));
  });

  it('keeps no snapshot after a failed read, so no change can be claimed from it', async () => {
    bridge.read = { events: [ev('e1', A)] };
    await refreshCalendarMoments(true);
    expect(getCalendarSnapshot()).not.toBeNull();
    bridge.read = null;
    await refreshCalendarMoments(true);
    expect(getCalendarSnapshot()).toBeNull();
  });

  it('writes no event data to storage', async () => {
    bridge.read = { events: [ev('e1', A, 'Confidential Board Review')] };
    await refreshCalendarMoments(true);
    await markCalendarMomentPrepared('e1', A);
    for (const v of store.values()) {
      expect(v).not.toContain('Confidential');
      expect(v).not.toContain('Board Review');
    }
  });
});
