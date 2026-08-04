// @vitest-environment happy-dom
/**
 * ReadinessInsightsSkeleton — NON-SHIPPING render harness.
 *
 * Pure, store-free presentational piece `ReadinessInsightsV2` mounts while
 * short on history AND its analytics fetch is still pending (RC-1 Wave-2B,
 * item 2c). `AFSkeleton` drives `react-native-reanimated` shared values —
 * mocked with the same targeted stub used in
 * `components/__tests__/statusPulseOrb.render.test.tsx`.
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
  const Easing = { out: (e: unknown) => e, in: (e: unknown) => e, inOut: (e: unknown) => e, cubic: 'cubic', quad: 'quad' };
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

import { ReadinessInsightsSkeleton } from '../ReadinessInsightsSkeleton';

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

describe('ReadinessInsightsSkeleton', () => {
  it('renders without crashing, as a single accessible loading region', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(ReadinessInsightsSkeleton)));
    const el = q('[data-testid="readiness-insights-skeleton"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('Loading');
  });

  it('shapes the score hero, the chart, and three driver rows', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(ReadinessInsightsSkeleton)));
    expect(q('[data-testid="ri-skeleton-score"]')).not.toBeNull();
    expect(q('[data-testid="ri-skeleton-chart"]')).not.toBeNull();
    expect(q('[data-testid="ri-skeleton-driver-0"]')).not.toBeNull();
    expect(q('[data-testid="ri-skeleton-driver-1"]')).not.toBeNull();
    expect(q('[data-testid="ri-skeleton-driver-2"]')).not.toBeNull();
  });
});
