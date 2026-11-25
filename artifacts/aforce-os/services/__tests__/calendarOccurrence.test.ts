/**
 * calendarOccurrence — recurring occurrences, duplicate invitations, moved and
 * cancelled events, time-zone changes and a daylight-saving boundary. Pure.
 */
import { describe, expect, it } from 'vitest';
import {
  calendarMomentId,
  calendarReadWindow,
  dedupeCalendarEvents,
  detectSealedCalendarChanges,
  matchOccurrence,
  occurrenceKey,
  preparedMarkFor,
  OCCURRENCE_MOVE_WINDOW_MS,
  type CalendarSnapshot,
} from '../calendarOccurrence';
import { mergeReviewedCalendarMoments } from '../momentRecommendation';
import type { CalendarEventLike } from '../momentClassification';
import type { Moment } from '../../types/moments';

const ev = (id: string, startAtIso: string, title = 'Team meeting', calendarId = 'c1'): CalendarEventLike => ({
  id,
  title,
  startAtIso,
  calendarId,
});
const WINDOW = { startIso: '2026-11-21T00:00:00.000Z', endIso: '2026-11-24T00:00:00.000Z' };
const snap = (events: CalendarEventLike[]): CalendarSnapshot => ({ events, window: WINDOW });
const sealed = (id: string, eventId: string, startAtIso: string): Moment => ({
  id,
  source: 'manual',
  title: 'Team meeting',
  type: 'work',
  importance: 'high',
  startAtIso,
  createdAtIso: '2026-11-20T00:00:00.000Z',
  calendarSource: { eventId, startAtIso },
  preparation: { sealedAtIso: '2026-11-20T12:00:00.000Z' } as Moment['preparation'],
});

describe('recurring occurrences share an event id', () => {
  const mon = '2026-11-23T15:00:00.000Z';
  const tue = '2026-11-24T15:00:00.000Z';
  it('gives each occurrence its own Moment id and mark key', () => {
    expect(calendarMomentId('series', mon)).not.toBe(calendarMomentId('series', tue));
    expect(occurrenceKey('series', mon)).not.toBe(occurrenceKey('series', tue));
  });
  it('is stable for the same occurrence however the instant is written', () => {
    expect(calendarMomentId('series', mon)).toBe(calendarMomentId('series', '2026-11-23T10:00:00-05:00'));
    expect(occurrenceKey('series', mon)).toBe(occurrenceKey('series', '2026-11-23T10:00:00-05:00'));
  });
  it('keeps the id free of characters that need escaping in a route', () => {
    expect(calendarMomentId('A1B2-C3', mon)).toMatch(/^cal-[A-Za-z0-9-]+@\d+$/);
  });
  it('does not spread a legacy bare-id mark across a series', () => {
    const marks = { series: '2026-11-22T00:00:00.000Z' };
    expect(preparedMarkFor(marks, 'series', mon, 1)).toBe(marks.series);
    expect(preparedMarkFor(marks, 'series', mon, 2)).toBeUndefined();
  });
  it('an occurrence-specific mark applies to that occurrence only', () => {
    const marks = { [occurrenceKey('series', mon)]: '2026-11-22T00:00:00.000Z' };
    expect(preparedMarkFor(marks, 'series', mon, 2)).toBeTruthy();
    expect(preparedMarkFor(marks, 'series', tue, 2)).toBeUndefined();
  });
});

describe('duplicate invitations across calendars', () => {
  it('collapses the same title and start, case and spacing aside', () => {
    const out = dedupeCalendarEvents([
      ev('a', '2026-11-23T15:00:00.000Z', 'Board Meeting', 'work'),
      ev('b', '2026-11-23T15:00:00.000Z', '  board meeting ', 'personal'),
    ]);
    expect(out.map((e) => e.id)).toEqual(['a']);
  });
  it('keeps recurring occurrences (same id, different starts) and different titles', () => {
    const out = dedupeCalendarEvents([
      ev('s', '2026-11-23T15:00:00.000Z'),
      ev('s', '2026-11-24T15:00:00.000Z'),
      ev('x', '2026-11-23T15:00:00.000Z', 'Lunch'),
    ]);
    expect(out).toHaveLength(3);
  });
  it('treats the same instant written in two zones as one start', () => {
    expect(
      dedupeCalendarEvents([ev('a', '2026-11-23T15:00:00.000Z'), ev('b', '2026-11-23T10:00:00-05:00')]),
    ).toHaveLength(1);
  });
});

