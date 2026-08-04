// @vitest-environment happy-dom
/**
 * ProviderSectionSkeleton — NON-SHIPPING render harness.
 *
 * Pure, store-free presentational piece `ProfileScreenV2` mounts while its
 * mount-time WHOOP + Garmin status checks are both still in flight (RC-1
 * Wave-2B, item 2b). `AFSkeleton` drives `react-native-reanimated` shared
 * values — mocked with the same targeted stub used in
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

import { ProviderSectionSkeleton } from '../ProviderSectionSkeleton';

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
const qa = (sel: string) => Array.from(host.querySelectorAll(sel));

describe('ProviderSectionSkeleton', () => {
  it('renders one row per provider count, as a single accessible loading region', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(ProviderSectionSkeleton, { count: 5 })));
    const container = q('[data-testid="profile-provider-skeleton"]');
    expect(container?.getAttribute('aria-label')).toBe('Loading');
    expect(qa('[data-testid^="profile-provider-skeleton-icon-"]')).toHaveLength(5);
  });

  it('renders zero rows for count=0 without crashing', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(ProviderSectionSkeleton, { count: 0 })));
    expect(qa('[data-testid^="profile-provider-skeleton-icon-"]')).toHaveLength(0);
  });
});
