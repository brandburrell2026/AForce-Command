// @vitest-environment happy-dom
/**
 * CONNECTED HEALTH CONTAINER — model + wiring evidence (W3.6).
 *
 * Two things live in this file, both named `.render.test.tsx` so vitest.config.ts
 * picks them up (`components/health/__tests__/**\/*.render.test.tsx`, happy-dom):
 *
 *  1. Render assertions — real scenarios built via the pure
 *     `buildConnectedHealthInput` (services/health/connectedHealthContainerModel)
 *     are resolved with `resolveConnectedHealthView` and rendered through the
 *     REAL presentational `ConnectedHealthView`, exactly like
 *     `connectedHealthView.render.test.tsx`'s existing harness. This proves the
 *     model's output actually renders the honest UI the wiring promises
 *     (dormant Garmin non-actionable, Samsung via-HC provenance, a live WHOOP
 *     row, etc.) — not just that the pure functions return the right shape.
 *
 *  2. Orchestration assertions — `loadConnectedHealthCloudFacts` /
 *     `performConnectedHealthDisconnect` with injected fetch/disconnect deps.
 *     These don't render anything; they live here (not a plain `.test.ts`
 *     under `services/health/__tests__`) only because they're already
 *     covered there in detail — this file re-exercises them end-to-end
 *     against the REAL `ConnectedHealthContainer`-shaped call pattern to
 *     prove the container and the model agree on the deps shape.
 *
 * `ConnectedHealthContainer.tsx` itself is deliberately NOT imported here —
 * it pulls in `expo-router` / `react-native-safe-area-context` /
 * `@react-native-async-storage/async-storage` / `useAppStore`, none of which
 * this repo's existing tests ever mount directly (see e.g.
 * `components/cruise/__tests__/cruiseModeView.render.test.tsx`, which tests
 * `CruiseModeView`, never `CruiseModeScreen`). The container's own file
 * header documents why it is unmounted/unregistered.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

// Icon uses native vector fonts/SVG irrelevant to structure/a11y here — same
// mock as connectedHealthView.render.test.tsx.
vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { ConnectedHealthView } from '../ConnectedHealthView';
import { resolveConnectedHealthView } from '@/services/health/connectedHealthView';
import {
  applyProbeCycle,
  buildConnectedHealthInput,
  dropCloudFact,
  loadConnectedHealthCloudFacts,
  performConnectedHealthDisconnect,
  type ConnectedHealthContainerModelInput,
} from '@/services/health/connectedHealthContainerModel';
import { DEFAULT_FLAGS } from '@/featureFlags/flags';
import type { HealthConnectionSignals } from '@/utils/health/healthConnectionMapping';

/** The container's own source, read as text so the orchestration suite below
 *  can pin its literal `setCloud(...)` call sites to the exact model
 *  functions this file exercises — see each guard's own comment for why a
 *  no-mount unit test needs this to catch a wiring regression at all
 *  (`ConnectedHealthContainer.tsx` is deliberately never mounted here). */
const CONTAINER_SOURCE = readFileSync(join(__dirname, '..', 'ConnectedHealthContainer.tsx'), 'utf8');

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
const noop = () => {};

function renderModelInput(input: ConnectedHealthContainerModelInput) {
  const resolved = resolveConnectedHealthView(buildConnectedHealthInput(input));
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(
        I18nextProvider,
        { i18n: testI18n },
        React.createElement(ConnectedHealthView, { view: resolved, onBack: noop, onTroubleshoot: noop, onDisconnect: noop }),
      ),
    ),
  );
  return resolved;
}

const q = (sel: string) => host.querySelector(sel);
const qa = (sel: string) => Array.from(host.querySelectorAll(sel));

const NOW = new Date('2026-08-03T18:00:00Z').getTime();
const MIN = 60_000;

function baseInput(over: Partial<ConnectedHealthContainerModelInput> = {}): ConnectedHealthContainerModelInput {
  return {
    nowMs: NOW,
    mode: 'ready',
    platform: 'ios',
    featureFlags: DEFAULT_FLAGS,
    biometrics: undefined,
    cloud: {},
    appleHealthLinked: false,
    appleHealthNativeReady: false,
    ...over,
  };
}

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { flushSync(() => root.unmount()); host.remove(); });

