/**
 * OneBreathConversationScreen — the One Breath conversation, connected to the
 * app (personal One Breath only).
 *
 * This file is wiring and nothing else. It hands the controller the services
 * that already own each thing:
 *   Moments      → `commitReviewedMoment` (the same commit Seal uses today)
 *   Lock In      → `lockInWithoutReminders` (the one place Quiet begins)
 *   Plain water  → the store's `logIntake`
 *   Other drinks → `postRecordedDrink` (the log that cannot move HydroState)
 *   HydroState   → read where Home reads it, with the same evidence gate
 * It computes no score, writes no state of its own, and uses no AI model:
 * the words are read by the fixed rules interpreter.
 *
 * A plan that is sealed, or locked in and in Quiet, is shown here too, as the
 * approved prototype shows it: its row, its state, and Lock In, Plans changed
 * and Heading back as buttons. Each one goes through the same owner as the
 * existing screens. Describing a change, and Replay after "Made it back",
 * hand over to those existing screens.
 *
 * Internal builds only (`app/one-breath.tsx`).
 */
import React from "react";
import { AppState, KeyboardAvoidingView, Linking, Platform, StyleSheet, type TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CycleSuccessOverlay } from "@/components/CycleSuccessOverlay";
import { countRealHistoryEntries, resolveHomeEvidence } from "@/components/home/homeBaselineState";
import { useOneBreathVoice } from "@/hooks/useOneBreathVoice";
import { carryUndo } from "@/services/carriedUndo";
import { travelPilotAvailable } from "@/featureFlags/flags";
import { cancelPlan, canUndoLoggedDrink, lockInMoment, returnFromPlan, type OneBreathOwners } from "@/services/oneBreath/effects";
import { rideHandoffUrl } from "@/services/momentPreparation";
import { lockInOpensInMs } from "@/utils/oneBreath/lockInWindow";
import { OPEN_PLAN_LINES, openOneBreathPlan, openPlanItems, openPlanPhase, type OpenPlanAction, type OpenPlanMode } from "@/utils/oneBreath/openPlan";
import { tripHandoff } from "@/utils/oneBreath/tripHandoff";
import { commitReviewedMoment, hydrateMoments, useMomentsStore } from "@/services/momentsStore";
import { createOneBreathConversation, type ConversationHost } from "@/services/oneBreath/conversationController";
import { lockInWithoutReminders } from "@/services/quietDelivery";
import { postRecordedDrink } from "@/services/realApi";
import { useBootstrapSlice, useEngineSlice, useHistorySlice, useUserSlice } from "@/store/slices";
import { useAppStore } from "@/store/useAppStore";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { countsAsWater, RECORDED_DRINK_DETAIL, RECORDED_DRINK_TITLE } from "@/utils/hydration/drinkRoute";
import { conversationStatus, conversationView } from "@/utils/oneBreath/conversation";
import { momentInLockInWindow, ONE_BREATH_ROUTES, upcomingForOneBreath } from "@/utils/oneBreath/screenAnswer";
import type { OneBreathContext } from "@/utils/oneBreath/session";
import { OneBreathConversation } from "./OneBreathConversation";
import { bandWord } from "./OneBreathStatusAnswer";

/** The opening line, from the approved One Breath opening screen. */
const PROMPT = "Plan a Moment. Just say it.";

