// @vitest-environment happy-dom
/**
 * ReadinessInsightsV2 — render-count proof (RC-1 Wave-3 P2 render-waste
 * elimination).
 *
 * See `store/__tests__/_renderCountHarness.tsx`'s header and
 * `components/home/__tests__/homeScreenV2RenderCount.render.test.tsx` for
 * the full rationale — same pattern, applied to this screen's slice list.
 * `ReadinessInsightsV2` itself is not mounted directly (expo-router /
 * react-i18next / the analytics-snapshot fetch pull in modules that hit the
 * pre-existing `__DEV__` load wall documented in
 * `readinessInsightsV2Wiring.test.ts`'s header).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FacadeAndSliceHarness,
  useFacadeState,
  useCountRenders,
  type HarnessControls,
} from '@/store/__tests__/_renderCountHarness';
import { extractCalledSliceHooks } from '@/store/__tests__/_actionsSourceScan';
import {
  useHistorySlice,
  useBootstrapSlice,
  useUserSlice,
  useEngineSlice,
  useFlagsSlice,
} from '@/store/slices';

const SOURCE = readFileSync(join(__dirname, '..', 'ReadinessInsightsV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

/** The exact slice-hook set `ReadinessSliceProbe` below exercises — kept as one list so the drift guard can diff against it. */
const PROBE_HOOKS = [
  'useHistorySlice',
  'useBootstrapSlice',
  'useUserSlice',
  'useEngineSlice',
  'useFeatureFlags', // called in the real screen as `useFeatureFlags()`, re-exported from `useFlagsSlice`
];

const TICKS = 20;

/** Mirrors ReadinessInsightsV2's actual top-of-component slice subscriptions. */
function ReadinessSliceProbe({ counterRef }: { counterRef: React.MutableRefObject<number> }) {
  useCountRenders(counterRef);
  useHistorySlice();
  useBootstrapSlice();
  useUserSlice();
  useEngineSlice();
  useFlagsSlice();
  return null;
}

/** The OLD pattern this screen dropped: a Context memoized on the whole state object. */
function FacadeControlProbe({ counterRef }: { counterRef: React.MutableRefObject<number> }) {
  useCountRenders(counterRef);
  useFacadeState();
  return null;
}

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

function mount(probe: React.ReactElement): HarnessControls {
  let controls: HarnessControls | null = null;
  root = createRoot(host);
  flushSync(() =>
    root.render(
      <FacadeAndSliceHarness onControls={(c) => { controls = c; }}>
        {probe}
      </FacadeAndSliceHarness>,
    ),
  );
  if (!controls) throw new Error('harness did not report controls');
  return controls;
}

describe('ReadinessInsightsV2 slice migration — render count on a TICK_TIMER burst (RC-1 W3P2)', () => {
  it(`a probe subscribed via ReadinessInsightsV2's exact slice hooks renders once and NEVER again across a ${TICKS}-tick TICK_TIMER burst`, () => {
    const counter = { current: 0 };
    const controls = mount(<ReadinessSliceProbe counterRef={counter} />);
    expect(counter.current).toBe(1);

    for (let i = 0; i < TICKS; i++) flushSync(() => controls.dispatchTick());

    expect(counter.current).toBe(1);
  });

  it('control: a facade-subscribed probe (the pre-migration pattern) DOES re-render on every tick — proves the harness detects renders', () => {
    const counter = { current: 0 };
    const controls = mount(<FacadeControlProbe counterRef={counter} />);
    expect(counter.current).toBe(1);

    for (let i = 0; i < TICKS; i++) flushSync(() => controls.dispatchTick());

    expect(counter.current).toBe(1 + TICKS);
  });

  it('mutation-verify: a probe that also reads the facade (simulating a regression back onto useAppStore) fails the zero-render expectation', () => {
    function RegressedProbe({ counterRef }: { counterRef: React.MutableRefObject<number> }) {
      useCountRenders(counterRef);
      useHistorySlice();
      useFacadeState(); // the regression this proves the harness would catch
      return null;
    }
    const counter = { current: 0 };
    const controls = mount(<RegressedProbe counterRef={counter} />);
    for (let i = 0; i < 5; i++) flushSync(() => controls.dispatchTick());

    expect(counter.current).toBeGreaterThan(1);
  });
});

describe('ReadinessInsightsV2 — render-count probe hook list matches the real screen (drift guard)', () => {
  it('the real screen calls every slice hook this probe exercises', () => {
    for (const hook of PROBE_HOOKS) {
      if (hook === 'useFeatureFlags') {
        // The real screen imports this as `useFeatureFlags` (re-exported
        // from `store/useAppStore.tsx`, which re-exports `useFlagsSlice`).
        expect(CODE).toContain('useFeatureFlags()');
        continue;
      }
      expect(CODE).toMatch(new RegExp(`${hook}\\s*(<[^>]*>)?\\s*\\(`));
    }
  });

  // RC-1 W3 r2 hardening (#551 should-fix 2): bidirectional — see
  // `homeScreenV2RenderCount.render.test.tsx`'s identical guard for the full
  // rationale. Source-scans the real screen for the SET of slice hooks it
  // calls and asserts it's EXACTLY `PROBE_HOOKS`, so a future hook this
  // screen adds but the probe doesn't mirror fails loudly instead of
  // leaving the zero-render evidence silently stale.
  it('PROBE_HOOKS is EXACTLY the set of slice hooks the real screen calls — not just a subset (bidirectional drift guard)', () => {
    const actualHooks = [...extractCalledSliceHooks(SOURCE)].sort();
    expect(actualHooks).toEqual([...PROBE_HOOKS].sort());
  });

  it('mutation-verify: a hook call the real screen adds but the probe list omits is caught', () => {
    const mutatedSource = `${SOURCE}\n  useCycleSlice();\n`;
    const actualHooks = [...extractCalledSliceHooks(mutatedSource)].sort();
    expect(actualHooks).not.toEqual([...PROBE_HOOKS].sort());
    expect(actualHooks).toContain('useCycleSlice');
  });
});
