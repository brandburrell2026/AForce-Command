/**
 * Render-count harness — RC-1 Wave-3 P2 render-waste elimination.
 *
 * Proves the actual MECHANISM the migration relies on: a component
 * subscribed to a narrow `slices.tsx` context does not re-render when the
 * reducer's `TICK_TIMER` case fires, while a component reading the OLD
 * `useAppStore()`-style facade (a Context memoized on the WHOLE state
 * object) does.
 *
 * Mounts the REAL, unmodified `reducer` (`store/appStoreReducer.ts`) and the
 * REAL, unmodified `SliceProvider` (`store/slices.tsx`) — the exact
 * production Context/Provider/reducer chain `AppProvider` itself nests
 * (`<AppContext.Provider><SliceProvider>…`, see `store/useAppStore.tsx`).
 * `AppProvider` itself is deliberately NOT used here: it transitively
 * imports AsyncStorage / expo-location / phantom-band BLE / textToSpeech /
 * secureKV / i18nService, all of which hit a documented pre-existing
 * `ReferenceError: __DEV__ is not defined` load failure under this repo's
 * vitest runtime (`expo-modules-core/src/environment/browser.ts:10`) —
 * reproducible today via any of the 13 currently-failing
 * `services/__tests__/*.test.ts` files, and the same reason every other
 * `useAppStore`/`expo-router`/`@clerk/expo`-connected screen in this repo is
 * source-guard-tested rather than mounted directly (see
 * `homeScreenV2Wiring.test.ts`, `readinessInsightsV2Wiring.test.ts`,
 * `profileScreenV2ErrorAndSkeletonWiring.test.ts`, and
 * `connectedHealthContainer.render.test.tsx`'s header, all citing the same
 * convention). None of `AppProvider`'s ~30 side-effecting scaffolding
 * effects (weather, geolocation, WebSocket subscribe, AsyncStorage
 * hydration, phantom-band, journal-snapshot POST, …) bear on render-count
 * correctness — the entire mechanism under test (does a `TICK_TIMER`
 * dispatch change a given slice's Context value identity) lives entirely in
 * `reducer` + `SliceProvider`, both used here byte-identical to production.
 *
 * `FacadeContext` below is a minimal, faithful stand-in for
 * `store/useAppStore.tsx`'s real `AppContext`: memoized on the whole `state`
 * object, exactly like that file's `value = useMemo(() => ({ state, ... }),
 * [state, ...])`. It exists so the harness can prove a facade-subscribed
 * consumer DOES re-render on every `TICK_TIMER` — the ">0 renders" control
 * required to make the migrated screens' "0 renders" result meaningful
 * evidence rather than a harness that never fires at all.
 */
import React, { createContext, useContext, useLayoutEffect, useMemo, useReducer } from 'react';
import { reducer } from '../appStoreReducer';
import { SliceProvider, type ActionsSlice } from '../slices';
import type { AppState } from '../appStoreTypes';
import { pickFacadeState, type FacadeState } from '../app/facadeState';
import { makeState } from './_fixtures';

const noop = (): void => {};
const asyncNoop = async (): Promise<void> => {};

/**
 * Every action the real `ActionsSlice` carries (mirrors `useAppStore.tsx`'s
 * `actions` useMemo), all no-ops — this harness never exercises action
 * behavior, only render counts from state changes.
 */
export function buildHarnessActions(): ActionsSlice {
  return {
    logIntake: asyncNoop,
    completeCycle: asyncNoop,
    snooze: noop,
    dismissSuccess: noop,
    updateSymptoms: asyncNoop,
    updateUrineSignal: asyncNoop,
    updateEnergyState: asyncNoop,
    confirmStatus: asyncNoop,
    setFeatureFlags: noop,
    setSubscription: noop,
    completeOnboarding: noop,
    setAppleHealthSnapshot: noop,
    setProviderBiometrics: noop,
    confirmCommand: asyncNoop,
    setLanguage: asyncNoop,
    activateSocialMode: asyncNoop,
    logSocialDrink: asyncNoop,
    confirmSocialHydration: asyncNoop,
    deactivateSocialMode: asyncNoop,
    setSocialContext: asyncNoop,
    activateCruiseMode: asyncNoop,
    activateVoyageShield: asyncNoop,
    setSweatAutopilot: noop,
    setNotificationSetting: noop,
    setUnitPreference: noop,
    setProfileIdentity: noop,
    setVoiceCoachEnabled: noop,
    setSelectedVoiceId: noop,
    setVoiceIntensity: noop,
    setVoiceScope: noop,
    setInvestorDemoActive: noop,
  };
}

