// @vitest-environment happy-dom
/**
 * AFPrice — NON-SHIPPING render harness (RC-1 Wave-1B, fix #5).
 *
 * Renders the real `AFPrice` to a DOM (react-native-web → react-dom,
 * happy-dom), following the pattern established in
 * components/__tests__/whoopSnapshotCard.render.test.tsx: a real i18next
 * instance loaded from the real `locales/en.json`, so the assertion is
 * against actual translated copy, not a fixture string.
 *
 * Defect under test: `value` ("$29.99") and `compareAt` ("$39.99") were two
 * separately accessibilityLabel'd Text nodes — the second one hardcoded the
 * untranslated English word "Was" directly in the label ( `Was ${compareAt}` )
 * — so a screen reader announced two disconnected reads instead of one
 * composed price ("$29.99, was $39.99"), and non-English locales got the
 * wrong word for "was" regardless of the user's language. The fix wraps both
 * in a single accessible row with one composed label built from an i18n key.
 *
 * RC-1 verdict-pass correction (Wave-1 r2, item 2): the original fix reused
 * `logIntake.score_was`, a key scoped to the intake-logging feature and
 * left untranslated (English "was") in ar/hi/ja/ko/zh — an orphan-key reuse
 * across unrelated surfaces. This now uses a dedicated `common.was` key
 * instead (added to all 11 locales; see docs/i18n/TRANSLATION-REVIEW.md for
 * the still-English-source locales pending human translation).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { AFPrice } from '../AFPrice';

const EN_LOCALE = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'));

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

function renderPrice(props: React.ComponentProps<typeof AFPrice>) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(I18nextProvider, { i18n: testI18n }, React.createElement(AFPrice, props)),
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

describe('AFPrice — composed price + compare-at announcement (RC-1 fix #5)', () => {
  it('announces "$X, was $Y" as one composed label, not two separate reads', () => {
    renderPrice({ value: '$29.99', compareAt: '$39.99', testID: 'afprice-sale' });
    const labelled = q('[aria-label]');
    expect(labelled).not.toBeNull();
    expect(labelled?.getAttribute('aria-label')).toBe('$29.99, was $39.99');
  });

  it('uses the dedicated common.was translation — never a hardcoded "Was"', () => {
    renderPrice({ value: '$10.00', compareAt: '$12.00' });
    const labelled = q('[aria-label]');
    // Would read "Was $12.00" (capital W, no comma) under the old bug.
    expect(labelled?.getAttribute('aria-label')).toBe('$10.00, was $12.00');
    expect(labelled?.getAttribute('aria-label')).not.toContain('Was $12.00');
  });

  it('the individual value/compare-at text nodes no longer carry their own accessibilityLabel', () => {
    renderPrice({ value: '$29.99', compareAt: '$39.99' });
    const leaves = Array.from(host.querySelectorAll('*')).filter((el) => el.children.length === 0);
    const valueLeaf = leaves.find((el) => el.textContent === '$29.99');
    const compareLeaf = leaves.find((el) => el.textContent === '$39.99');
    expect(valueLeaf).toBeDefined();
    expect(compareLeaf).toBeDefined();
    expect(valueLeaf?.getAttribute('aria-label')).toBeNull();
    expect(compareLeaf?.getAttribute('aria-label')).toBeNull();
  });

  it('with no compareAt, the composed label degrades to just the value (unchanged visual layout)', () => {
    renderPrice({ value: '$29.99', testID: 'afprice-plain' });
    const labelled = q('[aria-label]');
    expect(labelled?.getAttribute('aria-label')).toBe('$29.99');
    expect(host.textContent).toBe('$29.99');
  });

  it('preserves the visual layout: value and compareAt render in document order inside the row', () => {
    renderPrice({ value: '$29.99', compareAt: '$39.99', caption: '$0.99 / serving' });
    expect(host.textContent).toBe('$29.99$39.99$0.99 / serving');
  });
});
