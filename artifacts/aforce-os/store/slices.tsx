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
  InventoryState,
  HistoryEntry,
} from '../types';
import type { UserSubscription } from '../types/subscription';
import type { SweatAutopilot } from '../types/sweat';
import type { UnitPreferences } from '../utils/units';
import type { ProfileIdentity } from '../utils/profileIdentity';
import type { VoiceIntensity, VoiceScope } from '../services/voice/commandVoice';
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
}

/**
 * The recheck countdown, alone in its own context (Wave-4 Part 6).
 *
 * `timerSeconds` changes every second. Bundled into CycleSlice it minted a
 * new slice value 60x/min, re-rendering consumers that only read
 * `isCompletingCycle`. Isolated here, the per-second churn reaches only
 * components that actually display a countdown.
 */
export interface TimerSlice {
  timerSeconds: number;
}

export interface ConfirmationSlice {
  pendingConfirmation: boolean;
}

export interface OnboardingSlice {
  hasSeenOnboarding: boolean;
}

export type InventorySlice = InventoryState;

export type UnitPreferencesSlice = UnitPreferences;

export type ProfileIdentitySlice = ProfileIdentity;

export interface SweatAutopilotSlice {
  /**
   * Active autopilot snapshot derived from the most recent sweat
   * session. Null until the user runs the calculator at least once or
   * after the recovery window expires.
   */
  autopilot: SweatAutopilot | null;
  /** Epoch ms when the autopilot was set — drives the 4h window. */
  setAt: number | null;
}

/** Recovery/cycle history, newest-first — powers the Readiness Insights chart. */
export type HistorySlice = HistoryEntry[];

export interface BootstrapSlice {
  /**
   * RC-1 Wave-2B — true once the mount-time `/v1/home` fetch has settled
   * (success or failure). False only during the brief pre-hydration window
   * where `state` still reflects the local, synchronous initial guess.
   * Monotonic — never goes back to false. See `store/useAppStore.tsx`'s
   * `AppProvider` for where it flips.
   */
  isHydrated: boolean;
}

export interface VoiceSettingsSlice {
  /**
   * Selected ElevenLabs voice id, or null when the user prefers the
   * device synthesizer. Persisted to AsyncStorage by `AppProvider`.
   */
  selectedVoiceId: string | null;
  /** Voice Coach (T3) master toggle — reads each new AI command aloud. */
  voiceCoachEnabled: boolean;
  /** AForce Command Voice Engine — intensity setting ('calm'|'standard'|'pressure'). */
  voiceIntensity: VoiceIntensity;
  /** AForce Command Voice Engine — scope setting (which categories may speak). */
  voiceScope: VoiceScope;
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
const TimerContext = createContext<TimerSlice | null>(null);
const ConfirmationContext = createContext<ConfirmationSlice | null>(null);
const OnboardingContext = createContext<OnboardingSlice | null>(null);
const InventoryContext = createContext<InventorySlice | null>(null);
const SweatAutopilotContext = createContext<SweatAutopilotSlice | null>(null);
const UnitPreferencesContext = createContext<UnitPreferencesSlice | null>(null);
const ProfileIdentityContext = createContext<ProfileIdentitySlice | null>(null);
const HistoryContext = createContext<HistorySlice | null>(null);
const BootstrapContext = createContext<BootstrapSlice | null>(null);
const VoiceSettingsContext = createContext<VoiceSettingsSlice | null>(null);
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
export function useTimerSlice(): TimerSlice {
  return required(useContext(TimerContext), 'useTimerSlice');
}
export function useConfirmationSlice(): ConfirmationSlice {
  return required(useContext(ConfirmationContext), 'useConfirmationSlice');
}
export function useOnboardingSlice(): OnboardingSlice {
  return required(useContext(OnboardingContext), 'useOnboardingSlice');
}
/** On-hand AForce inventory — gates the Recovery Protocol card. */
export function useInventorySlice(): InventorySlice {
  return required(useContext(InventoryContext), 'useInventorySlice');
}
/** Active sweat-driven autopilot snapshot (null when expired / never set). */
export function useSweatAutopilotSlice(): SweatAutopilotSlice {
  return required(useContext(SweatAutopilotContext), 'useSweatAutopilotSlice');
}
/**
 * User-chosen display units (lbs/kg, °F/°C, oz/mL). Persisted across
 * launches. Components calling display formatters from `utils/units`
 * should read the relevant field from this slice instead of hard-
 * coding 'lbs' / 'F' / 'oz'.
 */
export function useUnitPreferencesSlice(): UnitPreferencesSlice {
  return required(useContext(UnitPreferencesContext), 'useUnitPreferencesSlice');
}
/**
 * User-editable identity fields shown on the premium profile card —
 * nickname, city, country, team/circle, territory badge, aura state.
 * Persisted across launches. Driven by the Edit Profile modal.
 */
export function useProfileIdentitySlice(): ProfileIdentitySlice {
  return required(useContext(ProfileIdentityContext), 'useProfileIdentitySlice');
}
/** Recovery/cycle history, newest-first (chart source for Readiness Insights). */
export function useHistorySlice(): HistorySlice {
  return required(useContext(HistoryContext), 'useHistorySlice');
}
/** First-paint hydration status — see `BootstrapSlice` for the contract. */
export function useBootstrapSlice(): BootstrapSlice {
  return required(useContext(BootstrapContext), 'useBootstrapSlice');
}
/** Voice Coach / Command Voice Engine preferences (coach id, intensity, scope). */
export function useVoiceSettingsSlice(): VoiceSettingsSlice {
  return required(useContext(VoiceSettingsContext), 'useVoiceSettingsSlice');
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
   * First-paint hydration flag + Voice Coach preferences. These live as
   * plain `useState` in `AppProvider` (not the reducer's `AppState`), so
   * they're threaded in as primitive props rather than read off `state`
   * — `SliceProvider` still owns memoizing them into their own slices.
   */
  isHydrated: boolean;
  selectedVoiceId: string | null;
  voiceCoachEnabled: boolean;
  voiceIntensity: VoiceIntensity;
  voiceScope: VoiceScope;
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
export function SliceProvider({
  state,
  actions,
  isHydrated,
  selectedVoiceId,
  voiceCoachEnabled,
  voiceIntensity,
  voiceScope,
  now = Date.now,
  children,
}: SliceProviderProps) {
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
    }),
    [state.showCycleSuccess, state.lastCycleResult, state.isCompletingCycle],
  );

