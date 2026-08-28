/**
 * AForce OS App Store
 * React Context + useReducer state container backed by the realApi service layer.
 *
 * Source of truth for: userState, engineOutput (score/state/pulseConfig/command),
 * cycle history, feature flags, and overlay UI state.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState as RNAppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserState,
  AppleHealthInputs,
  CycleResult,
  HistoryEntry,
  FluidType,
  FeatureFlags,
  ProviderSnapshot,
  ProviderBiometrics,
  ScoreEngineOutput,
  NotificationSettings,
  NotificationSettingKey,
} from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types';
import type { UserSubscription } from '../types/subscription';
import type { SweatAutopilot } from '../types/sweat';
import type { HealthProviderId } from '../data/healthProviders';
import type { AppState, Action } from './appStoreTypes';
import { reducer } from './appStoreReducer';
import {
  DEFAULT_UNIT_PREFERENCES,
  sanitizeUnitPreferences,
  type UnitPreferences,
} from '../utils/units';
import {
  DEFAULT_PROFILE_IDENTITY,
  sanitizeProfileIdentity,
  type ProfileIdentity,
} from '../utils/profileIdentity';
import { SliceProvider, type ActionsSlice } from './slices';
import { defaultSubscription } from '../services/subscriptionService';
import { scopedSecureKV } from '../services/scopedStorage';
import { scopedStorage } from '../services/scopedStorage';
import {
  hydrateProfileFromServer,
  flushPendingProfileSync,
} from '../services/profileSyncService';
import { generateCycleIdentityMessage, generateNextCycleHint } from '../utils/scoringEngine';
import { resolveInitialUserState } from '../data/initialUserState';
import { DEFAULT_FLAGS, demoUnlockAllFlags } from '../featureFlags/flags';
import { resolveInitialFeatureFlags } from '../featureFlags/internalTestflightOverlay';
import { CAPTURE_MODE } from '../services/demoMode';
import { getCommandLedgerState } from '../services/commandLedger';
import { adaptEngineOutputForRecheck } from '../utils/intelligence/adaptEngineOutput';
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
  postSocialCruise,
  postSocialShield,
  postSocialContext,
  postSocialDrink,
  postSocialHydrate,
  postSocialDeactivate,
  postJournalSnapshot,
  replayPreparedIntake,
  isOfflineError,
} from '../services/realApi';
import {
  hydrateIntakeOutbox,
  getIntakeOutboxState,
  selectDueIntakes,
  selectPendingCount,
  markIntakeSyncing,
  markIntakeSynced,
  markIntakeFailed,
  pruneSyncedIntakes,
  runExclusiveFlush,
} from '../services/intakeOutbox';
import {
  deriveRecoverySnapshot,
  recoveryInputsFromState,
} from '../services/recoveryEngine';
import i18n, { setLanguage as setI18nLanguage, type SupportedLanguage } from '../services/i18nService';
import { PRODUCTS } from '../data/products';
import { phantomBandService } from '../services/phantomBandService';
import { speak as ttsSpeak, setVoicePlaybackEnabled, setSelectedVoiceId as setTtsVoiceId } from '../services/textToSpeech';
import { DEFAULT_VOICE_ID } from '../services/voiceCatalog';
import {
  effectiveCommandLine,
  categoryAllowedForScope,
  completionRewardLine,
  type VoiceIntensity,
  type VoiceScope,
} from '../services/voice/commandVoice';
import { commandSpeak, markCycleExecuted, setSpeakerImpl as setBusSpeakerImpl } from '../services/voice/commandVoiceBus';

// Flavor inference moved to `utils/inferFlavorFromLabel` so it can be
// unit-tested in isolation. Substring-based: "Berry Blast" and
// "Berry Blast + Dulse" both resolve to the same canonical token.
import { inferFlavorFromLabel } from '../utils/inferFlavorFromLabel';

// Service-only synchronous bootstrapping helper. The store NEVER calls
// the scoring engine directly — it always asks the mock API for engineOutput.
// (We use the synchronous helper via fetchHome's
// promise resolution being immediate-after-microtask in tests; for the
// initial render, we accept a one-tick zero state and refresh on mount.)
import { calculateScore as _initialOnly } from '../utils/scoringEngine';
import { buildBreakdown } from '../utils/scoring/breakdown';
import type { AppContextValue } from './app/types';
import { pickFacadeState, type FacadeState } from './app/facadeState';
import {
  VOICE_COACH_KEY,
  SELECTED_VOICE_KEY,
  VOICE_INTENSITY_KEY,
  VOICE_SCOPE_KEY,
  NOTIFICATION_SETTINGS_KEY,
  UNIT_PREFERENCES_KEY,
  PROFILE_IDENTITY_KEY,
  VOICE_INTENSITIES,
  VOICE_SCOPES,
} from './app/constants';
import { buildSyntheticBaselineEntry } from './app/helpers';
import { useStoreActions } from './app/actions';
import { useAppStateGatedInterval } from '../hooks/useAppStateGatedInterval';

// Initial render only — engine output is then immediately refreshed via
// /v1/home from the service layer in an effect (see AppProvider mount).
//
// PR-2 production-seed honesty: production builds seed the honest empty
// state (0 units / 0 oz / streak 0 — byte-shaped like a fresh server
// account post-fetch); only env-gated DEMO/CAPTURE builds seed the tuned
// demo day (their entire data story is this seed — fetches 401 and echo
// it back). See data/initialUserState.ts for the full contract.
const initialUserState = resolveInitialUserState();
const initialEngineOutput = _initialOnly(initialUserState);

const initialState: AppState = {
  userState: initialUserState,
  engineOutput: initialEngineOutput,
  // Wave-3 PR10 (W2-N1): the store previously seeded five FABRICATED
  // history entries with always-fresh "Nm ago" stamps — and their lack of
  // an isSynthetic flag permanently disabled buildSyntheticBaselineEntry,
  // the designed self-labeling honest state. Empty start activates it.
  history: [],
  lastCycleResult: null,
  isCompletingCycle: false,
  showCycleSuccess: false,
  timerSeconds: initialEngineOutput.riskTimer.minutes * 60,
  pendingConfirmation: false,
  // RC-2 Ruling A: byte-identical to DEFAULT_FLAGS on every build except an
  // internal-TestFlight build with EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true (see
  // featureFlags/internalTestflightOverlay.ts). Production/App-Store builds
  // never set that env, so `resolveInitialFeatureFlags` returns DEFAULT_FLAGS
  // by reference here. CAPTURE_MODE (dev-only screenshot bypass, see
  // services/demoMode.ts) seeds the SAME clamped payload the Profile screen's
  // "Unlock all demo features" control dispatches — restricted
  // internal-preview flags stay OFF; compile-time inert outside __DEV__.
  featureFlags: CAPTURE_MODE ? demoUnlockAllFlags() : resolveInitialFeatureFlags(DEFAULT_FLAGS),
  subscription: defaultSubscription(),
  lastIntakeBurstAt: 0,
  hasSeenOnboarding: false,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  unitPreferences: DEFAULT_UNIT_PREFERENCES,
  profileIdentity: DEFAULT_PROFILE_IDENTITY,
};

// Exported SOLELY for the dev/demo-only Screen Gallery
// (`demo/AForceScreenGallery.tsx`, __DEV__/EXPO_PUBLIC_DEMO_MODE gated, never
// reachable or evaluated in a production build). It shadows this exact context
// with a fixture `AppContextValue` around one screen subtree — `useAppStore()`
// reads THIS instance, so no separate context can substitute, and injecting
// via `AppProvider`/`SliceProvider` can't feed `useAppStore()`.
//   WHY the export (not a provider wrap): the alternatives are worse — adding
//   an override prop to `AppProvider` puts a dev branch in the live provider's
//   runtime path; a demo-side `createContext()` is a different instance.
//   NON-BREAKING: additive visibility only; every existing call site is
//   unchanged and `AppProvider` still owns the one live instance app-wide.
//   NO RUNTIME BEHAVIOR CHANGE: `export` is compile-time only — the context
//   value, provider, and reducer are byte-identical at runtime.
export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Voice Coach toggle (T3) — defaults ON; mirrored to AsyncStorage +
  // the textToSpeech playback flag so non-React consumers see the same
  // value. Hydrated from storage on first effect.
  const [voiceCoachEnabled, setVoiceCoachEnabledState] = React.useState<boolean>(true);
  // AForce Coach picker (Profile). Defaults to Coach Rock — the device
  // synthesizer fallback is no longer user-selectable; it only kicks
  // in silently when the network drops mid-stream. The stored value is
  // a stable coach id ('rock' | 'bb' | 'surge' | 'sage'); the catalog
  // resolves it to the right ElevenLabs voiceId at playback time.
  const [selectedVoiceId, setSelectedVoiceIdState] = React.useState<string | null>(DEFAULT_VOICE_ID);
  // AForce Command Voice Engine — intensity + scope (defaults match
  // the spec: standard tone, all categories audible). Hydrated from
  // AsyncStorage on first effect; persisted on every setter call.
  const [voiceIntensity, setVoiceIntensityState] = React.useState<VoiceIntensity>('standard');
  const [voiceScope, setVoiceScopeState] = React.useState<VoiceScope>('all');
  // RC-1 Wave-2B (state-matrix audit, item 2a) — first-paint hydration
  // signal. `initialState` above is a LOCAL, synchronous guess (mock data run
  // through the scoring engine once, before any network round-trip) so a
  // screen can render on the very first frame; it is not yet the live server
  // state. `isHydrated` flips true once the mount-time `/v1/home` fetch below
  // (the "Periodic /state refresh" effect's first pass) has settled — success
  // OR failure, since either way we've made our one real attempt and should
  // stop presenting the local guess as if it were still loading. Screens that
  // want to skeleton the arc/command/tiles instead of flashing default/mock
  // values read this (see `HomeScreenV2`). Never reset back to false —
  // monotonic for the lifetime of the provider.
  const [isHydrated, setIsHydrated] = React.useState<boolean>(false);
  // Investor Demo overlay — purely transient UI flag. Never persisted
  // (every demo run starts fresh) and never reads/writes engine state.
  const [isInvestorDemoActive, setInvestorDemoActiveState] = React.useState<boolean>(false);
  const setInvestorDemoActive = useCallback((next: boolean) => {
    setInvestorDemoActiveState(next);
  }, []);
  // Latest intensity + scope mirrored into refs so the auto-speak +
  // completion side-effects can read the current preference without
  // taking them as deps (they would otherwise re-run on every toggle
  // and re-trigger the same line).
  const voiceIntensityRef = useRef(voiceIntensity);
  const voiceScopeRef = useRef(voiceScope);
  const voiceCoachEnabledRef = useRef(voiceCoachEnabled);
  useEffect(() => { voiceIntensityRef.current = voiceIntensity; }, [voiceIntensity]);
  useEffect(() => { voiceScopeRef.current = voiceScope; }, [voiceScope]);
  useEffect(() => { voiceCoachEnabledRef.current = voiceCoachEnabled; }, [voiceCoachEnabled]);
  // Elite Voice Coach (flag-gated, delivery-only): coach id + master switch,
  // mirrored into refs so the completion-reward speak reads the live values.
  const selectedVoiceIdRef = useRef(selectedVoiceId);
  const eliteVoiceCoachRef = useRef(state.featureFlags.elite_voice_coach_enabled);
  useEffect(() => { selectedVoiceIdRef.current = selectedVoiceId; }, [selectedVoiceId]);
  useEffect(() => { eliteVoiceCoachRef.current = state.featureFlags.elite_voice_coach_enabled; }, [state.featureFlags.elite_voice_coach_enabled]);

  // Wire the AForce Command Voice Engine bus to the real TTS speaker
  // exactly once on mount. The bus defaults to a silent noop so it can
  // be unit-tested in Node without dragging in expo-audio / expo-speech.
  useEffect(() => {
    setBusSpeakerImpl((text, opts) => ttsSpeak(text, opts ?? {}));
    return () => setBusSpeakerImpl(null);
  }, []);

  // Live countdown timer (drives recheck). INTENTIONALLY NOT AppState-gated
  // (RC-1 W3P1 fix-forward, PR #544 code review — blocker 2, reversing the
  // gating this timer originally shipped with). WHY: the reducer's
  // `TICK_TIMER` case (`appStoreReducer.ts`) is a pure "decrement
  // `timerSeconds` by 1 per dispatch" accumulator — it has no clock, no
  // deadline timestamp, nothing that lets it infer how much real time
  // passed while paused. AppState-gating this (as originally shipped)
  // meant backgrounding froze the countdown outright: a user who
  // backgrounds for 2 minutes returns to find the recheck timer exactly
  // where they left it, and `pendingConfirmation` then fires up to that
  // same 2 minutes late — a trust-surface regression, since this timer is
  // what confirms the user is still following the current command. Worse,
  // `AppState` also reports `'inactive'` (Control Center, permission
  // dialogs, the app switcher) — which the gating hook treats identically
  // to backgrounded — so even brief, common interruptions paused the
  // countdown, not just true backgrounding.
  //
  // The 30s `/state` poll and 15min weather refresh below stay
  // AppState-gated: both are idempotent network wakes (a poll/fetch you
  // skipped while backgrounded is simply stale, not silently WRONG), and
  // resume-fire-on-foreground is the right semantics for them. This timer
  // is different in kind, not degree — it accumulates rather than reads.
  //
  // Making the tick safely gate-able would require reworking it to track a
  // deadline timestamp (`Date.now() + N`) and derive the displayed seconds
  // from elapsed wall-clock time on every dispatch/resume, instead of
  // blindly decrementing by 1 — a real semantic change to the reducer's
  // contract, not a wiring change. That is future work; until it lands,
  // this stays a plain, always-on interval — its pre-PR-#544 behavior.
  // Regression coverage: `store/__tests__/appStoreTimerGating.test.ts`.
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK_TIMER' }), 1000);
    return () => clearInterval(id);
  }, []);

  // Ref-backed latest snapshot of the full UserState. Long-lived
  // intervals (30s poll, 15min weather) close over `state.userState` at
  // mount time and would otherwise pass STALE state to the merge layer
  // — including dropping client-only fields like `biometrics` /
  // `appleHealth` that landed AFTER the effect last ran. Reading
  // `userStateRef.current` inside the interval callbacks makes every
  // tick use the freshest state without re-creating timers on every
  // change.
  const userStateRef = useRef(state.userState);
  useEffect(() => { userStateRef.current = state.userState; }, [state.userState]);

  // ─── Command Confidence™ — adaptive recheck timing (STEP 2) ────────────
  // Ref-backed context so `adaptEngineOutput` can stay a stable (`[]`) callback
  // while still reading the freshest flag / autopilot state. The adapter is the
  // single seam applied before every timer-resetting dispatch (SET_USER_STATE,
  // CYCLE_SUCCESS, CONFIRM_COMMAND). It is a hard no-op (returns the SAME ref)
  // unless the flag is on, no sweat-autopilot recovery window is active, and the
  // ledger shows a reliably-followed, non-hydration, non-urgent command — in
  // which case it ONLY lengthens `riskTimer.minutes`. Timing only: it never
  // reads/awards/mutates score and never touches the command itself.
  const adaptCtxRef = useRef<{
    flags: typeof state.featureFlags;
    autopilot: typeof state.sweatAutopilot;
    autopilotSetAt: number | null;
  }>({
    flags: state.featureFlags,
    autopilot: state.sweatAutopilot,
    autopilotSetAt: state.sweatAutopilotSetAt ?? null,
  });
  useEffect(() => {
    adaptCtxRef.current = {
      flags: state.featureFlags,
      autopilot: state.sweatAutopilot,
      autopilotSetAt: state.sweatAutopilotSetAt ?? null,
    };
  }, [state.featureFlags, state.sweatAutopilot, state.sweatAutopilotSetAt]);

  const adaptEngineOutput = useCallback((engineOutput: ScoreEngineOutput): ScoreEngineOutput => {
    const { flags, autopilot, autopilotSetAt } = adaptCtxRef.current;
    // Strict flag-off inertness: short-circuit BEFORE touching the ledger or doing
    // any autopilot math, so the production (flag-off) path does literally nothing
    // extra and returns the same ref. (The pure adapter re-checks the flag too.)
    if (!flags?.command_confidence_adaptive_enabled) return engineOutput;
    // Yield entirely while a sweat-autopilot recovery window is still open — its
    // own (safer, shorter) cadence owns the timer during recovery. The window is
    // bounded by `recoveryWindowHours`; the autopilot object itself is not
    // auto-cleared, so a time check (not a null check) is what expires the yield.
    const autopilotActive =
      !!autopilot &&
      autopilotSetAt != null &&
      Date.now() - autopilotSetAt < autopilot.recoveryWindowHours * 3600_000;
    return adaptEngineOutputForRecheck({
      engineOutput,
      flags,
      ledgerEvents: getCommandLedgerState().events,
      now: Date.now(),
      autopilotActive,
    });
  }, []);

  // Race-safe wrapper for every SET_USER_STATE dispatched from a
  // server response.
  //
  // INVARIANT: client-only overlays (`biometrics`, `appleHealth`) are
  // owned exclusively by the device. Service responses NEVER produce
  // overlay data — they only echo whatever the request sent. Therefore
  // at dispatch time we always replace the payload's overlays with the
  // LATEST client state from `userStateRef.current`, regardless of
  // what the payload carries. This handles every race uniformly:
  //   - payload missing overlays (server-pushed WS update)         → use latest
  //   - payload carrying empty `{}` (request had no providers)     → use latest
  //   - payload carrying stale partial subset (e.g. `{whoop}` while
  //     current is `{whoop, oura}` because user connected oura
  //     mid-flight)                                                 → use latest superset
  //   - payload carrying stale superset (request had `{whoop}` but
  //     user disconnected mid-flight, current is `{}`)              → use empty current
  //
  // Engine output is then recomputed from the merged state so
  // score/command/timer reflect the actual overlays — the service-
  // computed `engineOutput` reflects the request-time snapshot which
  // may have been clobbered by the overlay swap.
  // T0b Offline Intake Outbox — flag mirror, declared here (above its first
  // consumer, the applyServerUserState guard) so the guard, the periodic
  // refresh, and flushOutbox all read one source of truth.
  const offlineOutboxEnabledRef = useRef(state.featureFlags.offline_intake_outbox_enabled);
  useEffect(() => {
    offlineOutboxEnabledRef.current = state.featureFlags.offline_intake_outbox_enabled;
  }, [state.featureFlags.offline_intake_outbox_enabled]);

  const applyServerUserState = useCallback((
    newUserState: UserState,
    _engineOutput: ScoreEngineOutput,
  ) => {
    // Offline Intake Outbox guard: a fresh server snapshot does NOT yet include
    // intakes the user completed offline that are still queued locally. Both the
    // periodic /state refresh AND the WebSocket broadcast flow through this single
    // chokepoint, so replacing reducer state here would drop those completed-but-
    // unsynced intakes. While the flag is ON and the queue is non-empty we hold
    // the optimistic state; flushOutbox reconciles to authoritative server truth
    // the moment the queue fully drains (pendingCount → 0). Byte-identical when
    // the flag is OFF (queue always empty) or the queue is already empty.
    if (offlineOutboxEnabledRef.current && selectPendingCount(getIntakeOutboxState()) > 0) {
      return;
    }
    const latest = userStateRef.current;
    const merged: UserState = {
      ...newUserState,
      // biometrics is NOT overridden here anymore: the SET_USER_STATE reducer
      // reconciles it freshest-wins so server-fetched provider snapshots (WHOOP)
      // land while on-device/demo ones are preserved. appleHealth stays a pure
      // on-device overlay.
      appleHealth: latest.appleHealth,
    };
    dispatch({
      type: 'SET_USER_STATE',
      payload: { newUserState: merged, engineOutput: adaptEngineOutput(_initialOnly(merged)) },
    });
  }, [adaptEngineOutput]);

  // ─── T0b: Offline Intake Outbox — flush / replay ───────────────────────
  // Drains the durable outbox when connectivity returns. Each queued intake is
  // replayed with its frozen `clientEventId`, so the server applies it exactly
  // once (duplicate replays are no-ops; stale events become historical logs).
  // Replay NEVER dispatches CYCLE_SUCCESS — the optimistic dispatch already
  // recorded the history/analytics/voice at log time, so there is no double
  // fire. We reconcile reducer state to authoritative server truth ONLY once the
  // queue is fully drained; while any item is still unsynced we keep the
  // optimistic state so a pending intake is never dropped (nor double-applied,
  // since `applyServerUserState` REPLACES rather than increments).
  // RC-1 W3P2 carried follow-up (#547 code review — should-fix c): the
  // single-flight guard used to be a plain `useRef` here — correct only as
  // long as `AppProvider` stays this outbox's one call site. That guarantee
  // now lives in `services/intakeOutbox.ts`'s `runExclusiveFlush` (a
  // module-level in-flight promise), so re-entrancy is safe regardless of
  // how many callers or `AppProvider` instances exist.
  const flushOutbox = useCallback(async () => {
    if (!offlineOutboxEnabledRef.current) return; // flag OFF → fully inert
    await runExclusiveFlush(async () => {
      await hydrateIntakeOutbox();
      const due = selectDueIntakes(getIntakeOutboxState(), Date.now());
      if (due.length === 0) return;
      for (const item of due) {
        const cid = item.prepared.clientEventId;
        await markIntakeSyncing(cid);
        try {
          await replayPreparedIntake(item.prepared);
          await markIntakeSynced(cid);
        } catch (err) {
          await markIntakeFailed(cid);
          // Still offline — stop hammering the rest; the next trigger retries
          // the remaining due items (respecting their backoff schedule).
          if (isOfflineError(err)) break;
        }
      }
      await pruneSyncedIntakes();
      // Reconcile only when nothing is left unsynced; otherwise the optimistic
      // reducer state (which still includes pending intakes) stays in place.
      if (selectPendingCount(getIntakeOutboxState()) === 0) {
        try {
          const { engineOutput, userState } = await fetchHome(userStateRef.current);
          applyServerUserState(userState, engineOutput);
        } catch {
          // offline again — keep last known state; the next trigger reconciles.
        }
      }
    });
  }, [applyServerUserState]);
  const flushOutboxRef = useRef(flushOutbox);
  useEffect(() => { flushOutboxRef.current = flushOutbox; }, [flushOutbox]);

  // Periodic /state refresh — keeps the engine output current (decay
  // ticks, weather staleness, etc.) and rehydrates from server in case
  // a WS push was missed.
  //
  // Ref-backed "still mounted" guard — was a `cancelled` local inside the
  // single effect that used to own both the mount-time call AND the
  // interval; hoisted to a ref (RC-1 W3P1) so the same post-unmount guard
  // still applies now that the recurring cadence is owned by the
  // AppState-gated interval below (a separate effect).
  const stateRefreshMountedRef = useRef(true);
  useEffect(() => {
    stateRefreshMountedRef.current = true;
    return () => { stateRefreshMountedRef.current = false; };
  }, []);

  const refreshState = useCallback(async () => {
    const current = userStateRef.current;
    try {
      const { engineOutput, userState } = await fetchHome(current);
      if (!stateRefreshMountedRef.current) return;
      // If server returned a newer state (e.g. from another device or
      // a fresh weather lookup), adopt it; otherwise just refresh the
      // engine. We compare a few fields rather than deep-equal to keep
      // this cheap.
      const drift =
        userState.weatherFetchedAt !== current.weatherFetchedAt ||
        userState.unitsConsumedToday !== current.unitsConsumedToday ||
        userState.urineSignal !== current.urineSignal ||
        // Pick up a language change persisted from another device when
        // the WS push was missed — without this, the Profile picker on
        // device A would never reach device B until a stronger drift
        // (intake / weather refresh) triggered the swap.
        userState.language !== current.language;
      if (drift) {
        applyServerUserState(userState, engineOutput);
      } else {
        dispatch({ type: 'REFRESH_ENGINE', payload: { engineOutput } });
      }
    } catch {
      // swallow — UI keeps last known engineOutput
    } finally {
      // RC-1 W3P2 carried follow-up (#547 code review — should-fix 5a): this
      // flush call used to live at the end of the `try`, after a successful
      // `fetchHome` — so a foreground return that hit a network failure (or
      // returned via the mounted-guard above) silently skipped draining any
      // intakes queued while offline. Moved to `finally` so every
      // foreground-return / 30s tick attempts the flush exactly once,
      // regardless of whether this refresh itself succeeded — restoring the
      // original unconditional-on-foreground parity. `flushOutbox` stays a
      // safe no-op when the flag is off or the queue is empty, and its own
      // in-flight guard (plus `intakeOutbox.ts`'s own module-level guard, see
      // that file) prevents overlap with a concurrent call.
      // RC-1 W3 r2 hardening (#551 nit 4): gated on the mounted ref — this
      // `finally` can still run after unmount (an in-flight `fetchHome`
      // resolving late), and there's no reason to keep draining the outbox
      // via a component instance that's no longer mounted.
      if (stateRefreshMountedRef.current) void flushOutboxRef.current();
      // First pass (success or failure) ends the pre-hydration window.
      // Cheap to call again on every 30s tick — React bails out a
      // no-op `setState(true)` once already true (Object.is same-value).
      if (stateRefreshMountedRef.current) setIsHydrated(true);
    }
  }, [applyServerUserState]);

  useEffect(() => {
    refreshState();
    // Mount-once immediate call; the recurring 30s cadence is owned by the
    // AppState-gated interval below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AppState-gated (RC-1 W3P1): zero polls while backgrounded; fires once
  // immediately on foreground return (so a returning user isn't stuck on
  // state that's up to as-stale-as-the-background-duration), then resumes
  // the normal 30s cadence. This is ALSO the app's sole foreground-return
  // outbox-flush trigger — see `refreshState`'s `flushOutboxRef.current()`
  // call above and the fix-forward note below.
  useAppStateGatedInterval(() => { void refreshState(); }, 30 * 1000);

  // RC-1 fix-forward (PR #544 code review — should-fix 4): a SECOND,
  // standalone `AppState` 'active' listener used to live here and ALSO call
  // `flushOutboxRef.current()` — meaning every foreground-return fired the
  // outbox flush twice from two independent listeners on the same event.
  // `flushOutbox` (above) does have an in-flight guard (`flushInFlightRef`),
  // but `services/intakeOutbox.ts` itself has no flush-level dedupe of its
  // own (its per-item mutators like `markIntakeSynced` are idempotent, but
  // nothing there prevented a second full flush pass from starting) — so the
  // in-flight guard was ONLY catching the double-fire when the two calls
  // happened to overlap in time, not by construction. Removed this second
  // listener entirely rather than rely on that timing: `refreshState`'s own
  // flush call (fired via the gated interval's resume-fire immediately on
  // foreground return, same as this listener was, plus every 30s while
  // foregrounded) is now the ONE flush path. Guard gap noted for a
  // follow-up: `intakeOutbox.ts` could grow its own module-level in-flight
  // flush guard so correctness doesn't depend on `useAppStore.tsx` staying
  // single-call-site.

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
  const overlayRef = useRef<{ appleHealth?: AppleHealthInputs; biometrics?: ProviderBiometrics }>({});
  useEffect(() => {
    overlayRef.current = {
      appleHealth: state.userState.appleHealth,
      biometrics: state.userState.biometrics,
    };
  }, [state.userState.appleHealth, state.userState.biometrics]);

  // Live state pushes from the api-server. The server broadcasts after
  // every mutation, so this catches changes from other clients (or
  // server-initiated updates like the weather refresh) without waiting
  // for the 30s poll. Subscribe once per mount; the overlay getter
  // pulls from `overlayRef` so updates to appleHealth + biometrics
  // (both client-only) never get clobbered by a server push.
  useEffect(() => {
    const unsubscribe = subscribeToStateUpdates(
      (next) => applyServerUserState(next, _initialOnly(next)),
      () => ({
        appleHealth: overlayRef.current.appleHealth,
        biometrics: overlayRef.current.biometrics,
      }),
    );
    return unsubscribe;
  }, []);

  // Weather: fetch on mount, then every 15 min — but ONLY once we actually
  // know where the member is.
  //
  // This provider wraps the entire route tree, so anything it asks for is
  // asked at launch, before a single line of AForce copy has explained
  // itself. The founder rule is absolute: never request a permission before
  // the member understands why we want it. The ask therefore lives in
  // onboarding, on the same row as the sentence that justifies it
  // (`components/onboarding/OnboardingScreenV2.tsx`, LIFESTYLE step). What
  // happens here is a READ of an answer already given —
  // `getForegroundPermissionsAsync` queries the current grant and never
  // presents a dialog; `requestForegroundPermissionsAsync` must not appear
  // anywhere in this provider's reachable graph
  // (`store/__tests__/noPermissionRequestOnProviderMount.test.ts` pins it).
  //
  // With no grant we fetch nothing at all. The previous Denver fallback fed
  // another city's air into the engine as if it were the member's, with
  // nothing in the UI able to tell the two apart — visual certainty ahead of
  // evidence. Leaving `weatherTempC`/`weatherHumidity` unset is the state
  // the engine is already documented to expect (see `types/index.ts`: never
  // substituted with placeholder numbers when missing), and the climate
  // surfaces keep their own `est.` labelling for the estimated reading.
  //
  // Coordinates resolve lazily rather than once-at-mount, because onboarding
  // may grant AFTER this effect has run. The permission dialog's own
  // inactive → active transition resume-fires the AppState-gated interval
  // below, so the first post-grant reading lands right away rather than up
  // to 15 min later. Once resolved the coordinates are reused forever, same
  // as before — a granted install re-resolves nothing.
  const weatherCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const weatherMountedRef = useRef(true);
  useEffect(() => {
    weatherMountedRef.current = true;
    return () => { weatherMountedRef.current = false; };
  }, []);

  const resolveWeatherCoords = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    if (weatherCoordsRef.current) return weatherCoordsRef.current;
    try {
      const Location = await import('expo-location');
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({});
      weatherCoordsRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      return weatherCoordsRef.current;
    } catch {
      // expo-location unavailable (web / test runtime) or the lookup failed
      // — indistinguishable from "no location", and treated the same.
      return null;
    }
  }, []);

  const weatherTick = useCallback(async () => {
    const coords = await resolveWeatherCoords();
    if (!coords || !weatherMountedRef.current) return;
    try {
      // Read latest userState via ref so a tick that fires AFTER a
      // provider connect / Apple-Health snapshot lands carries those
      // overlays into the merge, instead of the mount-time closure
      // that lacked them.
      const { newUserState, engineOutput } = await refreshWeather(userStateRef.current, coords.lat, coords.lon);
      if (!weatherMountedRef.current) return;
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] weather refresh failed', err);
    }
  }, [applyServerUserState, resolveWeatherCoords]);

  useEffect(() => {
    void weatherTick();
    // Mount-once first attempt; the recurring 15min cadence — and the retry
    // that picks up a grant made after mount — is owned by the AppState-gated
    // interval below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AppState-gated (RC-1 W3P1): zero weather fetches while backgrounded;
  // fires once immediately on foreground return, then resumes the normal
  // 15min cadence.
  useAppStateGatedInterval(() => {
    void weatherTick();
  }, 15 * 60 * 1000);

  // Action handlers — extracted into a factory hook so the bodies live
  // outside this (very large) provider. The factory receives dispatch /
  // the merge helper / refs the provider owns and returns the same
  // callbacks (bodies byte-identical to before).
  const {
    logIntake,
    completeCycle,
    snooze,
    dismissSuccess,
    updateSymptoms,
    updateUrineSignal,
    updateEnergyState,
    confirmStatus,
    setFeatureFlags,
    confirmCommand,
    setLanguage,
    activateSocialMode,
    logSocialDrink,
    confirmSocialHydration,
    deactivateSocialMode,
    activateCruiseMode,
    activateVoyageShield,
    setSocialContext,
    setSubscription,
    setSweatAutopilot,
    completeOnboarding,
    setAppleHealthSnapshot,
    setProviderBiometrics,
  } = useStoreActions({
    state,
    dispatch,
    applyServerUserState,
    adaptEngineOutput,
    userStateRef,
    voiceCoachEnabledRef,
    voiceScopeRef,
    voiceIntensityRef,
    selectedVoiceIdRef,
    eliteVoiceCoachRef,
  });

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
    // Recovery Layer — only attached when `spec_recovery` is on, so
    // production snapshots are byte-identical to before the layer landed.
    const recoveryFields = state.featureFlags.spec_recovery
      ? (() => {
          const snap = deriveRecoverySnapshot(
            recoveryInputsFromState(state.userState, state.engineOutput),
          );
          return {
            recoveryScore: snap.recovery,
            pressureScore: snap.pressure,
            recoveryTrend: snap.trend,
            recoveryFingerprint: snap.fingerprint,
            recoveryStory: snap.story.slice(0, 280),
          };
        })()
      : {};
    postJournalSnapshot({
      score: state.engineOutput.score,
      level,
      // Instrumentation vector (founder-approved): the per-factor deltas for
      // the state being snapshotted, computed at WRITE time. Deliberately not
      // derived from engineOutput — recomputing here means the vector always
      // sums to its own `raw`, and any divergence between `raw` and the
      // engine's `score` field becomes visible data (that divergence is
      // exactly the optimistic-vs-authoritative question). Same debounce, same
      // request — zero additional writes.
      factorDeltas: buildBreakdown(state.userState, now).factorDeltas,
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
      ...recoveryFields,
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
  // Wave-1 P0 hardening: the sip listener is registered ONLY while the
  // Phantom flag is on. Score Protection defense-in-depth — with the
  // listener unregistered, no BLE event or simulated sip can write intake
  // in a build where Phantom is not enabled (ordinary production).
  const phantomOn = state.featureFlags.phantom_wearable_enabled;
  useEffect(() => {
    if (!phantomOn) return;
    return phantomBandService.on('sip', (event) => {
      void logIntakeRef.current(event.fluidType, { silent: true, ozOverride: event.oz });
    });
  }, [phantomOn]);

  // ─── AForce Command Voice Engine — system command voice ────────────────
  // Routes through commandSpeak() so the bus records every utterance for
  // the Voice Status module + replay. Pressure Mode kicks in when the
  // user picks 'pressure' intensity OR when intensity is 'standard' AND
  // the user is currently DEPLETED (the engine self-sharpens when risk
  // is real). Scope is honored — 'risk' and 'muted' suppress system
  // commands. textToSpeech.speak (called inside the bus) is debounced
  // by 500ms on identical text so re-renders never double-trigger.
  const lastSpokenCommandIdRef = useRef<string | null>(null);
  // Startup suppression: don't greet the user with a command voiceover
  // the moment the app comes on. The first system command seen after
  // mount (including any that lands while persisted state hydrates) is
  // captured silently; only a genuine command change afterwards speaks.
  const systemVoiceMountedAtRef = useRef(Date.now());
  const SYSTEM_VOICE_STARTUP_GRACE_MS = 3000;
  useEffect(() => {
    if (!voiceCoachEnabled) return;
    if (!categoryAllowedForScope('system_command', voiceScopeRef.current)) return;
    const cmd = state.engineOutput.command;
    if (!cmd?.action) return;
    if (lastSpokenCommandIdRef.current === cmd.id) return;
    lastSpokenCommandIdRef.current = cmd.id;
    // Within the startup grace window we capture the command id above
    // but stay silent, so opening the app never triggers a voiceover.
    if (Date.now() - systemVoiceMountedAtRef.current < SYSTEM_VOICE_STARTUP_GRACE_MS) return;
    const intensity = voiceIntensityRef.current;
    const level = state.engineOutput.performanceState.level;
    const line = effectiveCommandLine(cmd.action, intensity, level);
    commandSpeak(line, { level, intensity, category: 'system_command' });
  }, [
    voiceCoachEnabled,
    state.engineOutput.command?.id,
    state.engineOutput.command?.action,
    state.engineOutput.performanceState.level,
    state.userState.language,
  ]);

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
        // Picker no longer offers a "device default" row, so an
        // empty/missing key falls through to Coach Rock rather than
        // null. Legacy ElevenLabs ids still resolve via the catalog's
        // dual-lookup so existing installs keep their voice.
        const next = raw && raw.length > 0 ? raw : DEFAULT_VOICE_ID;
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

  // Hydrate persisted Command Voice Engine intensity + scope on mount.
  // Both fields tolerate unknown / corrupt values by falling back to
  // their spec defaults so a forward-incompat change can never brick
  // the engine.
  useEffect(() => {
    AsyncStorage.getItem(VOICE_INTENSITY_KEY)
      .then((raw) => {
        if (raw && VOICE_INTENSITIES.has(raw as VoiceIntensity)) {
          setVoiceIntensityState(raw as VoiceIntensity);
        }
      })
      .catch(() => {});
    AsyncStorage.getItem(VOICE_SCOPE_KEY)
      .then((raw) => {
        if (raw && VOICE_SCOPES.has(raw as VoiceScope)) {
          setVoiceScopeState(raw as VoiceScope);
        }
      })
      .catch(() => {});
  }, []);

  const setVoiceIntensity = useCallback((next: VoiceIntensity) => {
    if (!VOICE_INTENSITIES.has(next)) return;
    setVoiceIntensityState(next);
    AsyncStorage.setItem(VOICE_INTENSITY_KEY, next).catch(() => {});
  }, []);

  const setVoiceScope = useCallback((next: VoiceScope) => {
    if (!VOICE_SCOPES.has(next)) return;
    setVoiceScopeState(next);
    AsyncStorage.setItem(VOICE_SCOPE_KEY, next).catch(() => {});
  }, []);

  // Hydrate persisted notification settings on mount; ignore corrupt
  // payloads so a forward-incompat key change can't brick the toggles.
  useEffect(() => {
    scopedStorage.getItem(NOTIFICATION_SETTINGS_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
          if (parsed && typeof parsed === 'object') {
            dispatch({
              type: 'SET_NOTIFICATION_SETTINGS',
              payload: { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed },
            });
          }
        } catch {
          // ignore malformed payload
        }
      })
      .catch(() => {});
  }, []);

  const setNotificationSetting = useCallback((key: NotificationSettingKey, value: boolean) => {
    dispatch({ type: 'SET_NOTIFICATION_SETTING', payload: { key, value } });
    // Persist the merged shape so reload always restores every toggle.
    const next = { ...state.notificationSettings, [key]: value };
    scopedStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  }, [state.notificationSettings]);

  // Race-safe persistence for unit preferences. Two refs guard the
  // critical path:
  //   - `unitPrefsHydratedRef` flips true once the AsyncStorage read
  //     resolves (success OR failure). The persist effect below is
  //     gated on this so it can't write the in-memory defaults over
  //     a real value still in flight from storage.
  //   - `unitPrefsDirtyRef` flips true the moment the user toggles
  //     a preference. The hydration handler honours this so a slow
  //     AsyncStorage read can't clobber a fast user edit.
  // Together they make both directions race-safe without coupling the
  // setter to a stale closure snapshot of `state.unitPreferences`.
  const unitPrefsHydratedRef = useRef(false);
  const unitPrefsDirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(UNIT_PREFERENCES_KEY)
      .then((raw) => {
        if (cancelled) return;
        // If the user has already toggled a preference while the read
        // was in flight, skip the apply — their choice wins over the
        // stale stored value (the persist effect will save it for next
        // launch). Still flag hydration complete so persistence can run.
        if (unitPrefsDirtyRef.current) return;
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          dispatch({
            type: 'SET_UNIT_PREFERENCES',
            payload: sanitizeUnitPreferences(parsed),
          });
        } catch {
          // ignore malformed payload — defaults remain in effect
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) unitPrefsHydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change to the authoritative state, but only after
  // hydration has completed. Reading from `state.unitPreferences`
  // (not a closure capture) guarantees we always save the fully
  // merged record, even under rapid back-to-back toggles.
  useEffect(() => {
    if (!unitPrefsHydratedRef.current) return;
    AsyncStorage.setItem(
      UNIT_PREFERENCES_KEY,
      JSON.stringify(state.unitPreferences),
    ).catch(() => {});
  }, [state.unitPreferences]);

  const setUnitPreference = useCallback(
    <K extends keyof UnitPreferences>(key: K, value: UnitPreferences[K]) => {
      // Mark dirty *before* dispatching so a hydration handler that
      // resolves between this line and the next reducer commit still
      // sees the dirty flag and yields to the user's choice.
      unitPrefsDirtyRef.current = true;
      dispatch({
        // The discriminated SET_UNIT_PREFERENCE payload keeps key/value
        // bound together at the type level — we re-narrow via the
        // generic K to satisfy the discriminator.
        type: 'SET_UNIT_PREFERENCE',
        payload: { key, value } as Extract<
          Action,
          { type: 'SET_UNIT_PREFERENCE' }
        >['payload'],
      });
    },
    [],
  );

  // ── Profile identity hydration / persistence (mirrors unit prefs) ──
  // Same two-ref race-safe pattern: hydratedRef gates the persist
  // effect so in-memory defaults can't overwrite a slow read; dirtyRef
  // makes a fast user edit win over a stale stored value.
  const profileIdentityHydratedRef = useRef(false);
  const profileIdentityDirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // K-1 (RC-L11): identity lives in the encrypted store; the read
    // transparently migrates any legacy plain-AsyncStorage value.
    scopedSecureKV.getItem(PROFILE_IDENTITY_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (profileIdentityDirtyRef.current) return;
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          dispatch({
            type: 'SET_PROFILE_IDENTITY',
            payload: sanitizeProfileIdentity(parsed),
          });
        } catch {
          // ignore malformed payload — defaults remain in effect
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) profileIdentityHydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profileIdentityHydratedRef.current) return;
    scopedSecureKV.setItem(
      PROFILE_IDENTITY_KEY,
      JSON.stringify(state.profileIdentity),
    ).catch(() => {});
  }, [state.profileIdentity]);

  // ─── Lock §7 / RC-L11 — server rehydration + reconnect flush ────────────
  // After a reinstall / device replacement the server holds the profile but
  // the local store is empty. Flag-gated; deterministic (never overwrites a
  // calibrated local profile or a pending unsynced change).
  const profileServerHydrationRanRef = useRef(false);
  const profileIdentityRef = useRef(state.profileIdentity);
  profileIdentityRef.current = state.profileIdentity;

  useEffect(() => {
    if (!state.featureFlags.profile_server_hydration_enabled) return;
    if (profileServerHydrationRanRef.current) return;
    profileServerHydrationRanRef.current = true;
    // Wait one tick so the local secure-store hydrate (above) lands first.
    const timer = setTimeout(() => {
      void hydrateProfileFromServer(profileIdentityRef.current)
        .then((result) => {
          if (result.decision === 'hydrate' && result.patch && !profileIdentityDirtyRef.current) {
            dispatch({
              type: 'SET_PROFILE_IDENTITY',
              payload: sanitizeProfileIdentity({
                ...profileIdentityRef.current,
                ...result.patch,
              }),
            });
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [state.featureFlags.profile_server_hydration_enabled]);

  // Reconnect flush (§7): retry a pending profile sync when the app
  // foregrounds (previously it retried only on the next manual save).
  useEffect(() => {
    if (!state.featureFlags.profile_server_hydration_enabled) return;
    const sub = RNAppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') {
        void flushPendingProfileSync(profileIdentityRef.current).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [state.featureFlags.profile_server_hydration_enabled]);

  const setProfileIdentity = useCallback((patch: Partial<ProfileIdentity>) => {
    // Mark dirty before dispatch (same race-safe ordering as the unit
    // prefs setter) so a hydration callback racing this edit will
    // yield to the user's input.
    profileIdentityDirtyRef.current = true;
    dispatch({ type: 'UPDATE_PROFILE_IDENTITY', payload: patch });
  }, []);

  // Seed a synthetic baseline history entry on first mount so the
  // Hydration Journal day card shows a populated yesterday row instead
  // of stark emptiness for brand-new users. The entry is marked
  // `isSynthetic` so downstream consumers (Insights, Streak Math) can
  // opt out. Real cycles always replace it via ADD_HISTORY_ENTRY id de-dupe.
  const baselineSeededRef = useRef(false);
  useEffect(() => {
    if (baselineSeededRef.current) return;
    if (state.history.some((h) => !h.isSynthetic)) {
      baselineSeededRef.current = true;
      return;
    }
    if (state.history.some((h) => h.id === 'synthetic-baseline')) {
      baselineSeededRef.current = true;
      return;
    }
    baselineSeededRef.current = true;
    const level = state.engineOutput.performanceState.level;
    const score = state.engineOutput.score;
    dispatch({
      type: 'ADD_HISTORY_ENTRY',
      payload: buildSyntheticBaselineEntry(level, score),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate persisted subscription on mount.
  useEffect(() => {
    scopedStorage.getItem('aforce.subscription')
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

  // Sync i18n with the language returned by the server on every userState
  // change. This lets a fresh app boot land on the user's saved language
  // without the picker having to be opened.
  useEffect(() => {
    const lang = state.userState.language;
    if (lang) {
      setI18nLanguage(lang).catch(() => { /* i18n init failure is non-fatal */ });
    }
  }, [state.userState.language]);

  // Wave-4 Part 6: the facade's `state` excludes `timerSeconds`, so a
  // `TICK_TIMER` no longer changes `value`'s identity and the ~90
  // `useAppStore()` consumers (including every tab-route wrapper, whose
  // children are not memoized) stop re-rendering once per second. The
  // dependency array lists each forwarded field individually — depending
  // on `state` itself would reintroduce the per-second churn this fix
  // removes. Countdown readers use `useTimerSlice()`.
  const facadeState = useMemo<FacadeState>(() => pickFacadeState(state), [
    state.userState, state.engineOutput, state.history, state.lastCycleResult,
    state.isCompletingCycle, state.showCycleSuccess, state.pendingConfirmation,
    state.featureFlags, state.subscription, state.lastIntakeBurstAt,
    state.hasSeenOnboarding, state.sweatAutopilot, state.sweatAutopilotSetAt,
    state.notificationSettings, state.unitPreferences, state.profileIdentity,
  ]);

  const value = useMemo<AppContextValue>(() => ({
    state: facadeState, isHydrated, logIntake, completeCycle, snooze, dismissSuccess,
    updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags,
    setSubscription, completeOnboarding, setAppleHealthSnapshot, setProviderBiometrics, confirmCommand, setLanguage,
    activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext,
    activateCruiseMode, activateVoyageShield,
    setSweatAutopilot,
    voiceCoachEnabled, setVoiceCoachEnabled,
    isInvestorDemoActive, setInvestorDemoActive,
    selectedVoiceId, setSelectedVoiceId,
    voiceIntensity, setVoiceIntensity,
    voiceScope, setVoiceScope,
    notificationSettings: state.notificationSettings, setNotificationSetting,
    unitPreferences: state.unitPreferences, setUnitPreference,
    profileIdentity: state.profileIdentity, setProfileIdentity,
  }), [facadeState, isHydrated, logIntake, completeCycle, snooze, dismissSuccess, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags, setSubscription, completeOnboarding, setAppleHealthSnapshot, setProviderBiometrics, confirmCommand, setLanguage, activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext, activateCruiseMode, activateVoyageShield, setSweatAutopilot, voiceCoachEnabled, setVoiceCoachEnabled, selectedVoiceId, setSelectedVoiceId, voiceIntensity, setVoiceIntensity, voiceScope, setVoiceScope, isInvestorDemoActive, setInvestorDemoActive, setNotificationSetting, setUnitPreference, setProfileIdentity]);

  // Stable actions value for the sliced ActionsContext — same callbacks
  // as `value` minus `state`, so action consumers don't re-render when
  // unrelated state mutates.
  //
  // RC-1 W3P2: `setVoiceCoachEnabled` / `setSelectedVoiceId` / `setVoiceIntensity`
  // / `setVoiceScope` / `setInvestorDemoActive` are added here so
  // ProfileScreenV2 (their only caller) can reach them via `useActionsSlice`
  // instead of the full `useAppStore()` facade. All five are already
  // `useCallback`-stable with empty/near-empty deps (declared above), so
  // adding them doesn't change how often this memo's identity changes.
  const actions = useMemo<ActionsSlice>(() => ({
    logIntake, completeCycle, snooze, dismissSuccess,
    updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags,
    setSubscription, completeOnboarding, setAppleHealthSnapshot, setProviderBiometrics, confirmCommand, setLanguage,
    activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext,
    activateCruiseMode, activateVoyageShield,
    setSweatAutopilot,
    setNotificationSetting,
    setUnitPreference,
    setProfileIdentity,
    setVoiceCoachEnabled,
    setSelectedVoiceId,
    setVoiceIntensity,
    setVoiceScope,
    setInvestorDemoActive,
  }), [logIntake, completeCycle, snooze, dismissSuccess, updateSymptoms, updateUrineSignal, updateEnergyState, confirmStatus, setFeatureFlags, setSubscription, completeOnboarding, setAppleHealthSnapshot, setProviderBiometrics, confirmCommand, setLanguage, activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode, setSocialContext, activateCruiseMode, activateVoyageShield, setSweatAutopilot, setNotificationSetting, setUnitPreference, setProfileIdentity, setVoiceCoachEnabled, setSelectedVoiceId, setVoiceIntensity, setVoiceScope, setInvestorDemoActive]);

  return (
    <AppContext.Provider value={value}>
      <SliceProvider
        state={state}
        actions={actions}
        isHydrated={isHydrated}
        selectedVoiceId={selectedVoiceId}
        voiceCoachEnabled={voiceCoachEnabled}
        voiceIntensity={voiceIntensity}
        voiceScope={voiceScope}
      >
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
  useTimerSlice,
  useConfirmationSlice,
  useOnboardingSlice,
  useInventorySlice,
  useSweatAutopilotSlice,
  useUnitPreferencesSlice,
  useProfileIdentitySlice,
  useHistorySlice,
  useBootstrapSlice,
  useVoiceSettingsSlice,
  useActionsSlice,
} from './slices';

