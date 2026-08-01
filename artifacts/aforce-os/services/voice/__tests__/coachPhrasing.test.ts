import { describe, it, expect } from 'vitest';
import {
  coachEyebrow,
  coachLead,
  formatCommandForCoach,
  formatSpokenLineForCoach,
  preservesCommandSubstance,
} from '../coachPhrasing';
import { AFORCE_VOICES } from '@/services/voiceCatalog';
import { isCompliantCoachLine } from '@/utils/intelligence/conversationalLanguage';
import {
  scoreBandLine,
  riskTimerLine,
  getCompletionRewardLines,
  RISK_THRESHOLDS,
} from '../commandVoice';

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

describe('formatSpokenLineForCoach — TTS line banks (delivery-only)', () => {
  // The full set of engine-authored spoken lines, across all bands/thresholds/rewards.
  const SPOKEN_LINES: string[] = [
    ...[100, 80, 60, 40, 10].flatMap((s) =>
      (['calm', 'standard', 'pressure'] as const).map((i) => scoreBandLine(s, i)),
    ),
    ...RISK_THRESHOLDS.flatMap((th) =>
      (['calm', 'standard', 'pressure'] as const).map((i) => riskTimerLine(th, i)),
    ),
    ...getCompletionRewardLines(),
  ];

  it('re-voices every shipped spoken line without dropping substance or breaking §64', () => {
    for (const line of SPOKEN_LINES) {
      for (const a of ARCHETYPES) {
        const out = formatSpokenLineForCoach(line, a);
        expect(preservesCommandSubstance(line, out)).toBe(true); // dose/timing intact
        expect(isCompliantCoachLine(out)).toBe(true); // observation-only guard holds
      }
    }
  });

  it('produces a distinct coach tone per archetype for the same line', () => {
    const line = scoreBandLine(40, 'standard'); // "Recovery window open. ..."
    const outs = ARCHETYPES.map((a) => formatSpokenLineForCoach(line, a));
    expect(new Set(outs).size).toBe(4);
    for (const out of outs) expect(out).not.toBe(line); // tone was layered on
  });

  it('preserves the exact dose token in a risk line ("Twelve ounces. AForce. Now.")', () => {
    const line = riskTimerLine(0, 'pressure');
    const out = formatSpokenLineForCoach(line, 'push');
    expect(preservesCommandSubstance(line, out)).toBe(true);
  });

  it('fail-safes to the original for empty input (never fabricates an alert)', () => {
    expect(formatSpokenLineForCoach('', 'push')).toBe('');
    expect(formatSpokenLineForCoach('   ', 'recovery')).toBe('   ');
  });
});
