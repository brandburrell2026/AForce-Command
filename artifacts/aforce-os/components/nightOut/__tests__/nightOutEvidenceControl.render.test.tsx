// @vitest-environment happy-dom
/**
 * NO-c native-evidence enabler — NON-SHIPPING render harness for the internal
 * evidence control. Proves, in a real DOM (react-native-web → react-dom):
 *   (a) the control renders NOTHING unless the internal-build gate passes;
 *   (b) when gated it renders the "INTERNAL BUILD — NOT FOR PRODUCTION" banner;
 *   (c) Enable routes ONLY through the sanctioned service (setFeatureFlags is
 *       called with exactly enableNightOutForInternalPreview(flags) — never a
 *       hand-rolled flag mutation), and Reset through the sanctioned disabler;
 *   (d) the "Open Night Out" affordance appears only once access is granted, and
 *       it never bypasses the /night-out route guard (push to '/night-out').
 * Imported by NO shipping code.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  INTERNAL_BUNDLE_ID,
  PRODUCTION_BUNDLE_ID,
  INTERNAL_PROFILE,
  type InternalBuildInputs,
} from '@/internal-preview/internalGate';
import { enableNightOutForInternalPreview } from '@/services/nightOut/access';
import { baseFlags } from '@/store/__tests__/_fixtures';
import type { FeatureFlags } from '@/types';

// Controlled build inputs — the single source the gate reads.
let BUILD: InternalBuildInputs = {
  buildProfile: INTERNAL_PROFILE, appVariant: 'internal', internalPreview: 'true',
  demoMode: true, applicationId: INTERNAL_BUNDLE_ID,
};
vi.mock('@/internal-preview/buildInputs', () => ({ readInternalBuildInputs: () => BUILD }));

// Store double — captures setFeatureFlags calls and re-serves updated flags.
let FLAGS: FeatureFlags = { ...baseFlags };
const setFeatureFlags = vi.fn((f: FeatureFlags) => { FLAGS = f; });
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ state: { featureFlags: FLAGS }, setFeatureFlags }),
}));
vi.mock('@/services/demoMode', () => ({ DEMO_MODE: true }));

const pushSpy = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ push: pushSpy }) }));

import { NightOutEvidenceModeControl } from '@/internal-preview/NightOutEvidenceModeControl';

let host: HTMLElement;
let root: Root;
function render() {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(NightOutEvidenceModeControl)));
}
function click(testId: string) {
  const el = host.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  if (!el) throw new Error(`no element ${testId}`);
  flushSync(() => el.dispatchEvent(new host.ownerDocument!.defaultView!.MouseEvent('click', { bubbles: true })));
}

beforeEach(() => {
  FLAGS = { ...baseFlags };
  BUILD = { buildProfile: INTERNAL_PROFILE, appVariant: 'internal', internalPreview: 'true', demoMode: true, applicationId: INTERNAL_BUNDLE_ID };
  setFeatureFlags.mockClear();
  pushSpy.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => { flushSync(() => root.unmount()); host.remove(); });

describe('NightOutEvidenceModeControl — render (fail closed)', () => {
  it('renders NOTHING in a production build (gate fails)', () => {
    BUILD = { ...BUILD, applicationId: PRODUCTION_BUNDLE_ID };
    render();
    expect(host.querySelector('[data-testid="night-out-evidence-control"]')).toBeNull();
    expect(host.textContent).toBe('');
  });

  it('renders the internal-only control with the production warning banner', () => {
    render();
    expect(host.querySelector('[data-testid="night-out-evidence-control"]')).not.toBeNull();
    expect(host.textContent).toContain('INTERNAL BUILD — NOT FOR PRODUCTION');
    // Not yet authorized → no Open affordance.
    expect(host.querySelector('[data-testid="evidence-open"]')).toBeNull();
  });

  it('Enable calls ONLY the sanctioned enabler (never a hand-rolled flag write)', () => {
    render();
    click('evidence-enable');
    expect(setFeatureFlags).toHaveBeenCalledTimes(1);
    expect(setFeatureFlags).toHaveBeenCalledWith(enableNightOutForInternalPreview(baseFlags));
  });

  it('after enable, the Open Night Out affordance appears and routes THROUGH the guard', () => {
    render();
    click('evidence-enable'); // updates FLAGS + re-renders
    const open = host.querySelector('[data-testid="evidence-open"]');
    expect(open).not.toBeNull();
    click('evidence-open');
    expect(pushSpy).toHaveBeenCalledWith('/night-out');
  });

  it('Reset turns the flag back off via the sanctioned disabler', () => {
    render();
    click('evidence-enable');
    expect(FLAGS.night_out_enabled).toBe(true);
    click('evidence-reset');
    expect(FLAGS.night_out_enabled).toBe(false);
  });
});
