// @vitest-environment happy-dom
/**
 * WeeklyReportSkeleton — NON-SHIPPING render harness.
 *
 * `WeeklyReportSkeleton` is the pure, store-free presentational piece
 * `WeeklyReportV3` mounts while the analytics snapshot, the journal rollups and
 * the command ledger are assembled. Renders it directly with
 * react-dom/happy-dom — the same harness shape as the neighbouring
 * `ReadinessInsightsSkeleton.render.test.tsx`, consistent with
 * `weeklyReportV3Wiring.test.ts`'s documented convention of never mounting the
 * connected `WeeklyReportV3` container directly.
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

import { WeeklyReportSkeleton } from '../WeeklyReportSkeleton';

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

describe('WeeklyReportSkeleton', () => {
  it('renders without crashing and exposes a stable container testID', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(WeeklyReportSkeleton)));
    expect(q('[data-testid="weekly-v3-skeleton"]')).not.toBeNull();
  });

  it('holds the sections the report ALWAYS renders: week chip, six tiles, two banners', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(WeeklyReportSkeleton)));
    expect(q('[data-testid="weekly-skeleton-chip"]')).not.toBeNull();
    expect(qa('[data-testid^="weekly-skeleton-tile-"]')).toHaveLength(6);
    expect(q('[data-testid="weekly-skeleton-banner-0"]')).not.toBeNull();
    expect(q('[data-testid="weekly-skeleton-banner-1"]')).not.toBeNull();
  });

  it('does NOT outline the Performance Age card, which only some members receive', () => {
    // `paView.currentAge` is null without a real age baseline, so the card is
    // omitted entirely. Shaping one here would promise a section that never
    // arrives — a skeleton may hold a shape, never invent one.
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(WeeklyReportSkeleton)));
    expect(q('[data-testid="weekly-skeleton-pa"]')).toBeNull();
  });

  it('claims nothing: no numbers, no weekday labels, no status words', () => {
    root = createRoot(host);
    flushSync(() => root.render(React.createElement(WeeklyReportSkeleton)));
    expect(host.textContent?.trim()).toBe('');
  });
});
