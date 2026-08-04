// @vitest-environment happy-dom
/**
 * ProfileScreenV2 — render-count proof (RC-1 Wave-3 P2 render-waste
 * elimination).
 *
 * See `store/__tests__/_renderCountHarness.tsx`'s header and
 * `components/home/__tests__/homeScreenV2RenderCount.render.test.tsx` for
 * the full rationale. `ProfileScreenV2` itself is not mounted directly
 * (expo-router / @clerk/expo / WHOOP+Garmin network services / the referral
 * hook all pull in modules that hit the pre-existing `__DEV__` load wall
 * documented in `profileScreenV2ErrorAndSkeletonWiring.test.ts`'s header).
 *
 * ProfileScreenV2's slice consumption was split by section (voice settings /
 * health providers / user profile / feature flags via the main component,
 * subscription via the separately-mounted `SubscriptionPanel`) — two probes
 * below mirror that split: `ProfileMainSliceProbe` for the screen body,
 * `SubscriptionPanelProbe` for the standalone subscription slice `
 * SubscriptionPanel` now reads on its own.
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
  useFlagsSlice,
  useUnitPreferencesSlice,
  useProfileIdentitySlice,
  useVoiceSettingsSlice,
  useActionsSlice,
  useSubscriptionSlice,
} from '@/store/slices';

const SOURCE = readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const TICKS = 20;

/** Mirrors ProfileScreenV2's main-component slice subscriptions. */
function ProfileMainSliceProbe({ counterRef }: { counterRef: React.MutableRefObject<number> }) {
  useCountRenders(counterRef);
  useUserSlice();
  useFlagsSlice();
  useUnitPreferencesSlice();
  useProfileIdentitySlice();
  useVoiceSettingsSlice();
  useActionsSlice();
  return null;
}

/** Mirrors the standalone `SubscriptionPanel` sub-component's slice subscription. */
function SubscriptionPanelProbe({ counterRef }: { counterRef: React.MutableRefObject<number> }) {
  useCountRenders(counterRef);
  useSubscriptionSlice();
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

function mount(...probes: React.ReactElement[]): HarnessControls {
  let controls: HarnessControls | null = null;
  root = createRoot(host);
  flushSync(() =>
    root.render(
      <FacadeAndSliceHarness onControls={(c) => { controls = c; }}>
        {probes}
      </FacadeAndSliceHarness>,
    ),
  );
  if (!controls) throw new Error('harness did not report controls');
  return controls;
}

describe('ProfileScreenV2 slice migration — render count on a TICK_TIMER burst (RC-1 W3P2)', () => {
  it(`the main-screen probe (voice/flags/units/identity/actions) renders once and NEVER again across a ${TICKS}-tick TICK_TIMER burst`, () => {
    const mainCounter = { current: 0 };
    const subCounter = { current: 0 };
    const controls = mount(
      <ProfileMainSliceProbe key="main" counterRef={mainCounter} />,
      <SubscriptionPanelProbe key="sub" counterRef={subCounter} />,
    );
    expect(mainCounter.current).toBe(1);
    expect(subCounter.current).toBe(1);

    for (let i = 0; i < TICKS; i++) flushSync(() => controls.dispatchTick());

    expect(mainCounter.current).toBe(1);
    expect(subCounter.current).toBe(1);
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

    expect(counter.current).toBeGreaterThan(1);
  });
});

describe('ProfileScreenV2 — render-count probe hook list matches the real screen (drift guard)', () => {
  it('the main component calls every slice hook the main-screen probe exercises', () => {
    for (const hook of [
      'useUserSlice',
      'useFlagsSlice',
      'useUnitPreferencesSlice',
      'useProfileIdentitySlice',
      'useVoiceSettingsSlice',
      'useActionsSlice', // called as `useActionsSlice<Pick<AppContextValue, ...>>()` — a multi-line generic
    ]) {
      expect(CODE).toMatch(new RegExp(`${hook}\\s*(<[\\s\\S]*?>)?\\s*\\(`));
    }
  });

  it('SubscriptionPanel reads the subscription off useSubscriptionSlice(), not the useAppStore() facade', () => {
    const panelBody = CODE.slice(
      CODE.indexOf('function SubscriptionPanel()'),
      CODE.indexOf('const onManage'),
    );
    expect(panelBody).toContain('useSubscriptionSlice()');
    expect(panelBody).not.toMatch(/useAppStore\(/);
  });
});
