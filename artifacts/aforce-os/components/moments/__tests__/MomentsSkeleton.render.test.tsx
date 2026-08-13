// @vitest-environment happy-dom
/**
 * MomentsSkeleton — NON-SHIPPING render harness.
 *
 * The two shapes are pure, store-free presentational pieces (`MomentsScreen`
 * and `app/moment/[id]` mount them while the moments store hydrates), so they
 * render directly with react-dom/happy-dom — no store/router harness — per this
 * repo's convention of never mounting connected containers in tests.
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

import { MomentsOverviewSkeleton, MomentRitualSkeleton } from '../MomentsSkeleton';

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

describe('MomentsOverviewSkeleton', () => {
  it('holds the overview shape: day summary, the one full up-next card, quiet later rows', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(MomentsOverviewSkeleton)));
    expect(q('[data-testid="moments-skeleton"]')).not.toBeNull();
    expect(q('[data-testid="moments-skeleton-summary"]')).not.toBeNull();
    expect(q('[data-testid="moments-skeleton-up-next"]')).not.toBeNull();
  });

  it('announces as ONE loading region, not one per block', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(MomentsOverviewSkeleton)));
    expect(q('[data-testid="moments-skeleton"]')?.getAttribute('aria-label')).toBe('Loading');
  });

  it('claims nothing — in particular it never says the day is empty', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(MomentsOverviewSkeleton)));
    expect(host.textContent?.trim()).toBe('');
  });
});

describe('MomentRitualSkeleton', () => {
  it('shapes the four ritual stages instead of the blank screen a deep link used to get', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(MomentRitualSkeleton)));
    expect(q('[data-testid="moment-ritual-skeleton"]')).not.toBeNull();
    expect(qa('[data-testid^="moment-ritual-skeleton-stage-"]')).toHaveLength(4);
  });

  it('announces as one loading region and claims nothing', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(MomentRitualSkeleton)));
    expect(q('[data-testid="moment-ritual-skeleton"]')?.getAttribute('aria-label')).toBe('Loading');
    expect(host.textContent?.trim()).toBe('');
  });
});
