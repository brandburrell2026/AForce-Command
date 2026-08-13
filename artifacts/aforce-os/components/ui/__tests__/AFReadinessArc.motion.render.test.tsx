// @vitest-environment happy-dom
/**
 * AFReadinessArc — the two signature moments it carries (Wave-5 motion pass).
 *
 *   HYDROSTATE REVEAL (Home)      — first paint draws the stroke from empty.
 *   RITUAL PROGRESSION (Protocol) — a later change animates from where the
 *                                   stroke ALREADY is, not from empty again.
 *
 * That distinction is the defect this file exists to pin. The previous effect
 * reset `fill.value = 0` on every `fraction` change, so a completed Protocol
 * step made the ring restart rather than advance — the opposite of progression,
 * on the one element whose whole job is showing that the member moved.
 *
 * Also pins the removal of the opt-in "alive" breathing halo: an unbounded
 * `withRepeat` glow behind the number it framed.
 *
 * Behavioral, following `components/__tests__/whoopSnapshotCard.render.test.tsx`:
 * `react-native-reanimated` is mocked with spy-able primitives so we can observe
 * which animations were started and what the shared value was set to, and
 * `react-native-svg` is stubbed (a native rendering surface irrelevant here).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { View as RNView } from 'react-native';

vi.mock('react-native-svg', () => {
  const stub = (name: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement(
        'svg-stub',
        { 'data-stub': name, ref },
        props.children as React.ReactNode,
      ),
    );
    C.displayName = `Stub(${name})`;
    return C;
  };
  const Svg = stub('Svg');
  return { __esModule: true, default: Svg, Svg, Circle: stub('Circle'), G: stub('G') };
});

const {
  withTimingMock,
  withRepeatMock,
  cancelAnimationMock,
  reducedMotionMock,
  sharedValues,
} = vi.hoisted(() => ({
  withTimingMock: vi.fn((toValue: unknown) => ({ __kind: 'timing', toValue })),
  withRepeatMock: vi.fn((anim: unknown) => ({ __kind: 'repeat', anim })),
  cancelAnimationMock: vi.fn(),
  reducedMotionMock: vi.fn(() => false),
  // Every shared value this component creates, in creation order. Each records
  // its full WRITE HISTORY, which is the only way to tell a reveal (a write of
  // 0 immediately before the tween) from a progression (no such write).
  sharedValues: [] as { value: unknown; writes: unknown[] }[],
}));

vi.mock('react-native-reanimated', () => {
  function useSharedValue(initial: unknown) {
    const ref = React.useRef<{ value: unknown; writes: unknown[] } | null>(null);
    if (ref.current === null) {
      let current: unknown = initial;
      const writes: unknown[] = [];
      const sv = {
        get value() {
          return current;
        },
        set value(next: unknown) {
          current = next;
          writes.push(next);
        },
        writes,
      };
      ref.current = sv;
      sharedValues.push(sv);
    }
    return ref.current;
  }
  function useAnimatedProps(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: (C: unknown) => C },
    useSharedValue,
    useAnimatedProps,
    withTiming: withTimingMock,
    cancelAnimation: cancelAnimationMock,
    withRepeat: withRepeatMock,
    Easing: {
      out: (e: unknown) => e,
      in: (e: unknown) => e,
      inOut: (e: unknown) => e,
      cubic: 'cubic',
      quad: 'quad',
    },
    useReducedMotion: reducedMotionMock,
  };
});

import { AFReadinessArc } from '../AFReadinessArc';

let host: HTMLElement;
let root: Root;

function render(props: React.ComponentProps<typeof AFReadinessArc>) {
  flushSync(() => root.render(React.createElement(AFReadinessArc, props)));
}

/** The `fill` shared value — the first (and only) one this component creates. */
const fill = () => sharedValues[0];

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  sharedValues.length = 0;
  withTimingMock.mockClear();
  withRepeatMock.mockClear();
  cancelAnimationMock.mockClear();
  reducedMotionMock.mockReturnValue(false);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('AFReadinessArc — HydroState reveal (first paint)', () => {
  it('draws in from empty when `animate` is set', () => {
    render({ progress: 0.76, animate: true });
    expect(withTimingMock).toHaveBeenCalledTimes(1);
    expect(withTimingMock.mock.calls[0][0]).toBeCloseTo(0.76, 5);
    // Writing 0 immediately before the tween is what makes this a REVEAL
    // (drawn in from empty) rather than a jump to the value.
    expect(fill().writes[0]).toBe(0);
  });

  it('stays static — no tween at all — when `animate` is not set', () => {
    render({ progress: 0.76 });
    expect(withTimingMock).not.toHaveBeenCalled();
    expect(fill().value).toBeCloseTo(0.76, 5);
  });

  it('collapses to the static render under reduced motion', () => {
    reducedMotionMock.mockReturnValue(true);
    render({ progress: 0.76, animate: true });
    expect(withTimingMock).not.toHaveBeenCalled();
    expect(fill().value).toBeCloseTo(0.76, 5);
  });
});

describe('AFReadinessArc — Ritual progression (a later change)', () => {
  it('animates FROM THE CURRENT FILL, not from empty, on a second value', () => {
    render({ progress: 0.5, animate: true });
    // Simulate the reveal having landed: the stroke now sits at 0.5.
    fill().value = 0.5;
    const writesBefore = fill().writes.length;
    withTimingMock.mockClear();

    render({ progress: 0.75, animate: true });

    // The tween targets the new value...
    expect(withTimingMock).toHaveBeenCalledTimes(1);
    expect(withTimingMock.mock.calls[0][0]).toBeCloseTo(0.75, 5);
    // ...and the ONLY write this pass made was that tween — no `= 0` reset
    // before it. A reset here is what made a completed Protocol step read as
    // "the ring restarted" instead of "the ring advanced".
    const writesThisPass = fill().writes.slice(writesBefore);
    expect(writesThisPass).toHaveLength(1);
    expect(writesThisPass).not.toContain(0);
  });

  it('a static arc still tracks a changing value exactly', () => {
    render({ progress: 0.25 });
    render({ progress: 0.6 });
    expect(withTimingMock).not.toHaveBeenCalled();
    expect(fill().value).toBeCloseTo(0.6, 5);
  });

  it('clamps out-of-range fractions instead of overdrawing', () => {
    render({ progress: 1.8 });
    expect(fill().value).toBe(1);
  });
});

describe('AFReadinessArc — calm contract (Wave-5)', () => {
  it('never starts an unbounded loop — the "alive" breathing halo is gone', () => {
    render({ progress: 0.76, animate: true });
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('does not loop under reduced motion either', () => {
    reducedMotionMock.mockReturnValue(true);
    render({ progress: 0.76, animate: true });
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('cancels any in-flight draw on unmount', () => {
    render({ progress: 0.76, animate: true });
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(1);
    // Re-mount so the shared afterEach unmount has a live root.
    root = createRoot(host);
  });
});
