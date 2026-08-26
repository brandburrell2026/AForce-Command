import { describe, it, expect, vi } from 'vitest';

// `services/uiFreeze.ts` imports `useFeatureFlags` from
// `@/store/useAppStore` at module scope (for the hidden
// `useHiddenUiFreeze()` hook, which this suite does not test).
// The store transitively reaches RN/Expo native edges (the `expo`
// winter runtime, expo-notifications, AsyncStorage) that fail to
// load under Vitest's Node environment. Per repo convention
// (see orbReasons.test.ts, realApi.intake.test.ts), stub the
// RN-touching edge minimally and test the real pure logic.
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({}),
}));

import {
  FROZEN_SURFACES,
  FROZEN_SURFACE_LABELS,
  UI_FREEZE_INVARIANTS,
  UiFreezeViolationError,
  assertUiFreeze,
  isFrozenSurface,
} from '../uiFreeze';

describe('uiFreeze — frozen surfaces', () => {
  it('lists the 14 spec surfaces in order', () => {
    expect(FROZEN_SURFACES).toEqual([
      'home',
      'orb',
      'timeline',
      'performanceSignal',
      'heatMap',
      'glowNodes',
      'journal',
      'hydroScan',
      'profile',
      'sleep',
      'community',
      'cards',
      'spacing',
      'graphs',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(FROZEN_SURFACE_LABELS.home).toBe('Home');
    expect(FROZEN_SURFACE_LABELS.orb).toBe('Orb');
    expect(FROZEN_SURFACE_LABELS.timeline).toBe('Timeline');
    expect(FROZEN_SURFACE_LABELS.performanceSignal).toBe('Performance Signal');
    expect(FROZEN_SURFACE_LABELS.heatMap).toBe('Heat map');
    expect(FROZEN_SURFACE_LABELS.glowNodes).toBe('Glow nodes');
    expect(FROZEN_SURFACE_LABELS.journal).toBe('Journal');
    expect(FROZEN_SURFACE_LABELS.hydroScan).toBe('HydroScan');
    expect(FROZEN_SURFACE_LABELS.profile).toBe('Profile');
    expect(FROZEN_SURFACE_LABELS.sleep).toBe('Sleep');
    expect(FROZEN_SURFACE_LABELS.community).toBe('Community');
    expect(FROZEN_SURFACE_LABELS.cards).toBe('Cards');
    expect(FROZEN_SURFACE_LABELS.spacing).toBe('Spacing');
    expect(FROZEN_SURFACE_LABELS.graphs).toBe('Graphs');
  });
});

describe('isFrozenSurface', () => {
  it('returns true for every frozen surface', () => {
    for (const s of FROZEN_SURFACES) expect(isFrozenSurface(s)).toBe(true);
  });

  it('returns false for unknown surfaces', () => {
    expect(isFrozenSurface('settings')).toBe(false);
    expect(isFrozenSurface('')).toBe(false);
  });
});

describe('UI_FREEZE_INVARIANTS', () => {
  it('lists the three spec prohibitions verbatim, in order', () => {
    expect(UI_FREEZE_INVARIANTS).toEqual([
      'No redesign.',
      'Do not move screens.',
      'Do not rebuild navigation.',
    ]);
  });
});

describe('assertUiFreeze', () => {
  it('is a no-op for empty intent', () => {
    expect(() => assertUiFreeze()).not.toThrow();
    expect(() => assertUiFreeze({})).not.toThrow();
  });

  it('is a no-op when every intent flag is false', () => {
    expect(() =>
      assertUiFreeze({
        redesign: false,
        moveScreen: false,
        rebuildNavigation: false,
      }),
    ).not.toThrow();
  });

  it('throws on redesign intent and names the violation', () => {
    expect.assertions(2);
    try {
      assertUiFreeze({ redesign: true });
    } catch (err) {
      expect(err).toBeInstanceOf(UiFreezeViolationError);
      expect((err as UiFreezeViolationError).violated).toEqual([
        'No redesign.',
      ]);
    }
  });

  it('throws on moveScreen intent and names the violation', () => {
    expect.assertions(1);
    try {
      assertUiFreeze({ moveScreen: true });
    } catch (err) {
      expect((err as UiFreezeViolationError).violated).toEqual([
        'Do not move screens.',
      ]);
    }
  });

  it('throws on rebuildNavigation intent and names the violation', () => {
    expect.assertions(1);
    try {
      assertUiFreeze({ rebuildNavigation: true });
    } catch (err) {
      expect((err as UiFreezeViolationError).violated).toEqual([
        'Do not rebuild navigation.',
      ]);
    }
  });

  it('reports multiple violations together, in spec order', () => {
    expect.assertions(2);
    try {
      assertUiFreeze({
        redesign: true,
        moveScreen: true,
        rebuildNavigation: true,
      });
    } catch (err) {
      expect((err as UiFreezeViolationError).violated).toEqual([
        'No redesign.',
        'Do not move screens.',
        'Do not rebuild navigation.',
      ]);
      expect((err as Error).name).toBe('UiFreezeViolationError');
    }
  });
});
