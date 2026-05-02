/**
 * AForce OS App Store
 * React Context + useReducer state container backed by the mockApi service layer.
 *
 * Source of truth for: userState, engineOutput (score/state/pulseConfig/command),
 * cycle history, feature flags, and overlay UI state.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserState,
  AppleHealthInputs,
  CycleResult,
  HistoryEntry,
  FluidType,
  FeatureFlags,
} from '../types';
import type { UserSubscription } from '../types/subscription';
import type { SweatAutopilot } from '../types/sweat';
import type { AppState } from './appStoreTypes';
import { reducer } from './appStoreReducer';
import { SliceProvider, type ActionsSlice } from './slices';
import { defaultSubscription } from '../services/subscriptionService';
import { generateCycleIdentityMessage, generateNextCycleHint } from '../utils/scoringEngine';
import { defaultUserState, mockHistory } from '../data/mockData';
import { DEFAULT_FLAGS } from '../featureFlags/flags';
import {
  fetchHome,
  postIntakeLog,
  postSignalsUpdate,
  postUrineSignalUpdate,
  postEnergyStateUpdate,
  postCheckin,
  postClutchFlag,
  postConfirmCommand,
  postLanguage,
  refreshWeather,
  subscribeToStateUpdates,
  postSocialActivate,
  postSocialContext,
  postSocialDrink,
  postSocialHydrate,
  postSocialDeactivate,
  postJournalSnapshot,
} from '../services/realApi';
import i18n, { setLanguage as setI18nLanguage, type SupportedLanguage } from '../services/i18nService';
import { PRODUCTS } from '../data/products';
import { phantomBandService } from '../services/phantomBandService';
import { speak as ttsSpeak, setVoicePlaybackEnabled, setSelectedVoiceId as setTtsVoiceId } from '../services/textToSpeech';

// Flavor inference moved to `utils/inferFlavorFromLabel` so it can be
// unit-tested in isolation. Substring-based: "Berry Blast" and
// "Berry Blast + Dulse" both resolve to the same canonical token.
import { inferFlavorFromLabel } from '../utils/inferFlavorFromLabel';

// Service-only synchronous bootstrapping helper. The store NEVER calls
// the scoring engine directly — it always asks the mock API for engineOutput.
// (We use the synchronous helper from mockApi internals via fetchHome's
// promise resolution being immediate-after-microtask in tests; for the
// initial render, we accept a one-tick zero state and refresh on mount.)
import { calculateScore as _initialOnly } from '../utils/scoringEngine';

// Initial render only — engine output is then immediately refreshed via
// /v1/home from the service layer in an effect (see AppProvider mount).
const initialEngineOutput = _initialOnly(defaultUserState);

const initialState: AppState = {
  userState: defaultUserState,
  engineOutput: initialEngineOutput,
  history: mockHistory,
  lastCycleResult: null,
  isCompletingCycle: false,
  showCycleSuccess: false,
  timerSeconds: initialEngineOutput.riskTimer.minutes * 60,
  pendingConfirmation: false,
  featureFlags: DEFAULT_FLAGS,
  subscription: defaultSubscription(),
  lastIntakeBurstAt: 0,
  hasSeenOnboarding: false,
};

interface AppContextValue {
  state: AppState;
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
  completeCycle: () => Promise<void>;
  snooze: () => void;
  dismissSuccess: () => void;
  updateSymptoms: (symptoms: string[]) => Promise<void>;
  updateUrineSignal: (signal: number) => Promise<void>;
  updateEnergyState: (energy: UserState['energyState']) => Promise<void>;
  confirmStatus: () => Promise<void>;
  setFeatureFlags: (flags: FeatureFlags) => void;
  setSubscription: (sub: UserSubscription) => void;
  completeOnboarding: () => void;
  setAppleHealthSnapshot: (snapshot: AppleHealthInputs | null) => void;
  /**
   * Resolve the post-recheck "Did you follow the command?" prompt (T2).
   * Yes → +3 score. No → -3 score and (in Clutch mode, T3) a 10-min
   * +0.5 pts/min decay boost.
   */
  confirmCommand: (followed: boolean) => Promise<void>;
  /**
   * Persist the user's chosen UI language. Updates i18next immediately,
   * mirrors the choice into UserState so the orb / breakdown re-render,
   * and POSTs to the server so it survives reload.
   */
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  /** Social Mode (alcohol mitigation) — start a fresh drinking session. */
  activateSocialMode: () => Promise<void>;
  /** Log a single drink of the given alcohol type. */
  logSocialDrink: (
    type: 'beer' | 'wine' | 'cocktail' | 'liquor' | 'hard_seltzer' | 'custom',
    opts?: { abv?: number; oz?: number },
  ) => Promise<void>;
  /** Resolve the post-drink hydration prompt (true = drank water/RTD). */
  confirmSocialHydration: (confirmed: boolean) => Promise<void>;
  /** End the drinking session — flips into the 8h Recovery Mode window. */
  deactivateSocialMode: () => Promise<void>;
  /** Persist optional BAC context (sex, ate recently) for sharper estimates. */
  setSocialContext: (
    ctx: { sex?: 'male' | 'female' | 'unspecified'; ateRecently?: boolean },
  ) => Promise<void>;
  /**
   * Snapshot the autopilot derived from a fresh sweat session into
   * the store. Pass null to clear (e.g. when the recovery window
   * expires). useHeatGuard reads this and surfaces interval/urgency
   * for any consumer that drives recheck cadence.
   */
  setSweatAutopilot: (autopilot: SweatAutopilot | null) => void;
  /**
   * Voice Coach (T3): when true, the AForce voice persona reads each
   * new AI command aloud (debounced inside textToSpeech.speak). The
   * preference is mirrored into AsyncStorage + the textToSpeech
   * playback flag so refreshes / non-React callers see the same value.
   */
  voiceCoachEnabled: boolean;
  setVoiceCoachEnabled: (next: boolean) => void;
  /**
   * Selected ElevenLabs voice id, or null when the user prefers the
   * device synthesizer. Persisted to AsyncStorage and mirrored into
   * `textToSpeech.setSelectedVoiceId` so any non-React caller sees the
   * same value.
   */
  selectedVoiceId: string | null;
  setSelectedVoiceId: (next: string | null) => void;
}

