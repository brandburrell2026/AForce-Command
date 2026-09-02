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

  /** A stroke must have VISIBLE LENGTH — a draw command alone is not enough. */
  function expectNonZeroLength(d: string): void {
    const xs = [...d.matchAll(/[MLC]([\d.]+),/g)].map((m) => Number(m[1]));
    expect(xs.length, `two endpoints expected: ${d}`).toBeGreaterThanOrEqual(2);
    expect(Math.abs(xs[xs.length - 1]! - xs[0]!), `zero-length stroke: ${d}`)
      .toBeGreaterThan(0);
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
    // ANTI-VACUITY: two distinct strokes, and each must actually DRAW.
    // `/^M[\d.]+,[\d.]+/` accepted a bare moveto — a path that renders
    // nothing — which is the same vacuity class this file was added to stop.
    const shapes = strokeShapes();
    expect(shapes.length).toBe(2);
    for (const d of shapes) {
      expect(d, `path must draw, not just move: ${d}`).toMatch(/[CL]/);
      expectNonZeroLength(d);
    }
    // A rejoined path would be ONE shape containing every anchor.
    expect(shapes.some((d) => d.split('C').length - 1 >= 4)).toBe(false);
  });

  it('ROLLOUT DAY 1 — a ONE-ANCHOR run renders a DRAWN stroke, not a moveto', () => {
    // 29 unstamped + 1 stamped gives anchor shares [5, 1]; the lone anchor used
    // to emit `M x,y`, which strokes nothing. The constellation dot still
    // appeared, so the day was not invisible — but the segmented-line contract
    // silently did not hold for the one shape a rollout guarantees.
    renderChart({
      data: versioned([...Array.from({ length: 29 }, () => null), V1]),
    });
    const shapes = strokeShapes();
    expect(shapes.length).toBe(2);
    for (const d of shapes) {
      expect(d, `must draw: ${d}`).toMatch(/[CL]/);
      // `M x,y L x,y` contains an L and strokes NOTHING — the same vacuity this
      // file exists to stop, which survived a first pass here.
      expectNonZeroLength(d);
    }
  });

  it('a lone-anchor mark CLEARS the dot and stays inside the plot', () => {
    // Geometric non-zero length is not the contract — VISIBILITY is. The
    // constellation dot is a solid r=3.5 core inside an r=8 halo, so a 1.5px
    // tick was painted entirely underneath it: measurably present, visually
    // absent. And a mark near the edge must not escape the plot area.
    renderChart({
      data: versioned([...Array.from({ length: 29 }, () => null), V1]),
      width: 320,
    });
    const shapes = strokeShapes();
    const lone = shapes[shapes.length - 1]!;
    const xs = [...lone.matchAll(/[ML]([\d.]+),/g)].map((m) => Number(m[1]));
    expect(xs.length).toBe(2);
    const halfWidth = Math.abs(xs[1]! - xs[0]!) / 2;
    // Must extend past the r=8 halo, or the dot hides it entirely.
    expect(halfWidth, `lone mark half-width ${halfWidth} must clear the r=8 dot`)
      .toBeGreaterThan(8);
    // ...and must stay within the plot bounds.
    const PAD_L = 26, PAD_R = 26;
    const innerW = Math.max(40, 320 - PAD_L - PAD_R);
    for (const x of xs) {
      expect(x, `x=${x} outside plot`).toBeGreaterThanOrEqual(PAD_L);
      expect(x, `x=${x} outside plot`).toBeLessThanOrEqual(PAD_L + innerW);
    }
  });

  it('unstamped history followed by v1 renders TWO stroke shapes', () => {
    renderChart({
      data: versioned([...Array.from({ length: 20 }, () => null),
                       ...Array.from({ length: 10 }, () => V1)]),
    });
    expect(strokeShapes().length).toBe(2);
  });
});

describe('adjacent one-anchor runs never merge into one mark', () => {
  const V0x = 'hydrostate-v0';
  const V1x = 'hydrostate-v1.0';
  const V11x = 'hydrostate-v1.1';

  function versionedLocal(spec: (string | null)[]): JournalSnapshot[] {
    const base = Date.parse('2026-07-01T00:00:00.000Z');
    return spec.map((modelVersion, i) => ({
      at: new Date(base + i * 86_400_000).toISOString(),
      score: 60 + (i % 20), modelVersion,
    } as unknown as JournalSnapshot));
  }
  const spans = () =>
    Array.from(host.querySelectorAll('[data-stub="Path"]'))
      .map((p) => p.getAttribute('d') ?? '')
      .filter((d) => d.startsWith('M'))
      .filter((d, i, a) => a.indexOf(d) === i)
      .map((d) => {
        const xs = [...d.matchAll(/[MLC]([\d.]+),/g)].map((m) => Number(m[1]));
        return [Math.min(...xs), Math.max(...xs)] as [number, number];
      });

  it('many consecutive one-day runs draw SEPARATED marks', () => {
    // A boundary drawn as one continuous mark is the claim segmentation exists
    // to prevent — reintroduced by the fix that made a lone run visible.
    //
    // The fixture must pack the anchors CLOSE: with only three runs they land
    // ~134px apart and a fixed 22px mark never overlaps, so the law passed
    // whatever the width rule did. Twenty alternating runs put them ~14px
    // apart, where a fixed 22px mark genuinely merges.
    const alternating = Array.from({ length: 20 }, (_, i) => (i % 2 ? V1x : V0x));
    renderChart({ data: versionedLocal(alternating), width: 320 });
    const s = spans();
    expect(s.length).toBeGreaterThanOrEqual(3);   // ANTI-VACUITY
    const sorted = [...s].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]![0], `run ${i} must start after run ${i - 1} ends`)
        .toBeGreaterThan(sorted[i - 1]![1]);
    }
  });

  it('each mark still has real visible width', () => {
    const alternating = Array.from({ length: 20 }, (_, i) => (i % 2 ? V1x : V0x));
    renderChart({ data: versionedLocal(alternating), width: 320 });
    for (const [lo, hi] of spans()) expect(hi - lo).toBeGreaterThan(1);
  });
});
