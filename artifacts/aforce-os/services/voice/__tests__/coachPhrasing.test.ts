import { describe, it, expect } from 'vitest';
import {
  coachEyebrow,
  coachLead,
  formatCommandForCoach,
  preservesCommandSubstance,
} from '../coachPhrasing';
import { AFORCE_VOICES } from '@/services/voiceCatalog';
import { isCompliantCoachLine } from '@/utils/intelligence/conversationalLanguage';

const ARCHETYPES = ['push', 'precision', 'ignite', 'recovery'] as const;

describe('coachEyebrow / coachLead', () => {
  it('gives each archetype a distinct eyebrow + lead', () => {
    expect(new Set(ARCHETYPES.map(coachEyebrow)).size).toBe(4);
    expect(new Set(ARCHETYPES.map(coachLead)).size).toBe(4);
  });
  it('every shipped coach archetype resolves', () => {
    for (const v of AFORCE_VOICES) {
      expect(coachEyebrow(v.archetype)).toBeTruthy();
      expect(coachLead(v.archetype)).toBeTruthy();
    }
  });
});

describe('preservesCommandSubstance', () => {
  it('passes when all dose/timing tokens survive', () => {
    expect(preservesCommandSubstance('Drink 12 oz water', 'Lock in. Drink 12 oz water')).toBe(true);
  });
  it('fails if a dose token is dropped or altered', () => {
    expect(preservesCommandSubstance('Drink 12 oz water', 'Drink 16 oz water')).toBe(false);
    expect(preservesCommandSubstance('Recheck in 15 min', 'Recheck soon')).toBe(false);
  });
});

describe('formatCommandForCoach — phrasing only, substance identical across coaches', () => {
  const CMD = 'Drink 12 oz water';

  it('re-voices with a coach lead while preserving the exact dose', () => {
    const push = formatCommandForCoach(CMD, 'push');
    expect(push).not.toBe(CMD); // tone was added
    expect(push).toContain('12 oz'); // dose intact
    expect(preservesCommandSubstance(CMD, push)).toBe(true);
  });

  it('produces DIFFERENT tone per coach but the SAME command substance', () => {
    const outs = ARCHETYPES.map((a) => formatCommandForCoach(CMD, a));
    expect(new Set(outs).size).toBe(4); // four distinct phrasings
    for (const out of outs) {
      expect(preservesCommandSubstance(CMD, out)).toBe(true); // dose never changes
      expect(isCompliantCoachLine(out)).toBe(true); // §64 clean
    }
  });

  it('every coach output is Section-64 compliant', () => {
    for (const a of ARCHETYPES) {
      expect(isCompliantCoachLine(formatCommandForCoach('Start with water. 20 oz now.', a))).toBe(true);
    }
  });

  it('fail-safes to the original for empty / whitespace input (never invents a command)', () => {
    expect(formatCommandForCoach('', 'push')).toBe('');
    expect(formatCommandForCoach('   ', 'ignite')).toBe('   ');
  });
});
