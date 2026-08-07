// @vitest-environment happy-dom
/**
 * StreakHero — NON-SHIPPING render harness (VS 3.0 P2 Journal slice A).
 *
 * Ported off legacy Colors.* + `${LIME}NN` opacity concat + raw #FFFFFF/rgba
 * onto af.* (LIME = af.green, byte-identical to Colors.states.PEAK.primary).
 * Pins that the headline + sub copy still render. reanimated (the pulsing halo)
 * and Icon are stubbed so the card mounts headless.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { View as RNView } from 'react-native';

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
    withTiming: vi.fn((v: unknown) => v),
    withRepeat: vi.fn((v: unknown) => v),
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
