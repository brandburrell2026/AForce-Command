// @vitest-environment happy-dom
/**
 * OpeningSequence — the cold-launch readiness number must be MEASURED, never
 * invented (Build 61 correction).
 *
 * Build 60 shipped `DEFAULT_SCORE = 92` behind a `readinessScore > 0` guard, so
 * a member whose real HydroState was 0 met the app with a confident 92 seconds
 * before Home correctly showed them 0. That is the same class of fabrication
 * Waves 4–5 removed everywhere else, and the exact inverse of the first-launch
 * evidence gate's purpose — so the correction is locked here behind rendered
 * output rather than trusted to review.
 *
 * This mounts the REAL overlay to a DOM (react-native-web → react-dom,
 * happy-dom) and drives its own stage timeline with fake timers, because the
 * defect only shows itself in stage 4. The native-only surfaces it happens to
 * carry on the way there (reanimated, react-native-svg, expo-haptics) are
 * stubbed with the same targeted mocks used by
 * `components/__tests__/journalChart.render.test.tsx` — none of them touch the
 * number under test. Copy comes from the real `locales/en.json` via a real
 * i18next instance, following `HomeBaselineHero.render.test.tsx`.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { View as RNView } from 'react-native';

// Deterministic reduce-motion resolution: the component asks the OS on mount
// and we always answer "off", so the full (non-reduced) stage timeline below is
// the one under test and nothing depends on happy-dom's matchMedia.
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const actualAccessibilityInfo = actual.AccessibilityInfo as Record<string, unknown>;
  return {
    ...actual,
    AccessibilityInfo: {
      ...actualAccessibilityInfo,
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: () => ({ remove: () => {} }),
    },
  };
});

vi.mock('react-native-svg', () => {
  const stub = (name: string) => {
    const C = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      React.createElement('svg-stub', { 'data-stub': name, ref }, props.children as React.ReactNode),
    );
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Defs: stub('Defs'),
    Path: stub('Path'),
    RadialGradient: stub('RadialGradient'),
    Rect: stub('Rect'),
    Stop: stub('Stop'),
  };
});

vi.mock('expo-haptics', () => ({
  selectionAsync: vi.fn(() => Promise.resolve()),
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
    in: (e: unknown) => e,
    out: (e: unknown) => e,
    inOut: (e: unknown) => e,
    ease: 'ease',
    sin: 'sin',
    cubic: 'cubic',
    quad: 'quad',
  };
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: (C: unknown) => C },
    useSharedValue,
    useAnimatedStyle,
    withTiming: vi.fn((v: unknown) => v),
    withDelay: vi.fn((_d: number, anim: unknown) => anim),
    withRepeat: vi.fn((anim: unknown) => anim),
    withSequence: vi.fn((...anims: unknown[]) => anims[0]),
    cancelAnimation: vi.fn(),
    Easing,
  };
});

import { OpeningSequence } from '../OpeningSequence';

const EN_LOCALE = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'),
);

const testI18n = i18nCore.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: EN_LOCALE } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/** The em dash the honest-data contract uses for "nothing observed" (U+2014). */
const EM_DASH = '—';

/**
 * Non-reduced stage holds are [1900, 3400, 3400, 2800] ms: stage 4 (readiness)
 * begins at 8700 ms and the sequence self-finishes at 11500 ms. Advancing to
 * 8700 + the 1500 ms count-up (+ margin) lands inside stage 4, well short of
 * the finish, so the number under test is on screen when it is read.
 */
const TO_STAGE_4_MS = 8_700;
const COUNT_UP_MS = 1_600;

let host: HTMLElement;
let root: Root;
const onFinish = vi.fn();

function render(readinessScore?: number, statusLabel = 'REHYDRATE NOW') {
  flushSync(() =>
    root.render(
      React.createElement(
        I18nextProvider,
        { i18n: testI18n },
        React.createElement(OpeningSequence, { readinessScore, statusLabel, onFinish }),
      ),
    ),
  );
}

