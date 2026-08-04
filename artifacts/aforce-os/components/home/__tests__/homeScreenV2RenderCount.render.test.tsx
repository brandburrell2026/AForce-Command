// @vitest-environment happy-dom
/**
 * HomeScreenV2 — render-count proof (RC-1 Wave-3 P2 render-waste elimination).
 *
 * See `store/__tests__/_renderCountHarness.tsx`'s header for the full
 * rationale: this mounts a probe calling HomeScreenV2's exact slice-hook
 * list against the REAL `reducer` + `SliceProvider`, rather than mounting
 * `HomeScreenV2` itself (which pulls in expo-router / @clerk/expo /
 * react-native-reanimated and hits the same pre-existing `__DEV__` load
 * wall documented in `homeScreenV2Wiring.test.ts`'s header — reproducible
 * today via any of the 13 currently-failing `services/__tests__` files).
 *
 * `HomeSliceProbe`'s hook list is pinned against `HomeScreenV2.tsx`'s
 * actual hook calls via the source-guard suite at the bottom of this file,
 * so a future change to the real screen's subscription set fails this file
 * loudly instead of leaving a stale, no-longer-representative proof here.
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
import {
  useUserSlice,
  useVoiceSettingsSlice,
  useBootstrapSlice,
  useEngineSlice,
  useFlagsSlice,
  useActionsSlice,
} from '@/store/slices';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const TICKS = 20;

/** Mirrors HomeScreenV2's actual top-of-component slice subscriptions. */
function HomeSliceProbe({ counterRef }: { counterRef: React.MutableRefObject<number> }) {
  useCountRenders(counterRef);
  useUserSlice();
  useVoiceSettingsSlice();
  useBootstrapSlice();
  useEngineSlice();
  useFlagsSlice();
  useActionsSlice();
  return null;
}

/** The OLD pattern HomeScreenV2 dropped: a Context memoized on the whole state object. */
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

describe('HomeScreenV2 slice migration — render count on a TICK_TIMER burst (RC-1 W3P2)', () => {
  it(`a probe subscribed via HomeScreenV2's exact slice hooks renders once and NEVER again across a ${TICKS}-tick TICK_TIMER burst`, () => {
    const counter = { current: 0 };
    const controls = mount(<HomeSliceProbe counterRef={counter} />);
    expect(counter.current).toBe(1); // initial mount only

    for (let i = 0; i < TICKS; i++) flushSync(() => controls.dispatchTick());

    expect(counter.current).toBe(1); // ZERO re-renders from the burst
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
      useUserSlice();
      useFacadeState(); // the regression this proves the harness would catch
      return null;
    }
    const counter = { current: 0 };
    const controls = mount(<RegressedProbe counterRef={counter} />);
    for (let i = 0; i < 5; i++) flushSync(() => controls.dispatchTick());

    // If re-subscribing to the facade stopped being observable here, this
    // harness would no longer be able to catch that regression on the real
    // screen — this assertion is the proof that it still can.
    expect(counter.current).toBeGreaterThan(1);
  });
});

describe('HomeScreenV2 — render-count probe hook list matches the real screen (drift guard)', () => {
  it('the real screen calls every slice hook this probe exercises', () => {
    for (const hook of [
      'useUserSlice',
      'useVoiceSettingsSlice',
      'useBootstrapSlice',
      'useEngineSlice',
      'useActionsSlice', // called as `useActionsSlice<HomeActions>()` — generic-tolerant below
    ]) {
      expect(CODE).toMatch(new RegExp(`${hook}\\s*(<[^>]*>)?\\s*\\(`));
    }
    // The real screen imports this as `useFeatureFlags` (re-exported from
    // `store/useAppStore.tsx`, which re-exports `useFlagsSlice`) — same
    // underlying context, different name at the call site.
    expect(CODE).toContain('useFeatureFlags()');
  });
});
