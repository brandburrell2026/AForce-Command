// @vitest-environment happy-dom
/**
 * RecoveryCapacityCard — reduced-motion gate on the ambient halo
 * (RC-1 audit, P0): the halo behind the score number was an ungated infinite
 * `withRepeat(..., -1)` loop with no reduced-motion check and no teardown —
 * it ran forever, including for users who have motion reduction on, and kept
 * animating on Reanimated's UI thread past unmount.
 *
 * Follows the harness + assertion pattern in
 * `components/__tests__/whoopSnapshotCard.render.test.tsx`: a real i18n-free
 * mount (this card has no translated copy) with a spy-able
 * `react-native-reanimated` mock so the gate (Squad-F HIGH #1 style) is
 * asserted directly — which primitives were invoked, and whether cleanup ran
 * on unmount — rather than inspecting animated numeric output.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { View as RNView, Text as RNText } from 'react-native';

vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
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
  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  const Easing = {
    inOut: (e: unknown) => e,
    cubic: 'cubic',
    quad: 'quad',
  };
  const AnimatedNamespace = {
    View: RNView,
    Text: RNText,
    createAnimatedComponent: (Component: unknown) => Component,
  };
  return {
    __esModule: true,
    default: AnimatedNamespace,
    useSharedValue,
    useAnimatedStyle,
    withTiming: withTimingMock,
    withRepeat: withRepeatMock,
    cancelAnimation: cancelAnimationMock,
    interpolate: vi.fn(() => 0),
    interpolateColor: vi.fn(() => '#000000'),
    Easing,
  };
});

const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

import { RecoveryCapacityCard } from '../RecoveryCapacityCard';
import { computeRecoveryCapacity, type RecoveryCapacityInputs } from '@/services/recoveryCapacity';

/** Builds a real (non-fabricated) RecoveryCapacityScore via the actual
 *  scoring helper, so the fixture can't drift from the real shape. */
function recovery(inputs: Partial<RecoveryCapacityInputs> = {}) {
  return computeRecoveryCapacity({
    autoPilotScore: 78,
    hydrationCompliance: 0.7,
    environmentalStress: 0.3,
    ...inputs,
  });
}

let host: HTMLElement;
let root: Root;

function renderCard(props: Partial<React.ComponentProps<typeof RecoveryCapacityCard>> = {}) {
  root = createRoot(host);
  flushSync(() =>
    root.render(React.createElement(RecoveryCapacityCard, { recovery: recovery(), ...props })),
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

describe('RecoveryCapacityCard — halo reduced-motion gate (RC-1 P0)', () => {
  it('reduced motion OFF: starts the breathing halo loop', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderCard();
    expect(withRepeatMock).toHaveBeenCalled();
  });

  it('reduced motion ON: never starts the halo loop', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderCard();
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('cancels the halo animation on unmount, motion ON or OFF', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderCard();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalled();
  });

  it('cancels the halo animation on unmount even under reduced motion (nothing was started, cleanup still runs)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderCard();
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalled();
  });

  it('renders the score and band label regardless of motion setting', () => {
    useReducedMotionMock.mockReturnValue(true);
    const declining = recovery({ autoPilotScore: 50, hydrationCompliance: 0.4, environmentalStress: 0.6 });
    expect(declining.meta.label).toBe('Declining');
    renderCard({ recovery: declining });
    expect(host.textContent).toContain(String(declining.score));
    expect(host.textContent).toContain('DECLINING');
  });
});
