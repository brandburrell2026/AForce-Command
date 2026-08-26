// @vitest-environment happy-dom
/**
 * LiveStatusLine — af.* token + i18n migration (RC-1 Wave-1 r2, item 5).
 *
 * Renders the real `LiveStatusLine` to a DOM (react-native-web → react-dom,
 * happy-dom), following the pattern in
 * `components/ui/__tests__/AFPrice.render.test.tsx`: a real i18next instance
 * loaded from the real `locales/en.json`, so assertions run against actual
 * translated copy rather than a fixture string.
 *
 * Defect under test: the component previously hardcoded English strings
 * ("LAST", "pts", the `StatusVerb` values, and the `Trend ${verb}`
 * accessibility label) and styled itself from `Colors`/raw `rgba(...)`/
 * literal `Inter_*` font-family strings instead of the shared `af.*`/
 * `afType` token layer. This suite proves: (1) every rendered string now
 * resolves through `t()` against `home.live_status.*` keys, (2) the
 * accessibility label composes the translated verb, and (3) the "flat /
 * fresh" collapse to verb-only still holds with the new keys.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { LiveStatusLine } from '../LiveStatusLine';

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

function renderLine(props: React.ComponentProps<typeof LiveStatusLine>) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(I18nextProvider, { i18n: testI18n }, React.createElement(LiveStatusLine, props)),
    ),
  );
}

const q = (sel: string) => host.querySelector(sel);

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('LiveStatusLine — localized copy (RC-1 Wave-1 r2, item 5)', () => {
  it('renders the translated "LAST" label and "pts" suffix, not hardcoded English literals baked into JSX', () => {
    renderLine({ direction: 'rising', delta: 3, ageSec: 12, verb: 'ASCENDING', accent: '#1FA35A', testID: 'live-status' });
    expect(host.textContent).toContain('+3 pts');
    expect(host.textContent).toContain('LAST 12s');
    // en.json's values happen to equal the old hardcoded strings — this only
    // proves the copy round-trips through i18n, not that English changed.
    expect(EN_LOCALE.home.live_status.last_label).toBe('LAST');
    expect(EN_LOCALE.home.live_status.pts_suffix).toBe('pts');
  });

  it('renders each StatusVerb through its dedicated i18n key', () => {
    const cases: Array<[React.ComponentProps<typeof LiveStatusLine>['verb'], string]> = [
      ['ASCENDING', 'ASCENDING'],
      ['LOCKED IN', 'LOCKED IN'],
      ['HOLDING', 'HOLDING'],
      ['DRIFTING', 'DRIFTING'],
      ['DECLINING', 'DECLINING'],
      ['RECOVERING', 'RECOVERING'],
      ['CRITICAL', 'CRITICAL'],
    ];
    for (const [verb, expectedText] of cases) {
      renderLine({ direction: 'flat', delta: 0, ageSec: 0, verb, accent: '#00E5C8' });
      expect(host.textContent).toContain(expectedText);
      flushSync(() => root.unmount());
    }
  });

  it('composes the accessibilityLabel from the translated verb via home.live_status.a11y_label', () => {
    renderLine({ direction: 'falling', delta: -2, ageSec: 40, verb: 'DECLINING', accent: '#FF2800', testID: 'live-status-a11y' });
    const el = q('[data-testid="live-status-a11y"]');
    expect(el?.getAttribute('aria-label')).toBe('Trend DECLINING');
  });

  it('flat / freshly-mounted state still collapses to verb-only (no window), with the new i18n wiring', () => {
    renderLine({ direction: 'flat', delta: 0, ageSec: 2, verb: 'HOLDING', accent: '#00E5C8', testID: 'live-status-flat' });
    expect(host.textContent).not.toContain('LAST');
    expect(host.textContent).not.toContain('pts');
    expect(host.textContent).toContain('HOLDING');
    const el = q('[data-testid="live-status-flat"]');
    expect(el?.getAttribute('aria-label')).toBe('Trend HOLDING');
  });
});

/**
 * HOME HIERARCHY — the verb is optional, and silence is a valid render
 * (founder §1, 2026-08-13; see this component's header and
 * `homeHierarchyPremium.test.ts` for the call-site gate).
 *
 * These are ADDITIVE: every assertion above still holds, including that a
 * CRITICAL passed IN still renders — the verb set and `services/statusVerb.ts`
 * are unchanged, and it is Home that withholds it.
 */
describe('LiveStatusLine — no verb to report (founder §1)', () => {
  it('renders NOTHING when there is neither a verb nor a measurement window', () => {
    // The exact first-paint case: `useScoreTrend` starts at 'flat', and Home
    // withholds the verb, so there is no momentum to draw. A bare arrow glyph
    // holding the line under the hero is what this replaces.
    renderLine({ direction: 'flat', delta: 0, ageSec: 0, accent: '#00E5C8', testID: 'live-status-silent' });
    expect(q('[data-testid="live-status-silent"]')).toBeNull();
    expect(host.textContent).toBe('');
  });

  it('renders NOTHING for a fresh direction that has not opened a window yet', () => {
    // `showWindow` needs ageSec >= 5; before that there is no delta to show and
    // (with the verb withheld) nothing else to say.
    renderLine({ direction: 'rising', delta: 3, ageSec: 2, accent: '#1FA35A', testID: 'live-status-fresh' });
    expect(q('[data-testid="live-status-fresh"]')).toBeNull();
    expect(host.textContent).toBe('');
  });

  it('still reports real momentum without a verb: arrow + delta + window, no verdict', () => {
    // DEPLETED + falling is where `getStatusVerb` returns CRITICAL, so this is
    // what a genuinely declining member now sees — the measurement, not a
    // second, louder restatement of the band word above it.
    renderLine({ direction: 'falling', delta: -4, ageSec: 30, accent: '#E4564A', testID: 'live-status-nover' });
    const el = q('[data-testid="live-status-nover"]');
    expect(el).not.toBeNull();
    expect(host.textContent).toContain('-4 pts');
    expect(host.textContent).toContain('LAST 30s');
    for (const verb of ['CRITICAL', 'DECLINING', 'DRIFTING', 'HOLDING']) {
      expect(host.textContent).not.toContain(verb);
    }
  });

  it('speaks the measurement when there is no verb to announce', () => {
    // "Trend " with an empty verb would be an announcement of nothing; the
    // label carries the same strings the sighted member reads instead.
    renderLine({ direction: 'falling', delta: -4, ageSec: 30, accent: '#E4564A', testID: 'live-status-a11y-nover' });
    expect(q('[data-testid="live-status-a11y-nover"]')?.getAttribute('aria-label')).toBe(
      '-4 pts LAST 30s',
    );
  });

  it('a verb that IS passed still renders and still leads the spoken label', () => {
    // Proves the suppression is the CALLER's decision, not something baked in
    // here: this component did not lose the ability to show a verb.
    renderLine({ direction: 'falling', delta: -4, ageSec: 30, verb: 'DECLINING', accent: '#E4564A', testID: 'live-status-verb' });
    expect(host.textContent).toContain('DECLINING');
    expect(host.textContent).toContain('-4 pts');
    expect(q('[data-testid="live-status-verb"]')?.getAttribute('aria-label')).toBe('Trend DECLINING');
  });
});
