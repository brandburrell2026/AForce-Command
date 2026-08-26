// @vitest-environment happy-dom
/**
 * PerformanceSignalV3 — A FAILED READ MUST NOT LOOK LIKE AN EMPTY WEEK
 * (Build 61 correction, read leg).
 *
 * Build 60's `load()` swallowed a thrown fetch into
 * `setRollups((prev) => prev ?? [])`. Three consequences, all of which shipped:
 *   1. A 401 / 5xx / timeout became an EMPTY ARRAY — indistinguishable from an
 *      account that genuinely has no tracked days.
 *   2. Because the failure and the empty account shared one branch, the error
 *      replaced the ENTIRE body: the week already on screen, every section and
 *      every affordance went with it.
 *   3. `rollups` going non-null also tripped the loading→loaded announcement, so
 *      a screen-reader member was told "History loaded" over a read that failed.
 *
 * The wiring guard next door (`performanceSignalV3Wiring.test.ts`) reads source
 * text. That is the right tool for "is the shipped primitive imported", but it
 * cannot answer the founder's three regression questions — does TRY AGAIN
 * actually re-invoke the fetch, does a failure fabricate data, do the
 * history-dependent sections degrade independently — because all three are
 * about what the component DOES at runtime. So this file mounts the REAL screen
 * to a DOM (react-native-web → react-dom, happy-dom) and drives it, following
 * `components/opening/__tests__/OpeningSequence.render.test.tsx`, the Build-61
 * harness for the same class of question.
 *
 * Everything mocked below is either a native surface on the way to the screen
 * (reanimated, haptics, safe-area, the one feature flag the button family
 * reads) or the network boundary itself — `fetchJournalRollups`, the thing
 * whose failure IS the subject. None of them touch the load/render decisions
 * being asserted. Copy comes from the real `locales/en.json` through a real
 * i18next instance, so a test can never pass against a string the app doesn't
 * ship.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { View as RNView } from 'react-native';

import type { JournalRollup } from '@/types';

vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Pulled in by the `@/components/ui` barrel (AFReadinessArc / AFChart /
// AFProgressRing / AFEditorialHero), never rendered by this screen.
vi.mock('expo-linear-gradient', () => ({ LinearGradient: RNView }));
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
    Circle: stub('Circle'),
    G: stub('G'),
    Polyline: stub('Polyline'),
    Rect: stub('Rect'),
    Line: stub('Line'),
    Defs: stub('Defs'),
    Path: stub('Path'),
    Stop: stub('Stop'),
    LinearGradient: stub('LinearGradient'),
  };
});

// The button family reads exactly one flag (elite motion). Off = the static
// press path, which is this screen's shipped posture.
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({ elite_motion_enabled: false }),
}));

vi.mock('expo-haptics', () => ({
  selectionAsync: vi.fn(() => Promise.resolve()),
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
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
    linear: 'linear',
    sin: 'sin',
    cubic: 'cubic',
    quad: 'quad',
    bezier: () => 'bezier',
  };
  return {
    __esModule: true,
    default: { View: RNView, createAnimatedComponent: (C: unknown) => C },
    useSharedValue,
    useAnimatedStyle,
    // Reduced motion ON: the shipped static alternative for every primitive
    // here, and the posture that keeps this harness deterministic.
    useReducedMotion: () => true,
    withTiming: vi.fn((v: unknown) => v),
    withDelay: vi.fn((_d: number, anim: unknown) => anim),
    withRepeat: vi.fn((anim: unknown) => anim),
    withSequence: vi.fn((...anims: unknown[]) => anims[0]),
    cancelAnimation: vi.fn(),
    Easing,
  };
});

const fetchJournalRollups = vi.fn<(days: number) => Promise<JournalRollup[]>>();
vi.mock('@/services/realApi', () => ({
  fetchJournalRollups: (days: number) => fetchJournalRollups(days),
}));

import { PerformanceSignalV3 } from '../PerformanceSignalV3';

const EN_LOCALE = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'),
) as { signal: { v3: Record<string, string> } };
const V3 = EN_LOCALE.signal.v3;

const testI18n = i18nCore.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: EN_LOCALE } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/** Two real-shaped rollup days — the "history is already on screen" fixture. */
function rollupDays(): JournalRollup[] {
  const day = (date: string, avgScore: number, oz: number): JournalRollup => ({
    date,
    snapshotsCount: 11,
    avgScore,
    minScore: avgScore - 8,
    maxScore: avgScore + 6,
    endOzConsumed: oz,
    endAforceUnits: 2,
    endUnitsConsumed: 6,
    endSodiumDelivered: 900,
    endSodiumLost: 700,
    endDeficitPct: 12,
    pctTimePeak: 30,
    pctTimeBalanced: 45,
    pctTimeRecovering: 20,
    pctTimeDepleted: 5,
    intakeCount: 6,
    autopilotSessions: 0,
    socialSessions: 0,
  });
  return [day('2026-08-11', 82, 96), day('2026-08-12', 71, 74)];
}

