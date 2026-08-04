// @vitest-environment happy-dom
/**
 * PulseRing — reduced-motion gate (RC-1 Wave-2A motion-token adoption).
 *
 * PulseRing (the soft repeating glow behind SocialModeSheet's CRUISE / SHIELD
 * live-timer pills) was an ungated `withRepeat(..., -1, true)` — no
 * reduced-motion check, no `cancelAnimation` cleanup. Pattern mirrors
 * components/WhoopSnapshotCard.tsx:126-168; harness technique mirrors
 * components/__tests__/whoopSnapshotCard.render.test.tsx (spy-able
 * Reanimated primitives so the gate is asserted by which primitives were
 * invoked). Extracted to its own file (components/PulseRing.tsx) specifically
 * so it can be unit-tested here without mounting the full sheet (which pulls
 * in the app store, subscription gate, i18n, safe-area context, and
 * `expo-haptics` → `expo-modules-core`, the last of which hits this suite's
 * documented pre-existing `__DEV__` module-load failure in this environment).
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
    interpolate: vi.fn(() => 0),
    cancelAnimation: cancelAnimationMock,
    Easing,
  };
});

import { PulseRing } from '../PulseRing';

let host: HTMLElement;
let root: Root;

function renderPulseRing() {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(PulseRing, { color: '#19E5C6' })));
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

describe('PulseRing — reduced-motion gate (RC-1 Wave-2A)', () => {
  it('reduced motion OFF: starts the looping glow animation', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderPulseRing();
    expect(withRepeatMock).toHaveBeenCalled();
    expect(withTimingMock).toHaveBeenCalled();
  });

  it('reduced motion ON: never starts the looping glow animation', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderPulseRing();
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('cancels the glow animation on unmount, motion ON or OFF', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderPulseRing();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(1);
  });

  it('cancels the glow animation on unmount even under reduced motion (nothing was started, cleanup still runs)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderPulseRing();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(1);
  });
});
