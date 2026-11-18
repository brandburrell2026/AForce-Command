/**
 * Bottom-bar orb geometry (Screen Upgrade v1.1 §1: 64pt, raised 12pt).
 * The orb must be whole on every phone, including ones with no home indicator.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ORB_SIZE,
  ORB_RAISE,
  ORB_MIN_BOTTOM_GAP,
  TAB_BAR_ROW_HEIGHT,
  oneBreathOrbRaise,
  oneBreathTabHitSlop,
} from '../navigation/oneBreathOrbGeometry';

const layout = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');

/** Distance from the orb's bottom edge to the bottom of the screen. */
const bottomGap = (inset: number) => TAB_BAR_ROW_HEIGHT + inset - (ORB_SIZE - oneBreathOrbRaise(inset));

describe('One Breath orb geometry', () => {
  it('matches the spec constants used by the bar', () => {
    expect(ORB_SIZE).toBe(64);
    expect(ORB_RAISE).toBe(12);
    expect(layout).toContain('export const ONE_BREATH_ORB_SIZE = 64;');
    expect(layout).toContain('export const ONE_BREATH_ORB_RAISE = 12;');
  });

  it('is raised exactly 12pt on phones with a home indicator', () => {
    for (const inset of [20, 21, 34]) expect(oneBreathOrbRaise(inset)).toBe(12);
  });

  it('is raised further, never less, where there is no room below', () => {
    expect(oneBreathOrbRaise(0)).toBe(19);
    expect(oneBreathOrbRaise(0)).toBeGreaterThanOrEqual(ORB_RAISE);
  });

  it('is never cut off at the bottom of the screen', () => {
    for (const inset of [0, 2, 8, 16, 21, 34, 48]) {
      expect(bottomGap(inset)).toBeGreaterThanOrEqual(ORB_MIN_BOTTOM_GAP);
    }
  });

  it('treats a missing or bad inset as no inset', () => {
    expect(oneBreathOrbRaise(Number.NaN)).toBe(oneBreathOrbRaise(0));
    expect(oneBreathOrbRaise(-10)).toBe(oneBreathOrbRaise(0));
  });

  it('the touch area above the centre tab covers the raised part', () => {
    expect(oneBreathTabHitSlop(34)).toEqual({ top: 12 });
    expect(oneBreathTabHitSlop(0)).toEqual({ top: 19 });
  });

  it('the bar uses both rules for the centre tab', () => {
    expect(layout).toContain('oneBreathOrbRaise(useSafeAreaInsets().bottom)');
    expect(layout).toContain('{ top: -raise }');
    expect(layout).toContain('hitSlop={oneBreathTabHitSlop(bottomInset)}');
  });
});