const VOICE_COACH_KEY = 'aforce.voiceCoachEnabled';
const SELECTED_VOICE_KEY = 'aforce.selectedVoiceId';

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Voice Coach toggle (T3) — defaults ON; mirrored to AsyncStorage +
  // the textToSpeech playback flag so non-React consumers see the same
  // value. Hydrated from storage on first effect.
  const [voiceCoachEnabled, setVoiceCoachEnabledState] = React.useState<boolean>(true);
  // ElevenLabs voice picker (Profile). Null = device synthesizer (default).
  const [selectedVoiceId, setSelectedVoiceIdState] = React.useState<string | null>(null);

  // Live countdown timer (drives recheck)
  useEffect(() => {
    const interval = setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic /state refresh — keeps the engine output current (decay
  // ticks, weather staleness, etc.) and rehydrates from server in case
  // a WS push was missed.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { engineOutput, userState } = await fetchHome(state.userState);
        if (cancelled) return;
        // If server returned a newer state (e.g. from another device or
        // a fresh weather lookup), adopt it; otherwise just refresh the
        // engine. We compare a few fields rather than deep-equal to keep
        // this cheap.
        const drift =
          userState.weatherFetchedAt !== state.userState.weatherFetchedAt ||
          userState.unitsConsumedToday !== state.userState.unitsConsumedToday ||
          userState.urineSignal !== state.userState.urineSignal ||
          // Pick up a language change persisted from another device when
          // the WS push was missed — without this, the Profile picker on
          // device A would never reach device B until a stronger drift
          // (intake / weather refresh) triggered the swap.
          userState.language !== state.userState.language;
        if (drift) {
          dispatch({ type: 'SET_USER_STATE', payload: { newUserState: userState, engineOutput } });
        } else {
          dispatch({ type: 'REFRESH_ENGINE', payload: { engineOutput } });
        }
      } catch {
        // swallow — UI keeps last known engineOutput
      }
    };
    refresh();
    const interval = setInterval(refresh, 30 * 1000); // every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [state.userState.lastIntakeTime, state.userState.urineSignal, state.userState.symptoms.length]);

  // When the user switches languages, the AI command strings (action /
  // explanation) live inside engineOutput and were rendered with the
  // OLD locale. Re-derive engineOutput locally so the coach card and
  // any TTS playback pick up the new language on the very next frame —
  // no server round trip required.
  useEffect(() => {
    const handler = () => {
      dispatch({
        type: 'REFRESH_ENGINE',
        payload: { engineOutput: _initialOnly(state.userState) },
      });
    };
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, [state.userState]);

  // Ref-backed latest snapshot of the client-only overlay so the WS
  // subscription (mounted once) always reads the *current* appleHealth
  // value rather than a stale closure over the initial render.
  const overlayRef = useRef<{ appleHealth?: AppleHealthInputs }>({});
  useEffect(() => {
    overlayRef.current = { appleHealth: state.userState.appleHealth };
  }, [state.userState.appleHealth]);

  // Live state pushes from the api-server. The server broadcasts after
  // every mutation, so this catches changes from other clients (or
  // server-initiated updates like the weather refresh) without waiting
  // for the 30s poll. Subscribe once per mount; the overlay getter
  // pulls from `overlayRef` so updates to appleHealth never get lost.
  useEffect(() => {
    const unsubscribe = subscribeToStateUpdates(
      (next) => dispatch({ type: 'SET_USER_STATE', payload: { newUserState: next, engineOutput: _initialOnly(next) } }),
      () => ({ appleHealth: overlayRef.current.appleHealth }),
    );
    return unsubscribe;
  }, []);

  // Weather: fetch once on mount, then every 15 min. Uses Denver as a
  // safe default (matches the existing climate strip) so we never block
  // the UI on a permission prompt; if expo-location grants real coords
  // later the next tick will use them.
  useEffect(() => {
    let cancelled = false;
    const DEFAULT_LAT = 39.7392;
    const DEFAULT_LON = -104.9903;
    const tick = async (lat: number, lon: number) => {
      try {
        const { newUserState, engineOutput } = await refreshWeather(state.userState, lat, lon);
        if (cancelled) return;
        dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
      } catch (err) {
        console.warn('[AForce] weather refresh failed', err);
      }
    };
    let lat = DEFAULT_LAT;
    let lon = DEFAULT_LON;
    // Best-effort geolocation — only on web/native where the API exists.
    // Failures fall through to the Denver default.
    (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        }
      } catch {
        // fall back to Denver
      }
      if (!cancelled) tick(lat, lon);
    })();
    const interval = setInterval(() => tick(lat, lon), 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logIntake = useCallback(async (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => {
    if (state.isCompletingCycle) return;
    dispatch({ type: 'CYCLE_START' });
    try {
      // Allow callers (e.g. the manual water amount picker) to override
      // the default per-serving oz so the score impact reflects what was
      // actually consumed (e.g. a 24 oz water bottle instead of 12 oz).
      // Map flavorLabel (display string) → ProductFlavor for the
      // hydration scoring engine. Watermelon/Berry/Soursop bonuses
      // depend on this. Fallback to the product's default flavor.
      const flavor = inferFlavorFromLabel(opts?.flavorLabel) ?? PRODUCTS[fluidType].flavor;
      const { log, newUserState, engineOutput } = await postIntakeLog(state.userState, {
        fluidType,
        ...(opts?.ozOverride != null ? { ozAmount: opts.ozOverride } : {}),
        ...(flavor ? { flavor } : {}),
      });
      const product = PRODUCTS[fluidType];
      const result: CycleResult = {
        id: log.id,
        timestamp: log.loggedAt,
        scoreBefore: log.scoreBefore,
        scoreAfter: log.scoreAfter,
        gainDisplay: `${log.scoreAfter - log.scoreBefore >= 0 ? '+' : ''}${log.scoreAfter - log.scoreBefore}`,
        identityMessage: generateCycleIdentityMessage(engineOutput.performanceState.level),
        nextCycleHint: generateNextCycleHint(engineOutput.performanceState.level),
        state: engineOutput.performanceState.level,
      };
      // When a flavor was chosen (e.g. Berry Blast +Dulse), surface it
      // in the history label so users can recall exactly what they drank.
      const baseName = opts?.flavorLabel
        ? `${product.shortName} — ${opts.flavorLabel}`
        : product.shortName;
      const historyEntry: HistoryEntry = {
        id: log.id,
        timestamp: log.loggedAt,
        score: log.scoreAfter,
        state: engineOutput.performanceState.level,
        action: `Logged ${baseName} (${log.ozAmount} oz)`,
        unitsTaken: 1,
        fluidType,
      };
      dispatch({ type: 'CYCLE_SUCCESS', payload: { result, newUserState, engineOutput, historyEntry, silent: opts?.silent } });
      // Only schedule the auto-dismiss when the hero overlay was actually shown.
      if (!opts?.silent) setTimeout(() => dispatch({ type: 'DISMISS_SUCCESS' }), 2400);
    } catch (err) {
      // Fail-safe: clear loading flag so UI never soft-locks.
      console.warn('[AForce] logIntake failed', err);
      dispatch({ type: 'DISMISS_SUCCESS' });
    }
  }, [state.userState, state.isCompletingCycle]);

  // Generic "complete cycle" — defaults to AForce stick (primary intake)
  const completeCycle = useCallback(() => logIntake('aforce_stick'), [logIntake]);

  const snooze = useCallback(() => dispatch({ type: 'SNOOZE' }), []);
  const dismissSuccess = useCallback(() => dispatch({ type: 'DISMISS_SUCCESS' }), []);

  const updateSymptoms = useCallback(async (symptoms: string[]) => {
    const { newUserState, engineOutput } = await postSignalsUpdate(state.userState, symptoms);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const updateUrineSignal = useCallback(async (signal: number) => {
    const { newUserState, engineOutput } = await postUrineSignalUpdate(state.userState, signal);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const updateEnergyState = useCallback(async (energy: UserState['energyState']) => {
    const { newUserState, engineOutput } = await postEnergyStateUpdate(state.userState, energy);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const confirmStatus = useCallback(async () => {
    const { newUserState, engineOutput } = await postCheckin(state.userState);
    dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
  }, [state.userState]);

  const setFeatureFlags = useCallback((flags: FeatureFlags) => {
    dispatch({ type: 'SET_FLAGS', payload: flags });
    // Mirror clutch_access_enabled into UserState so the engine's decay
    // function picks up the ×1.3 multiplier (T3) without needing flags
    // drilled into its API.
    const clutchActive = !!flags.clutch_access_enabled;
    if ((state.userState.clutchActive ?? false) !== clutchActive) {
      // Persist the flag server-side so it survives reload and is
      // available to any other connected client.
      postClutchFlag(state.userState, clutchActive)
        .then(({ newUserState, engineOutput }) => {
          dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
        })
        .catch(() => {});
    }
  }, [state.userState]);

  const confirmCommand = useCallback(async (followed: boolean) => {
    try {
      // Server applies confirmationDelta + (in Clutch, on No)
      // clutchDecayBoostUntil. Compliance streak is intentionally NOT
      // mutated server-side — it already contributes to the score via
      // the `consistency` term, so a ±3 swing here would double-count.
      const { newUserState, engineOutput } = await postConfirmCommand(state.userState, followed);
      dispatch({ type: 'CONFIRM_COMMAND', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] confirmCommand failed', err);
      // Local fallback so the UI doesn't soft-lock if the server is
      // unreachable; the next reconnect will re-sync state.
      const inClutch = !!state.userState.clutchActive;
      const merged: UserState = {
        ...state.userState,
        confirmationDelta: followed ? 3 : -3,
        confirmationDeltaSetAt: new Date(),
        clutchDecayBoostUntil: !followed && inClutch
          ? new Date(Date.now() + 10 * 60 * 1000)
          : state.userState.clutchDecayBoostUntil,
      };
      dispatch({ type: 'CONFIRM_COMMAND', payload: { newUserState: merged, engineOutput: state.engineOutput } });
    }
  }, [state.userState, state.engineOutput]);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    // Update i18n + local state instantly so the UI re-renders without
    // waiting for the server round-trip. The server POST is fire-and-forget;
    // a failed write just means the choice doesn't persist to other devices.
    await setI18nLanguage(lang);
    const optimistic: UserState = { ...state.userState, language: lang };
    // Recompute engineOutput now (after i18n.changeLanguage resolves) so
    // the AI command strings are fresh. Reusing `state.engineOutput`
    // would clobber the localized output produced by the
    // `languageChanged` listener with stale, pre-switch text.
    dispatch({
      type: 'SET_USER_STATE',
      payload: { newUserState: optimistic, engineOutput: _initialOnly(optimistic) },
    });
    try {
      const { newUserState, engineOutput } = await postLanguage(state.userState, lang);
      dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] setLanguage persist failed', err);
    }
  }, [state.userState]);

  const activateSocialMode = useCallback(async () => {
    try {
      const { newUserState, engineOutput } = await postSocialActivate(state.userState);
      dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] activateSocialMode failed', err);
    }
  }, [state.userState]);

  const logSocialDrink = useCallback(async (
    type: 'beer' | 'wine' | 'cocktail' | 'liquor' | 'hard_seltzer' | 'custom',
    opts: { abv?: number; oz?: number } = {},
  ) => {
    try {
      const { newUserState, engineOutput } = await postSocialDrink(state.userState, type, opts);
      dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] logSocialDrink failed', err);
    }
  }, [state.userState]);

  const confirmSocialHydration = useCallback(async (confirmed: boolean) => {
    try {
      const { newUserState, engineOutput } = await postSocialHydrate(state.userState, confirmed);
      dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] confirmSocialHydration failed', err);
    }
  }, [state.userState]);

  const deactivateSocialMode = useCallback(async () => {
    try {
      const { newUserState, engineOutput } = await postSocialDeactivate(state.userState);
      dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] deactivateSocialMode failed', err);
    }
  }, [state.userState]);

  const setSocialContext = useCallback(async (
    ctx: { sex?: 'male' | 'female' | 'unspecified'; ateRecently?: boolean },
  ) => {
    try {
      const { newUserState, engineOutput } = await postSocialContext(state.userState, ctx);
      dispatch({ type: 'SET_USER_STATE', payload: { newUserState, engineOutput } });
    } catch (err) {
      console.warn('[AForce] setSocialContext failed', err);
    }
  }, [state.userState]);

  const setSubscription = useCallback((sub: UserSubscription) => {
    dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
    AsyncStorage.setItem('aforce.subscription', JSON.stringify(sub)).catch(() => {});
  }, []);

  const setSweatAutopilot = useCallback((autopilot: SweatAutopilot | null) => {
    dispatch({
      type: 'SET_SWEAT_AUTOPILOT',
      payload: { autopilot, setAt: autopilot ? Date.now() : null },
    });
  }, []);

  // ─── Hydration Journal snapshot writer ──────────────────────────────
  // Persists a `aforce_score_snapshots` row after each engine refresh,
  // debounced so we don't flood the table:
  //   - On first render after mount
  //   - At least every 5 minutes
  //   - Immediately on band change (PEAK ↔ BALANCED ↔ RECOVERING ↔ DEPLETED)
  // Writes are fire-and-forget — a network failure never breaks the UI.
  // Crucially, `lastSnapshotRef.at/level` only advance on a *successful*
  // POST so a transient network failure doesn't suppress retries until
  // the next 5 min window or band change. An `inFlight` flag prevents
  // duplicate writes while a request is in flight.
  const lastSnapshotRef = useRef<{ at: number; level: string | null; inFlight: boolean }>({
    at: 0,
    level: null,
    inFlight: false,
  });
  useEffect(() => {
    const now = Date.now();
    const level = state.engineOutput.performanceState.level;
    const last = lastSnapshotRef.current;
    if (last.inFlight) return;
    const FIVE_MIN = 5 * 60 * 1000;
    const elapsed = now - last.at;
    const bandChanged = last.level !== null && last.level !== level;
    const shouldWrite = last.at === 0 || bandChanged || elapsed >= FIVE_MIN;
    if (!shouldWrite) return;
    lastSnapshotRef.current = { ...last, inFlight: true };
    // Sodium delivered ≈ AForce units × 25 mg (matches the prescription
    // spec rule). Sodium lost & deficit % aren't carried on the
    // autopilot snapshot itself (only urgency / interval), so they
    // default to 0; future work can plumb the underlying SweatSession.
    const autopilot = state.sweatAutopilot ?? null;
    const sodiumDeliveredMg = state.userState.aforceUnitsToday * 25;
    const sodiumLostMg = 0;
    const deficitPct = 0;
    const socialActive = !!state.userState.socialMode?.active;
    const reason = state.engineOutput.command?.action?.slice(0, 240) ?? '';
    postJournalSnapshot({
      score: state.engineOutput.score,
      level,
      ozConsumedToday: state.userState.ozConsumedToday,
      aforceUnitsToday: state.userState.aforceUnitsToday,
      unitsConsumedToday: state.userState.unitsConsumedToday,
      sodiumDeliveredMg,
      sodiumLostMg,
      deficitPct,
      clutchActive: !!state.userState.clutchActive,
      socialActive,
      autopilotActive: autopilot != null,
      reason,
    })
      .then(() => {
        // Only commit the debounce window on success.
        lastSnapshotRef.current = { at: now, level, inFlight: false };
      })
      .catch((err) => {
        // Roll back: leave `at` / `level` untouched so the very next
        // engine refresh retries (network down, auth not yet ready).
        lastSnapshotRef.current = { at: last.at, level: last.level, inFlight: false };
        console.warn('[Journal] snapshot write failed', err);
      });
  }, [
    state.engineOutput.score,
    state.engineOutput.performanceState.level,
    state.userState.ozConsumedToday,
    state.userState.aforceUnitsToday,
    state.userState.unitsConsumedToday,
    state.userState.clutchActive,
    state.userState.socialMode?.active,
    state.sweatAutopilot,
    state.engineOutput.command?.action,
  ]);

  // ─── T1: Phantom Band auto-log ─────────────────────────────────────────
  // Subscribe once: every BLE sip notification is silently logged as an
  // intake. We use a ref-backed `logIntake` so the listener always sees
  // the latest closure (state.userState moves a lot) without resubscribing.
  const logIntakeRef = useRef(logIntake);
  useEffect(() => { logIntakeRef.current = logIntake; }, [logIntake]);
  useEffect(() => {
    return phantomBandService.on('sip', (event) => {
      void logIntakeRef.current(event.fluidType, { silent: true, ozOverride: event.oz });
    });
  }, []);

  // ─── T3: Voice Coach — auto-speak the AI command on change ─────────────
  // textToSpeech.speak is debounced (500ms window on identical text), so
  // re-renders that produce the same `command.action` won't double-trigger.
  const lastSpokenCommandIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!voiceCoachEnabled) return;
    const cmd = state.engineOutput.command;
    if (!cmd?.action) return;
    if (lastSpokenCommandIdRef.current === cmd.id) return;
    lastSpokenCommandIdRef.current = cmd.id;
    ttsSpeak(cmd.action, { language: state.userState.language as SupportedLanguage | undefined });
  }, [voiceCoachEnabled, state.engineOutput.command?.id, state.engineOutput.command?.action, state.userState.language]);

  // Hydrate persisted Voice Coach preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(VOICE_COACH_KEY)
      .then((raw) => {
        if (raw == null) return;
        const next = raw === 'true';
        setVoiceCoachEnabledState(next);
        setVoicePlaybackEnabled(next);
      })
      .catch(() => {});
  }, []);

  const setVoiceCoachEnabled = useCallback((next: boolean) => {
    setVoiceCoachEnabledState(next);
    setVoicePlaybackEnabled(next);
    AsyncStorage.setItem(VOICE_COACH_KEY, String(next)).catch(() => {});
  }, []);

  // Hydrate persisted ElevenLabs voice selection on mount + mirror into
  // textToSpeech so non-React callers see it immediately.
  useEffect(() => {
    AsyncStorage.getItem(SELECTED_VOICE_KEY)
      .then((raw) => {
        const next = raw && raw.length > 0 ? raw : null;
        setSelectedVoiceIdState(next);
        setTtsVoiceId(next);
      })
      .catch(() => {});
  }, []);

  const setSelectedVoiceId = useCallback((next: string | null) => {
    const normalized = next && next.length > 0 ? next : null;
    setSelectedVoiceIdState(normalized);
    setTtsVoiceId(normalized);
    if (normalized) {
      AsyncStorage.setItem(SELECTED_VOICE_KEY, normalized).catch(() => {});
    } else {
      AsyncStorage.removeItem(SELECTED_VOICE_KEY).catch(() => {});
    }
  }, []);

  // Hydrate persisted subscription on mount.
  useEffect(() => {
    AsyncStorage.getItem('aforce.subscription')
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as UserSubscription;
          if (parsed && parsed.planId) {
            dispatch({ type: 'SET_SUBSCRIPTION', payload: parsed });
          }
        } catch {
          // Ignore malformed payloads.
        }
      })
      .catch(() => {});
  }, []);

  const completeOnboarding = useCallback(() => {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, []);

  // Push an Apple Health snapshot into the score. Pass null to clear
  // (e.g. on disconnect). The engine immediately recomputes so HRV /
  // sleep show up in the orb and breakdown without waiting for the
  // next /v1/home tick.
  const setAppleHealthSnapshot = useCallback((snapshot: AppleHealthInputs | null) => {
    const merged: UserState = snapshot
      ? { ...state.userState, appleHealth: snapshot }
      : (() => { const { appleHealth: _drop, ...rest } = state.userState; return rest as UserState; })();
    fetchHome(merged)
      .then(({ engineOutput }) => {
        dispatch({ type: 'SET_APPLE_HEALTH', payload: { snapshot, engineOutput } });
      })
      .catch((err) => {
        console.warn('[AForce] setAppleHealthSnapshot refresh failed', err);
      });
  }, [state.userState]);

  // Sync i18n with the language returned by the server on every userState
  // change. This lets a fresh app boot land on the user's saved language
  // without the picker having to be opened.
  useEffect(() => {
    const lang = state.userState.language;
    if (lang) {
      setI18nLanguage(lang).catch(() => { /* i18n init failure is non-fatal */ });
    }
  }, [state.userState.language]);

  const value = useMemo<AppContextValue>(() => ({
    state, logIntake, completeCycle, snooze, dismissSuccess,
    updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags,
    setSubscription, completeOnboarding, setAppleHealthSnapshot, confirmCommand, setLanguage,
    activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext,
    setSweatAutopilot,
    voiceCoachEnabled, setVoiceCoachEnabled,
    selectedVoiceId, setSelectedVoiceId,
  }), [state, logIntake, completeCycle, snooze, dismissSuccess, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags, setSubscription, completeOnboarding, setAppleHealthSnapshot, confirmCommand, setLanguage, activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext, setSweatAutopilot, voiceCoachEnabled, setVoiceCoachEnabled, selectedVoiceId, setSelectedVoiceId]);

  // Stable actions value for the sliced ActionsContext — same callbacks
  // as `value` minus `state`, so action consumers don't re-render when
  // unrelated state mutates.
  const actions = useMemo<ActionsSlice>(() => ({
    logIntake, completeCycle, snooze, dismissSuccess,
    updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags,
    setSubscription, completeOnboarding, setAppleHealthSnapshot, confirmCommand, setLanguage,
    activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext,
    setSweatAutopilot,
  }), [logIntake, completeCycle, snooze, dismissSuccess, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags, setSubscription, completeOnboarding, setAppleHealthSnapshot, confirmCommand, setLanguage, activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext, setSweatAutopilot]);

  return (
    <AppContext.Provider value={value}>
      <SliceProvider state={state} actions={actions}>
        {children}
      </SliceProvider>
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider');
  return ctx;
}

// ─── Focused selector hooks ────────────────────────────────────────────
// Re-exported from `./slices` so existing call sites keep working but
// now read from per-slice contexts. Subscribers re-render only when
// *their* slice changes (not on every store mutation).

export {
  useEngineSlice as useEngineOutput,
  useUserSlice as useUserState,
  useSubscriptionSlice as useSubscription,
  useFlagsSlice as useFeatureFlags,
  useSocialSlice,
  useIntakeSlice,
  useCycleSlice,
  useConfirmationSlice,
  useOnboardingSlice,
  useInventorySlice,
  useSweatAutopilotSlice,
  useActionsSlice,
} from './slices';

