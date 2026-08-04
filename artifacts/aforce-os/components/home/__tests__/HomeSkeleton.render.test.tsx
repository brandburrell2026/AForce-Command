// @vitest-environment happy-dom
/**
 * HomeSkeleton — NON-SHIPPING render harness.
 *
 * `HomeSkeleton` is the pure, store-free presentational piece `HomeScreenV2`
 * mounts during its pre-hydration window (RC-1 Wave-2B, item 2a). Renders it
 * directly with react-dom/happy-dom — no store/router/Clerk harness needed,
 * consistent with `homeScreenV2Wiring.test.ts`'s documented convention of
 * never mounting the connected `HomeScreenV2` container directly.
 *
 * `AFSkeleton` drives `react-native-reanimated` shared values — mocked with
 * the same targeted stub used in
 * `components/__tests__/statusPulseOrb.render.test.tsx` so the component
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

import { HomeSkeleton } from '../HomeSkeleton';

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

describe('HomeSkeleton', () => {
  it('renders without crashing and exposes a stable container testID', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(HomeSkeleton)));
    expect(q('[data-testid="home-v2-skeleton"]')).not.toBeNull();
  });

  it('shapes the arc, command card, and all three signal tiles', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(HomeSkeleton)));
    expect(q('[data-testid="home-skeleton-arc"]')).not.toBeNull();
    expect(q('[data-testid="home-skeleton-command"]')).not.toBeNull();
    expect(q('[data-testid="home-skeleton-tile-0"]')).not.toBeNull();
    expect(q('[data-testid="home-skeleton-tile-1"]')).not.toBeNull();
    expect(q('[data-testid="home-skeleton-tile-2"]')).not.toBeNull();
  });

  it('is announced as a single accessible loading region', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(HomeSkeleton)));
    const el = q('[data-testid="home-v2-skeleton"]');
    expect(el?.getAttribute('aria-label')).toBe('Loading');
  });
});