  const timerValue = useMemo<TimerSlice>(
    () => ({ timerSeconds: state.timerSeconds }),
    [state.timerSeconds],
  );

  const confirmationValue = useMemo<ConfirmationSlice>(
    () => ({ pendingConfirmation: state.pendingConfirmation }),
    [state.pendingConfirmation],
  );

  const onboardingValue = useMemo<OnboardingSlice>(
    () => ({ hasSeenOnboarding: state.hasSeenOnboarding }),
    [state.hasSeenOnboarding],
  );

  // Default to all-zero inventory so consumers always get a stable
  // shape — the Recovery Protocol resolver flips to a restock command
  // when every count is zero. Real values come from defaultUserState
  // in mockData.ts (or, eventually, the inventory service).
  const inventoryValue = useMemo<InventorySlice>(
    () => state.userState.inventory ?? { sticks: 0, rtd: 0, canister: 0 },
    [state.userState.inventory],
  );

  const sweatAutopilotValue = useMemo<SweatAutopilotSlice>(
    () => ({
      autopilot: state.sweatAutopilot ?? null,
      setAt: state.sweatAutopilotSetAt ?? null,
    }),
    [state.sweatAutopilot, state.sweatAutopilotSetAt],
  );

  const unitPreferencesValue = useMemo<UnitPreferencesSlice>(
    () => state.unitPreferences,
    [state.unitPreferences],
  );

  const profileIdentityValue = useMemo<ProfileIdentitySlice>(
    () => state.profileIdentity,
    [state.profileIdentity],
  );

  const historyValue = useMemo<HistorySlice>(() => state.history, [state.history]);

  const bootstrapValue = useMemo<BootstrapSlice>(() => ({ isHydrated }), [isHydrated]);

  const voiceSettingsValue = useMemo<VoiceSettingsSlice>(
    () => ({ selectedVoiceId, voiceCoachEnabled, voiceIntensity, voiceScope }),
    [selectedVoiceId, voiceCoachEnabled, voiceIntensity, voiceScope],
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
                 <TimerContext.Provider value={timerValue}>
                  <ConfirmationContext.Provider value={confirmationValue}>
                    <OnboardingContext.Provider value={onboardingValue}>
                      <InventoryContext.Provider value={inventoryValue}>
                        <SweatAutopilotContext.Provider value={sweatAutopilotValue}>
                          <UnitPreferencesContext.Provider value={unitPreferencesValue}>
                            <ProfileIdentityContext.Provider value={profileIdentityValue}>
                              <HistoryContext.Provider value={historyValue}>
                                <BootstrapContext.Provider value={bootstrapValue}>
                                  <VoiceSettingsContext.Provider value={voiceSettingsValue}>
                                    <ActionsContext.Provider value={actions}>
                                      {children}
                                    </ActionsContext.Provider>
                                  </VoiceSettingsContext.Provider>
                                </BootstrapContext.Provider>
                              </HistoryContext.Provider>
                            </ProfileIdentityContext.Provider>
                          </UnitPreferencesContext.Provider>
                        </SweatAutopilotContext.Provider>
                      </InventoryContext.Provider>
                    </OnboardingContext.Provider>
                  </ConfirmationContext.Provider>
                 </TimerContext.Provider>
                </CycleContext.Provider>
              </IntakeContext.Provider>
            </FlagsContext.Provider>
          </SubscriptionContext.Provider>
        </SocialContext.Provider>
      </UserContext.Provider>
    </EngineContext.Provider>
  );
}