const DAY_ROWS = '[data-testid^="signal-v3-day-"]';

let host: HTMLElement;
let root: Root;

const q = (sel: string) => host.querySelector(sel);
const qa = (sel: string) => Array.from(host.querySelectorAll(sel));
const byTestId = (id: string) => q(`[data-testid="${id}"]`) as HTMLElement | null;

/** Renders the screen. Timers are NOT advanced — the mount-retry backoff stays
 *  parked, which several scenarios below depend on. */
async function mount() {
  await act(async () => {
    root.render(
      React.createElement(
        I18nextProvider,
        { i18n: testI18n },
        React.createElement(PerformanceSignalV3, {}),
      ),
    );
  });
  await act(async () => {});
}

/** Drains the mount-retry backoffs (1500 ms, then 4000 ms) and everything they
 *  schedule, so the component is quiescent and any further fetch can only have
 *  come from a tap. */
async function drainRetryLoop() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  }
}

async function mountAndSettle() {
  await mount();
  await drainRetryLoop();
}

/** The retry control inside a given testID'd container. */
function retryControlIn(testId: string): HTMLElement {
  const el = byTestId(testId);
  expect(el, `expected "${testId}" on screen`).not.toBeNull();
  const btn = el!.matches('[role="button"]') ? el : el!.querySelector('[role="button"]');
  expect(btn, `expected a retry button inside "${testId}"`).not.toBeNull();
  return btn as HTMLElement;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {});
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  fetchJournalRollups.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  host.remove();
  vi.useRealTimers();
});

/**
 * Reaches the one state the component cannot arrive at from mount alone: a real
 * week ON SCREEN with a failed read behind it.
 *
 * The route is the natural one. The mount read fails, so the retry loop parks on
 * its 1500 ms backoff; the member taps TRY AGAIN and that read succeeds, putting
 * the week up; then the parked background retry fires and fails. `rollups` keeps
 * the week, `error` goes true — the stale case.
 */
async function reachStaleWeek() {
  fetchJournalRollups
    .mockRejectedValueOnce(new Error('GET /journal/rollups → 401'))
    .mockResolvedValueOnce(rollupDays())
    .mockRejectedValue(new Error('offline'));
  await mount();
  await click(retryControlIn('signal-v3-unknown'));
  expect(qa(DAY_ROWS), 'the manual retry should have loaded the week').toHaveLength(2);
  await drainRetryLoop();
}

describe('PerformanceSignalV3 — TRY AGAIN actually retries', () => {
  it('re-invokes the fetch on every tap, from the failed-read retry', async () => {
    fetchJournalRollups.mockRejectedValue(new Error('GET /journal/rollups → 401'));
    await mountAndSettle();

    // Mount + both backoff retries have run and stopped. Nothing fires on its
    // own from here, so any further call can only come from the tap.
    const settled = fetchJournalRollups.mock.calls.length;
    expect(settled).toBeGreaterThan(0);
    await drainRetryLoop();
    expect(fetchJournalRollups.mock.calls.length).toBe(settled);

    await click(retryControlIn('signal-v3-unknown'));
    expect(fetchJournalRollups.mock.calls.length).toBe(settled + 1);

    await click(retryControlIn('signal-v3-unknown'));
    expect(fetchJournalRollups.mock.calls.length).toBe(settled + 2);
  });

  it('re-invokes the fetch from the inline notice over a stale week too', async () => {
    await reachStaleWeek();
    expect(byTestId('signal-v3-stale')).not.toBeNull();

    const settled = fetchJournalRollups.mock.calls.length;
    await click(retryControlIn('signal-v3-stale'));
    expect(fetchJournalRollups.mock.calls.length).toBe(settled + 1);
  });

  it('a successful retry replaces the failure with the real week', async () => {
    fetchJournalRollups.mockRejectedValue(new Error('boom'));
    await mountAndSettle();
    expect(byTestId('signal-v3-unknown')).not.toBeNull();

    fetchJournalRollups.mockReset();
    fetchJournalRollups.mockResolvedValue(rollupDays());
    await click(retryControlIn('signal-v3-unknown'));
    await drainRetryLoop();

    expect(byTestId('signal-v3-unknown')).toBeNull();
    expect(byTestId('signal-v3-load-error')).toBeNull();
    expect(byTestId('signal-v3-stale')).toBeNull();
    expect(byTestId('signal-v3-summary')).not.toBeNull();
    expect(qa(DAY_ROWS)).toHaveLength(2);
  });
});

