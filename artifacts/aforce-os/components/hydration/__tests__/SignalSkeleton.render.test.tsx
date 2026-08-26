// @vitest-environment happy-dom
/**
 * SignalSkeleton — NON-SHIPPING render harness.
 *
 * `SignalSkeleton` is the pure, store-free presentational piece
 * `PerformanceSignalV3` mounts while its rollup fetch (plus, on a cold-launch
 * auth race, two retry backoffs) is in flight. Renders it directly with
 * react-dom/happy-dom — no store/router/realApi harness needed, consistent with
 * `performanceSignalV3Wiring.test.ts`'s documented convention of never mounting
 * the connected `PerformanceSignalV3` container directly.
 *
 * `AFSkeleton` drives `react-native-reanimated` shared values — mocked with the
 * same targeted stub `HomeSkeleton.render.test.tsx` uses so the component
 * mounts without a real animation runtime.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { View as RNView } from 'react-native';

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
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: (Component: unknown) => Component },
    useSharedValue,
    useAnimatedStyle,
    withTiming: vi.fn((v: unknown) => v),
    withRepeat: vi.fn((anim: unknown) => anim),
    cancelAnimation: vi.fn(),
    Easing,
  };
});

vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

import { SignalSkeleton } from '../SignalSkeleton';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

const q = (sel: string) => host.querySelector(sel);
const qa = (sel: string) => host.querySelectorAll(sel);

describe('SignalSkeleton', () => {
  it('renders without crashing and exposes a stable container testID', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(SignalSkeleton)));
    expect(q('[data-testid="signal-v3-skeleton"]')).not.toBeNull();
  });

  it('holds the loaded layout: one summary card, seven day rows, the week-detail control', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(SignalSkeleton)));
    expect(q('[data-testid="signal-skeleton-summary"]')).not.toBeNull();
    expect(qa('[data-testid^="signal-skeleton-day-"]')).toHaveLength(7);
    expect(q('[data-testid="signal-skeleton-week-detail"]')).not.toBeNull();
  });

  it('shapes the caller\'s window length, so the rows match the days that will arrive', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(SignalSkeleton, { dayCount: 3 })));
    expect(qa('[data-testid^="signal-skeleton-day-"]')).toHaveLength(3);
  });

  it('claims nothing: no score, no band word, no day name anywhere in the shape', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(SignalSkeleton)));
    // A skeleton block may say "something is coming"; it may never say what.
    expect(host.textContent?.trim()).toBe('');
  });
});
