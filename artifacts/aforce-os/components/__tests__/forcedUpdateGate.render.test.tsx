// @vitest-environment happy-dom
/**
 * The forced-update gate renders NOTHING today, and that is the point.
 *
 * The flag ships off, so the only behaviour a member can currently experience
 * is "the app renders exactly as before". These laws hold that, and separately
 * hold the accessibility and offline affordances of the screen it WOULD show —
 * so activation later is a flag flip against a surface already reviewed,
 * rather than a screen written during an incident.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import en from '../../locales/en.json';

vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], en) ?? k,
  }),
}));

import { ForcedUpdateGate } from '../ForcedUpdateGate';
import * as support from '@/services/clientSupport';
import { Platform } from 'react-native';

let host: HTMLElement;
let root: Root | null = null;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { if (root) flushSync(() => root!.unmount()); root = null; host.remove(); vi.restoreAllMocks(); });

const render = () => {
  root = createRoot(host);
  flushSync(() => root!.render(
    React.createElement(ForcedUpdateGate, null, React.createElement('div', { id: 'app' }, 'THE APP')),
  ));
  return (host.textContent ?? '').replace(/\s+/g, ' ').trim();
};

describe('with the flag OFF — the shipping state', () => {
  it('renders the app and never the gate, even when the verdict is unsupported', () => {
    vi.spyOn(support, 'evaluateOwnSupport').mockReturnValue('unsupported');
    expect(support.FORCED_UPDATE_UI_ENABLED).toBe(false);
    const text = render();
    expect(text).toContain('THE APP');
    expect(host.querySelector('[data-testid="forced-update-gate"]')).toBeNull();
    expect(text).not.toContain(en.update.required_title);
  });

  it('renders the app when nothing is known, which is every member today', () => {
    expect(render()).toContain('THE APP');
  });
});

describe('the screen it would show, once activated', () => {
  beforeEach(() => {
    vi.spyOn(support, 'shouldBlockForUpgrade').mockReturnValue(true);
    vi.spyOn(support, 'evaluateOwnSupport').mockReturnValue('unsupported');
  });

  it('replaces the app rather than layering over it', () => {
    const text = render();
    expect(text).not.toContain('THE APP');
    expect(text).toContain(en.update.required_title);
  });

  it('ACCESSIBILITY: announced as an alert, with a header and a labelled action', () => {
    render();
    expect(host.querySelector('[role="alert"]'), 'screen readers must be told').not.toBeNull();
    // react-native-web renders `accessibilityRole="header"` as a real
    // heading element, which is what a screen reader needs.
    expect(host.querySelector('[role="heading"]'), 'the title must be a heading').not.toBeNull();
  });

  it('the store action is labelled and hinted, on a platform that has a store', () => {
    // `Platform.select` yields no URL under the web test renderer — the gate
    // is a native surface — so the button is asserted with the platform
    // pinned to iOS rather than by weakening the assertion.
    vi.spyOn(Platform, 'select').mockReturnValue('https://apps.apple.com/app/id0000000000');
    render();
    const btn = host.querySelector('[role="button"]');
    expect(btn, 'the action must be reachable').not.toBeNull();
    expect(btn!.getAttribute('aria-label')).toBe(en.update.required_cta);
  });

  it('OFFLINE: it is useful with no network and never says the data is gone', () => {
    // A blocked member cannot reach the app, so this screen has to stand on
    // its own — and must not imply their history was lost.
    const text = render();
    expect(text).toContain(en.update.required_offline_note);
    expect(text).toMatch(/history is safe|Nothing has been lost/i);
    expect(text).not.toMatch(/deleted|erased|lost your/i);
  });
});
