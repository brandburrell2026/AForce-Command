// @vitest-environment happy-dom
/**
 * JournalChart — reduced-motion gate on the three ambient oscillators
 * (RC-1 audit, P0): `breath` (halo), `drift` (vertical float), and `shimmer`
 * (trend-line opacity) were three ungated infinite `withRepeat(..., -1)`
 * loops with no reduced-motion check — they ran forever, including for users
 * who have motion reduction on. Unmount cleanup was already correct.
 *
 * Follows the harness + assertion pattern in
 * `components/__tests__/whoopSnapshotCard.render.test.tsx`: a spy-able
 * `react-native-reanimated` mock so the gate is asserted directly (which
 * primitives were invoked, and whether cleanup ran on unmount), plus stubs
 * for `react-native-svg` and `expo-haptics` — native rendering/haptics
 * surfaces irrelevant to the animation gate under test (same rationale as
 * Icon/react-native-svg mocks in the existing WHOOP + connected-health render
 * harnesses).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { View as RNView } from 'react-native';
import type { JournalSnapshot } from '@/types';

vi.mock('react-native-svg', () => {
  const stub = (name: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement('svg-stub', { ...props, 'data-stub': name, ref }, props.children as React.ReactNode),
    );
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Circle: stub('Circle'),
    Defs: stub('Defs'),
    LinearGradient: stub('LinearGradient'),
    Path: stub('Path'),
    RadialGradient: stub('RadialGradient'),
    Rect: stub('Rect'),
    Stop: stub('Stop'),
  };
});

vi.mock('expo-haptics', () => ({
  selectionAsync: vi.fn(() => Promise.resolve()),
}));

const { withTimingMock, withRepeatMock, cancelAnimationMock } = vi.hoisted(() => ({
  withTimingMock: vi.fn((value: number) => ({ __kind: 'timing', value })),
  withRepeatMock: vi.fn((anim: unknown) => ({ __kind: 'repeat', anim })),
  cancelAnimationMock: vi.fn(),
}));

vi.mock('react-native-reanimated', () => {
  function useSharedValue(initial: unknown) {
    const ref = React.useRef({ value: initial });
    return ref.current;
  }
  function useAnimatedProps(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  const Easing = {
    in: (e: unknown) => e,
    out: (e: unknown) => e,
    inOut: (e: unknown) => e,
    cubic: 'cubic',
    quad: 'quad',
    sin: 'sin',
  };
  const AnimatedNamespace = {
    View: RNView,
    createAnimatedComponent: (Component: unknown) => Component,
  };
  return {
    __esModule: true,
    default: AnimatedNamespace,
    useSharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    withTiming: withTimingMock,
    withRepeat: withRepeatMock,
    withSequence: vi.fn((...anims: unknown[]) => anims[0]),
    cancelAnimation: cancelAnimationMock,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    Easing,
  };
});

const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

import JournalChart from '../journal/JournalChart';

function fixtureData(n = 8): JournalSnapshot[] {
  const out: JournalSnapshot[] = [];
  const base = Date.parse('2026-07-01T00:00:00.000Z');
  for (let i = 0; i < n; i++) {
    out.push({ at: new Date(base + i * 86_400_000).toISOString(), score: 60 + i } as JournalSnapshot);
  }
  return out;
}

let host: HTMLElement;
let root: Root;

function renderChart(props: Partial<React.ComponentProps<typeof JournalChart>> = {}) {
  root = createRoot(host);
  const merged: React.ComponentProps<typeof JournalChart> = {
    data: fixtureData(),
    width: 320,
    weeklyCompliancePct: 80,
    complianceStreak: 4,
    ...props,
  };
  flushSync(() => root.render(React.createElement(JournalChart, merged)));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  useReducedMotionMock.mockReset();
  useReducedMotionMock.mockReturnValue(false);
  withTimingMock.mockClear();
  withRepeatMock.mockClear();
  cancelAnimationMock.mockClear();
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('JournalChart — three-oscillator reduced-motion gate (RC-1 P0)', () => {
  it('reduced motion OFF: starts all three ambient loops (breath, drift, shimmer)', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderChart();
    expect(withRepeatMock).toHaveBeenCalledTimes(3);
  });

  it('reduced motion ON: never starts any of the three loops', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderChart();
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('cancels all three shared-value animations on unmount, motion ON or OFF', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderChart();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(3);
  });

  it('cancels animations on unmount even under reduced motion (nothing was started, cleanup still runs)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderChart();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(3);
  });

  it('still renders the constellation (non-empty dataset) under reduced motion', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderChart();
    expect(host.querySelector('svg-stub[data-stub="Svg"]')).not.toBeNull();
  });
});
