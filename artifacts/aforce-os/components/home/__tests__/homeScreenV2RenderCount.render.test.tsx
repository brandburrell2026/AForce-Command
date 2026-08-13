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
import { extractCalledSliceHooks } from '@/store/__tests__/_actionsSourceScan';
import {
  useUserSlice,
  useVoiceSettingsSlice,
  useBootstrapSlice,
  useEngineSlice,
  useFlagsSlice,
  useActionsSlice,
  useHistorySlice,
  useCycleSlice,
} from '@/store/slices';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

/** The exact slice-hook set `HomeSliceProbe` below exercises — kept as one list so the drift guard can diff against it. */
const PROBE_HOOKS = [
  'useUserSlice',
  'useVoiceSettingsSlice',
  'useBootstrapSlice',
  'useEngineSlice',
  'useFeatureFlags', // called in the real screen as `useFeatureFlags()`, re-exported from `useFlagsSlice`
  'useActionsSlice',
  // Wave 5: the first-launch evidence gate reads real cycle history from the
  // store rather than fetching it, so Home subscribes to this slice. History
  // changes only when a cycle completes, so it costs no per-tick renders.
  'useHistorySlice',
  // BUILD-61 CORRECTION 2: LOG WATER now opens a picker, writes on confirm and
  // shows the shipped success overlay, so Home reads the cycle slice for the
  // in-flight flag and the settled result. This is a DELIBERATE new
  // subscription, added here (rather than the guard being relaxed) so the
  // zero-render proof below covers it: the cycle slice's memo depends only on
  // showCycleSuccess / lastCycleResult / isCompletingCycle, none of which
  // TICK_TIMER touches, so the burst assertion still expects ZERO re-renders.
  'useCycleSlice',
];

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
  useHistorySlice();
  useCycleSlice();
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
    for (const hook of PROBE_HOOKS) {
      if (hook === 'useFeatureFlags') {
        // The real screen imports this as `useFeatureFlags` (re-exported
        // from `store/useAppStore.tsx`, which re-exports `useFlagsSlice`) —
        // same underlying context, different name at the call site, so it
        // doesn't match the `use*Slice` shape the loop below checks.
        expect(CODE).toContain('useFeatureFlags()');
        continue;
      }
      expect(CODE).toMatch(new RegExp(`${hook}\\s*(<[^>]*>)?\\s*\\(`));
    }
  });

  // RC-1 W3 r2 hardening (#551 should-fix 2): the check above is
  // one-directional — it proves the probe's hooks are all present in the
  // real screen, but says nothing if the real screen starts calling an
  // ADDITIONAL slice hook the probe doesn't exercise. That gap lets the
  // render-count evidence above go silently stale: a screen that grows a
  // new `use*Slice()`/`useFeatureFlags()` subscription (e.g. `useCycleSlice`
  // for a new feature) would keep re-rendering on ticks that touch that
  // slice, with no test catching that the "zero re-renders" proof no longer
  // reflects the real screen. This test closes the loop: it source-scans
  // HomeScreenV2.tsx for the actual SET of slice hooks it calls and asserts
  // that set is EXACTLY `PROBE_HOOKS` — not a subset, not a superset.
  it("PROBE_HOOKS is EXACTLY the set of slice hooks the real screen calls — not just a subset (bidirectional drift guard)", () => {
    const actualHooks = [...extractCalledSliceHooks(SOURCE)].sort();
    expect(actualHooks).toEqual([...PROBE_HOOKS].sort());
  });

  it('mutation-verify: a hook call the real screen adds but the probe list omits is caught', () => {
    // Simulates the exact regression the bidirectional check above exists
    // for — HomeScreenV2.tsx growing a new slice-hook call that
    // `HomeSliceProbe` never picks up, so its zero-render proof stops
    // covering the real screen's actual subscription set.
    //
    // BUILD-61 CORRECTION 2: the mutant used to be `useCycleSlice`, which the
    // real screen now genuinely calls — appending it a second time would have
    // left the extracted SET unchanged and turned this into a vacuous test
    // that could never fail. `useTimerSlice` is the right replacement on the
    // merits, not just the first unused name: it is the per-second slice, so
    // an unmirrored subscription to it is precisely the regression that would
    // invalidate the zero-re-render proof above.
    expect(PROBE_HOOKS).not.toContain('useTimerSlice');
    expect(extractCalledSliceHooks(SOURCE)).not.toContain('useTimerSlice');

    const mutatedSource = `${SOURCE}\n  useTimerSlice();\n`;
    const actualHooks = [...extractCalledSliceHooks(mutatedSource)].sort();
    expect(actualHooks).not.toEqual([...PROBE_HOOKS].sort());
    expect(actualHooks).toContain('useTimerSlice');
  });
});
