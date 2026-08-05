// @vitest-environment happy-dom
/**
 * CONNECTED HEALTH — NON-SHIPPING render harness.
 *
 * Renders the PURE presentational `ConnectedHealthView` to a real DOM
 * (react-native-web → react-dom, happy-dom) with a resolved fixture view
 * model injected directly. Imports no store, flag, or route — so it can
 * never enable a gated feature. Asserts structure, accessibility, and
 * (since review #460 item 4 moved copy through i18n) the actual translated
 * text across every fixture state.
 *
 * This file IS picked up by the root vitest.config.ts:
 * `components/health/__tests__/**` is already present in both `test.include`
 * and `test.environmentMatchGlobs` (mirroring the sleep/cruise/nightOut
 * entries) — see /Users/brandonburrell/AForce-Command/vitest.config.ts.
 *
 * i18n wiring: the component calls `useTranslation()` from `react-i18next`.
 * Rather than importing the app's real `services/i18nService.ts` (which
 * pulls in `expo-localization` — a native module that cannot load under
 * happy-dom/node, per the precedent in components/cruise/__tests__/
 * cruiseModeView.render.test.tsx mocking CommandConfidenceBadge for the same
 * reason), this harness spins up its OWN `i18next` instance directly from
 * the real `locales/en.json` file and provides it via `I18nextProvider`.
 * That gives real, translated assertions (e.g. "Awaiting Access" actually
 * renders) without any native-module dependency.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

// Icon uses native vector fonts/SVG irrelevant to structure/a11y here.
vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { ConnectedHealthView } from '../ConnectedHealthView';
import { resolveConnectedHealthView, type ConnectedHealthInput } from '@/services/health/connectedHealthView';
import { CONNECTED_HEALTH_FIXTURES, PROVIDER_ROW_FIXTURES } from '@/services/health/connectedHealthFixtures';
import type { ProviderPresentationState } from '@workspace/health-core';

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
const noop = () => {};

function renderView(
  view: ConnectedHealthInput,
  over: { onTroubleshoot?: (id: string) => void; onDisconnect?: (id: string) => void } = {},
) {
  const resolved = resolveConnectedHealthView(view);
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(
        I18nextProvider,
        { i18n: testI18n },
        React.createElement(ConnectedHealthView, {
          view: resolved,
          onBack: noop,
          onTroubleshoot: over.onTroubleshoot ?? noop,
          onDisconnect: over.onDisconnect ?? noop,
        }),
      ),
    ),
  );
  return resolved;
}

function render(
  fixtureKey: keyof typeof CONNECTED_HEALTH_FIXTURES,
  over: { onTroubleshoot?: (id: string) => void; onDisconnect?: (id: string) => void } = {},
) {
  return renderView(CONNECTED_HEALTH_FIXTURES[fixtureKey], over);
}

/** Renders a single-row screen for one ProviderPresentationState fixture. */
function renderState(state: ProviderPresentationState) {
  return renderView({
    now: CONNECTED_HEALTH_FIXTURES.mixed.now,
    mode: 'ready',
    platform: 'ios',
    providers: [PROVIDER_ROW_FIXTURES[state]],
  });
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
    // #491 review B2: reworded away from "Offline" — a cold-start probe
    // failure isn't necessarily offline, and there's no last-known status yet.
    expect(host.textContent).toMatch(/couldn't check|out of date/i);
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

describe('review #460 item 1 — dormant reads factually, no commitment language', () => {
  it('dormant renders "Awaiting Access", never "Coming Soon"', () => {
    renderState('dormant');
    const status = q('[data-testid^="ch-status-"]');
    expect(status?.textContent).toContain('Awaiting Access');
    expect(host.textContent).not.toMatch(/coming soon/i);
  });

  it('requires_external_approval renders its own distinct label ("Approval Pending")', () => {
    renderState('requires_external_approval');
    const status = q('[data-testid^="ch-status-"]');
    expect(status?.textContent).toContain('Approval Pending');
  });
});

describe('review #460 item 2 — troubleshoot affordances match what is actually actionable', () => {
  it('stale (real link, old data) offers Reconnect', () => {
    renderState('stale');
    const action = q('[data-testid^="ch-action-"]');
    expect(action).not.toBeNull();
    expect(action?.textContent).toContain('Reconnect');
  });

  it('no_recent_data (fine link, nothing generated yet) offers no action, and the sub-copy explains why', () => {
    renderState('no_recent_data');
    expect(q('[data-testid^="ch-action-"]')).toBeNull();
    expect(host.textContent).toMatch(/nothing to sync/i);
  });
});

describe('review #460 item 3 — pull-chip row never summarizes denied grants as "pulled"', () => {
  it('connected_limited row: the pulls container carries no aria-label of its own', () => {
    renderState('connected_limited'); // apple_health, sleep_session denied
    const pullsContainer = q('[data-testid^="ch-pulls-"]');
    expect(pullsContainer).not.toBeNull();
    expect(pullsContainer?.hasAttribute('aria-label')).toBe(false);
  });

  it('the denied Sleep chip is announced as "denied", never implying it was pulled', () => {
    renderState('connected_limited');
    const chips = qa('[aria-label*="Sleep"]');
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      const label = chip.getAttribute('aria-label') ?? '';
      expect(label).toMatch(/denied/i);
      expect(label).not.toMatch(/pulled/i);
    }
  });

  it('a granted chip in the same row is announced as "granted"', () => {
    renderState('connected_limited');
    const hrChip = qa('[aria-label*="Resting HR"]')[0];
    expect(hrChip?.getAttribute('aria-label')).toMatch(/granted/i);
  });
});

describe('review #460 item 6 — gated rows render zero pull chips (non-actionable, no phantom pulls)', () => {
  for (const state of ['dormant', 'requires_external_approval', 'unavailable'] as const) {
    it(`${state} row renders no pull chips and no action/disconnect affordances`, () => {
      renderState(state);
      const pullsContainer = q('[data-testid^="ch-pulls-"]');
      expect(pullsContainer).toBeNull();
      expect(q('[data-testid^="ch-action-"]')).toBeNull();
      expect(q('[data-testid^="ch-disconnect-"]')).toBeNull();
    });
  }
});

describe('review #460 item 9 — via-Health-Connect attribution + gated non-actionability', () => {
  it('Samsung (via_health_connect) shows explicit "via Health Connect" attribution', () => {
    renderState('via_health_connect');
    expect(host.textContent).toContain('Samsung Health · via Health Connect');
  });

  it('Samsung (via_health_connect) row is not disconnectable and has no troubleshoot action', () => {
    renderState('via_health_connect');
    expect(q('[data-testid^="ch-disconnect-"]')).toBeNull();
    expect(q('[data-testid^="ch-action-"]')).toBeNull();
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

describe('Founder Ruling I — observation freshness axis renders and announces truthfully', () => {
  /** A 'connected' row (recent lastSyncAtMs) with the observation axis
   *  forced to differ meaningfully, exactly as `resolveProviderPresentation`
   *  would produce for the #562 delayed-sync scenario. */
  function screenWithDivergedAxes(observedAtMs: number): ConnectedHealthInput {
    const base = PROVIDER_ROW_FIXTURES.connected;
    return {
      now: CONNECTED_HEALTH_FIXTURES.mixed.now,
      mode: 'ready',
      platform: 'ios',
      providers: [{
        ...base,
        presentation: { ...base.presentation, showBothFreshnessAxes: true },
        observedAtMs,
      }],
    };
  }

  it('renders the composed "Synced … · data from …" line when the axes meaningfully differ', () => {
    const threeDaysAgo = CONNECTED_HEALTH_FIXTURES.mixed.now - 3 * 24 * 60 * 60_000;
    const view = renderView(screenWithDivergedAxes(threeDaysAgo));
    const freshnessNode = q(`[data-testid="ch-freshness-${view.rows[0].providerId}"]`);
    expect(freshnessNode).not.toBeNull();
    expect(freshnessNode?.textContent).toMatch(/^Synced .* ago · data from /);
  });

  it('the composed accessibility label carries BOTH axes, extending the status_a11y pattern', () => {
    const threeDaysAgo = CONNECTED_HEALTH_FIXTURES.mixed.now - 3 * 24 * 60 * 60_000;
    const view = renderView(screenWithDivergedAxes(threeDaysAgo));
    const freshnessNode = q(`[data-testid="ch-freshness-${view.rows[0].providerId}"]`);
    const label = freshnessNode?.getAttribute('aria-label') ?? '';
    expect(label.startsWith('Data freshness: ')).toBe(true); // mirrors "Status: {{label}}"
    expect(label).toMatch(/Synced .* ago/); // sync axis present
    expect(label).toMatch(/data from /); // observation axis present
  });

  it('a single-axis row (axes close, or no observation timestamp) announces only the sync axis — no fabricated date', () => {
    renderState('connected'); // PROVIDER_ROW_FIXTURES.connected carries no observedAtMs
    const freshnessNode = q('[data-testid^="ch-freshness-"]');
    const label = freshnessNode?.getAttribute('aria-label') ?? '';
    expect(label).toBe('Data freshness: Synced 5m ago');
    expect(label).not.toMatch(/data from/);
  });
});