describe('PerformanceSignalV3 — a failed read fabricates nothing', () => {
  it('does not render the empty-account state for a read that threw', async () => {
    fetchJournalRollups.mockRejectedValue(new Error('GET /journal/rollups → 500'));
    await mountAndSettle();

    // THE defect: `prev ?? []` made this block render, telling a member with a
    // full history that they had never tracked a day.
    expect(byTestId('signal-v3-empty')).toBeNull();
    expect(host.textContent).not.toContain(V3.empty_title);
    expect(host.textContent).not.toContain(V3.empty_body);
  });

  it('invents no days, no average and no coverage claim behind the failure', async () => {
    fetchJournalRollups.mockRejectedValue(new Error('timeout'));
    await mountAndSettle();

    expect(qa(DAY_ROWS)).toHaveLength(0);
    expect(byTestId('signal-v3-summary')).toBeNull();
    expect(byTestId('signal-v3-week-detail')).toBeNull();
    // "0 of 7 days tracked" is a measurement of coverage, and the screen has no
    // grounds to state one: it does not know what the week holds.
    expect(host.textContent).not.toContain(
      testI18n.t('signal.v3.days_tracked', { n: 0, total: 7 }),
    );
  });

  it('says the read failed, in the shipped inline error row', async () => {
    fetchJournalRollups.mockRejectedValue(new Error('nope'));
    await mountAndSettle();

    const row = byTestId('signal-v3-load-error');
    expect(row).not.toBeNull();
    expect(row!.getAttribute('role')).toBe('alert');
    expect(row!.getAttribute('aria-label')).toBe(V3.load_failed);
    expect(host.textContent).toContain(V3.load_failed_body);
  });

  it('keeps the skeleton — a promise that data is coming — off a failed read', async () => {
    fetchJournalRollups.mockRejectedValue(new Error('nope'));
    await mountAndSettle();
    expect(byTestId('signal-v3-loading')).toBeNull();
  });

  it('still shows the genuine empty state when the read SUCCEEDS with no days', async () => {
    fetchJournalRollups.mockResolvedValue([]);
    await mountAndSettle();

    expect(byTestId('signal-v3-empty')).not.toBeNull();
    expect(host.textContent).toContain(V3.empty_title);
    // …and claims nothing failed.
    expect(byTestId('signal-v3-load-error')).toBeNull();
    expect(byTestId('signal-v3-unknown')).toBeNull();
    expect(byTestId('signal-v3-stale')).toBeNull();
  });
});

describe('PerformanceSignalV3 — history-dependent sections degrade independently', () => {
  it('a failed read takes the history only — the screen root survives it', async () => {
    fetchJournalRollups.mockRejectedValue(new Error('401'));
    await mountAndSettle();

    // Before the fix the error WAS the body: it rendered as the screen's whole
    // content block, in the empty account's slot. Now the root — eyebrow, title,
    // scroll surface — carries an inline alert ABOVE a history region that
    // failed on its own, and the empty account's block is nowhere near it.
    expect(host.textContent).toContain(V3.title);
    expect(host.textContent).toContain(V3.eyebrow.toUpperCase());
    const row = byTestId('signal-v3-load-error');
    expect(row).not.toBeNull();
    expect(row!.getAttribute('role')).toBe('alert');
    expect(byTestId('signal-v3-empty')).toBeNull();
  });

  it('keeps the week, its rows and its affordances when a refresh fails over them', async () => {
    await reachStaleWeek();

    // Every history-dependent section is still standing; only the failure was
    // added. A refresh that failed must not cost the member the week they had.
    expect(byTestId('signal-v3-summary')).not.toBeNull();
    expect(qa(DAY_ROWS)).toHaveLength(2);
    expect(byTestId('signal-v3-week-detail')).not.toBeNull();
    // …and the failure is stated, not swallowed.
    expect(byTestId('signal-v3-stale')!.getAttribute('aria-label')).toBe(V3.stale_notice);
  });

  it('renders the failure ABOVE the sections it qualifies, never in place of them', async () => {
    await reachStaleWeek();

    const order = qa(
      '[data-testid="signal-v3-stale"], [data-testid="signal-v3-summary"], ' + DAY_ROWS,
    ).map((el) => el.getAttribute('data-testid'));
    expect(order[0]).toBe('signal-v3-stale');
    expect(order[1]).toBe('signal-v3-summary');
  });

  it('never shows two contradictory history states at once', async () => {
    for (const scenario of ['fail', 'empty', 'days'] as const) {
      fetchJournalRollups.mockReset();
      if (scenario === 'fail') fetchJournalRollups.mockRejectedValue(new Error('x'));
      if (scenario === 'empty') fetchJournalRollups.mockResolvedValue([]);
      if (scenario === 'days') fetchJournalRollups.mockResolvedValue(rollupDays());
      await mountAndSettle();

      const shown = ['signal-v3-loading', 'signal-v3-empty', 'signal-v3-unknown'].filter(
        (id) => byTestId(id) !== null,
      );
      expect(shown, `scenario "${scenario}" must show at most one history state`).toHaveLength(
        scenario === 'days' ? 0 : 1,
      );
      await act(async () => {
        root.unmount();
      });
      root = createRoot(host);
    }
  });
});
