/**
 * Sliced contexts for the AForce app store.
 *
 * Why this exists:
 *   The original `useAppStore()` exposes one monolithic context. Any state
 *   change re-rendered every consumer. We now project the reducer state
 *   into a small set of slice-scoped React contexts (Engine / User /
 *   Social / Heat / Subscription / Flags / Intake / Cycle / Confirmation /
 *   Onboarding) plus a stable Actions context for callbacks.
 *
 *   Components subscribe to a slice via the `use*Slice()` hooks below.
 *   Because each slice's value is memoized off only the fields it needs,
 *   `React.useContext` only re-runs the consumer when *that* slice
 *   actually changes — even though the underlying reducer still owns the
 *   full app state.
 *
 *   `useAppStore()` is preserved as a facade for legacy consumers; new
 *   code should reach for the slice hooks instead.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type {
  ScoreEngineOutput,
  UserState,
  CycleResult,
  FeatureFlags,
  IntakeEvent,
} from '../types';
import type { UserSubscription } from '../types/subscription';
import type { AppState } from './appStoreTypes';

// ─── Slice value shapes ──────────────────────────────────────────────

export type EngineSlice = ScoreEngineOutput;
export type UserSlice = UserState;
export type SocialSlice = NonNullable<ScoreEngineOutput['social']> | null;
export type SubscriptionSlice = UserSubscription;
export type FlagsSlice = FeatureFlags;

export interface IntakeSlice {
  /** Most recent intake event timestamp burst — drives the orb pulse. */
  lastIntakeBurstAt: number;
  /** Events from the last rolling 24h window (already filtered). */
  recentEvents: IntakeEvent[];
  /** Convenience: true when no intake events were logged in the last 24h. */
  noRecentIntake: boolean;
}

export interface CycleSlice {
  showCycleSuccess: boolean;
  lastCycleResult: CycleResult | null;
  isCompletingCycle: boolean;
  timerSeconds: number;
}

export interface ConfirmationSlice {
  pendingConfirmation: boolean;
}

export interface OnboardingSlice {
  hasSeenOnboarding: boolean;
}

// Actions are passed through unchanged — the AppProvider already memoizes
// the callbacks so this context value is stable across renders unless a
// callback identity actually changes. Consumers narrow it to the subset
// of actions they actually call via `useActionsSlice<MyShape>()`.
export interface ActionsSlice {
  [action: string]: ((...args: never[]) => unknown) | undefined;
}

// ─── Contexts ────────────────────────────────────────────────────────

const EngineContext = createContext<EngineSlice | null>(null);
const UserContext = createContext<UserSlice | null>(null);
const SocialContext = createContext<SocialSlice>(null);
const SubscriptionContext = createContext<SubscriptionSlice | null>(null);
const FlagsContext = createContext<FlagsSlice | null>(null);
const IntakeContext = createContext<IntakeSlice | null>(null);
const CycleContext = createContext<CycleSlice | null>(null);
const ConfirmationContext = createContext<ConfirmationSlice | null>(null);
const OnboardingContext = createContext<OnboardingSlice | null>(null);
const ActionsContext = createContext<ActionsSlice | null>(null);

// ─── Selector hooks ──────────────────────────────────────────────────

function required<T>(value: T | null, name: string): T {
  if (value === null || value === undefined) {
    throw new Error(`${name} must be used inside <SliceProvider/> (typically nested under <AppProvider/>).`);
  }
  return value;
}

export function useEngineSlice(): EngineSlice {
  return required(useContext(EngineContext), 'useEngineSlice');
}
export function useUserSlice(): UserSlice {
  return required(useContext(UserContext), 'useUserSlice');
}
/** Returns null when Social Mode is not active. */
export function useSocialSlice(): SocialSlice {
  return useContext(SocialContext);
}
export function useSubscriptionSlice(): SubscriptionSlice {
  return required(useContext(SubscriptionContext), 'useSubscriptionSlice');
}
export function useFlagsSlice(): FlagsSlice {
  return required(useContext(FlagsContext), 'useFlagsSlice');
}
export function useIntakeSlice(): IntakeSlice {
  return required(useContext(IntakeContext), 'useIntakeSlice');
}
export function useCycleSlice(): CycleSlice {
  return required(useContext(CycleContext), 'useCycleSlice');
}
export function useConfirmationSlice(): ConfirmationSlice {
  return required(useContext(ConfirmationContext), 'useConfirmationSlice');
}
export function useOnboardingSlice(): OnboardingSlice {
  return required(useContext(OnboardingContext), 'useOnboardingSlice');
}
export function useActionsSlice<T = ActionsSlice>(): T {
  return required(useContext(ActionsContext), 'useActionsSlice') as unknown as T;
}

