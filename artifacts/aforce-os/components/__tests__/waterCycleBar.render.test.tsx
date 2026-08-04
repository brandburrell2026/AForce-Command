// @vitest-environment happy-dom
/**
 * WaterCycleBar — reduced-motion gate on the "you are here" caret
 * (RC-1 Wave-2A motion-token adoption).
 *
 * The caret's vertical breathing loop (`caretY`) was an ungated
 * `withRepeat(..., -1, true)` — no reduced-motion check, no `cancelAnimation`
 * cleanup on unmount or on re-run. Pattern mirrors
 * components/WhoopSnapshotCard.tsx:126-168 (the canonical reference
 * implementation): spy-able Reanimated primitives so the gate is asserted by
 * which primitives were invoked, not by inspecting animated numeric output —
 * same harness technique as
 * components/__tests__/whoopSnapshotCard.render.test.tsx.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { View as RNView } from 'react-native';

const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

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
  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  const Easing = {
    out: (e: unknown) => e,
    in: (e: unknown) => e,
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
    useAnimatedStyle,
    withTiming: withTimingMock,
    withRepeat: withRepeatMock,
    withSpring: vi.fn((v: unknown) => v),
    withDelay: vi.fn((_ms: number, anim: unknown) => anim),
    cancelAnimation: cancelAnimationMock,
    Easing,
  };
});

import { WaterCycleBar } from '../WaterCycleBar';
import type { PerformanceState } from '@/types';

const PERFORMANCE_STATE: PerformanceState = {
  level: 'PEAK',
  score: 92,
  color: '#1FA35A',
  glowColor: '#1FA35A',
  urgency: 'calm',
  pulseSpeed: 'slow',
  animationStyle: 'breathe',
};

let host: HTMLElement;
let root: Root;

function renderBar(unitsConsumed: number) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(WaterCycleBar, {
        unitsConsumed,
        dailyTarget: 8,
        performanceState: PERFORMANCE_STATE,
      }),
    ),
  );
}

/** Re-renders onto the SAME root (a prop update, not a fresh mount). */
function rerenderBar(unitsConsumed: number) {
  flushSync(() =>
    root.render(
      React.createElement(WaterCycleBar, {
        unitsConsumed,
        dailyTarget: 8,
        performanceState: PERFORMANCE_STATE,
      }),
    ),
  );
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

describe('WaterCycleBar — caret reduced-motion gate (RC-1 Wave-2A)', () => {
  it('reduced motion OFF: the caret starts its looping breathe animation', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderBar(3); // nextIdx = 3, caret visible
    expect(withRepeatMock).toHaveBeenCalled();
  });

  it('reduced motion ON: the caret never starts the looping breathe animation', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderBar(3);
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('cancels the caret animation on unmount, motion ON or OFF', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderBar(3);
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalled();
  });

  it('cancels the caret animation on unmount even under reduced motion (nothing was started, cleanup still runs)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderBar(3);
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalled();
  });

  it('the day-complete transition (caret hidden) also cancels any in-flight caret loop', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderBar(3); // caret visible, loop running
    cancelAnimationMock.mockClear();
    rerenderBar(8); // nextIdx = -1, caret hides — must cancel the running loop
    expect(cancelAnimationMock).toHaveBeenCalled();
  });
});
