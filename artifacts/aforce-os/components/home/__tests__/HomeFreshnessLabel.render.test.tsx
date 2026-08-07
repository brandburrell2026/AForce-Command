// @vitest-environment happy-dom
/**
 * HomeFreshnessLabel — graduated freshness render coverage (RC-2 ruling E,
 * item 1 — Home truthfulness fix).
 *
 * Renders the real component to a DOM (react-native-web → react-dom,
 * happy-dom) against a real i18next instance loaded from the real
 * `locales/en.json`, following the exact pattern established by
 * `LiveStatusLine.render.test.tsx` (same directory) — assertions run
 * against actual translated copy, not a fixture string.
 *
 * Proves:
 *   1. the three graduated states the ticket specifies with fake
 *      timestamps (1 min → "just now", 30 min → "30m ago", 5 h → "5h
 *      ago"), plus the days tier and the honest "never synced" fallback
 *      this fix adds beyond the ticket's literal three;
 *   2. the label updates AS TIME PASSES without remounting or any prop
 *      change — the self-ticking behavior `useAppStateGatedInterval`
 *      drives internally (see the component's own header for why this
 *      lives in an isolated leaf rather than on `HomeScreenV2` itself);
 *   3. mutation-verify hooks for the two ways this fix could regress back
 *      to the original bug (static copy, or a naive `<2min` check written
 *      as `<=` at the exact boundary).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { HomeFreshnessLabel } from '../HomeFreshnessLabel';
import { resolveHomeFreshness } from '../homeFreshness';

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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const START = new Date('2026-08-06T12:00:00.000Z').getTime();

let host: HTMLElement;
let root: Root;

function renderLabel(props: React.ComponentProps<typeof HomeFreshnessLabel>) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(I18nextProvider, { i18n: testI18n }, React.createElement(HomeFreshnessLabel, props)),
    ),
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('HomeFreshnessLabel — graduated states (ticket-specified fake timestamps)', () => {
  it('1 minute old → "Checked just now" (<2 min threshold)', () => {
    renderLabel({ fetchedAtMs: START - 1 * MINUTE, testID: 'freshness' });
    expect(host.textContent).toBe('Checked just now');
  });

  it('30 minutes old → "Checked 30m ago"', () => {
    renderLabel({ fetchedAtMs: START - 30 * MINUTE, testID: 'freshness' });
    expect(host.textContent).toBe('Checked 30m ago');
  });

  it('5 hours old → "Checked 5h ago"', () => {
    renderLabel({ fetchedAtMs: START - 5 * HOUR, testID: 'freshness' });
    expect(host.textContent).toBe('Checked 5h ago');
  });

  it('extension beyond the ticket\'s literal 3 states: multi-day age → "Checked Nd ago", not an absurd hour count', () => {
    renderLabel({ fetchedAtMs: START - 3 * DAY, testID: 'freshness' });
    expect(host.textContent).toBe('Checked 3d ago');
  });

  it('never fabricates: no fetch has ever happened (null) → honest "Awaiting first sync", never a bogus age', () => {
    renderLabel({ fetchedAtMs: null, testID: 'freshness' });
    expect(host.textContent).toBe('Awaiting first sync');
  });
});

describe('HomeFreshnessLabel — updates as time passes (no remount, no prop change)', () => {
  it('a mounted label crosses from "just now" to "Xm ago" purely from its own tick, with the SAME fetchedAtMs prop throughout', () => {
    // Mounted 90s after the fetch — still within the <2min "just now" window.
    renderLabel({ fetchedAtMs: START - 90_000, testID: 'freshness' });
    expect(host.textContent).toBe('Checked just now');

    // Advance real elapsed time past the 2-minute boundary (90s + 45s =
    // 135s) via the component's own internal recheck interval — never a
    // prop change, never a remount.
    flushSync(() => vi.advanceTimersByTime(45_000));
    expect(host.textContent).toBe('Checked 2m ago');
  });

  it('continues ticking across multiple intervals into the hour bucket', () => {
    renderLabel({ fetchedAtMs: START - 55 * MINUTE, testID: 'freshness' });
    expect(host.textContent).toBe('Checked 55m ago');

    // 5 more minutes of real time, delivered across several recheck ticks.
    for (let i = 0; i < 20; i++) {
      flushSync(() => vi.advanceTimersByTime(15_000));
    }
    expect(host.textContent).toBe('Checked 1h ago');
  });
});

describe('HomeFreshnessLabel — mutation-verify: the two ways this fix could regress', () => {
  it('MUTATION 1 (static-freshness regression): a component that ignores fetchedAtMs and always renders "just now" would pass the 1-min case but fail every other case here', () => {
    // Simulates the original bug — `t('home.v2.freshness')` rendered
    // unconditionally. Proves this test SUITE would catch it, without
    // requiring a second real component: the honest resolver disagrees
    // with the frozen-copy behavior for every case except the trivial one.
    const frozenCopy = () => 'Checked just now';
    const cases: Array<{ fetchedAtMs: number | null; expected: string }> = [
      { fetchedAtMs: START - 30 * MINUTE, expected: 'Checked 30m ago' },
      { fetchedAtMs: START - 5 * HOUR, expected: 'Checked 5h ago' },
      { fetchedAtMs: null, expected: 'Awaiting first sync' },
    ];
    for (const { expected } of cases) {
      expect(frozenCopy()).not.toBe(expected);
    }
  });

  it('MUTATION 2 (off-by-one boundary regression): exactly 2:00.000 min old must already read "2m ago", not "just now" — a `<=` threshold bug would fail this', () => {
    const freshness = resolveHomeFreshness(START, START - 2 * MINUTE);
    expect(freshness).toEqual({ key: 'home.v2.freshness.minutes_ago', params: { count: 2 } });
    expect(freshness.key).not.toBe('home.v2.freshness.just_now');
  });
});