/** Advance the overlay's own timeline into stage 4 and settle the count-up. */
function runToReadiness() {
  flushSync(() => vi.advanceTimersByTime(TO_STAGE_4_MS));
  flushSync(() => vi.advanceTimersByTime(COUNT_UP_MS));
}

function readinessValue(): string {
  const node = host.querySelector('[data-testid="opening-readiness-value"]');
  if (!node) throw new Error('readiness value node not rendered');
  return (node.textContent ?? '').trim();
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse('2026-08-13T06:00:00.000Z'));
  onFinish.mockClear();
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('OpeningSequence — a real score is displayed, whatever it is', () => {
  it('a real 0 renders as 0 — the state the founder\'s device actually had', () => {
    render(0);
    runToReadiness();
    expect(readinessValue()).toBe('0');
  });

  it('never answers a real 0 with the retired cinematic default', () => {
    render(0);
    runToReadiness();
    expect(host.textContent ?? '').not.toContain('92');
  });

  it('a real mid-band score still counts up to itself', () => {
    render(71);
    runToReadiness();
    expect(readinessValue()).toBe('71');
  });

  it('a real 100 is not clipped on the way through the guard', () => {
    render(100);
    runToReadiness();
    expect(readinessValue()).toBe('100');
  });
});

describe('OpeningSequence — an unloaded score is never a number', () => {
  it('no score at all renders the em-dash glyph, not a figure', () => {
    render(undefined);
    runToReadiness();
    expect(readinessValue()).toBe(EM_DASH);
  });

  it('renders no digit anywhere on screen while the score is unknown', () => {
    render(undefined);
    runToReadiness();
    // The whole overlay, not just the score slot: an unloaded readiness must
    // not leak a number through any other element of the composition either.
    expect(host.textContent ?? '').not.toMatch(/\d/);
  });

  it('a non-finite score (NaN) is "not measured", not zero and not a default', () => {
    render(Number.NaN);
    runToReadiness();
    expect(readinessValue()).toBe(EM_DASH);
  });

  it('the score landing mid-stage counts to the REAL value, never a stranded 0', () => {
    // The engine resolves under the overlay. `null → number` has to start the
    // count-up; if it did not, the slot would flip from the honest em dash to a
    // fabricated 0 — a worse lie than the one being fixed.
    render(undefined);
    flushSync(() => vi.advanceTimersByTime(TO_STAGE_4_MS));
    expect(readinessValue()).toBe(EM_DASH);

    render(71);
    flushSync(() => vi.advanceTimersByTime(COUNT_UP_MS));
    expect(readinessValue()).toBe('71');
  });
});

describe('OpeningSequence — the guard itself', () => {
  it('mutation-verify: the retired `> 0` guard is what these tests catch', () => {
    // Restoring `readinessScore > 0` (with any numeric default) makes the two
    // load-bearing cases above fail: a real 0 would render the default instead
    // of '0', and an absent score would render the default instead of the em
    // dash. Both are asserted on rendered output, so neither can pass silently.
    render(0);
    runToReadiness();
    const zero = readinessValue();

    flushSync(() => root.unmount());
    host.remove();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    render(undefined);
    runToReadiness();
    const absent = readinessValue();

    // Distinct outputs are the whole point: the retired guard collapsed these
    // two states into one fabricated number.
    expect(zero).toBe('0');
    expect(absent).toBe(EM_DASH);
    expect(zero).not.toBe(absent);
  });

  it('the shipped opening copy carries no number of its own to confuse this with', () => {
    // Values only — key names are never rendered (and `skip_a11y` has digits).
    // This is what lets the "no digit anywhere on screen" assertion above mean
    // "no number was invented" rather than "no copy happened to contain one".
    for (const value of Object.values(EN_LOCALE.opening as Record<string, string>)) {
      expect(value).not.toMatch(/\d/);
    }
  });
});
