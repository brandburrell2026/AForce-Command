/**
 * momentClassification — unit tests for the DR-011 honesty contract:
 * confidence-gated keyword classification, category toggles filter, all-day
 * and unparseable events skip, unmatched titles skip (never guessed), and
 * titleless events surface masked as neutral PRIVATE EVENT moments.
 */
import { describe, it, expect } from 'vitest';

import {
  classifyCalendarEvent,
  type CalendarEventLike,
} from '@/services/momentClassification';

const ALL = ['work', 'training', 'travel'] as const;

function event(title: string | null, overrides: Partial<CalendarEventLike> = {}): CalendarEventLike {
  return {
    id: 'e1',
    title,
    startAtIso: '2026-08-13T18:00:00.000Z',
    calendarId: 'c1',
    ...overrides,
  };
}

describe('classifyCalendarEvent — category matching', () => {
  it('classifies the founder-spec vocabulary with default importances', () => {
    expect(classifyCalendarEvent(event('Investor Meeting'), ALL)).toMatchObject({
      kind: 'moment', type: 'work', importance: 'high', masked: false,
    });
    expect(classifyCalendarEvent(event('Evening run'), ALL)).toMatchObject({
      kind: 'moment', type: 'training', importance: 'high',
    });
    expect(classifyCalendarEvent(event('Flight to Denver'), ALL)).toMatchObject({
      kind: 'moment', type: 'travel', importance: 'moderate',
    });
    expect(classifyCalendarEvent(event('Keynote talk'), ALL)).toMatchObject({
      kind: 'moment', type: 'performance', importance: 'high',
    });
    expect(classifyCalendarEvent(event('Massage'), ALL)).toMatchObject({
      kind: 'moment', type: 'recovery', importance: 'moderate',
    });
  });

  it('matches whole words only — no substring false positives', () => {
    // "trainee" must not match "train"; "scallop" must not match "call".
    expect(classifyCalendarEvent(event('Trainee onboarding docs'), ALL).kind).toBe('skip');
    expect(classifyCalendarEvent(event('Scallop dinner'), ALL).kind).toBe('skip');
  });
});

describe('classifyCalendarEvent — honesty gates', () => {
  it('skips unmatched titles rather than guessing', () => {
    expect(classifyCalendarEvent(event('Pick up dry cleaning'), ALL)).toEqual({
      kind: 'skip', reason: 'low_confidence',
    });
  });

  it('respects category toggles (work off → meetings skip as disabled)', () => {
    expect(classifyCalendarEvent(event('Team meeting'), ['training', 'travel'])).toEqual({
      kind: 'skip', reason: 'category_disabled',
    });
  });

  it('skips all-day and unparseable events', () => {
    expect(classifyCalendarEvent(event('Team meeting', { allDay: true }), ALL)).toEqual({
      kind: 'skip', reason: 'all_day',
    });
    expect(classifyCalendarEvent(event('Team meeting', { startAtIso: 'nope' }), ALL)).toEqual({
      kind: 'skip', reason: 'bad_time',
    });
  });

  it('masks titleless events as neutral PRIVATE EVENT moments', () => {
    expect(classifyCalendarEvent(event(null), ALL)).toMatchObject({
      kind: 'moment', type: 'personal', importance: 'moderate', masked: true,
    });
    expect(classifyCalendarEvent(event('   '), ALL)).toMatchObject({ kind: 'moment', masked: true });
    // Everything toggled off → nothing surfaces, masked or not.
    expect(classifyCalendarEvent(event(null), [])).toEqual({
      kind: 'skip', reason: 'no_categories',
    });
  });
});
