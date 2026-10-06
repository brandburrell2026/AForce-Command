/**
 * Opening logic — one relevant suggestion, one reason, no inference from absence.
 */
import { describe, it, expect } from 'vitest';
import { firstSentence, pickSuggestedQuestion, recheckMinutesFrom, SUGGESTED_KEYS } from '../openingLogic';

const base = {
  intake: { ozToday: 40, ozTarget: 96, unitsToday: 3, unitsTarget: 8, lastIntakeMinutesAgo: 60, provenance: 'logged' as const, loggedToday: true },
  hydroState: { score: 72, level: 'BALANCED' as const, urgency: 'moderate' as const, evidence: 'ready' as const },
  localTime: { iso: '2026-10-05T14:00:00-04:00', timeZone: 'America/New_York', hour: 14 },
  providers: [],
};

describe('pickSuggestedQuestion', () => {
  it('nothing logged → the ritual question (a habit, never a body-state conclusion)', () => {
    expect(pickSuggestedQuestion({ ...base, intake: { ...base.intake, loggedToday: false, unitsToday: 0, ozToday: 0 } })).toBe('ritual');
  });
  it('lower bands → explain the target', () => {
    expect(pickSuggestedQuestion({ ...base, hydroState: { ...base.hydroState, level: 'RECOVERING' } })).toBe('target');
    expect(pickSuggestedQuestion({ ...base, hydroState: { ...base.hydroState, level: 'DEPLETED' } })).toBe('target');
  });
  it('evening → sleep; early morning → workout; otherwise focus', () => {
    expect(pickSuggestedQuestion({ ...base, localTime: { ...base.localTime, hour: 21 } })).toBe('sleep');
    expect(pickSuggestedQuestion({ ...base, localTime: { ...base.localTime, hour: 6 } })).toBe('workout');
    expect(pickSuggestedQuestion(base)).toBe('focus');
  });
  it('always returns one of the six registered questions', () => {
    for (const h of [0, 6, 12, 19, 23]) {
      expect(SUGGESTED_KEYS).toContain(pickSuggestedQuestion({ ...base, localTime: { ...base.localTime, hour: h } }));
    }
  });
});

describe('firstSentence / recheckMinutesFrom', () => {
  it('keeps one sentence of the engine explanation', () => {
    expect(firstSentence('Behind pace since the 11:40 log. Heat is adding demand. Recheck soon.')).toBe('Behind pace since the 11:40 log.');
    expect(firstSentence('No punctuation here')).toBe('No punctuation here');
    expect(firstSentence('')).toBeNull();
    expect(firstSentence(undefined)).toBeNull();
  });
  it('exposes the engine recheck clock only when it is a positive number', () => {
    expect(recheckMinutesFrom({ command: { action: 'x', explanation: '', urgencyLevel: 'medium', guard: 'approved', recheckInMinutes: 20 } })).toBe(20);
    expect(recheckMinutesFrom({ command: { action: 'x', explanation: '', urgencyLevel: 'medium', guard: 'approved', recheckInMinutes: 0 } })).toBeNull();
    expect(recheckMinutesFrom({ command: null })).toBeNull();
  });
});
