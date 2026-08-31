import { useCallback } from 'react';
import { Alert } from 'react-native';
import i18n from '@/services/i18nService';
import { scopedStorage } from '@/services/scopedStorage';
import type { IntakeSource } from '@/services/intakeSource';
import type { Dispatch, MutableRefObject } from 'react';
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
} from '../../types';
import type { UserSubscription } from '../../types/subscription';
import type { SweatAutopilot } from '../../types/sweat';
import type { HealthProviderId } from '../../data/healthProviders';
import type { AppState, Action } from '../appStoreTypes';
import {
  generateCycleIdentityMessage,
  calculateScore as _initialOnly,
} from '../../utils/scoringEngine';
import { inferFlavorFromLabel } from '../../utils/inferFlavorFromLabel';
import { buildAppleHealthProviderSnapshot } from '../../utils/biometricsAggregator';
import { PRODUCTS } from '../../data/products';
import { isStimulantCategory } from '../../data/drinkCatalog';
import { recordCaffeineSignal } from '../../services/performanceMemoryCapture';
import {
  fetchHome,
  postIntakeLog,
  postIntakeCorrection,
  prepareIntake,
  sendPreparedIntake,
  isOfflineError,
  type IntakeLogResponse,
  postSignalsUpdate,
  postUrineSignalUpdate,
  postEnergyStateUpdate,
  postCheckin,
  postClutchFlag,
  postConfirmCommand,
  postLanguage,
  postSocialActivate,
  postSocialCruise,
  postSocialShield,
  postSocialContext,
  postSocialDrink,
  postSocialHydrate,
  postSocialDeactivate,
} from '../../services/realApi';
import { setLanguage as setI18nLanguage, type SupportedLanguage } from '../../services/i18nService';
import {
  categoryAllowedForScope,
  completionRewardLine,
  type VoiceIntensity,
  type VoiceScope,
} from '../../services/voice/commandVoice';
import { commandSpeak, markCycleExecuted } from '../../services/voice/commandVoiceBus';
import { findVoice } from '../../services/voiceCatalog';
import { formatSpokenLineForCoach } from '../../services/voice/coachPhrasing';
import { emit } from '../../analytics/event_dispatcher';
import { markFirstCommandCompleted } from '../../analytics/activation_anchor';
import { categorizeCommand } from '../../utils/intelligence/commandCategory';
import { confirmationToCommandEvent } from '../../utils/intelligence/commandEventAdapters';
import { appendCommandEvents } from '../../services/commandLedger';
import { enqueueIntake } from '../../services/intakeOutbox';
import { classifyWriteFailure, WRITE_FAILURE_COPY } from './writeFailure';

interface StoreActionsDeps {
  state: AppState;
  dispatch: Dispatch<Action>;
  applyServerUserState: (newUserState: UserState, engineOutput: ScoreEngineOutput) => void;
  /**
   * STEP 2 — Command Confidence™ adaptive recheck timing. Applied to a freshly
   * recomputed engine output before any timer-resetting dispatch. Hard no-op
   * (returns the same ref) unless the flag is on and the ledger earns a stretch;
   * only ever lengthens `riskTimer.minutes`, never score/command.
   */
  adaptEngineOutput: (engineOutput: ScoreEngineOutput) => ScoreEngineOutput;
  userStateRef: MutableRefObject<UserState>;
  voiceCoachEnabledRef: MutableRefObject<boolean>;
  voiceScopeRef: MutableRefObject<VoiceScope>;
  voiceIntensityRef: MutableRefObject<VoiceIntensity>;
  /** Elite Voice Coach (flag-gated, delivery-only) — coach id + master switch. */
  selectedVoiceIdRef: MutableRefObject<string | null>;
  eliteVoiceCoachRef: MutableRefObject<boolean>;
  /**
   * Stale delivery truth (founder Lane A, 2026-08-30). `fetchHome` resolves
   * even when the server was unreachable, so these health-snapshot writes can
   * land a locally recomputed engineOutput exactly like the poll can. Report
   * the delivery so Home can lower its authority honestly.
   */
  markRefreshStale: (stale: boolean) => void;
}

