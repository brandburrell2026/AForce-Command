import { describe, it, expect } from 'vitest';
import {
  COACH_MICROCOPY,
  COACH_MODES,
  DEFAULT_COACH_MODE,
  resolveEffectiveCoachMode,
  shouldHaptic,
  shouldSpeak,
  type CoachMode,
} from '../coachMode';

describe('coachMode — pure helpers', () => {
  it('declares exactly three modes in spec order', () => {
    expect(COACH_MODES).toEqual(['silent', 'ambient', 'spoken']);
  });

  it('defaults to ambient per spec', () => {
    expect(DEFAULT_COACH_MODE).toBe('ambient');
  });

  it('shouldSpeak is true only for spoken', () => {
    const cases: Array<[CoachMode, boolean]> = [
      ['silent', false],
      ['ambient', false],
      ['spoken', true],
    ];
    for (const [mode, expected] of cases) {
      expect(shouldSpeak(mode)).toBe(expected);
    }
  });

  it('shouldHaptic is false only for silent', () => {
    const cases: Array<[CoachMode, boolean]> = [
      ['silent', false],
      ['ambient', true],
      ['spoken', true],
    ];
    for (const [mode, expected] of cases) {
      expect(shouldHaptic(mode)).toBe(expected);
    }
  });

  it('exposes the four spec microcopy phrases verbatim', () => {
    expect(COACH_MICROCOPY.recover).toBe('Recover now');
    expect(COACH_MICROCOPY.water).toBe('Water first');
    expect(COACH_MICROCOPY.rising).toBe('Signal rising');
    expect(COACH_MICROCOPY.meeting).toBe('Meeting aware');
  });

  it('microcopy phrases stay under 12 words each (spec voice constraint)', () => {
    for (const phrase of Object.values(COACH_MICROCOPY)) {
      expect(phrase.split(/\s+/).length).toBeLessThanOrEqual(12);
    }
  });
});

// `resolveEffectiveCoachMode` is the shared formula behind BOTH
// `useCoachMode()` (used by the two Hydration Scan screens) and
// `CoachModeVoiceSync` (which mirrors it into `textToSpeech.speak()`'s
// gate). Testing it here as a pure function locks the exact rule those
// two consumers can never legitimately disagree on.
describe('resolveEffectiveCoachMode — shared useCoachMode()/CoachModeVoiceSync formula', () => {
  it('falls back to spoken while spec_coachV2 is off, regardless of the stored mode', () => {
    const modes: CoachMode[] = ['silent', 'ambient', 'spoken'];
    for (const stored of modes) {
      expect(resolveEffectiveCoachMode(false, stored)).toBe('spoken');
    }
  });

  it('returns the stored mode once spec_coachV2 is on', () => {
    const modes: CoachMode[] = ['silent', 'ambient', 'spoken'];
    for (const stored of modes) {
      expect(resolveEffectiveCoachMode(true, stored)).toBe(stored);
    }
  });
});