// ─── Provider ────────────────────────────────────────────────────────

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function asMillis(value: Date | string | number | undefined | null): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface SliceProviderProps {
  state: AppState;
  actions: ActionsSlice;
  /**
   * Optional clock override for tests so the 24h window is deterministic.
   * Defaults to `Date.now`.
   */
  now?: () => number;
  children: React.ReactNode;
}

/**
 * Project AppState into per-slice contexts. Each slice value is memoized
 * off only the fields it needs so consumers re-render exactly when their
 * slice changes — not when an unrelated part of state changes.
 */
export function SliceProvider({ state, actions, now = Date.now, children }: SliceProviderProps) {
  const engineValue = useMemo<EngineSlice>(() => state.engineOutput, [state.engineOutput]);

  const userValue = useMemo<UserSlice>(() => state.userState, [state.userState]);

  const socialValue = useMemo<SocialSlice>(
    () => state.engineOutput.social ?? null,
    [state.engineOutput.social],
  );

  const subscriptionValue = useMemo<SubscriptionSlice>(
    () => state.subscription,
    [state.subscription],
  );

  const flagsValue = useMemo<FlagsSlice>(() => state.featureFlags, [state.featureFlags]);

  const intakeValue = useMemo<IntakeSlice>(() => {
    const events = state.userState.intakeEvents ?? [];
    const cutoff = now() - ONE_DAY_MS;
    const recentEvents = events.filter((evt) => {
      const ms = asMillis(evt.loggedAt);
      return ms != null && ms >= cutoff;
    });
    return {
      lastIntakeBurstAt: state.lastIntakeBurstAt,
      recentEvents,
      noRecentIntake: recentEvents.length === 0,
    };
  }, [state.lastIntakeBurstAt, state.userState.intakeEvents, now]);

  const cycleValue = useMemo<CycleSlice>(
    () => ({
      showCycleSuccess: state.showCycleSuccess,
      lastCycleResult: state.lastCycleResult,
      isCompletingCycle: state.isCompletingCycle,
      timerSeconds: state.timerSeconds,
    }),
    [state.showCycleSuccess, state.lastCycleResult, state.isCompletingCycle, state.timerSeconds],
  );

  const confirmationValue = useMemo<ConfirmationSlice>(
    () => ({ pendingConfirmation: state.pendingConfirmation }),
    [state.pendingConfirmation],
  );

  const onboardingValue = useMemo<OnboardingSlice>(
    () => ({ hasSeenOnboarding: state.hasSeenOnboarding }),
    [state.hasSeenOnboarding],
  );

  // Actions identity is already stabilized by the parent AppProvider's
  // useMemo. Pass through unchanged so callback consumers don't re-render
  // unless an action actually changes identity.
  return (
    <EngineContext.Provider value={engineValue}>
      <UserContext.Provider value={userValue}>
        <SocialContext.Provider value={socialValue}>
          <SubscriptionContext.Provider value={subscriptionValue}>
            <FlagsContext.Provider value={flagsValue}>
              <IntakeContext.Provider value={intakeValue}>
                <CycleContext.Provider value={cycleValue}>
                  <ConfirmationContext.Provider value={confirmationValue}>
                    <OnboardingContext.Provider value={onboardingValue}>
                      <ActionsContext.Provider value={actions}>
                        {children}
                      </ActionsContext.Provider>
                    </OnboardingContext.Provider>
                  </ConfirmationContext.Provider>
                </CycleContext.Provider>
              </IntakeContext.Provider>
            </FlagsContext.Provider>
          </SubscriptionContext.Provider>
        </SocialContext.Provider>
      </UserContext.Provider>
    </EngineContext.Provider>
  );
}
