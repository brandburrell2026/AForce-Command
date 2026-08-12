import { describe, it, expect, vi } from 'vitest';

// hydroJournal imports useFeatureFlags from the app store, which
// transitively pulls RN/Expo-native edges (expo winter runtime,
// expo-notifications, AsyncStorage) that are unparseable in node.
// Repo convention (see coachModeResolution.test.ts): stub the store
// edge minimally; every helper under test here is pure and untouched.
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({}),
}));

import {
  JOURNAL_SOURCES,
  JOURNAL_SOURCE_LABELS,
  RECOVERY_CONTRIBUTORS,
  RECOVERY_CONTRIBUTOR_LABELS,
  normalizeContributors,
  summarizeMemory,
  topContributor,
} from '../hydroJournal';

describe('hydroJournal — journal sources', () => {
  it('lists the seven spec sources in order', () => {
    expect(JOURNAL_SOURCES).toEqual([
      'timeline',
      'commands',
      'hydration',
      'mood',
      'water',
      'recovery',
      'orb',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(JOURNAL_SOURCE_LABELS.timeline).toBe('Timeline');
    expect(JOURNAL_SOURCE_LABELS.commands).toBe('Commands');
    expect(JOURNAL_SOURCE_LABELS.hydration).toBe('Hydration');
    expect(JOURNAL_SOURCE_LABELS.mood).toBe('Mood');
    expect(JOURNAL_SOURCE_LABELS.water).toBe('Water');
    expect(JOURNAL_SOURCE_LABELS.recovery).toBe('Recovery');
    expect(JOURNAL_SOURCE_LABELS.orb).toBe('Orb');
  });
});

describe('hydroJournal — recovery contributors', () => {
  it('lists the four spec contributors in order', () => {
    expect(RECOVERY_CONTRIBUTORS).toEqual([
      'water',
      'timing',
      'minerals',
      'environment',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(RECOVERY_CONTRIBUTOR_LABELS.water).toBe('Water');
    expect(RECOVERY_CONTRIBUTOR_LABELS.timing).toBe('Timing');
    expect(RECOVERY_CONTRIBUTOR_LABELS.minerals).toBe('Minerals');
    expect(RECOVERY_CONTRIBUTOR_LABELS.environment).toBe('Environment');
  });
});

describe('normalizeContributors', () => {
  it('returns null for empty / all-zero input', () => {
    expect(normalizeContributors({})).toBeNull();
    expect(
      normalizeContributors({
        water: 0,
        timing: 0,
        minerals: 0,
        environment: 0,
      }),
    ).toBeNull();
  });

  it('clamps negatives to zero', () => {
    expect(
      normalizeContributors({
        water: -5,
        timing: 0,
        minerals: 0,
        environment: 0,
      }),
    ).toBeNull();
  });

  it('assigns 100 to a single contributor', () => {
    expect(normalizeContributors({ water: 1 })).toEqual({
      water: 100,
      timing: 0,
      minerals: 0,
      environment: 0,
    });
  });

  it('splits evenly when all four are equal', () => {
    expect(
      normalizeContributors({
        water: 1,
        timing: 1,
        minerals: 1,
        environment: 1,
      }),
    ).toEqual({ water: 25, timing: 25, minerals: 25, environment: 25 });
  });

  it('always sums to exactly 100 (rounding distribution)', () => {
    const out = normalizeContributors({
      water: 1,
      timing: 1,
      minerals: 1,
      environment: 0,
    })!;
    expect(out.water + out.timing + out.minerals + out.environment).toBe(100);
  });

  it('hands rounding remainder out in spec order', () => {
    const out = normalizeContributors({
      water: 1,
      timing: 1,
      minerals: 1,
      environment: 0,
    })!;
    // 100/3 = 33.33 → floors to 33 each, 1 remainder → water gets it
    expect(out.water).toBe(34);
    expect(out.timing).toBe(33);
    expect(out.minerals).toBe(33);
    expect(out.environment).toBe(0);
  });
});

describe('topContributor', () => {
  it('returns the highest-weighted contributor', () => {
    expect(
      topContributor({ water: 10, timing: 70, minerals: 15, environment: 5 }),
    ).toBe('timing');
  });

  it('breaks ties in spec order', () => {
    expect(
      topContributor({ water: 50, timing: 50, minerals: 0, environment: 0 }),
    ).toBe('water');
    expect(
      topContributor({ water: 0, timing: 50, minerals: 50, environment: 0 }),
    ).toBe('timing');
  });

  it('returns null when every weight is zero', () => {
    expect(
      topContributor({ water: 0, timing: 0, minerals: 0, environment: 0 }),
    ).toBeNull();
  });
});

describe('summarizeMemory', () => {
  it('reports zero connected and full missing list for empty input', () => {
    const s = summarizeMemory([]);
    expect(s.connectedCount).toBe(0);
    expect(s.missing).toEqual(JOURNAL_SOURCES);
  });

  it('reports all seven connected with no missing', () => {
    const s = summarizeMemory(JOURNAL_SOURCES);
    expect(s.connectedCount).toBe(7);
    expect(s.missing).toEqual([]);
  });

  it('lists missing sources in spec order', () => {
    const s = summarizeMemory(['water', 'orb']);
    expect(s.connectedCount).toBe(2);
    expect(s.missing).toEqual([
      'timeline',
      'commands',
      'hydration',
      'mood',
      'recovery',
    ]);
  });

  it('accepts a Set as well as an array', () => {
    const s = summarizeMemory(new Set(['timeline', 'orb'] as const));
    expect(s.connectedCount).toBe(2);
  });
});
