// @vitest-environment happy-dom
/**
 * WhoopSnapshotCard — NON-SHIPPING render harness (Squad-F HIGH #1, #2, #5b).
 *
 * Renders the real `WhoopSnapshotCard` to a DOM (react-native-web → react-dom,
 * happy-dom), following the pattern established in
 * components/health/__tests__/connectedHealthView.render.test.tsx: a real
 * i18next instance loaded from the real `locales/en.json` (so assertions are
 * against actual translated copy, not fixtures), plus targeted mocks for
 * native-only rendering surfaces irrelevant to structure/a11y (SVG ring,
 * gradient background — same rationale as that file mocking `Icon`).
 *
 * `react-native-reanimated` is mocked with spy-able `withTiming` /
 * `withRepeat` / `cancelAnimation` so the reduced-motion GATE (Squad-F HIGH
 * #1) can be asserted directly: which animation primitives were invoked, and
 * whether cleanup ran on unmount. This is the one place in the suite that
 * needs to observe *behavior*, not just rendered markup.
 *
 * `maxFontSizeMultiplier` and `accessibilityViewIsModal`-style RN-only props
 * are NOT forwarded to the DOM by react-native-web (verified against
 * node_modules/react-native-web/dist/exports/Text/index.js's `forwardPropsList`
 * allowlist), so DOM assertions can't see them. Where the mission calls for
 * asserting a specific prop reached a specific element, this file wraps the
 * real `Text` from `react-native` to record the props it receives BEFORE
 * react-native-web's allowlist drops them — the same technique used below for
 * the Dynamic Type clamp (Squad-F HIGH #5b).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
// The REAL (react-native-web) View — needed so the react-native-reanimated
// mock below can flatten RN style ARRAYS (`[styles.pulseDot, animatedDotStyle]`)
// the way the app actually renders them. A raw `<div>` can't: react-dom's
// style setter requires a plain object, and RN style props are routinely
// arrays. Resolves through the `react-native` mock further down (which only
// overrides `Text`), so this is the real View.
import { View as RNView } from 'react-native';

// react-native-svg / expo-linear-gradient are native rendering surfaces
// irrelevant to structure/a11y here (same rationale as Icon in
// connectedHealthView.render.test.tsx) — stub them to plain DOM-safe elements.
vi.mock('react-native-svg', () => {
  const stub = (name: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement('svg-stub', { ...props, 'data-stub': name, ref }, props.children as React.ReactNode),
    );
    C.displayName = name;
    return C;
  };
  const Svg = stub('Svg');
  return { __esModule: true, default: Svg, Svg, Circle: stub('Circle'), G: stub('G') };
});

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, colors: _colors, start: _start, end: _end, ...rest }: Record<string, unknown>) =>
    React.createElement(RNView, rest, children as React.ReactNode),
}));

// Reduced-motion is controlled per-test via this mock's return value.
const { useReducedMotionMock } = vi.hoisted(() => ({ useReducedMotionMock: vi.fn(() => false) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: useReducedMotionMock }));

// Spy-able Reanimated primitives — the reduced-motion GATE (Squad-F HIGH #1)
// is asserted by checking which of these were called, not by inspecting
// animated numeric output.
const { withTimingMock, withRepeatMock, withSequenceMock, cancelAnimationMock } = vi.hoisted(() => ({
  withTimingMock: vi.fn((value: number) => ({ __kind: 'timing', value })),
  withRepeatMock: vi.fn((anim: unknown) => ({ __kind: 'repeat', anim })),
  withSequenceMock: vi.fn((...anims: unknown[]) => ({ __kind: 'sequence', anims })),
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
  function useAnimatedProps(fn: () => Record<string, unknown>) {
    try {
      return fn();
    } catch {
      return {};
    }
  }
  const Easing = {
    out: (e: unknown) => e,
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
    useAnimatedProps,
    withTiming: withTimingMock,
    withRepeat: withRepeatMock,
    withSequence: withSequenceMock,
    cancelAnimation: cancelAnimationMock,
    Easing,
  };
});

// Records every prop object passed to <Text> BEFORE react-native-web's
// allowlist silently drops RN-only props (maxFontSizeMultiplier has no web
// equivalent — confirmed against react-native-web's Text `forwardPropsList`).
const { capturedTextProps } = vi.hoisted(() => ({ capturedTextProps: [] as Record<string, unknown>[] }));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const RealText = actual.Text as React.ComponentType<Record<string, unknown>>;
  const RecordingText = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    capturedTextProps.push(props);
    return React.createElement(RealText, { ...props, ref });
  });
  return { ...actual, Text: RecordingText };
});

import { WhoopSnapshotCard } from '../WhoopSnapshotCard';

const EN_LOCALE = JSON.parse(readFileSync(join(__dirname, '..', '..', 'locales', 'en.json'), 'utf8'));

const testI18n = i18nCore.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: EN_LOCALE } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

let host: HTMLElement;
let root: Root;

function renderCard(props: React.ComponentProps<typeof WhoopSnapshotCard> = {}) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(I18nextProvider, { i18n: testI18n }, React.createElement(WhoopSnapshotCard, props)),
    ),
  );
}

const q = (sel: string) => host.querySelector(sel);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  useReducedMotionMock.mockReset();
  useReducedMotionMock.mockReturnValue(false);
  withTimingMock.mockClear();
  withRepeatMock.mockClear();
  withSequenceMock.mockClear();
  cancelAnimationMock.mockClear();
  capturedTextProps.length = 0;
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('WhoopSnapshotCard — reduced-motion gate (Squad-F HIGH #1)', () => {
  it('reduced motion OFF: starts the reveal tweens AND the looping pulse', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderCard({ recoveryPct: 72, strain: 10.2, sleepHoursLastNight: 7.5 });
    expect(withTimingMock).toHaveBeenCalled();
    expect(withRepeatMock).toHaveBeenCalled();
  });

  it('reduced motion ON: never starts the reveal tweens or the looping pulse', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderCard({ recoveryPct: 72, strain: 10.2, sleepHoursLastNight: 7.5 });
    expect(withTimingMock).not.toHaveBeenCalled();
    expect(withRepeatMock).not.toHaveBeenCalled();
  });

  it('cancels all three shared-value animations on unmount, motion ON or OFF', () => {
    useReducedMotionMock.mockReturnValue(false);
    renderCard({ recoveryPct: 72 });
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(3);
  });

  it('cancels animations on unmount even under reduced motion (nothing was started, cleanup still runs)', () => {
    useReducedMotionMock.mockReturnValue(true);
    renderCard({ recoveryPct: 72 });
    cancelAnimationMock.mockClear();
    flushSync(() => root.unmount());
    expect(cancelAnimationMock).toHaveBeenCalledTimes(3);
  });
});

describe('WhoopSnapshotCard — grouped accessible labels (Squad-F HIGH #2)', () => {
  it('connection state is one accessible element carrying the connected/syncing text + a live region', () => {
    renderCard({ recoveryPct: 72, syncing: false });
    const el = q('[data-testid="whoop-connection-state"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-label')).toBe('CONNECTED');
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });

  it('syncing state announces SYNCING…, not CONNECTED', () => {
    renderCard({ syncing: true });
    const el = q('[data-testid="whoop-connection-state"]');
    expect(el?.getAttribute('aria-label')).toBe('SYNCING…');
  });

  it('recovery ring is one accessible element with a composed "Recovery N percent" label', () => {
    renderCard({ recoveryPct: 72 });
    const el = q('[data-testid="whoop-recovery"]');
    expect(el?.getAttribute('aria-label')).toBe('Recovery 72 percent');
  });

  it('null recovery announces a meaningful label, never a bare dash', () => {
    renderCard({ recoveryPct: null });
    const el = q('[data-testid="whoop-recovery"]');
    const label = el?.getAttribute('aria-label') ?? '';
    expect(label).not.toBe('—');
    expect(label.length).toBeGreaterThan(0);
    expect(label).toBe('Recovery not yet available');
  });

  it('strain value + bucket are grouped into one label', () => {
    renderCard({ strain: 12.4 });
    const el = q('[data-testid="whoop-strain"]');
    expect(el?.getAttribute('aria-label')).toBe('Strain 12.4 of 21, MODERATE');
  });

  it('null strain announces a meaningful label, never a bare dash', () => {
    renderCard({ strain: null });
    const el = q('[data-testid="whoop-strain"]');
    const label = el?.getAttribute('aria-label') ?? '';
    expect(label).not.toBe('—');
    expect(label).toBe('Strain not yet available');
  });

  it('sleep hours + performance are grouped into one label', () => {
    renderCard({ sleepHoursLastNight: 7.5, sleepPerformance: 88 });
    const el = q('[data-testid="whoop-sleep"]');
    expect(el?.getAttribute('aria-label')).toBe('Sleep 7.5 hours, 88 percent performance');
  });

  it('null sleep announces a meaningful label, never a bare dash', () => {
    renderCard({ sleepHoursLastNight: null, sleepPerformance: null });
    const el = q('[data-testid="whoop-sleep"]');
    const label = el?.getAttribute('aria-label') ?? '';
    expect(label).not.toBe('—');
    expect(label).toBe('Sleep data not yet available');
  });

  it('footer is one accessible element with the live/syncing feeding-score line', () => {
    renderCard({ syncing: false });
    const el = q('[data-testid="whoop-footer"]');
    expect(el?.getAttribute('aria-label')).toBe('INFORMING AFORCE READINESS · LIVE');
  });
});

describe('WhoopSnapshotCard — Dynamic Type clamp on in-ring numerics (Squad-F HIGH #5b)', () => {
  it('the recovery value and its label both receive maxFontSizeMultiplier, so the fixed 132px ring cannot overflow', () => {
    renderCard({ recoveryPct: 72 });
    const AF_MAX_DISPLAY_FONT_SCALE = 1.35;
    const ringTexts = capturedTextProps.filter(
      (p) => p.children === '72%' || p.children === 'RECOVERY',
    );
    expect(ringTexts.length).toBe(2);
    for (const props of ringTexts) {
      expect(props.maxFontSizeMultiplier).toBe(AF_MAX_DISPLAY_FONT_SCALE);
    }
  });
});