const FacadeContext = createContext<AppState | null>(null);

/** Reads the facade-style context — the OLD pattern every migrated screen dropped. */
export function useFacadeState(): AppState {
  const v = useContext(FacadeContext);
  if (!v) throw new Error('useFacadeState() called outside <FacadeAndSliceHarness>');
  return v;
}

const StableFacadeContext = createContext<FacadeState | null>(null);

/**
 * Reads the CURRENT facade — `pickFacadeState`-shaped and memoized on the
 * 16 non-timer fields, exactly as `useAppStore.tsx` builds it since Wave-4
 * Part 6. Paired with `useFacadeState` above, the two give a before/after
 * measurement of the same `TICK_TIMER` load in one run.
 */
export function useStableFacadeState(): FacadeState {
  const v = useContext(StableFacadeContext);
  if (!v) throw new Error('useStableFacadeState() called outside <FacadeAndSliceHarness>');
  return v;
}

export interface HarnessControls {
  /** Fires one `TICK_TIMER` dispatch against the real reducer. */
  dispatchTick: () => void;
}

/**
 * Mounts both the facade-style context and the real `SliceProvider` around
 * `children`, driven by ONE real `reducer` instance — mirroring how
 * `AppProvider` nests `<AppContext.Provider>` around `<SliceProvider>`
 * today. `onControls` hands the test a `dispatchTick()` it can call
 * imperatively (outside React, e.g. from a `flushSync` block) to fire
 * `TICK_TIMER` bursts. `dispatch` from `useReducer` is referentially stable
 * across renders (a React guarantee), so capturing it once in a
 * `useLayoutEffect` with an empty dependency array is safe.
 */
export function FacadeAndSliceHarness({
  initialState,
  onControls,
  children,
}: {
  initialState?: AppState;
  onControls: (controls: HarnessControls) => void;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState ?? makeState());
  const actions = useMemo(buildHarnessActions, []);
  // The PRE-Wave-4 facade: memoized on `state` alone, so every TICK_TIMER
  // changed its identity. Retained as the "before" control.
  const facadeValue = useMemo(() => state, [state]);

  // The CURRENT facade: `pickFacadeState` memoized on the 16 non-timer
  // fields — byte-identical in shape and dependency list to
  // `useAppStore.tsx`'s `facadeState` memo.
  const stableFacadeValue = useMemo<FacadeState>(() => pickFacadeState(state), [
    state.userState, state.engineOutput, state.history, state.lastCycleResult,
    state.isCompletingCycle, state.showCycleSuccess, state.pendingConfirmation,
    state.featureFlags, state.subscription, state.lastIntakeBurstAt,
    state.hasSeenOnboarding, state.sweatAutopilot, state.sweatAutopilotSetAt,
    state.notificationSettings, state.unitPreferences, state.profileIdentity,
  ]);

  useLayoutEffect(() => {
    onControls({ dispatchTick: () => dispatch({ type: 'TICK_TIMER' }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FacadeContext.Provider value={facadeValue}>
     <StableFacadeContext.Provider value={stableFacadeValue}>
      <SliceProvider
        state={state}
        actions={actions}
        isHydrated
        lastRefreshStale={false}
        selectedVoiceId={null}
        voiceCoachEnabled={false}
        voiceIntensity="standard"
        voiceScope="all"
      >
        {children}
      </SliceProvider>
     </StableFacadeContext.Provider>
    </FacadeContext.Provider>
  );
}

/**
 * Increments `counterRef.current` on every render commit of the calling
 * component (via `useLayoutEffect` with no dependency array, so it fires
 * after every render — never during the render body itself, keeping this
 * side-effect-free per React's rules). Call once per probe component.
 */
export function useCountRenders(counterRef: React.MutableRefObject<number>): void {
  useLayoutEffect(() => {
    counterRef.current += 1;
  });
}
