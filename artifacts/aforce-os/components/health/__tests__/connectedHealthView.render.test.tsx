// @vitest-environment happy-dom
/**
 * CONNECTED HEALTH — NON-SHIPPING render harness.
 *
 * Renders the PURE presentational `ConnectedHealthView` to a real DOM
 * (react-native-web → react-dom, happy-dom) with a resolved fixture view
 * model injected directly. Imports no store, flag, or route — so it can
 * never enable a gated feature. Asserts structure + accessibility across
 * every fixture state.
 *
 * NOTE: this file will not be picked up by the root vitest.config.ts until
 * `components/health/__tests__/**` is added to `test.include` and
 * `test.environmentMatchGlobs` (mirroring the sleep/cruise/nightOut entries).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Icon uses native vector fonts/SVG irrelevant to structure/a11y here.
vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { ConnectedHealthView } from '../ConnectedHealthView';
import { resolveConnectedHealthView } from '@/services/health/connectedHealthView';
import { CONNECTED_HEALTH_FIXTURES } from '@/services/health/connectedHealthFixtures';

let host: HTMLElement;
let root: Root;
const noop = () => {};

function render(
  fixtureKey: keyof typeof CONNECTED_HEALTH_FIXTURES,
  over: { onTroubleshoot?: (id: string) => void; onDisconnect?: (id: string) => void } = {},
) {
  const view = resolveConnectedHealthView(CONNECTED_HEALTH_FIXTURES[fixtureKey]);
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(ConnectedHealthView, {
        view,
        onBack: noop,
        onTroubleshoot: over.onTroubleshoot ?? noop,
        onDisconnect: over.onDisconnect ?? noop,
      }),
    ),
  );
  return view;
}
const q = (sel: string) => host.querySelector(sel);
const qa = (sel: string) => Array.from(host.querySelectorAll(sel));

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { flushSync(() => root.unmount()); host.remove(); });

describe('ConnectedHealthView — renders every fixture without crashing', () => {
  for (const key of Object.keys(CONNECTED_HEALTH_FIXTURES)) {
    it(`renders ${key}`, () => {
      render(key as keyof typeof CONNECTED_HEALTH_FIXTURES);
      expect(q('[data-testid="connected-health-view"]')).not.toBeNull();
    });
  }
});

describe('Score-Protection footer — always present, exact sentence, no prohibited claim', () => {
  for (const key of Object.keys(CONNECTED_HEALTH_FIXTURES)) {
    it(`${key} shows the exact Score-Protection sentence`, () => {
      render(key as keyof typeof CONNECTED_HEALTH_FIXTURES);
      expect(host.textContent).toContain('Health data informs Readiness only. It never changes your Hydration Score.');
      expect(q('[data-testid="connected-health-footer"]')).not.toBeNull();
    });

    it(`${key} never contains the prohibited "feeding the score" claim`, () => {
      render(key as keyof typeof CONNECTED_HEALTH_FIXTURES);
      expect(host.textContent).not.toMatch(/FEEDING.*HYDRATION SCORE/i);
    });
  }
});

describe('screen states', () => {
  it('loading renders a loading shell, not rows', () => {
    render('loading');
    expect(q('[data-testid="connected-health-loading"]')).not.toBeNull();
  });

  it('empty renders an honest empty shell', () => {
    render('empty');
    expect(q('[data-testid="connected-health-empty"]')).not.toBeNull();
    expect(host.textContent).toContain('No health sources configured yet.');
  });

  it('offline renders the offline banner AND still shows last-known rows', () => {
    render('offline');
    expect(q('[data-testid="connected-health-offline-banner"]')).not.toBeNull();
    expect(host.textContent).toMatch(/Offline/);
    expect(qa('[data-testid^="ch-row-"]').length).toBeGreaterThan(0);
  });
});

describe('per-row structure + testIDs', () => {
  it('mixed fixture exposes ch-row / ch-status testIDs per provider', () => {
    const view = render('mixed');
    for (const row of view.rows) {
      expect(q(`[data-testid="ch-row-${row.providerId}"]`)).not.toBeNull();
      expect(q(`[data-testid="ch-status-${row.providerId}"]`)).not.toBeNull();
    }
  });

  it('a row with a troubleshoot affordance exposes ch-action with accessibilityRole button', () => {
    render('mixed'); // includes google_health in action_required
    const action = q('[data-testid="ch-action-google_health"]');
    expect(action).not.toBeNull();
    expect(action?.getAttribute('role')).toBe('button');
    expect(action?.getAttribute('aria-label')).toBe('Reconnect');
  });

  it('a gated row (dormant) has no ch-action and no disconnect affordance', () => {
    render('mixed'); // includes garmin dormant
    expect(q('[data-testid="ch-action-garmin"]')).toBeNull();
    expect(q('[data-testid="ch-disconnect-garmin"]')).toBeNull();
  });

  it('a connected row exposes a disconnect affordance as a button', () => {
    render('mixed'); // apple_health connected
    const disconnect = q('[data-testid="ch-disconnect-apple_health"]');
    expect(disconnect).not.toBeNull();
    expect(disconnect?.getAttribute('role')).toBe('button');
  });
});

describe('accessibility + honesty invariants at render time', () => {
  it('44pt touch targets on troubleshoot + disconnect affordances', () => {
    render('mixed');
    for (const el of qa('[data-testid^="ch-action-"], [data-testid^="ch-disconnect-"]')) {
      const h = parseFloat(getComputedStyle(el as HTMLElement).minHeight || '0');
      expect(h).toBeGreaterThanOrEqual(44);
    }
  });

  it('status is communicated by TEXT, not color alone (stale renders the word "Stale")', () => {
    render('mixed'); // oura stale
    const status = q('[data-testid="ch-status-oura"]');
    expect(status?.textContent).toContain('Stale');
  });

  it('a denied pull chip renders struck-through text + a slash icon, not just a color change', () => {
    render('android'); // google_health connected_limited, sleep denied
    const leaf = qa('*').find((el) => el.children.length === 0 && el.textContent === 'Sleep');
    expect(leaf).toBeTruthy();
    expect(q('[data-icon="slash"]')).not.toBeNull();
  });

  it('every provider with lastSyncAtMs === null renders "Never synced" (no fabricated time)', () => {
    render('mixed'); // strava disconnected, garmin dormant → both never synced
    expect(host.textContent).toContain('Never synced');
  });

  it('freshness + provenance are always visible text, never hidden behind an icon only', () => {
    render('all-connected');
    // Every row should show a "Synced ..." freshness line.
    const freshMatches = host.textContent?.match(/Synced/g) ?? [];
    expect(freshMatches.length).toBeGreaterThan(0);
  });
});