export function OneBreathConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const app = useAppStore();
  const moments = useMomentsStore();
  const engine = useEngineSlice();
  const user = useUserSlice();
  const history = useHistorySlice();
  const { isHydrated } = useBootstrapSlice();
  React.useEffect(() => {
    if (!moments.hydrated) void hydrateMoments();
  }, [moments.hydrated]);

  const evidence = resolveHomeEvidence({
    intakeEventCount: user.intakeEvents?.length ?? 0,
    loggedDayCount: isHydrated ? countRealHistoryEntries(history) : null,
  });
  const ready = evidence !== "pending" && evidence !== "building" && Number.isFinite(engine.score);

  // The controller lives for the life of the screen; it reads the latest values through this ref.
  const live = React.useRef({ app, moments, engine, ready, router });
  live.current = { app, moments, engine, ready, router };

  // The services that own each thing, read fresh each time through `live`.
  const owners = React.useMemo<OneBreathOwners>(
    () => ({
      commitMoment: commitReviewedMoment,
      lockIn: lockInWithoutReminders,
      logWater: (oz) => live.current.app.logIntake("water", { source: "manual", ozOverride: oz }),
      undoWater: (logId) => live.current.app.undoIntake(logId),
      recordDrink: postRecordedDrink,
      moments: () => live.current.moments.moments,
      command: () => live.current.app.state.engineOutput.command,
    }),
    [],
  );

  const controller = React.useMemo(() => {
    const host: ConversationHost = {
      context: (): OneBreathContext => {
        const { moments: store, engine: e, ready: hasState } = live.current;
        const nowMs = Date.now();
        const starting = store.hydrated ? momentInLockInWindow(store.moments, nowMs) : undefined;
        return {
          nowIso: new Date(nowMs).toISOString(),
          social: false,
          momentInWindow: !!starting,
          ...(starting ? { currentMomentId: starting.id } : {}),
          ...(() => {
            // One open plan at a time: a sealed plan is finished or cancelled before another is started.
            const held = store.hydrated ? openOneBreathPlan(store.moments) : undefined;
            return held && openPlanPhase(held) !== "draft" ? { openPlanTitle: held.title } : {};
          })(),
          learningOn: false,
          interpreterReachable: true,
          networkUp: true,
          // HydroState is worked out from what the member logged, so it is an estimate.
          ...(hasState
            ? { hydroState: { value: Math.max(0, Math.min(100, Math.round(e.score))), word: bandWord(e.performanceState?.level), estimated: true, source: "what you’ve logged" } }
            : { hydroStateCollecting: true }),
          ...(store.hydrated ? { upcoming: upcomingForOneBreath(store.moments, nowMs) } : {}),
          // The hydration rules' own words for a drink that does not move HydroState yet.
          // Plain water can be taken back by the hydration log, so it is logged at once with Undo.
          undoAfterLog: canUndoLoggedDrink,
          creditNote: (categoryId) => (countsAsWater(categoryId) ? "" : `${RECORDED_DRINK_TITLE}. ${RECORDED_DRINK_DETAIL}`),
        };
      },
      owners,
      carryUndo,
      openScreen: (screen) => {
        const route = ONE_BREATH_ROUTES[screen];
        if (!route) return false;
        live.current.router.push(route as never);
        return true;
      },
    };
    return createOneBreathConversation(host);
  }, [owners]);

  // ── The open plan: sealed and waiting for Lock In, or locked in and in Quiet ──
  const openPlan = moments.hydrated ? openOneBreathPlan(moments.moments) : undefined;
  const phase = openPlan ? openPlanPhase(openPlan) : undefined;
  const [mode, setMode] = React.useState<OpenPlanMode>("rest");
  const [working, setWorking] = React.useState<OpenPlanAction | undefined>();
  const [planError, setPlanError] = React.useState("");
  const [cancelled, setCancelled] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const busy = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);
  // Plans changed and Heading back belong to Quiet: any other state starts at rest.
  React.useEffect(() => {
    if (phase !== "quiet") setMode("rest");
    setPlanError("");
  }, [openPlan?.id, phase]);
  // Lock In appears when its window opens, without the member having to leave and come back.
  const startAtIso = phase === "sealed" ? openPlan?.startAtIso : undefined;
  React.useEffect(() => {
    if (!startAtIso) return;
    const wait = lockInOpensInMs(startAtIso, Date.now());
    if (wait <= 0) return;
    const timer = setTimeout(() => setNowMs(Date.now()), Math.min(wait + 500, 2147483647));
    return () => clearTimeout(timer);
  }, [startAtIso, nowMs]);

  const act = async (id: string) => {
    const plan = openPlan;
    if (!plan?.preparation) return;
    setPlanError("");
    if (id === "plans_changed") return setMode("change");
    if (id === "heading_back") return setMode("return");
    if (id === "back_to_quiet") return setMode("rest");
    if (id === "emergency" || id === "uber" || id === "lyft") {
      // Opens the phone or the provider's own app. Nothing is sent from here.
      try {
        await Linking.openURL(id === "emergency" ? `tel:${plan.preparation.emergencyNumber}` : rideHandoffUrl(id));
      } catch {
        if (mounted.current) setPlanError(OPEN_PLAN_LINES.openFailed);
      }
      return;
    }
    if (id !== "lock_in" && id !== "cancel" && id !== "made_it_back") return;
    // One at a time: a second tap while the owner is answering does nothing.
    if (busy.current) return;
    busy.current = true;
    setWorking(id);
    try {
      if (id === "lock_in") await lockInMoment(owners, plan.id);
      else if (id === "cancel") {
        await cancelPlan(owners, plan.id);
        if (mounted.current) setCancelled(true);
      } else {
        await returnFromPlan(owners, plan.id);
        // Replay lives on the existing screen for this Moment.
        live.current.router.replace({ pathname: "/one-breath", params: { momentId: plan.id } } as never);
      }
    } catch {
      if (mounted.current) setPlanError(id === "lock_in" ? OPEN_PLAN_LINES.lockInFailed : OPEN_PLAN_LINES.saveFailed);
    } finally {
      busy.current = false;
      if (mounted.current) setWorking(undefined);
    }
  };

  const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  // Leaving, or the app going to the background, puts Undo out of reach: a held drink is logged now, once.
  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") controller.interrupt();
    });
    return () => {
      sub.remove();
      // Closing keeps a logged drink and takes its Undo to the next screen.
      controller.close();
      controller.dispose();
    };
  }, [controller]);

  const [words, setWords] = React.useState("");
  const inputRef = React.useRef<TextInput>(null);
  /** A trip goes to Travel with the words as said; everything else is One Breath's. */
  const hear = (said: string, via: "typed" | "spoken") => {
    if (openPlan && phase === "quiet" && mode === "change") {
      // What changed goes to the existing Plans changed screen, which owns the safety check and the review.
      setMode("rest");
      live.current.router.push({ pathname: "/one-breath", params: { momentId: openPlan.id, changed: said } } as never);
      return;
    }
    if (cancelled) setCancelled(false);
    const session = controller.getSnapshot().session;
    const flags = live.current.app.state.featureFlags;
    const route = tripHandoff(said, { session, travelAvailable: !!flags && travelPilotAvailable(flags), now: new Date() });
    if (route) {
      // Travel shows what it understood on a card, asks only for what is missing, and saves nothing until confirmed.
      live.current.router.push(route as never);
      return;
    }
    controller.send({ kind: "say", words: said, via });
  };
  const voice = useOneBreathVoice((text, info) => {
    if (info.final && text.trim()) hear(text.trim(), "spoken");
  });
  const send = () => {
    const said = words.trim();
    if (!said) return;
    voice.cancel();
    setWords("");
    hear(said, "typed");
  };

  const results = { done: snapshot.done, failed: snapshot.failed };
  const view = conversationView(snapshot.entries, results, {
    state: snapshot.session,
    planRows: snapshot.planRows,
    planNote: snapshot.planNote,
    planError: snapshot.planError,
  });

  const planItems = openPlan && phase !== "draft" ? openPlanItems({ moment: openPlan, mode, nowMs, working, error: planError || undefined }) : [];
  const items = [
    ...view.items,
    ...planItems,
    // Said only after the Moments store confirmed the cancellation.
    ...(cancelled && !openPlan ? [{ kind: "ai" as const, key: "op-cancelled", text: OPEN_PLAN_LINES.cancelled }] : []),
  ];
  const baseStatus = conversationStatus(snapshot.entries, results, voice.listening);
  const status = working ? "Operating" : baseStatus === "Standby" && phase === "quiet" ? "Quiet" : baseStatus;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <View style={[s.body, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <OneBreathConversation
          social={false}
          status={status}
          items={items}
          onAction={(id) => void act(id)}
          quiet={phase === "quiet"}
          {...(phase === "quiet" && mode === "change" ? { placeholder: OPEN_PLAN_LINES.change } : {})}
          awaitingSeal={view.awaitingSeal}
          onSeal={() => controller.send({ kind: "tap", control: "seal" })}
          onChoice={(label) => controller.send({ kind: "say", words: label, via: "typed" })}
          onUndo={() => controller.send({ kind: "tap", control: "undo" })}
          onClose={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}
          onTalk={() => {
            if (voice.busy) voice.stop();
            else void voice.start();
          }}
          voiceAvailable={voice.available}
          voiceListening={voice.listening}
          words={words}
          onChangeWords={setWords}
          onSend={send}
          inputRef={inputRef}
          prompt={PROMPT}
        />
      </View>
      {/* The S21 contract: every reachable screen that logs water shows the app's own confirmation. */}
      {app.state.showCycleSuccess && app.state.lastCycleResult ? (
        <CycleSuccessOverlay result={app.state.lastCycleResult} onDismiss={app.dismissSuccess} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.ink },
  body: { flex: 1, paddingHorizontal: 28 },
});
