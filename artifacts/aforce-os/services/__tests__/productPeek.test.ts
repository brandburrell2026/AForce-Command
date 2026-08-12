import { describe, it, expect, vi } from 'vitest';

// `services/productPeek.ts` imports `useFeatureFlags` from
// `@/store/useAppStore` at module scope (for the untested
// `useHiddenProductPeek` hook), which transitively reaches RN/Expo
// native modules ('expo' winter runtime, expo-notifications,
// AsyncStorage) that fail to load under Vitest's Node environment.
// Mirroring the repo convention (see coachModeResolution.test.ts),
// stub that single RN-touching edge with the minimal shape the module
// reads; every constant/function under test here is pure and real.
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({}),
}));

import {
  PEEK_BLOCKED_ACTIONS,
  PEEK_LINKS,
  PEEK_LINK_LABELS,
  PEEK_VISUAL,
  derivePeekTransform,
  isPeekActionAllowed,
} from '../productPeek';

describe('productPeek — spec visual constants', () => {
  it('scales to 150% per spec "Grow 150%"', () => {
    expect(PEEK_VISUAL.scale).toBe(1.5);
  });

  it('applies a blur radius (spec "Blur")', () => {
    expect(PEEK_VISUAL.blurRadius).toBeGreaterThan(0);
  });

  it('applies a soft glow with sub-1 opacity (spec "Soft glow")', () => {
    expect(PEEK_VISUAL.glowOpacity).toBeGreaterThan(0);
    expect(PEEK_VISUAL.glowOpacity).toBeLessThan(1);
  });

  it('uses a multi-second period for "Slow float"', () => {
    expect(PEEK_VISUAL.floatDurationMs).toBeGreaterThanOrEqual(3000);
    expect(PEEK_VISUAL.floatAmplitudePx).toBeGreaterThan(0);
  });
});

describe('productPeek — link table', () => {
  it('exposes exactly the four spec KEEP links', () => {
    expect(Object.keys(PEEK_LINKS).sort()).toEqual(
      ['export', 'share', 'story', 'website'].sort(),
    );
  });

  it('routes website to drinkaforce.com verbatim', () => {
    expect(PEEK_LINKS.website).toBe('https://drinkaforce.com');
  });

  it('exposes a human label for every link', () => {
    for (const key of Object.keys(PEEK_LINKS) as Array<keyof typeof PEEK_LINKS>) {
      expect(PEEK_LINK_LABELS[key]).toBeTruthy();
    }
  });
});

describe('isPeekActionAllowed', () => {
  it('allows the four KEEP actions', () => {
    expect(isPeekActionAllowed('website')).toBe(true);
    expect(isPeekActionAllowed('share')).toBe(true);
    expect(isPeekActionAllowed('story')).toBe(true);
    expect(isPeekActionAllowed('export')).toBe(true);
  });

  it('denies every commerce action (spec "No buy button.")', () => {
    for (const action of PEEK_BLOCKED_ACTIONS) {
      expect(isPeekActionAllowed(action)).toBe(false);
    }
  });

  it('denies unknown actions by default', () => {
    expect(isPeekActionAllowed('unknown')).toBe(false);
    expect(isPeekActionAllowed('')).toBe(false);
  });
});

describe('derivePeekTransform', () => {
  it('holds scale constant at the spec 150%', () => {
    for (const t of [0, 1000, 3000, 6000, 9000]) {
      expect(derivePeekTransform(t).scale).toBe(1.5);
    }
  });

  it('starts at translateY = 0 at t=0', () => {
    expect(derivePeekTransform(0).translateY).toBeCloseTo(0, 10);
  });

  it('peaks near the spec amplitude at quarter-period', () => {
    const quarter = PEEK_VISUAL.floatDurationMs / 4;
    expect(derivePeekTransform(quarter).translateY).toBeCloseTo(
      PEEK_VISUAL.floatAmplitudePx,
      5,
    );
  });

  it('returns to 0 at half-period (sine zero crossing)', () => {
    const half = PEEK_VISUAL.floatDurationMs / 2;
    expect(derivePeekTransform(half).translateY).toBeCloseTo(0, 5);
  });

  it('reaches negative amplitude at three-quarter period', () => {
    const threeQuarter = (3 * PEEK_VISUAL.floatDurationMs) / 4;
    expect(derivePeekTransform(threeQuarter).translateY).toBeCloseTo(
      -PEEK_VISUAL.floatAmplitudePx,
      5,
    );
  });

  it('is periodic with the spec period', () => {
    const p = PEEK_VISUAL.floatDurationMs;
    expect(derivePeekTransform(p).translateY).toBeCloseTo(
      derivePeekTransform(0).translateY,
      5,
    );
  });
});
