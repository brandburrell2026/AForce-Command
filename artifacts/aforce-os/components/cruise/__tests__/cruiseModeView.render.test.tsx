// @vitest-environment happy-dom
/**
 * CRUISE MODE (redesign) — NON-SHIPPING render harness.
 *
 * Renders the PURE presentational `CruiseModeView` to a real DOM
 * (react-native-web → react-dom under happy-dom) with a resolved fixture view
 * model injected directly. Imports no store, flag, or route — so it can never
 * enable a gated feature. Asserts structure + accessibility across states.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Icon uses native vector fonts/SVG irrelevant to structure/a11y here.
vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { CruiseModeView, type CruiseCrossNavItem } from '../CruiseModeView';
import { resolveCruiseModeView } from '@/services/cruise/cruiseModeView';
import { CRUISE_FIXTURES } from '@/services/cruise/cruiseModeFixtures';

const CROSS_NAV: CruiseCrossNavItem[] = [
  { key: 'home', icon: 'droplet', label: 'Live Hydration Score', hint: 'Open command center' },
  { key: 'sweat', icon: 'activity', label: 'Sweat & Autopilot', hint: 'Sweat-rate calculator' },
];

let host: HTMLElement;
let root: Root;
const noop = () => {};

function render(fixtureKey: keyof typeof CRUISE_FIXTURES) {
  const input = CRUISE_FIXTURES[fixtureKey];
  const view = resolveCruiseModeView(input);
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(CruiseModeView, {
        view,
        log: input.log,
        ports: input.ports,
        selectedPortId: input.portId,
        crossNav: CROSS_NAV,
        onBack: noop, onSelectPort: noop, onLogWater: noop, onLogChange: noop, onNavigate: noop,
      }),
    ),
  );
  return view;
}
const q = (sel: string) => host.querySelector(sel);
const qa = (sel: string) => Array.from(host.querySelectorAll(sel));

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { flushSync(() => root.unmount()); host.remove(); });

describe('CruiseModeView — renders every state without crashing', () => {
  for (const key of Object.keys(CRUISE_FIXTURES)) {
    it(`renders ${key}`, () => {
      render(key as keyof typeof CRUISE_FIXTURES);
      expect(q('[data-testid="cruise-mode-view"]')).not.toBeNull();
    });
  }
});

describe('accessibility', () => {
  it('back + water CTA are buttons with accessible names', () => {
    render('live-balanced');
    expect(q('[data-testid="cruise-back"]')?.getAttribute('aria-label')).toBe('Back');
    const water = q('[data-testid="cruise-log-water"]');
    expect(water?.getAttribute('role')).toBe('button');
    expect(water?.getAttribute('aria-label')).toBe('Log water');
  });

  it('port chips carry selected state + accessible names', () => {
    render('live-balanced');
    const chip = q('[data-testid="cruise-port-cozumel"]');
    expect(chip?.getAttribute('aria-label')).toBe('Port Cozumel');
    expect(chip?.getAttribute('role')).toBe('button');
  });

  it('self-log steppers expose +/- buttons with labels', () => {
    render('live-balanced');
    const plus = q('[data-testid="cruise-log-drinks-plus"]');
    const minus = q('[data-testid="cruise-log-drinks-minus"]');
    expect(plus?.getAttribute('role')).toBe('button');
    expect(minus?.getAttribute('role')).toBe('button');
    expect(plus?.getAttribute('aria-label')).toMatch(/Increase/);
  });
});

describe('honesty is visible in the DOM', () => {
  it('building state shows an em-dash score and no "/100", no fabricated status', () => {
    render('building');
    expect(host.textContent).toContain('BUILDING SIGNAL');
    expect(q('[data-testid="cruise-readiness-score"]')?.textContent).toBe('—');
    expect(host.textContent).not.toContain('/ 100');
  });

  it('live state shows the real score with /100 and all five environment cells', () => {
    render('live-balanced');
    expect(q('[data-testid="cruise-readiness-score"]')?.textContent).toMatch(/^\d+$/);
    expect(host.textContent).toContain('/ 100');
    for (const key of ['temp', 'humidity', 'sun', 'heat', 'wind']) {
      expect(q(`[data-testid="cruise-env-${key}"]`), key).not.toBeNull();
    }
  });

  it('offline state renders NO environment cells (never invents weather)', () => {
    render('offline');
    expect(q('[data-testid="cruise-source-offline"]')).not.toBeNull();
    expect(qa('[data-testid^="cruise-env-"]')).toHaveLength(0);
    expect(host.textContent).toMatch(/Live conditions are unavailable/i);
  });

  it('pilot fallback is labelled PILOT DATA, not LIVE', () => {
    render('pilot-fallback');
    expect(q('[data-testid="cruise-source-pilot"]')).not.toBeNull();
    expect(host.textContent).toContain('PILOT DATA');
  });

  it('empty self-log surfaces the "nothing is assumed" hint', () => {
    render('live-balanced');
    expect(host.textContent).toMatch(/Nothing is assumed for you/i);
    expect(host.textContent).toMatch(/Nothing is logged for you/i);
  });

  it('log-water preview (capability unwired) renders as a disabled Preview, not a live action', () => {
    render('log-water-preview');
    const water = q('[data-testid="cruise-log-water"]');
    expect(water?.getAttribute('aria-disabled')).toBe('true');
    expect(host.textContent).toMatch(/Preview/i);
  });
});

describe('reduced motion', () => {
  it('reducedMotion=true suppresses the decorative hero glow', () => {
    render('reduced-motion');
    expect(q('[data-testid="cruise-hero-glow"]')).toBeNull();
  });
  it('reducedMotion=false renders the glow on a live (non-building) hero', () => {
    render('live-balanced');
    expect(q('[data-testid="cruise-hero-glow"]')).not.toBeNull();
  });
});

describe('recovery demand', () => {
  it('no-signal state shows honest reassurance, not a risk value', () => {
    render('live-locked-in');
    expect(host.textContent).toMatch(/No elevated recovery demand detected/i);
  });
  it('heavy logged day surfaces the composite demand + reasons', () => {
    render('live-reset-needed');
    expect(host.textContent).toContain('COMPOSITE RECOVERY DEMAND');
  });
});

describe('compliance', () => {
  it('always renders the non-diagnostic disclaimer', () => {
    render('building');
    expect(host.textContent).toMatch(/not a medical, diagnostic, safety, or navigation tool/i);
  });
});
