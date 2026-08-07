// @vitest-environment happy-dom
/**
 * ScoreBreakdownSheet — NON-SHIPPING render harness (VS 3.0 P2 migration).
 *
 * The sheet was ported off legacy Colors.* / hardcoded Inter_* strings /
 * `${color}NN` opacity hacks / a raw rgba scrim onto the af.* system, and
 * gained a previously-missing empty state. This harness pins the two things a
 * token-only migration must NOT quietly change:
 *   1. the populated sheet still renders the score, the DETAILS list, every
 *      contribution row, and the byte-exact FORMULA text; and
 *   2. zero contributions now render the calm empty state instead of an empty
 *      DETAILS/FORMULA shell.
 *
 * Mirrors components/__tests__/pulseRing.render.test.tsx: reanimated /
 * expo-haptics / Icon / the analytics emit are stubbed so the sheet mounts
 * without hitting this suite's documented pre-existing expo-modules-core
 * `__DEV__` module-load failure.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { View as RNView } from 'react-native';

vi.mock('react-native-reanimated', () => {
  function useSharedValue(initial: unknown) {
    const ref = React.useRef({ value: initial });
    return ref.current;
  }
  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    try { return fn(); } catch { return {}; }
  }
  const Easing = { bezier: (..._a: number[]) => 'bezier' };
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: (C: unknown) => C },
    useSharedValue,
    useAnimatedStyle,
    withTiming: vi.fn((v: unknown) => v),
    withSpring: vi.fn((v: unknown) => v),
    Easing,
  };
});
vi.mock('expo-haptics', () => ({ selectionAsync: vi.fn(() => Promise.resolve()) }));
vi.mock('../Icon', () => ({ Icon: () => null }));
vi.mock('../../analytics/event_dispatcher', () => ({ emit: vi.fn(() => Promise.resolve()) }));

import { ScoreBreakdownSheet } from '../ScoreBreakdownSheet';
import type { ScoreContribution, PerformanceState } from '../../types';

const STATE: PerformanceState = {
  level: 'PEAK',
  score: 82,
  color: '#1FA35A',
  glowColor: '#1FA35A',
  urgency: 'calm',
  pulseSpeed: 'slow',
  animationStyle: 'breathe',
};

const CONTRIBS: ScoreContribution[] = [
  { id: 'water', label: 'Water intake', delta: 12, maxMagnitude: 20, hint: 'On pace today' },
  { id: 'sleep', label: 'Sleep debt', delta: -6, maxMagnitude: 15, hint: 'Short last night' },
  { id: 'heat', label: 'Heat load', delta: 0, maxMagnitude: 10, hint: 'Mild conditions' },
];

let host: HTMLElement;
let root: Root;

function render(props: Partial<React.ComponentProps<typeof ScoreBreakdownSheet>> = {}) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(ScoreBreakdownSheet, {
        visible: true,
        onDismiss: () => {},
        score: 82,
        contributions: CONTRIBS,
        performanceState: STATE,
        ...props,
      }),
    ),
  );
}

const text = () => host.textContent ?? '';

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('ScoreBreakdownSheet — VS 3.0 P2 token migration', () => {
  it('renders nothing when not visible', () => {
    render({ visible: false });
    expect(text()).toBe('');
  });

  it('populated: shows the score, DETAILS, every contribution row, and the byte-exact FORMULA', () => {
    render();
    const t = text();
    expect(t).toContain('SCORE BREAKDOWN');
    expect(t).toContain('82');
    expect(t).toContain('DETAILS');
    // every contribution row label is present
    expect(t).toContain('Water intake');
    expect(t).toContain('Sleep debt');
    expect(t).toContain('Heat load');
    // FORMULA text is unchanged, byte-for-byte (claims-adjacent — must not drift)
    expect(t).toContain(
      'base + recency + streak + context + recovery − symptoms − urine − output − sleep',
    );
    expect(t).toContain('clamped to 0–100. Re-evaluated every 30 seconds and on every event.');
    // the empty state must NOT show when there is signal
    expect(t).not.toContain('Not enough signal yet');
  });

  it('empty: zero contributions render the calm empty state, not an empty DETAILS/FORMULA shell', () => {
    render({ contributions: [] });
    const t = text();
    expect(t).toContain('SCORE BREAKDOWN'); // header still frames the sheet
    expect(t).toContain('Not enough signal yet to break this down.');
    expect(t).not.toContain('DETAILS');
    expect(t).not.toContain('FORMULA');
  });
});
