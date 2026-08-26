// @vitest-environment happy-dom
/**
 * StreakHero — NON-SHIPPING render harness (VS 3.0 P2 Journal slice A).
 *
 * Ported off legacy Colors.* + `${LIME}NN` opacity concat + raw #FFFFFF/rgba
 * onto af.* (LIME = af.green, byte-identical to Colors.states.PEAK.primary).
 * Pins that the headline + sub copy still render, and — since Wave-5 removed
 * the pulsing halo — that this card starts NO animation at all. The reanimated
 * mock is kept (spy-able) precisely so that absence can be asserted rather
 * than assumed; Icon is stubbed so the card mounts headless.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { View as RNView } from 'react-native';

const { withTimingMock, withRepeatMock } = vi.hoisted(() => ({
  withTimingMock: vi.fn((v: unknown) => v),
  withRepeatMock: vi.fn((v: unknown) => v),
}));

vi.mock('react-native-reanimated', () => {
  function useSharedValue(initial: unknown) {
    const ref = React.useRef({ value: initial });
    return ref.current;
  }
  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    try { return fn(); } catch { return {}; }
  }
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: (C: unknown) => C },
    useSharedValue,
    useAnimatedStyle,
    withTiming: withTimingMock,
    withRepeat: withRepeatMock,
    cancelAnimation: vi.fn(),
    Easing: { inOut: (e: unknown) => e, quad: 'quad' },
  };
});
vi.mock('@/components/Icon', () => ({ Icon: () => null }));

import StreakHero from '../StreakHero';
import { streakHeroHeadline, streakHeroSub } from '@/utils/streak/streakCopy';

let host: HTMLElement;
let root: Root;

function render(streakDays: number) {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(StreakHero, { streakDays })));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  withTimingMock.mockClear();
  withRepeatMock.mockClear();
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('StreakHero — VS 3.0 P2 token migration', () => {
  it('renders the streak headline and sub copy for the given day count', () => {
    render(5);
    const t = host.textContent ?? '';
    expect(t).toContain(streakHeroHeadline(5));
    expect(t).toContain(streakHeroSub(5));
  });
});

describe('StreakHero — the pulsing halo is GONE (Wave-5)', () => {
  // It was a `withRepeat(..., -1)` glow with NO reduced-motion gate at all, on
  // a card whose own doc-comment promises "calm, not gamified". The founder's
  // motion brief removes constant pulsing rather than tuning it down, so this
  // card must now start nothing — which is also why it needs no gate.
  it('starts no animation of any kind', () => {
    render(5);
    expect(withRepeatMock).not.toHaveBeenCalled();
    expect(withTimingMock).not.toHaveBeenCalled();
  });

  it('renders at every streak value without animating', () => {
    for (const days of [0, 1, 30]) {
      render(days);
      expect(withRepeatMock).not.toHaveBeenCalled();
      flushSync(() => root.unmount());
    }
    // Re-render so the shared afterEach unmount has a live root to tear down.
    render(5);
  });
});