/**
 * Action-handler factory for the AForce app store. Every handler body is
 * preserved byte-for-byte from the original AppProvider; the factory only
 * threads in the dispatch / refs / merge helper the provider owns so the
 * callbacks can live outside the (very large) provider function.
 */
export function useStoreActions({
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
  markRefreshStale,
}: StoreActionsDeps) {
  const logIntake = useCallback(async (
    fluidType: FluidType,
    opts?: {
      silent?: boolean;
      ozOverride?: number;
      flavorLabel?: string;
      displayNameOverride?: string;
      categoryId?: string;
      /**
       * Which surface is logging. Record-only provenance — it never affects
       * scoring, dedupe or persistence. Callers that omit it produce a NULL
       * `entry_source`, which is exactly the un-attributable state that made the
       * Build-65 duplicate impossible to narrow, so every real entry point
       * should pass one.
       */
      source?: IntakeSource;
    },
  ) => {
    if (state.isCompletingCycle) return null;
    dispatch({ type: 'CYCLE_START' });
    if (!opts?.silent) {
      // Internal analytics pipeline (Task #39) — a user-initiated intake
      // begins a hydration ritual. Silent Phantom-Band auto-sips are
      // excluded. Consent-gated + best-effort; never blocks the cycle.
      void emit('ritual_started', { ritualId: fluidType });
    }
    try {
      // Allow callers (e.g. the manual water amount picker) to override
      // the default per-serving oz so the score impact reflects what was
      // actually consumed (e.g. a 24 oz water bottle instead of 12 oz).
      // Map flavorLabel (display string) → ProductFlavor for the
      // hydration scoring engine. Watermelon/Berry/Soursop bonuses
      // depend on this. Fallback to the product's default flavor.
      const flavor = inferFlavorFromLabel(opts?.flavorLabel) ?? PRODUCTS[fluidType].flavor;
      const intakeBody = {
        fluidType,
        ...(opts?.ozOverride != null ? { ozAmount: opts.ozOverride } : {}),
        ...(flavor ? { flavor } : {}),
        ...(opts?.source ? { entrySource: opts.source } : {}),
      };
      // Offline Intake Outbox marker — true only when this intake could not
      // reach the server and was durably queued. Drives the optional pending UI
      // marker; always false on the unchanged online path.
      let offlinePending = false;
      let response: IntakeLogResponse;
      if (state.featureFlags.offline_intake_outbox_enabled) {
        // Flag ON: freeze the payload ONCE so the exact same bytes are either
        // sent now (with the idempotency key) or durably queued for replay if
        // the device is offline — never lost, never double-applied.
        const prepared = prepareIntake(state.userState, intakeBody);
        try {
          response = await sendPreparedIntake(
            prepared,
            {
              ...(state.userState.appleHealth ? { appleHealth: state.userState.appleHealth } : {}),
              ...(state.userState.biometrics ? { biometrics: state.userState.biometrics } : {}),
            },
            { withClientEventId: true },
          );
        } catch (sendErr) {
          // A real server response (4xx/5xx) is NOT offline — surface it as a
          // failure (today's behaviour). Only a transport gap is queue-able.
          if (!isOfflineError(sendErr)) throw sendErr;
          // Durably queue the frozen payload, then proceed optimistically so the
          // completed behaviour shows immediately. Score-Protection: the
          // optimistic state derives from the user's completed action; the queued
          // item carries frozen scores and the server dedupes on replay.
          await enqueueIntake(prepared.outbox);
          response = {
            log: {
              id: prepared.event.id,
              fluidType: prepared.fluidType,
              ozAmount: prepared.ozAmount,
              loggedAt: prepared.event.loggedAt,
              scoreBefore: prepared.scoreBefore,
              scoreAfter: prepared.scoreAfter,
            },
            newUserState: prepared.optimisticUserState,
            engineOutput: _initialOnly(prepared.optimisticUserState),
          };
          offlinePending = true;
        }
      } else {
        // Flag OFF: unchanged online-only path (byte-identical no-op).
        response = await postIntakeLog(state.userState, intakeBody);
      }
      const { log, newUserState, engineOutput } = response;
      const product = PRODUCTS[fluidType];
      const result: CycleResult = {
        id: log.id,
        timestamp: log.loggedAt,
        scoreBefore: log.scoreBefore,
        scoreAfter: log.scoreAfter,
        gainDisplay: `${log.scoreAfter - log.scoreBefore >= 0 ? '+' : ''}${log.scoreAfter - log.scoreBefore}`,
        identityMessage: generateCycleIdentityMessage(engineOutput.performanceState.level),
        nextCheckMinutes: engineOutput.riskTimer.minutes,
        state: engineOutput.performanceState.level,
        // Built from the CONFIRMED log the server returned, so the confirmation
        // can never claim a write that did not land.
        recordedLabel: `${log.ozAmount} oz ${PRODUCTS[fluidType].shortName}`,
      };
      // When a flavor was chosen (e.g. Berry Blast +Dulse), surface it
      // in the history label so users can recall exactly what they drank.
      // displayNameOverride (used by AddDrinkModal for non-AForce drinks)
      // completely replaces the auto-built label so history reads e.g.
      // "Logged Coffee · Starbucks Pike Place (16 ounces)" instead of
      // a misleading "Logged Water — Coffee...".
      const baseName = opts?.displayNameOverride
        ? opts.displayNameOverride
        : opts?.flavorLabel
        ? `${product.shortName} — ${opts.flavorLabel}`
        : product.shortName;
      // Race-safe: merge in latest client-only overlays (provider
      // biometrics + appleHealth) and recompute engineOutput from the
      // merged state so the score/command/timer dispatched here
      // reflects actual overlays — the server-computed `engineOutput`
      // was derived from the request-time snapshot which may have
      // been clobbered by a concurrent connect/disconnect.
      const latest = userStateRef.current;
      // Tag the just-logged intake event with the drink-catalog
      // categoryId (when the caller provided one) so the Acidic Load /
      // Stimulant Load helper can attribute it. The server doesn't
      // persist categoryId yet, so we patch the newest event here —
      // matching by log.id is exact (the server returns the same id it
      // wrote into intakeEvents). Backward-compatible: if no categoryId,
      // the array is left as-is.
      const taggedIntakeEvents = opts?.categoryId && newUserState.intakeEvents
        ? newUserState.intakeEvents.map((ev) =>
            ev.id === log.id ? { ...ev, categoryId: opts.categoryId } : ev,
          )
        : newUserState.intakeEvents;
      const mergedUserState: UserState = {
        ...newUserState,
        ...(taggedIntakeEvents ? { intakeEvents: taggedIntakeEvents } : {}),
        biometrics: latest.biometrics,
        appleHealth: latest.appleHealth,
      };
      const mergedEngine = _initialOnly(mergedUserState);
      // Derive user-visible success state from the merged engine so
      // the success card and history entry stay coherent with the
      // overlay-corrected level (otherwise a mid-flight provider
      // connect could land 'PEAK' state with a server-computed
      // 'BALANCED' level in the success card).
      result.state = mergedEngine.performanceState.level;
      result.identityMessage = generateCycleIdentityMessage(mergedEngine.performanceState.level);
      // ONE CLOCK (ruling R2): the overlay's minutes and the reducer's
      // countdown must be the same number, so both read the SAME adapted
      // engine output — adaptEngineOutput can LENGTHEN riskTimer.minutes, and
      // deriving the overlay from the pre-adapt merge would split the clocks
      // one layer down.
      const adapted = adaptEngineOutput(mergedEngine);
      result.nextCheckMinutes = adapted.riskTimer.minutes;
      const historyEntry: HistoryEntry = {
        id: log.id,
        timestamp: log.loggedAt,
        score: log.scoreAfter,
        state: mergedEngine.performanceState.level,
        // When the caller passes a fully-formed display name (AddDrinkModal
        // for non-AForce drinks), trust it verbatim — appending the engine's
        // effective ounces here would produce nonsense like
        // "Logged Coffee · Pike Place (16 oz) (10.2 ounces)" because
        // ozOverride stores the water-equivalent, not the entered amount.
        action: opts?.displayNameOverride
          ? `Logged ${baseName}`
          : `Logged ${baseName} (${log.ozAmount} ounces)`,
        unitsTaken: 1,
        fluidType,
        ...(offlinePending ? { pending: true } : {}),
      };
      dispatch({ type: 'CYCLE_SUCCESS', payload: { result, newUserState: mergedUserState, engineOutput: adapted, historyEntry, silent: opts?.silent } });
      // Performance Memory capture (OBSERVATIONAL only — never touches score).
      // A caffeinated intake is one of the three behaviour streams Performance
      // Memory needs; record it idempotently by the intake event id.
      if (opts?.categoryId && isStimulantCategory(opts.categoryId)) {
        void recordCaffeineSignal({
          intakeEventId: log.id,
          atMs: log.loggedAt instanceof Date ? log.loggedAt.getTime() : Date.now(),
          categoryId: opts.categoryId,
        });
      }
      // AForce Command Voice Engine — completion reward voice. Fires
      // on user-initiated cycles (silent sips from the Phantom Band
      // get `silent: true` and stay quiet so background auto-logging
      // doesn't keep speaking). Honors the master toggle + scope: a
      // completion is a 'commands' category event (not a 'risk' one),
      // so it stays silent under 'risk' / 'muted' scope.
      if (
        !opts?.silent
        && voiceCoachEnabledRef.current
        && categoryAllowedForScope('completion', voiceScopeRef.current)
      ) {
        // Elite Voice Coach (flag-gated, delivery-only): re-voice the reward in
        // the selected coach's tone. Off → the exact shipped line. Fail-safe to
        // the original on any §64/substance violation (see coachPhrasing).
        const rewardLine = completionRewardLine();
        const spokenReward = eliteVoiceCoachRef.current
          ? formatSpokenLineForCoach(
              rewardLine,
              findVoice(selectedVoiceIdRef.current)?.archetype ?? 'push',
            )
          : rewardLine;
        commandSpeak(spokenReward, {
          level: mergedEngine.performanceState.level,
          intensity: voiceIntensityRef.current,
          category: 'completion',
        });
      }
      // AForce Command Voice Engine — visual "COMMAND EXECUTED" badge.
      // Fires on every user-initiated cycle regardless of voice
      // settings: the badge is the reward, voice is one of several
      // ways to express it. Stays silent for silent-sip events
      // (Phantom Band auto-logging) so background activity doesn't
      // pulse the orb.
      if (!opts?.silent) {
        markCycleExecuted();
        // Internal analytics pipeline (Task #39) — a completed,
        // user-initiated intake is the canonical score-moving behavior
        // (silent Phantom-Band auto-sips are excluded). Consent-gated +
        // best-effort; never blocks the cycle.
        void emit('water_cycle_logged', { fluidType, oz: log.ozAmount });
        void emit('hydration_score_updated', {
          score: log.scoreAfter,
          level: mergedEngine.performanceState.level,
        });
        void emit('ritual_completed', { ritualId: fluidType });
        // Daily hydration goal just reached — emit only on the crossing
        // transition. The server increments unitsConsumedToday by exactly
        // 1 per log, so prev = new − 1; this fires once, on the log that
        // first reaches the target (and again only on a later day's cross).
        if (
          mergedUserState.dailyTarget > 0
          && mergedUserState.unitsConsumedToday - 1 < mergedUserState.dailyTarget
          && mergedUserState.unitsConsumedToday >= mergedUserState.dailyTarget
        ) {
          void emit('water_goal_completed');
        }
        // Auto-dismiss the hero overlay on the same cadence as the
        // executed badge so the two cinematic moments end together.
        setTimeout(() => dispatch({ type: 'DISMISS_SUCCESS' }), 2400);
      }
      // RP-6 (ruling R4): hand the logged cycle id back so the calling
      // surface can offer an UNDO window. Only a LANDED write returns an id —
      // the offline-queued path (flag-gated) resolves optimistically with a
      // client event id the correction endpoint could never reference, so it
      // returns null and no undo is offered until server truth exists.
      return offlinePending ? null : result.id;
    } catch (err) {
      // Fail-safe: clear loading flag so UI never soft-locks.
      // Must dispatch CYCLE_FAILURE (not DISMISS_SUCCESS) — DISMISS_SUCCESS
      // does not reset isCompletingCycle, leaving the home-screen CTAs
      // (STABILIZE SYSTEM / EXECUTE COMMAND / Become AForce / etc.)
      // permanently disabled after any failed intake.
      console.warn('[AForce] logIntake failed', err);
      dispatch({ type: 'CYCLE_FAILURE' });
      // …but clearing the spinner is ALL CYCLE_FAILURE does, so a 401 / 5xx /
      // timeout once looked exactly like success. There is no durable queue
      // behind this catch in production, so the write really is lost. Fail
      // visibly — and name the CAUSE: one sentence for every cause is what
      // made a 401 read as a network problem for three builds (why, and the
      // classes, in ./writeFailure.ts). `confirmCommand` raises the identical
      // pair for the identical cause.
      const failure = classifyWriteFailure(err);
      Alert.alert(
        i18n.t(`common.action_failed_title.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].title,
        }),
        i18n.t(`common.action_failed_body.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].body,
        }),
      );
    }
    return null;
  }, [state.userState, state.isCompletingCycle, state.featureFlags.offline_intake_outbox_enabled]);

  // Generic "complete cycle" — defaults to AForce stick (primary intake)
  const completeCycle = useCallback(async () => {
    await logIntake('aforce_stick');
  }, [logIntake]);

  /**
   * RP-6 (ruling R4) — the UNDO half of the intake lifecycle. First client
   * consumer of the server's append-only POST /intake/correction (§10
   * RC-L12): the original row is never mutated, today's counters reverse
   * floor-0 under a per-user lock, so a double-tapped undo cannot reverse
   * twice. The client does NO reversal arithmetic — server truth returns and
   * the engine recomputes, committed through applyServerUserState, the same
   * allowlisted path every server-state write uses.
   */
  const undoIntake = useCallback(async (
    cycleResultId: string,
    reason: 'mistake' | 'spill' | 'wrong_product' | 'duplicate' = 'mistake',
  ): Promise<boolean> => {
    if (state.isCompletingCycle) return false;
    // Only the canonical `intake-<serverId>` shape is accepted — anything
    // else is refused, never guessed at.
    const m = /^intake-(\d+)$/.exec(cycleResultId);
    if (!m) return false;
    try {
      const { newUserState, engineOutput } = await postIntakeCorrection(
        state.userState,
        Number(m[1]),
        reason,
      );
      // KNOWN flag-gated window (Wave-2 review, recorded): while the
      // offline outbox holds queued intakes, applyServerUserState defers to
      // the pending queue and the corrected snapshot lands at drain-time
      // reconciliation instead — server truth is already corrected; the
      // local view catches up when the outbox flushes.
      applyServerUserState(newUserState, engineOutput);
      return true;
    } catch (err) {
      // Fail VISIBLY, same doctrine as logIntake one function above: a
      // silent undo failure means the member says "I didn't drink that"
      // and the system keeps counting it with no signal to retry.
      console.warn('[AForce] undoIntake failed', err);
      const failure = classifyWriteFailure(err);
      Alert.alert(
        i18n.t(`common.action_failed_title.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].title,
        }),
        i18n.t(`common.action_failed_body.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].body,
        }),
      );
      return false;
    }
  }, [state.isCompletingCycle, state.userState, applyServerUserState]);

  const snooze = useCallback(() => dispatch({ type: 'SNOOZE' }), []);
  const dismissSuccess = useCallback(() => dispatch({ type: 'DISMISS_SUCCESS' }), []);

  const updateSymptoms = useCallback(async (symptoms: string[]) => {
    const { newUserState, engineOutput } = await postSignalsUpdate(state.userState, symptoms);
    applyServerUserState(newUserState, engineOutput);
  }, [state.userState, applyServerUserState]);

  const updateUrineSignal = useCallback(async (signal: number) => {
    const { newUserState, engineOutput } = await postUrineSignalUpdate(state.userState, signal);
    applyServerUserState(newUserState, engineOutput);
  }, [state.userState, applyServerUserState]);

  const updateEnergyState = useCallback(async (energy: UserState['energyState']) => {
    const { newUserState, engineOutput } = await postEnergyStateUpdate(state.userState, energy);
    applyServerUserState(newUserState, engineOutput);
  }, [state.userState, applyServerUserState]);

  const confirmStatus = useCallback(async () => {
    const { newUserState, engineOutput } = await postCheckin(state.userState);
    applyServerUserState(newUserState, engineOutput);
  }, [state.userState, applyServerUserState]);

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
          applyServerUserState(newUserState, engineOutput);
        })
        .catch(() => {});
    }
  }, [state.userState, adaptEngineOutput]);

  const confirmCommand = useCallback(async (followed: boolean) => {
    // STEP 2 — Command Confidence™ adaptive learning. Record the REAL
    // confirmation (followed OR not) into the advisory Command-Event Ledger at
    // the moment of the tap, tagged with the command's category. Advisory only:
    // never dispatches a reducer action and never touches a hydration /
    // performance / recovery score (Score-Protection). The learning that reads
    // this can only ever influence command SELECTION, never the score.
    {
      const setAtMs = Date.now();
      const commandType = categorizeCommand({
        level: state.engineOutput.performanceState.level,
        score: state.engineOutput.score,
        urgencyLevel: state.engineOutput.command.urgencyLevel,
      });
      const ledgerEvent = confirmationToCommandEvent({
        followed,
        setAtMs,
        delta: followed ? 3 : -3,
        commandType,
        commandId: state.engineOutput.command.id,
      });
      if (ledgerEvent) void appendCommandEvents([ledgerEvent]);
    }
    if (followed) {
      // Internal analytics pipeline (Task #39) — user followed the coach
      // command. Tied to the real tap, independent of server success.
      void emit('command_followed', { commandId: state.engineOutput.command.id });
      // Stamp the activation anchor (first followed command) for the Day-7
      // offer timer. Idempotent — only the very first command sets it.
      void markFirstCommandCompleted();
    }
    try {
      // Server applies confirmationDelta + (in Clutch, on No)
      // clutchDecayBoostUntil. Compliance streak is intentionally NOT
      // mutated server-side — it already contributes to the score via
      // the `consistency` term, so a ±3 swing here would double-count.
      const { newUserState, engineOutput } = await postConfirmCommand(state.userState, followed);
      // Race-safe: same client-owns-overlays merge as logIntake.
      const latest = userStateRef.current;
      const mergedUserState: UserState = {
        ...newUserState,
        biometrics: latest.biometrics,
        appleHealth: latest.appleHealth,
      };
      const mergedEngine = _initialOnly(mergedUserState);
      dispatch({ type: 'CONFIRM_COMMAND', payload: { newUserState: mergedUserState, engineOutput: adaptEngineOutput(mergedEngine) } });
    } catch (err) {
      // Wave-3 PR10: the old fallback applied a LOCAL +3/-3 the server never
      // heard about — the user was rewarded, then silently un-rewarded on
      // the next sync. Fail visibly instead; state stays untouched.
      console.warn('[AForce] confirmCommand failed', err);
      // Same classification as the intake leg above — a refused confirmation
      // and a refused intake share one cause and must read the same way.
      const failure = classifyWriteFailure(err);
      Alert.alert(
        i18n.t(`common.action_failed_title.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].title,
        }),
        i18n.t(`common.action_failed_body.${failure.kind}`, {
          defaultValue: WRITE_FAILURE_COPY[failure.kind].body,
        }),
      );
    }
  }, [state.userState, state.engineOutput, adaptEngineOutput]);

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
    applyServerUserState(optimistic, _initialOnly(optimistic));
    try {
      const { newUserState, engineOutput } = await postLanguage(state.userState, lang);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] setLanguage persist failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const activateSocialMode = useCallback(async (
    preset?: 'travel' | 'heat' | 'hard_block' | null,
  ) => {
    try {
      const { newUserState, engineOutput } = await postSocialActivate(state.userState, preset);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] activateSocialMode failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const logSocialDrink = useCallback(async (
    type: 'beer' | 'wine' | 'cocktail' | 'liquor' | 'hard_seltzer' | 'custom',
    opts: { abv?: number; oz?: number } = {},
  ) => {
    try {
      const { newUserState, engineOutput } = await postSocialDrink(state.userState, type, opts);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] logSocialDrink failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const confirmSocialHydration = useCallback(async (confirmed: boolean) => {
    try {
      const { newUserState, engineOutput } = await postSocialHydrate(state.userState, confirmed);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] confirmSocialHydration failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const deactivateSocialMode = useCallback(async () => {
    try {
      const { newUserState, engineOutput } = await postSocialDeactivate(state.userState);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] deactivateSocialMode failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const activateCruiseMode = useCallback(async () => {
    try {
      const { newUserState, engineOutput } = await postSocialCruise(state.userState);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] activateCruiseMode failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const activateVoyageShield = useCallback(async () => {
    try {
      const { newUserState, engineOutput } = await postSocialShield(state.userState);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] activateVoyageShield failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const setSocialContext = useCallback(async (
    ctx: { sex?: 'male' | 'female' | 'unspecified'; ateRecently?: boolean },
  ) => {
    try {
      const { newUserState, engineOutput } = await postSocialContext(state.userState, ctx);
      applyServerUserState(newUserState, engineOutput);
    } catch (err) {
      console.warn('[AForce] setSocialContext failed', err);
    }
  }, [state.userState, applyServerUserState]);

  const setSubscription = useCallback((sub: UserSubscription) => {
    dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
    scopedStorage.setItem('aforce.subscription', JSON.stringify(sub)).catch(() => {});
  }, []);

  const setSweatAutopilot = useCallback((autopilot: SweatAutopilot | null) => {
    dispatch({
      type: 'SET_SWEAT_AUTOPILOT',
      payload: { autopilot, setAt: autopilot ? Date.now() : null },
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
  }, []);

  // Push an Apple Health snapshot into the score. Pass null to clear
  // (e.g. on disconnect). The engine immediately recomputes so HRV /
  // sleep show up in the orb and breakdown without waiting for the
  // next /v1/home tick.
  const setAppleHealthSnapshot = useCallback((snapshot: AppleHealthInputs | null) => {
    const baseBio = state.userState.biometrics ?? {};
    const merged: UserState = snapshot
      ? {
          ...state.userState,
          appleHealth: snapshot,
          biometrics: {
            ...baseBio,
            // RC-2 Founder Ruling C: carries the optional per-field
            // observation times through additively — see
            // `buildAppleHealthProviderSnapshot`'s header. This mirrors
            // (and must stay in sync with) the identical mapping in
            // `SET_APPLE_HEALTH` (store/appStoreReducer.ts) — both now
            // call the SAME function rather than maintaining two copies.
            apple_health: buildAppleHealthProviderSnapshot(snapshot),
          },
        }
      : (() => {
          const { appleHealth: _drop, ...rest } = state.userState;
          const { apple_health: _dropBio, ...restBio } = baseBio;
          return { ...(rest as UserState), biometrics: restBio };
        })();
    fetchHome(merged)
      .then(({ engineOutput, stale }) => {
        markRefreshStale(stale === true);
        dispatch({ type: 'SET_APPLE_HEALTH', payload: { snapshot, engineOutput } });
      })
      .catch((err) => {
        console.warn('[AForce] setAppleHealthSnapshot refresh failed', err);
      });
  }, [state.userState]);

  // Push a snapshot from any non-Apple health platform (Oura / WHOOP /
  // Strava / Garmin / Samsung / Google Health) into UserState.biometrics.
  // The score engine immediately picks it up via the multi-provider
  // aggregator. Pass null to disconnect.
  const setProviderBiometrics = useCallback((
    providerId: HealthProviderId,
    snapshot: ProviderSnapshot | null,
  ) => {
    const baseBio = state.userState.biometrics ?? {};
    let nextBio: ProviderBiometrics;
    if (snapshot) {
      nextBio = { ...baseBio, [providerId]: snapshot };
    } else {
      const { [providerId]: _drop, ...rest } = baseBio;
      nextBio = rest;
    }
    const merged: UserState = { ...state.userState, biometrics: nextBio };
    fetchHome(merged)
      .then(({ engineOutput, stale }) => {
        markRefreshStale(stale === true);
        dispatch({ type: 'SET_PROVIDER_BIOMETRICS', payload: { providerId, snapshot, engineOutput } });
      })
      .catch((err) => {
        console.warn('[AForce] setProviderBiometrics refresh failed', err);
      });
  }, [state.userState]);

  return {
    logIntake,
    undoIntake,
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
  };
}
