// @vitest-environment happy-dom
/**
 * JournalChart motion harness.
 *
 * RC-1 (P0) gated three ungated infinite `withRepeat(..., -1)` oscillators —
 * `breath` (halo), `drift` (vertical float), `shimmer` (trend-line opacity) —
 * on reduced motion. Wave-5 DELETED all three per the founder's motion brief
 * (decorative loops are removed, not tuned down), so this file now pins their
 * absence plus the reduced-motion + teardown contract on the one motion that
 * survives: the range-switch crossfade.
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

describe('JournalChart — the three ambient oscillators are GONE (Wave-5)', () => {
  // Strictly stronger than the RC-1 gate this replaces: there is no unbounded
  // loop left to gate, in either motion mode. `breath` / `drift` / `shimmer`
  // were the chart's only `withRepeat` calls, so "never called" is the
  // regression guard against them coming back.
  it('reduced motion OFF: starts no ambient loop at all', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderChart();
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('reduced motion ON: starts no ambient loop either', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderChart();
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('cancels the surviving crossfade on unmount, motion ON or OFF', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderChart();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(1);
  });

  it('cancels on unmount even under reduced motion (nothing was started, cleanup still runs)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderChart();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(1);
  });

  it('still renders the constellation (non-empty dataset) under reduced motion', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderChart();
    expect(host.querySelector('svg-stub[data-stub="Svg"]')).not.toBeNull();
  });
});

/* ═══════════════ MODEL BOUNDARY — rendered strokes, not vocabulary ═══════════
 *
 * The PR-3 remediation's chart law is a source-routing regex. It catches a
 * wholesale revert of the component (verified), but a regex asserts vocabulary:
 * a mutation that keeps every identifier and rejoins the strokes survives it.
 *
 * These laws render the component and count the actual <Path> elements, so the
 * invariant "no path is drawn across a model boundary" is asserted on what the
 * member would actually see.
 */
describe('JournalChart — no stroke crosses a model boundary (rendered)', () => {
  const V0 = 'hydrostate-v0';
  const V1 = 'hydrostate-v1.0';

  function versioned(spec: (string | null)[]): JournalSnapshot[] {
    const base = Date.parse('2026-07-01T00:00:00.000Z');
    return spec.map((modelVersion, i) => ({
      at: new Date(base + i * 86_400_000).toISOString(),
      score: 60 + (i % 20),
      modelVersion,
    } as unknown as JournalSnapshot));
  }

  /** Distinct `d` attributes across every rendered trend <Path>. */
  function strokeShapes(): string[] {
    const paths = Array.from(host.querySelectorAll('[data-stub="Path"]'));
    const ds = paths
      .map((p) => p.getAttribute('d') ?? '')
      .filter((d) => d.startsWith('M'));
    return [...new Set(ds)];
  }

  it('a single-version history renders ONE stroke shape', () => {
    renderChart({ data: versioned(Array.from({ length: 10 }, () => V1)) });
    expect(strokeShapes().length).toBe(1);
  });

  it('an all-UNSTAMPED history renders ONE stroke shape (legacy regression)', () => {
    // Every member predating the version column. Pre-PR-3 this was one line;
    // PR 3 shattered it into moveto-only stubs.
    renderChart({ data: versioned(Array.from({ length: 30 }, () => null)) });
    expect(strokeShapes().length).toBe(1);
  });

  it('a v0 → v1 history renders TWO stroke shapes, never one joined path', () => {
    renderChart({
      data: versioned([...Array.from({ length: 6 }, () => V0),
                       ...Array.from({ length: 6 }, () => V1)]),
    });
    // ANTI-VACUITY: two distinct strokes, and neither is empty.
    const shapes = strokeShapes();
    expect(shapes.length).toBe(2);
    for (const d of shapes) expect(d).toMatch(/^M[\d.]+,[\d.]+/);
    // A rejoined path would be ONE shape containing every anchor.
    expect(shapes.some((d) => d.split('C').length - 1 >= 4)).toBe(false);
  });

  it('unstamped history followed by v1 renders TWO stroke shapes', () => {
    renderChart({
      data: versioned([...Array.from({ length: 20 }, () => null),
                       ...Array.from({ length: 10 }, () => V1)]),
    });
    expect(strokeShapes().length).toBe(2);
  });
});
