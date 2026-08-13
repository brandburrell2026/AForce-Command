// @vitest-environment happy-dom
/**
 * HomeBaselineHero — first-launch treatment render coverage (Wave 5, founder
 * ruling 2026-08-12).
 *
 * Renders the real component to a DOM (react-native-web → react-dom,
 * happy-dom) against a real i18next instance loaded from the real
 * `locales/en.json`, following `HomeFreshnessLabel.render.test.tsx` in this
 * same directory — assertions run against the copy that actually ships, not a
 * fixture string. `HomeBaselineHero` is store-free and router-free precisely
 * so this is possible without mounting the connected `HomeScreenV2` container
 * (see `homeScreenV2Wiring.test.ts`'s header for that convention).
 *
 * The founder's constraints on this treatment are copy constraints, and copy
 * regressions are invisible to a type checker — so they are asserted here
 * against the shipped strings rather than trusted to review.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { HomeBaselineHero } from '../HomeBaselineHero';

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

let host: HTMLElement;
let root: Root;

function renderHero() {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(
        I18nextProvider,
        { i18n: testI18n },
        React.createElement(HomeBaselineHero, { testID: 'baseline-hero' }),
      ),
    ),
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('HomeBaselineHero — says what is true', () => {
  it('names the state as baseline-building, in the founder-approved spirit', () => {
    renderHero();
    expect(host.textContent).toContain('Building your baseline');
  });

  it('keeps the hero slot labelled with the product\'s name for the state, so the member learns where it will appear', () => {
    renderHero();
    // Correction 6 (build 61): the slot eyebrow is the SAME key the arc carries
    // (`home.v2.readiness_label`), and that key now says HYDROSTATE — the word
    // the product never printed anywhere. Asserted against the shipped value as
    // well as the literal, so the two can never drift apart silently.
    expect(EN_LOCALE.home.v2.readiness_label).toBe('HYDROSTATE');
    expect(host.textContent).toContain('HYDROSTATE');
  });

  it('explains that AForce is still gathering, and points at the one thing to do', () => {
    renderHero();
    const text = host.textContent ?? '';
    expect(text).toContain('learning how your body responds');
    expect(text.toLowerCase()).toContain('log what you drink');
  });
});

describe('HomeBaselineHero — the founder\'s hard constraints on the copy', () => {
  it('invents no physiological state: none of the four band words appear', () => {
    renderHero();
    const upper = (host.textContent ?? '').toUpperCase();
    for (const band of ['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED']) {
      expect(upper).not.toContain(band);
    }
  });

  it('shows no number at all — a score, a percentage or a day count would all be fabricated here', () => {
    renderHero();
    expect(host.textContent ?? '').not.toMatch(/\d/);
  });

  it('gives missing observation no negative meaning', () => {
    renderHero();
    const lower = (host.textContent ?? '').toLowerCase();
    for (const negative of [
      'no data',
      'unavailable',
      'missing',
      'empty',
      'error',
      'unknown',
      'not enough',
      'incomplete',
      'failed',
      'low',
      'depleted',
      'warning',
    ]) {
      expect(lower).not.toContain(negative);
    }
  });

  it('exposes no internal technical language', () => {
    renderHero();
    const lower = (host.textContent ?? '').toLowerCase();
    // CORRECTION 6 (build 61, founder-authorised) RECLASSIFIED ONE TERM.
    // 'hydrostate' used to sit in this list, on the Wave-5 premise that it was
    // an internal engine word. Device QA reversed that premise: the founder
    // could not find HydroState in the product because the product never said
    // it, so HYDROSTATE is now the member-facing NAME of the hero state and
    // this slot's eyebrow. It therefore moved from this forbidden list to a
    // REQUIRED assertion — "keeps the hero slot labelled…" above asserts the
    // rendered text CONTAINS it, and `homeHeroNamingLock.test.ts` locks the
    // shipped value in all 11 locales. Net: the term is more tightly
    // constrained than before, not less. Every other term stays forbidden.
    for (const jargon of [
      'null',
      'rollup',
      'engine',
      'sample',
      'sync',
      'fetch',
      'loading',
      'score',
    ]) {
      expect(lower).not.toContain(jargon);
    }
  });

  it('adds no second call to action — the command card below is still the one move', () => {
    renderHero();
    // A button/link role here would compete with the command card's primary
    // action, which is the hierarchy rule this treatment must not break.
    expect(host.querySelectorAll('button').length).toBe(0);
    expect(host.querySelectorAll('a').length).toBe(0);
    expect(host.querySelector('[role="button"]')).toBeNull();
  });

  it('is not a spinner: nothing in it announces itself as loading', () => {
    renderHero();
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
    expect(host.querySelector('[aria-label="Loading"]')).toBeNull();
  });

  it('mutation-verify: the copy assertions above would catch a reworded en.json key', () => {
    // Proves these tests read the SHIPPED strings rather than a hardcoded
    // expectation that could drift away from the locale file silently.
    expect(EN_LOCALE.home.v2.baseline_title).toBe('Building your baseline');
    expect(EN_LOCALE.home.v2.baseline_body).toContain('learning how your body responds');
  });
});
