// @vitest-environment happy-dom
/**
 * AFOfflineBanner — NON-SHIPPING render harness.
 *
 * Renders the real, pure `AFOfflineBanner` to a DOM (react-native-web →
 * react-dom, happy-dom) with a real `i18next` instance loaded from the real
 * `locales/en.json`, following the pattern established in
 * components/health/__tests__/connectedHealthView.render.test.tsx.
 *
 * Mutation-verifies the banner's signal wiring: the component's entire
 * output is a function of two numbers (`pendingCount`, `hasFailedItem`) —
 * these tests assert the banner is silent at `pendingCount <= 0`, appears the
 * moment it goes positive, switches to the distinct "last attempt failed"
 * copy exactly when `hasFailedItem` flips (never based on count alone), and
 * that its accessible label always carries the visible text (never a mute
 * icon-only alert). A wiring bug that fed the wrong outbox selector (e.g.
 * `selectDueIntakes(...).length` instead of `selectPendingCount`) or dropped
 * the `hasFailedItem` distinction would fail these.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { AFOfflineBanner, type AFOfflineBannerProps } from '../AFOfflineBanner';

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

function renderBanner(props: AFOfflineBannerProps) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(I18nextProvider, { i18n: testI18n }, React.createElement(AFOfflineBanner, props)),
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

describe('AFOfflineBanner — pendingCount is the sole visibility signal', () => {
  it('renders nothing when pendingCount is 0', () => {
    renderBanner({ pendingCount: 0 });
    expect(q('[data-testid="af-offline-banner"]')).toBeNull();
    expect(host.textContent).toBe('');
  });

  it('renders nothing for a negative pendingCount (defensive)', () => {
    renderBanner({ pendingCount: -1 });
    expect(q('[data-testid="af-offline-banner"]')).toBeNull();
  });

  it('appears the moment pendingCount goes positive', () => {
    renderBanner({ pendingCount: 1 });
    expect(q('[data-testid="af-offline-banner"]')).not.toBeNull();
  });

  it('is an accessible alert whose label carries the visible text', () => {
    renderBanner({ pendingCount: 2 });
    const el = q('[data-testid="af-offline-banner"]');
    expect(el?.getAttribute('role')).toBe('alert');
    const label = el?.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(host.textContent).toContain(label);
  });
});

describe('AFOfflineBanner — truthful, count-aware copy (queued vs. failed)', () => {
  it('singular queued copy at pendingCount=1, hasFailedItem=false', () => {
    renderBanner({ pendingCount: 1, hasFailedItem: false });
    expect(host.textContent).toBe(
      "1 intake queued — not yet synced. It'll send automatically once you're back online.",
    );
  });

  it('plural queued copy at pendingCount=3, hasFailedItem=false', () => {
    renderBanner({ pendingCount: 3, hasFailedItem: false });
    expect(host.textContent).toBe(
      "3 intakes queued — not yet synced. They'll send automatically once you're back online.",
    );
  });

  it('switches to the distinct "failed" copy when hasFailedItem is true, at the SAME count', () => {
    renderBanner({ pendingCount: 3, hasFailedItem: true });
    expect(host.textContent).toBe(
      '3 intakes queued — the last sync attempt failed. AForce will keep retrying automatically.',
    );
  });

  it('never claims a general "offline" state — copy is scoped to queued/unsynced intakes only', () => {
    renderBanner({ pendingCount: 1, hasFailedItem: true });
    expect(host.textContent?.toLowerCase()).not.toContain("you're offline");
    expect(host.textContent?.toLowerCase()).not.toContain('no connection');
  });

  it('hasFailedItem defaults to false when omitted', () => {
    renderBanner({ pendingCount: 1 });
    expect(host.textContent).toContain('not yet synced');
    expect(host.textContent).not.toContain('last sync attempt failed');
  });
});
