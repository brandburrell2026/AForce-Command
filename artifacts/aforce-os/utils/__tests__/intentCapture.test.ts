import { describe, it, expect } from 'vitest';

import {
  INTENT_IDS,
  INTENT_SOURCES,
  coachingPostureForIntent,
  isIntentId,
  isIntentSource,
  type IntentId,
} from '../intentCapture';

describe('intentCapture · isIntentId', () => {
  it('accepts the three known intents', () => {
    for (const id of INTENT_IDS) expect(isIntentId(id)).toBe(true);
    expect(INTENT_IDS).toEqual(['ready', 'recovering', 'notToday']);
  });

  it('rejects unknown / non-string values', () => {
    expect(isIntentId('nope')).toBe(false);
    expect(isIntentId('')).toBe(false);
    expect(isIntentId(null)).toBe(false);
    expect(isIntentId(undefined)).toBe(false);
    expect(isIntentId(3)).toBe(false);
  });
});

describe('intentCapture · isIntentSource', () => {
  it('accepts known sources, rejects others', () => {
    for (const s of INTENT_SOURCES) expect(isIntentSource(s)).toBe(true);
    expect(isIntentSource('whatever')).toBe(false);
    expect(isIntentSource(null)).toBe(false);
  });
});

describe('intentCapture · coachingPostureForIntent', () => {
  it('maps ready -> push', () => {
    expect(coachingPostureForIntent('ready')).toEqual({
      intensity: 'push',
      toneKey: 'ready',
    });
  });

  it('maps recovering -> steady', () => {
    expect(coachingPostureForIntent('recovering')).toEqual({
      intensity: 'steady',
      toneKey: 'recovering',
    });
  });

  it('maps notToday -> protect', () => {
    expect(coachingPostureForIntent('notToday')).toEqual({
      intensity: 'protect',
      toneKey: 'notToday',
    });
  });

  it('returns a NEUTRAL posture for null/undefined — never fabricates "ready"', () => {
    const neutral = { intensity: 'steady', toneKey: 'neutral' };
    expect(coachingPostureForIntent(null)).toEqual(neutral);
    expect(coachingPostureForIntent(undefined)).toEqual(neutral);
  });

  it('is total over every known intent', () => {
    for (const id of INTENT_IDS as readonly IntentId[]) {
      const p = coachingPostureForIntent(id);
      expect(['push', 'steady', 'protect']).toContain(p.intensity);
      expect(p.toneKey).toBe(id);
    }
  });
});