describe('ConnectedHealthContainer wiring — real model input renders through the real view', () => {
  it('a live, connected WHOOP row (real cloud probe + real biometrics) renders Connected + a disconnect affordance', () => {
    const view = renderModelInput(
      baseInput({
        cloud: { whoop: { integrationReady: true, link: 'connected' } as HealthConnectionSignals },
        biometrics: { whoop: { fetchedAt: NOW - 5 * MIN } as never },
      }),
    );
    const whoopRow = view.rows.find((r) => r.providerId === 'whoop')!;
    expect(whoopRow.statusPill.state).toBe('connected');

    const status = q('[data-testid="ch-status-whoop"]');
    expect(status?.textContent).toContain('Connected');
    const disconnect = q('[data-testid="ch-disconnect-whoop"]');
    expect(disconnect).not.toBeNull();
    expect(disconnect?.getAttribute('role')).toBe('button');
  });

  it('Garmin, dormant while its flag is off, renders "Awaiting Access" with no action and no disconnect', () => {
    renderModelInput(baseInput({ cloud: { garmin: { integrationReady: true, link: 'none' } as HealthConnectionSignals } }));
    const status = q('[data-testid="ch-status-garmin"]');
    expect(status?.textContent).toContain('Awaiting Access');
    expect(q('[data-testid="ch-action-garmin"]')).toBeNull();
    expect(q('[data-testid="ch-disconnect-garmin"]')).toBeNull();
  });

  it('Garmin with backend credentials unconfigured renders "Approval Pending" — a distinct, honest label', () => {
    renderModelInput(baseInput());
    const status = q('[data-testid="ch-status-garmin"]');
    expect(status?.textContent).toContain('Approval Pending');
  });

  it('Samsung on Android renders explicit "via Health Connect" provenance and is not disconnectable', () => {
    renderModelInput(baseInput({ platform: 'android' }));
    expect(host.textContent).toContain('Samsung Health · via Health Connect');
    expect(q('[data-testid="ch-disconnect-samsung_health"]')).toBeNull();
    expect(q('[data-testid="ch-action-samsung_health"]')).toBeNull();
  });

  it('Oura/Strava/Google Health render as dormant/unavailable — never an actionable Connect — with flags off', () => {
    renderModelInput(baseInput());
    for (const id of ['oura', 'strava', 'google_health']) {
      expect(q(`[data-testid="ch-action-${id}"]`)).toBeNull();
      expect(q(`[data-testid="ch-disconnect-${id}"]`)).toBeNull();
    }
  });

  it('loading mode renders the loading shell, not rows', () => {
    renderModelInput(baseInput({ mode: 'loading' }));
    expect(q('[data-testid="connected-health-loading"]')).not.toBeNull();
  });

  it('a probe failure (mode: offline) surfaces the honest retry banner while still showing last-known rows — never a fabricated denied/disconnected/unsupported', () => {
    const view = renderModelInput(
      baseInput({
        mode: 'offline',
        // Last-known-good facts from before the probe started failing —
        // ConnectedHealthContainer's refreshCloudFacts never discards these
        // on a failed cycle.
        cloud: { whoop: { integrationReady: true, link: 'connected' } as HealthConnectionSignals },
        biometrics: { whoop: { fetchedAt: NOW - 5 * MIN } as never },
      }),
    );

    const banner = q('[data-testid="connected-health-offline-banner"]');
    expect(banner).not.toBeNull();
    // #491 review B2: reworded away from "Offline" (false on a cold-start
    // probe failure, which has no last-known status yet) to an honest
    // "couldn't check ... may be out of date" sentence.
    expect(banner?.textContent).toMatch(/couldn't check|out of date/i);

    // The row that was genuinely connected before the probe cycle failed
    // still renders its true last-known state — offline mode never
    // downgrades a real fact into a fabricated one.
    const whoopRow = view.rows.find((r) => r.providerId === 'whoop')!;
    expect(whoopRow.statusPill.state).toBe('connected');
    expect(q('[data-testid="ch-status-whoop"]')?.textContent).toContain('Connected');

    // No row anywhere renders a state this container has no evidence for.
    for (const row of view.rows) {
      expect(row.statusPill.state).not.toBe('disconnected');
    }
  });

  it('every rendered row exposes 44pt touch targets on its interactive affordances (a11y)', () => {
    renderModelInput(
      baseInput({
        cloud: { whoop: { integrationReady: true, link: 'connected' } as HealthConnectionSignals },
        biometrics: { whoop: { fetchedAt: NOW - 5 * MIN } as never },
      }),
    );
    for (const el of qa('[data-testid^="ch-action-"], [data-testid^="ch-disconnect-"]')) {
      const h = parseFloat(getComputedStyle(el as HTMLElement).minHeight || '0');
      expect(h).toBeGreaterThanOrEqual(44);
    }
  });

  it('the Score-Protection footer sentence is present verbatim regardless of scenario', () => {
    renderModelInput(baseInput());
    expect(host.textContent).toContain('Health data informs Readiness only. It never changes your Hydration Score.');
  });
});

describe('orchestration deps agree with the container-shaped call pattern', () => {
  it('loadConnectedHealthCloudFacts probes all 4 cloud providers with an injected fetch', async () => {
    const calls: string[] = [];
    const { facts, anyProbeFailed } = await loadConnectedHealthCloudFacts(NOW, {
      fetchCloudSignals: async (provider) => {
        calls.push(provider);
        return { integrationReady: false, link: 'none' };
      },
    });
    expect(calls.sort()).toEqual(['garmin', 'oura', 'strava', 'whoop']);
    expect(facts.whoop).toEqual({ integrationReady: false, link: 'none' });
    expect(anyProbeFailed).toBe(false);
  });

  it('performConnectedHealthDisconnect surfaces "unsupported" for apple_health without calling any transport', async () => {
    const outcome = await performConnectedHealthDisconnect('apple_health', {
      disconnectWhoop: async () => ({ status: 'ok' }),
      disconnectGarmin: async () => ({ status: 'ok' }),
    });
    expect(outcome).toBe('unsupported');
  });

  it(
    '#494 S-1 — B1 regression guard: two probe cycles merge via applyProbeCycle exactly as ' +
      'ConnectedHealthContainer wires it, and a failed second cycle cannot downgrade a connected WHOOP row',
    async () => {
      // Source-text guard: pin the container's literal `setCloud` call site
      // to `applyProbeCycle`, the exact function this test exercises below.
      // ConnectedHealthContainer.tsx is deliberately never mounted in this
      // suite (see file header), so this is what makes a regression back to
      // `setCloud(facts)` (the actual #494 S-1 bug — real, and previously
      // invisible to all 415 tests that existed before this pair) fail a
      // test at all. Confirmed by temporary mutation while building this
      // test: reverting the container's line to `setCloud(facts);` fails
      // this exact assertion (see PR body).
      expect(CONTAINER_SOURCE).toContain('setCloud((prev) => applyProbeCycle(prev, facts));');

      // Cycle 1: whoop's cloud probe genuinely resolves connected.
      const cycle1 = await loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: async (provider) =>
          provider === 'whoop'
            ? ({ integrationReady: true, link: 'connected' } as HealthConnectionSignals)
            : ({ integrationReady: false, link: 'none' } as HealthConnectionSignals),
      });
      expect(cycle1.anyProbeFailed).toBe(false);
      const cloudAfterCycle1 = applyProbeCycle({}, cycle1.facts);
      expect(cloudAfterCycle1.whoop).toEqual({ integrationReady: true, link: 'connected' });

      // Cycle 2: whoop's probe now fails to complete (rejects) — exactly the
      // scenario `mergeCloudFacts`'s own header documents as the reason a
      // plain `setCloud(facts)` replacement would be wrong: it would
      // silently drop whoop back to "no evidence" instead of preserving
      // cycle 1's real, last-known-good fact.
      const cycle2 = await loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: async (provider) => {
          if (provider === 'whoop') throw new Error('bridge exploded');
          return { integrationReady: false, link: 'none' };
        },
      });
      expect(cycle2.anyProbeFailed).toBe(true);
      const cloudAfterCycle2 = applyProbeCycle(cloudAfterCycle1, cycle2.facts);

      // The actual regression-catching assertion: with a plain-replacement
      // bug, `cloudAfterCycle2.whoop` would be `undefined` here (cycle 2's
      // empty `facts` would have wholly replaced cycle 1's), which resolves
      // to a non-'connected' presentation below. Rendered through the REAL
      // view exactly as ConnectedHealthContainer would on this exact state.
      const view = renderModelInput(
        baseInput({
          mode: 'offline', // cycle 2 failed a probe → container's mode maps to offline
          cloud: cloudAfterCycle2,
          biometrics: { whoop: { fetchedAt: NOW - 5 * MIN } as never },
        }),
      );
      const whoopRow = view.rows.find((r) => r.providerId === 'whoop')!;
      expect(whoopRow.statusPill.state).toBe('connected');
      expect(q('[data-testid="ch-status-whoop"]')?.textContent).toContain('Connected');
    },
  );

  it(
    '#494 S-2 — post-disconnect regression guard: a successful WHOOP disconnect drops its cloud fact ' +
      'immediately, so a failed follow-up probe cycle leaves it honestly absent, never stale-connected',
    async () => {
      // Source-text guard: pin the container's onDisconnect success path to
      // dropping the cloud fact via `dropCloudFact` before the follow-up
      // refresh. Same rationale as the S-1 guard above — the container is
      // never mounted here, so this is what makes a regression (removing
      // this line, leaving only the pre-existing `refreshCloudFacts()` call)
      // fail a test.
      expect(CONTAINER_SOURCE).toContain('setCloud((prev) => dropCloudFact(prev, providerId));');

      // Cloud already shows whoop connected from a prior successful cycle —
      // the exact real-world lead-up to a disconnect action.
      const priorCycle = await loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: async (provider) =>
          provider === 'whoop'
            ? ({ integrationReady: true, link: 'connected' } as HealthConnectionSignals)
            : ({ integrationReady: false, link: 'none' } as HealthConnectionSignals),
      });
      let cloud = applyProbeCycle({}, priorCycle.facts);
      expect(cloud.whoop).toEqual({ integrationReady: true, link: 'connected' });

      // Disconnect succeeds: the container drops whoop's key immediately,
      // exactly as `onDisconnect`'s success branch does, before the
      // follow-up `refreshCloudFacts` even starts.
      cloud = dropCloudFact(cloud, 'whoop');
      expect('whoop' in cloud).toBe(false);

      // The follow-up refreshCloudFacts probe cycle then FAILS for whoop
      // (server hasn't caught up yet / bridge hiccup) — exactly the sequence
      // #494 S-2 flags. Pre-fix, nothing would have dropped the stale fact
      // above, so this failed cycle's merge alone would have left
      // "connected" in place.
      const followUp = await loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: async (provider) => {
          if (provider === 'whoop') throw new Error('not caught up yet');
          return { integrationReady: false, link: 'none' };
        },
      });
      expect(followUp.anyProbeFailed).toBe(true);
      cloud = applyProbeCycle(cloud, followUp.facts);
      expect(cloud.whoop).toBeUndefined();

      // Rendered through the REAL view: honestly absent, never "Connected".
      // (No biometrics override — `setProviderBiometrics(providerId, null)`
      // already ran in the real onDisconnect handler on this path.)
      const view = renderModelInput(baseInput({ mode: 'offline', cloud }));
      const whoopRow = view.rows.find((r) => r.providerId === 'whoop')!;
      expect(whoopRow.statusPill.state).not.toBe('connected');
      expect(q('[data-testid="ch-status-whoop"]')?.textContent).not.toContain('Connected');
    },
  );
});
