import { describe, it, expect, vi } from 'vitest';

// `services/coachMode.ts` also exports `useCoachMode()` / `useCoachModeSetting()`,
// which pull in `@react-native-async-storage/async-storage` and
// `@/store/useAppStore` at module scope. Both transitively reach RN/Expo
// native modules that fail to load under Vitest's Node environment (see
// governance/TEST-BASELINE.md §3, Cause A — the 13 documented
// `__DEV__` module-load-failure files, of which `coachMode.test.ts` is one).
//
// `resolveEffectiveCoachMode()` is a pure function with none of those
// dependencies, so — mirroring the mock-the-RN-touching-deps shape
// `textToSpeech.test.ts` uses to test `speak()` in isolation — stub both
// modules before importing, and test the pure formula in a file that
// actually executes.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({}),
}));

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
