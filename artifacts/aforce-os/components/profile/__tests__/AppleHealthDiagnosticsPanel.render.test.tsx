// @vitest-environment happy-dom
/**
 * AppleHealthDiagnosticsPanel — RC-2 P0 device-validation audit.
 *
 * Renders the real component to a DOM (react-native-web → react-dom,
 * happy-dom), following the pattern established in
 * `AppleHealthRefreshControl.render.test.tsx`: pure presentational
 * component, no store/router/HealthKit import, so it can be mounted
 * directly per this repo's convention.
 *
 * The single most important behavior under test: this panel must render
 * NOTHING — not even an empty wrapper `View` — whenever `enabled` is false
 * or `diagnostics` is null, since that is exactly the shape a production
 * build (`INTERNAL_TESTFLIGHT_OVERLAY_ENABLED === false`) always is. This is
 * the "production build → panel absent" gating the audit's diagnostics
 * deliverable requires.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { AppleHealthDiagnosticsPanel } from '../AppleHealthDiagnosticsPanel';
import type { AppleHealthDiagnosticsSnapshot } from '@/services/appleHealthDiagnostics';

let host: HTMLElement;
let root: Root;

const FIXTURE: AppleHealthDiagnosticsSnapshot = {
  capturedAt: 1_700_000_000_000,
  restingHeartRate: {
    identifier: 'HKQuantityTypeIdentifierRestingHeartRate',
    queried: true,
    sampleCount24h: 3,
    newest: {
      startDate: '2026-08-05T10:00:00.000Z',
      endDate: '2026-08-05T10:00:00.000Z',
      quantity: 58,
      unit: 'count/min',
      sourceName: 'iPhone',
    },
    valueUsed: 58,
  },
  hrv: {
    identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    queried: true,
    sampleCount24h: 12,
    newest: {
      startDate: '2026-08-05T09:30:00.000Z',
      endDate: '2026-08-05T09:30:00.000Z',
      quantity: 45,
      unit: 'ms',
      sourceName: "Brandon's Apple Watch",
    },
    valueUsed: 45,
  },
  steps: {
    identifier: 'HKQuantityTypeIdentifierStepCount',
    queried: true,
    rawSampleSum: 12000,
    bucketedMaxTotal: 7200,
    nativeMergedTotal: 7300,
    perSourceTotals: [
      { sourceName: 'iPhone', total: 4800 },
      { sourceName: "Brandon's Apple Watch", total: 7200 },
    ],
    sampleCount: 240,
    valueUsed: 7200,
    usedFallback: false,
  },
  sleep: {
    identifier: 'HKCategoryTypeIdentifierSleepAnalysis',
    queried: true,
    sampleCount: 14,
    valueUsed: 7.2,
  },
  workout: {
    identifier: 'HKWorkoutTypeIdentifier',
    queried: false,
    reason: 'never queried',
  },
  mappedSnapshot: {
    restingHeartRate: 58,
    hrvSdnn: 45,
    stepsToday: 7200,
    sleepHoursLastNight: 7.2,
  },
};

function renderPanel(props: Partial<React.ComponentProps<typeof AppleHealthDiagnosticsPanel>> = {}) {
  const defaults: React.ComponentProps<typeof AppleHealthDiagnosticsPanel> = {
    enabled: true,
    diagnostics: FIXTURE,
    scoringInput: null,
  };
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(AppleHealthDiagnosticsPanel, { ...defaults, ...props })));
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

describe('AppleHealthDiagnosticsPanel — production-safety gating', () => {
  it('renders nothing when enabled=false, even with a real diagnostics snapshot present', () => {
    renderPanel({ enabled: false, diagnostics: FIXTURE });
    expect(host.innerHTML).toBe('');
  });

  it('renders nothing when diagnostics=null, even if enabled=true', () => {
    renderPanel({ enabled: true, diagnostics: null });
    expect(host.innerHTML).toBe('');
  });

  it('renders nothing when both enabled=false AND diagnostics=null (the real production shape)', () => {
    renderPanel({ enabled: false, diagnostics: null });
    expect(host.innerHTML).toBe('');
  });

  it('renders the collapsed header when enabled=true and diagnostics is present', () => {
    renderPanel({ enabled: true, diagnostics: FIXTURE });
    expect(q('[data-testid="apple-health-diagnostics-panel"]')).not.toBeNull();
    expect(q('[data-testid="apple-health-diagnostics-panel-toggle"]')).not.toBeNull();
  });
});

describe('AppleHealthDiagnosticsPanel — collapsible body', () => {
  it('starts collapsed — the body is not rendered until toggled', () => {
    renderPanel();
    expect(q('[data-testid="apple-health-diagnostics-panel-body"]')).toBeNull();
  });

  it('expands to show the body on tap, and collapses again on a second tap', () => {
    renderPanel();
    const toggle = q('[data-testid="apple-health-diagnostics-panel-toggle"]') as HTMLElement;
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(q('[data-testid="apple-health-diagnostics-panel-body"]')).not.toBeNull();
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(q('[data-testid="apple-health-diagnostics-panel-body"]')).toBeNull();
  });
});

describe('AppleHealthDiagnosticsPanel — old vs. new steps comparison (the founder-facing evidence)', () => {
  it('shows the raw-sum (old) and bucketed-max (new) values side by side, plus per-source totals', () => {
    renderPanel();
    const toggle = q('[data-testid="apple-health-diagnostics-panel-toggle"]') as HTMLElement;
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(q('[data-testid="apple-health-diagnostics-panel-steps-raw"]')?.textContent).toBe('12000');
    expect(q('[data-testid="apple-health-diagnostics-panel-steps-bucketed"]')?.textContent).toBe('7200');
    expect(q('[data-testid="apple-health-diagnostics-panel-steps-used"]')?.textContent).toBe('7200');
    expect(host.textContent).toContain('iPhone');
    expect(host.textContent).toContain("Brandon's Apple Watch");
  });

  it('B1: shows HealthKit\'s own native-merged total as a third row, side by side with raw-sum and bucketed-max', () => {
    renderPanel();
    const toggle = q('[data-testid="apple-health-diagnostics-panel-toggle"]') as HTMLElement;
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(q('[data-testid="apple-health-diagnostics-panel-steps-native-merged"]')?.textContent).toBe('7300');
  });

  it('B1: renders an em dash for native-merged when the capture returned null (e.g. platform without support)', () => {
    renderPanel({
      diagnostics: {
        ...FIXTURE,
        steps: { ...FIXTURE.steps, nativeMergedTotal: null },
      },
    });
    const toggle = q('[data-testid="apple-health-diagnostics-panel-toggle"]') as HTMLElement;
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(q('[data-testid="apple-health-diagnostics-panel-steps-native-merged"]')?.textContent).toBe('—');
  });

  it('flags a fallback explicitly in the "value used" row when the bucketed query failed', () => {
    renderPanel({
      diagnostics: {
        ...FIXTURE,
        steps: {
          ...FIXTURE.steps,
          bucketedMaxTotal: null,
          valueUsed: 12000,
          usedFallback: true,
        },
      },
    });
    const toggle = q('[data-testid="apple-health-diagnostics-panel-toggle"]') as HTMLElement;
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(q('[data-testid="apple-health-diagnostics-panel-steps-used"]')?.textContent).toContain('fallback');
  });
});

describe('AppleHealthDiagnosticsPanel — scoring input section', () => {
  it('shows "not set" / "none found" when no scoring input is supplied', () => {
    renderPanel({ scoringInput: null });
    const toggle = q('[data-testid="apple-health-diagnostics-panel-toggle"]') as HTMLElement;
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(host.textContent).toContain('not set');
    expect(host.textContent).toContain('none found');
  });

  it('renders the breakdown row and biometrics entry when scoring input is supplied', () => {
    renderPanel({
      scoringInput: {
        biometricsEntry: {
          restingHeartRate: 58,
          hrvSdnn: 45,
          sleepHoursLastNight: 7.2,
          stepsToday: 7200,
          fetchedAt: 1_700_000_000_000,
        },
        recoveryContribution: {
          id: 'health_signals',
          label: 'Health platform (HRV / sleep / strain)',
          delta: 7,
          hint: 'HRV 45ms · Sleep 7.2h',
        },
      },
    });
    const toggle = q('[data-testid="apple-health-diagnostics-panel-toggle"]') as HTMLElement;
    flushSync(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(q('[data-testid="apple-health-diagnostics-panel-scoring-breakdown"]')?.textContent).toContain('Health platform (HRV / sleep / strain)');
    expect(q('[data-testid="apple-health-diagnostics-panel-scoring-biometrics"]')?.textContent).toContain('RHR=58');
  });
});
