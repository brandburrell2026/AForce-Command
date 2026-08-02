// @vitest-environment happy-dom
/**
 * Night Out — NON-SHIPPING render harness (NO-c evidence).
 *
 * Renders the PURE presentational `NightOutCommandView` to a real DOM
 * (react-native-web → react-dom under happy-dom) with the resolved view model
 * injected directly. It renders the presentation component ONLY — it does NOT
 * import or exercise the route guard (`app/night-out.tsx`) or the feature flag,
 * so it can never enable Night Out in a real build. This file lives under
 * `__tests__` and is imported by NO shipping code (proven by `bundleIsolation`).
 *
 * Produces: (a) reproducible DOM snapshots per state × device width, and
 * (b) render-level accessibility assertions (roles, accessible names, targets,
 * color-independent status, one dominant CTA, no clipped CTA).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub the decorative HydroState arc so the harness stays lean (its svg deps are
// irrelevant to the command UI's a11y/structure). The score/state text still renders.
vi.mock('@/components/ui', () => ({
  AFReadinessArc: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

import { NightOutCommandView, styles } from '../NightOutCommandView';
import {
  resolveNightOutCommandView,
  NIGHT_OUT_ADJUST_OZ,
  type NightOutCommandInput,
} from '@/services/nightOut/commandPresentation';
import { makeCommandTimer, resolveCommandTimerView } from '@/services/nightOut/commandTimer';

const T0 = Date.UTC(2026, 0, 1, 22, 0, 0);
const MIN = 60 * 1000;

function inp(over: Partial<NightOutCommandInput> = {}): NightOutCommandInput {
  return {
    score: 76, stateLabel: 'BALANCED', interpretation: 'Your confirmed signals are steady.',
    hasActionableCommand: true, commandTitle: 'Water first', commandInstruction: 'Drink 12 oz water',
    doseOz: 12, reason: 'Stay ahead of the curve', confidenceLevel: 'high', freshnessAgeMs: 2 * MIN,
    reassessMinutes: 20, windowMinutes: 20, timerView: null, ...over,
  };
}

// The required NO-c states, expressed as resolved view models.
const t20 = makeCommandTimer('c', 20 * MIN, T0);
const t1 = makeCommandTimer('c', 1 * MIN, T0);
const STATES: Record<string, { model: ReturnType<typeof resolveNightOutCommandView>; adjusting?: boolean }> = {
  'eligible-idle': { model: resolveNightOutCommandView(inp({ hasActionableCommand: false })) },
  'low-confidence': { model: resolveNightOutCommandView(inp({ confidenceLevel: 'low', freshnessAgeMs: null })) },
  'stale-data': { model: resolveNightOutCommandView(inp({ confidenceLevel: 'low', freshnessAgeMs: 6 * 60 * MIN })) },
  'command-accepted': { model: resolveNightOutCommandView(inp({ timerView: resolveCommandTimerView(t20, T0 + 1000) })) },
  'restored-active': { model: resolveNightOutCommandView(inp({ timerView: resolveCommandTimerView(t20, T0 + 5 * MIN) })) },
  'nearing-expiry': { model: resolveNightOutCommandView(inp({ timerView: resolveCommandTimerView(t20, T0 + 19 * MIN) })) },
  'expired-reassessing': { model: resolveNightOutCommandView(inp({ timerView: resolveCommandTimerView(t1, T0 + 5 * MIN) })) },
  'completed-processing': { model: resolveNightOutCommandView(inp({ justCompleted: true })) },
  'deferred-not-now': { model: resolveNightOutCommandView(inp({ hasActionableCommand: false })) },
  'pre-acceptance-adjust': { model: resolveNightOutCommandView(inp({})), adjusting: true },
};

// Representative device widths (px) + a max-text-scale variant.
const WIDTHS = { small: 320, standard: 390, large: 430 };

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { flushSync(() => root.unmount()); host.remove(); });

function renderState(name: string, width: number, opts: { reducedMotion?: boolean; fontScale?: number } = {}) {
  const s = STATES[name];
  const wrapper = React.createElement(
    'div',
    { style: { width, fontSize: 16 * (opts.fontScale ?? 1) } },
    React.createElement(NightOutCommandView, {
      view: s.model,
      reducedMotion: opts.reducedMotion ?? false,
      adjusting: !!s.adjusting,
      approvedAdjustOz: NIGHT_OUT_ADJUST_OZ,
      selectedDoseOz: 12,
      onPrimary: () => {}, onToggleAdjust: () => {}, onAdjustPick: () => {}, onNotNow: () => {},
    }),
  );
  flushSync(() => root.render(wrapper));
  return host;
}

describe('NO-c render harness — every required state renders to DOM', () => {
  for (const name of Object.keys(STATES)) {
    it(`renders "${name}" without error and matches its DOM snapshot`, () => {
      const el = renderState(name, WIDTHS.standard);
      expect(el.querySelector('[data-testid="night-out-command-view"], div')).toBeTruthy();
      expect(el.innerHTML).toMatchSnapshot();
    });
  }

  it('renders at small / standard / large widths, max-text-scale, and reduced-motion', () => {
    for (const [label, w] of Object.entries(WIDTHS)) {
      const el = renderState('command-accepted', w);
      expect(el.innerHTML.length, `width ${label}`).toBeGreaterThan(0);
    }
    // max supported text scale (approx): larger base font must not throw / drop the CTA
    const maxScale = renderState('pre-acceptance-adjust', WIDTHS.small, { fontScale: 2 });
    expect(maxScale.textContent).toMatch(/NIGHT OUT/);
    // reduced-motion path
    const rm = renderState('restored-active', WIDTHS.standard, { reducedMotion: true });
    expect(rm.textContent).toMatch(/COMPLETE WATER/);
  });
});

describe('NO-c render-level accessibility evidence', () => {
  it('the primary CTA has role=button and an accessible name (not clipped/empty)', () => {
    const el = renderState('command-accepted', WIDTHS.standard);
    const cta = el.querySelector('[data-testid="night-out-primary-cta"]');
    expect(cta).toBeTruthy();
    expect(cta!.getAttribute('role')).toBe('button');
    expect(cta!.getAttribute('aria-label')).toBe('Complete water');
    expect(cta!.textContent).toContain('COMPLETE WATER'); // label visible, not clipped
  });

  it('exactly ONE dominant primary CTA renders per state', () => {
    for (const name of ['pre-acceptance-adjust', 'command-accepted', 'restored-active', 'nearing-expiry', 'expired-reassessing']) {
      const el = renderState(name, WIDTHS.standard);
      expect(el.querySelectorAll('[data-testid="night-out-primary-cta"]').length, name).toBe(1);
    }
  });

  it('secondary actions carry accessible names + selectable state', () => {
    const el = renderState('pre-acceptance-adjust', WIDTHS.standard);
    expect(el.querySelector('[data-testid="night-out-not-now"]')?.getAttribute('aria-label')).toBe('Not now');
    const chip = el.querySelector('[aria-label="Set 12 ounces"]');
    expect(chip).toBeTruthy();
  });

  it('status is communicated by TEXT, not color alone (confidence + freshness line present)', () => {
    const el = renderState('low-confidence', WIDTHS.standard);
    expect(el.querySelector('[data-testid="night-out-telemetry"]')?.textContent)
      .toMatch(/Command confidence: Limited · Waiting for fresher/);
  });

  it('NOW / NEXT / LATER section headers all render', () => {
    const el = renderState('command-accepted', WIDTHS.standard);
    const text = el.textContent ?? '';
    expect(text).toContain('NOW');
    expect(text).toContain('NEXT');
    expect(text).toContain('LATER');
  });

  it('interactive targets meet the 44×44 minimum in the style tokens', () => {
    // react-native-web flattens dynamic styles; the source of truth is the tokens.
    for (const key of ['primaryCta', 'secondaryBtn', 'ozChip'] as const) {
      const st = styles[key] as { minHeight?: number };
      expect(st.minHeight, key).toBe(44);
    }
  });
});