describe('a sealed plan whose calendar event moved or went', () => {
  const at = '2026-11-23T15:00:00.000Z';
  it('is unchanged when the same occurrence is still there', () => {
    expect(detectSealedCalendarChanges([sealed('m', 'e1', at)], snap([ev('e1', at)]))).toEqual({});
  });
  it('is unchanged when only other occurrences of the series moved', () => {
    expect(
      detectSealedCalendarChanges(
        [sealed('m', 'e1', at)],
        snap([ev('e1', at), ev('e1', '2026-11-24T16:00:00.000Z')]),
      ),
    ).toEqual({});
  });
  it('reports a moved event with where it went', () => {
    expect(
      detectSealedCalendarChanges([sealed('m', 'e1', at)], snap([ev('e1', '2026-11-23T17:00:00.000Z')])),
    ).toEqual({ m: { kind: 'moved', toStartAtIso: '2026-11-23T17:00:00.000Z' } });
  });
  it('reports a cancelled event as gone', () => {
    expect(
      detectSealedCalendarChanges([sealed('m', 'e1', at)], snap([ev('other', '2026-11-23T15:30:00.000Z')])),
    ).toEqual({ m: { kind: 'gone' } });
  });
  it('reports a cancelled occurrence of a daily series as gone, not moved to the next day', () => {
    expect(
      detectSealedCalendarChanges(
        [sealed('m', 'series', at)],
        snap([ev('series', '2026-11-22T15:00:00.000Z'), ev('series', '2026-11-24T15:00:00.000Z')]),
      ),
    ).toEqual({ m: { kind: 'gone' } });
  });
  it('makes no claim without a read, from an empty read, or outside the window read', () => {
    expect(detectSealedCalendarChanges([sealed('m', 'e1', at)], null)).toEqual({});
    expect(detectSealedCalendarChanges([sealed('m', 'e1', at)], snap([]))).toEqual({});
    expect(
      detectSealedCalendarChanges([sealed('m', 'e1', '2026-12-30T15:00:00.000Z')], snap([ev('z', at)])),
    ).toEqual({});
  });
  it('ignores Moments that are not sealed, were cancelled or finished, or carry no link', () => {
    const base = sealed('m', 'e1', at);
    const read = snap([ev('z', at)]);
    const none = { ...base, preparation: undefined } as Moment;
    const cancelled = { ...base, preparation: { ...base.preparation!, cancelledAtIso: 'x' } } as Moment;
    const returned = { ...base, preparation: { ...base.preparation!, returnedAtIso: 'x' } } as Moment;
    const unlinked = { ...base, calendarSource: undefined } as Moment;
    expect(detectSealedCalendarChanges([none, cancelled, returned, unlinked], read)).toEqual({});
  });
  it('never edits the saved Moment', () => {
    const m = sealed('m', 'e1', at);
    const before = JSON.stringify(m);
    detectSealedCalendarChanges([m], snap([ev('e1', '2026-11-23T17:00:00.000Z')]));
    expect(JSON.stringify(m)).toBe(before);
  });
});

describe('time zones and daylight saving', () => {
  it('uses instants, so changing the device time zone changes nothing', () => {
    const original = process.env.TZ;
    try {
      const ids: string[] = [];
      for (const tz of ['America/New_York', 'Asia/Tokyo', 'Europe/London']) {
        process.env.TZ = tz;
        ids.push(calendarMomentId('e1', '2026-11-23T15:00:00.000Z'));
        expect(matchOccurrence({ eventId: 'e1', startAtIso: '2026-11-23T15:00:00.000Z' }, [
          { eventId: 'e1', startAtIso: '2026-11-23T10:00:00-05:00' },
        ]).kind).toBe('same');
      }
      expect(new Set(ids).size).toBe(1);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
  it('treats a one-hour shift at a daylight-saving change as a move, within the window', () => {
    // US spring forward 2026-03-08: a 9:00 local event is 14:00Z before, 13:00Z after.
    const before = '2026-03-08T14:00:00.000Z';
    const after = '2026-03-08T13:00:00.000Z';
    expect(matchOccurrence({ eventId: 'e', startAtIso: before }, [{ eventId: 'e', startAtIso: after }])).toEqual({
      kind: 'moved',
      toStartAtIso: after,
    });
    expect(3_600_000).toBeLessThan(OCCURRENCE_MOVE_WINDOW_MS);
  });
  it('keeps the two occurrences either side of the change distinct (23 hours apart)', () => {
    const sat = '2026-03-07T14:00:00.000Z';
    const sun = '2026-03-08T13:00:00.000Z';
    expect(occurrenceKey('e', sat)).not.toBe(occurrenceKey('e', sun));
    expect(matchOccurrence({ eventId: 'e', startAtIso: sat }, [{ eventId: 'e', startAtIso: sun }]).kind).toBe('gone');
  });
  it('reads a fixed number of hours around now, whatever the local day length', () => {
    const w = calendarReadWindow('2026-03-08T12:00:00.000Z', 2);
    expect(Date.parse(w.endIso) - Date.parse('2026-03-08T12:00:00.000Z')).toBe(48 * 3_600_000);
    expect(Date.parse('2026-03-08T12:00:00.000Z') - Date.parse(w.startIso)).toBe(6 * 3_600_000);
  });
});

describe('a moved event never reappears as a fresh suggestion beside its own plan', () => {
  const at = '2026-11-23T15:00:00.000Z';
  const cal = (id: string, startAtIso: string): Moment => ({
    id: calendarMomentId(id, startAtIso),
    source: 'calendar',
    title: 'Team meeting',
    type: 'work',
    importance: 'high',
    startAtIso,
    calendarEventId: id,
    createdAtIso: '2026-11-21T00:00:00.000Z',
  });
  it('hides the moved occurrence of a sealed plan', () => {
    const moved = cal('e1', '2026-11-23T17:00:00.000Z');
    const merged = mergeReviewedCalendarMoments([sealed('m', 'e1', at)], [moved]);
    expect(merged.map((m) => m.id)).toEqual(['m']);
  });
  it('still shows other occurrences of the series and unrelated events', () => {
    const nextWeek = cal('e1', '2026-11-30T15:00:00.000Z');
    const other = cal('e2', '2026-11-23T17:00:00.000Z');
    const merged = mergeReviewedCalendarMoments([sealed('m', 'e1', at)], [nextWeek, other]);
    expect(merged.map((m) => m.id)).toEqual(['m', nextWeek.id, other.id]);
  });
  it('shows the moved event again once the plan is cancelled', () => {
    const moved = cal('e1', '2026-11-23T17:00:00.000Z');
    const cancelled = {
      ...sealed('m', 'e1', at),
      preparation: { sealedAtIso: 'x', cancelledAtIso: 'y' } as Moment['preparation'],
    };
    expect(mergeReviewedCalendarMoments([cancelled], [moved]).map((m) => m.id)).toContain(moved.id);
  });
});
