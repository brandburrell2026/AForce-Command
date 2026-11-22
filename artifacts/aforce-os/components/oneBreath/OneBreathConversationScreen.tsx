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
 * existing screens. What the member types under "What changed?" meets the same
 * safety gate first; a changed day or time is read back and sealed like any
 * plan. Replay after "Made it back" is asked here, with the existing Replay's
 * steps and saves. Nothing private is kept from what is typed here.
 *
 * Internal builds only (`app/one-breath.tsx`).
 */
import React from "react";
import { AppState, KeyboardAvoidingView, Linking, Platform, StyleSheet, type TextInput, View } from "react-native";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CycleSuccessOverlay } from "@/components/CycleSuccessOverlay";
import { countRealHistoryEntries, resolveHomeEvidence } from "@/components/home/homeBaselineState";
import { useOneBreathVoice } from "@/hooks/useOneBreathVoice";
import { carryUndo } from "@/services/carriedUndo";
import { closeOneBreath } from "@/services/oneBreathOrigin";
import { cancelPlan, canUndoLoggedDrink, lockInMoment, returnFromPlan, saveReplay, type OneBreathOwners } from "@/services/oneBreath/effects";
import { approveLessonFromReplay, hydrateMomentLessons, lessonForMoment, useMomentLessons } from "@/services/momentLessons";
import { momentReturnLabel, rideHandoffUrl } from "@/services/momentPreparation";
import { activeAlcoholContext, alcoholDisclosure } from "@/services/momentSafetyContext";
import { evaluateMomentSafety } from "@/utils/intelligence/decisionGuard";
import { changePlan } from "@/utils/oneBreath/planTurn";
import { REPLAY_LINES, replayItems, replayTyping, type ReplayEditing } from "@/utils/oneBreath/replayItems";
import { cleanReplayNote, type ReplayAnswer, type ReplayObstacle } from "@/utils/replayFollowUp";
import { ONE_BREATH_LINES } from "@/utils/oneBreath/session";
import { lockInOpensInMs } from "@/utils/oneBreath/lockInWindow";
import { OPEN_PLAN_LINES, openOneBreathPlan, openPlanItems, contactNumber, openPlanPhase, planDraftFromMoment, resumableDraft, type OpenPlanMode, type PlanSafety } from "@/utils/oneBreath/openPlan";
import { commitReviewedMoment, hydrateMoments, useMomentsStore } from "@/services/momentsStore";
import { createOneBreathConversation, type ConversationHost } from "@/services/oneBreath/conversationController";
import { lockInWithoutReminders } from "@/services/quietDelivery";
import { postRecordedDrink, removeRecordedDrink } from "@/services/realApi";
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
  const pathname = usePathname();
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
      removeDrink: removeRecordedDrink,
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
          // A drink that can be taken back is logged at once with Undo: water through the
          // hydration log, anything else by removing it from the drink log.
          undoAfterLog: (categoryId, name) => canUndoLoggedDrink(categoryId, name, owners),
          creditNote: (categoryId) => (countsAsWater(categoryId) ? "" : `${RECORDED_DRINK_TITLE}. ${RECORDED_DRINK_DETAIL}`),
        };
      },
      owners,
      // A plan saved earlier and never sealed is picked up where it was left.
      resume: () => {
        const store = live.current.moments;
        const held = store.hydrated ? openOneBreathPlan(store.moments) : undefined;
        return resumableDraft(held) ? held : undefined;
      },
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
  const [working, setWorking] = React.useState<string | undefined>();
  const [safety, setSafety] = React.useState<PlanSafety | undefined>();
  const [contact, setContact] = React.useState(false);
  // Replay, for the Moment the member has just come back from.
  const [replayFor, setReplayFor] = React.useState<string | undefined>();
  const [replayEditing, setReplayEditing] = React.useState<ReplayEditing>(null);
  const [replayError, setReplayError] = React.useState("");
  const lessons = useMomentLessons();
  React.useEffect(() => {
    if (replayFor) void hydrateMomentLessons();
  }, [replayFor]);
  const replayMoment = replayFor ? moments.moments.find((m) => m.id === replayFor) : undefined;
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
    setSafety(undefined);
    setContact(false);
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
    const to = (next: OpenPlanMode) => {
      setSafety(undefined);
      setContact(false);
      setMode(next);
    };
    if (id === "plans_changed") return to("change");
    if (id === "heading_back" || id === "get_ride" || id === "stay") return to("return");
    if (id === "back_to_quiet") return to("rest");
    if (id === "contact") return setContact(true);
    if (id === "emergency" || id === "call_emergency" || id === "uber" || id === "lyft") {
      // Opens the phone or the provider's own app. Nothing is sent from here.
      try {
        await Linking.openURL(id === "uber" || id === "lyft" ? rideHandoffUrl(id) : `tel:${plan.preparation.emergencyNumber}`);
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
        // The one Replay question is asked here, once the return is saved.
        if (mounted.current) {
          setReplayEditing(null);
          setReplayFor(plan.id);
        }
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

  // One Breath is also a tab, and a tab stays mounted when the member moves to
  // another one. Leaving it is leaving all the same: a held drink is logged
  // now, and an open Undo goes with the member to the screen they land on.
  useFocusEffect(
    React.useCallback(() => {
      return () => controller.close();
    }, [controller]),
  );

  /** One Replay save at a time, through the Moments commit. */
  const replaySave = async (answer: { replay?: ReplayAnswer; replayObstacle?: ReplayObstacle; replayNote?: string }) => {
    if (!replayFor || busy.current) return;
    busy.current = true;
    setWorking("replay");
    setReplayError("");
    try {
      await saveReplay(owners, replayFor, answer);
      if (mounted.current) setReplayEditing(null);
    } catch {
      if (mounted.current) setReplayError(REPLAY_LINES.failed);
    } finally {
      busy.current = false;
      if (mounted.current) setWorking(undefined);
    }
  };
  const replayAct = (id: string) => {
    setReplayError("");
    // A new answer starts the follow-up again, as on the existing Replay.
    if (id.startsWith("replay:")) return void replaySave({ replay: id.slice(7) as ReplayAnswer, replayObstacle: undefined, replayNote: undefined });
    if (id.startsWith("obstacle:")) return void replaySave({ replayObstacle: id.slice(9) as ReplayObstacle, replayNote: undefined });
    if (id === "replay_other") return setReplayEditing("other");
    if (id === "replay_rule") return setReplayEditing("rule");
    if (id === "replay_change") return setReplayEditing("ask");
    if (id === "replay_cancel") return setReplayEditing(null);
    if (id === "remembers") return live.current.router.push("/remembers" as never);
    if (id === "open_moments") return live.current.router.navigate("/moments-tab" as never);
  };
  const typingFor = replayMoment ? replayTyping({ moment: replayMoment, editing: replayEditing }) : null;

  const [words, setWords] = React.useState("");
  const inputRef = React.useRef<TextInput>(null);
  /** A trip goes to Travel with the words as said; everything else is One Breath's. */
  const hear = (said: string, via: "typed" | "spoken") => {
    // Replay is waiting on the member's own words: a private note, or their own rule.
    if (replayMoment && typingFor === "note") {
      void replaySave({ replayObstacle: "other", replayNote: cleanReplayNote(said) });
      return;
    }
    if (replayMoment && typingFor === "rule") {
      const result = approveLessonFromReplay({ text: said, scope: replayMoment.type, momentId: replayMoment.id, momentAtIso: replayMoment.startAtIso, nowIso: new Date().toISOString() });
      if (result === "saved") {
        setReplayError("");
        setReplayEditing(null);
      } else if (result === "full") setReplayError(REPLAY_LINES.full);
      else if (result !== "empty") setReplayError(REPLAY_LINES.failed);
      return;
    }
    if (openPlan && phase === "quiet" && mode === "change") {
      if (contact) {
        // "Contact someone": the number opens the phone app. No message or status is shared.
        const number = contactNumber(said);
        if (number) void Linking.openURL(`tel:${number}`).catch(() => mounted.current && setPlanError(OPEN_PLAN_LINES.openFailed));
        return;
      }
      // The same safety gate as the existing Plans changed screen, before anything else.
      const found = evaluateMomentSafety(said, alcoholDisclosure(said) || activeAlcoholContext(openPlan));
      if (found) {
        setSafety(found);
        return;
      }
      // A changed day or time is read back and waits for a seal. Anything else is asked about.
      const draft = planDraftFromMoment(openPlan);
      const changed = draft ? changePlan(draft, said, new Date()) : null;
      if (changed) {
        setMode("rest");
        controller.revise(openPlan, changed, said, via);
      } else setPlanError(ONE_BREATH_LINES.askChange);
      return;
    }
    if (cancelled) setCancelled(false);
    // Anything else moves on from a finished or unanswered Replay; it stays in Moments.
    if (replayFor) setReplayFor(undefined);
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

  const planItems =
    openPlan && phase !== "draft"
      ? openPlanItems({ moment: openPlan, mode, nowMs, working: working as never, error: planError || undefined, ...(safety ? { safety } : {}), contact })
      : [];
  const replay = replayMoment
    ? replayItems({
        moment: replayMoment,
        editing: replayEditing,
        returnLabel: momentReturnLabel(new Date()),
        lessonText: lessonForMoment(lessons.lessons, replayMoment.id)?.text,
        ...(lessons.hydrated ? { learningOn: lessons.learningOn } : {}),
        clock: (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        working: !!working,
        error: replayError || undefined,
      })
    : [];
  const barHint =
    typingFor === "note" ? REPLAY_LINES.otherHint
    : typingFor === "rule" ? REPLAY_LINES.ruleHint
    : phase === "quiet" && mode === "change" ? (contact ? OPEN_PLAN_LINES.contactHint : OPEN_PLAN_LINES.change)
    : undefined;
  const items = [
    ...view.items,
    ...planItems,
    ...replay,
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
          onAction={(id) => (id.startsWith("replay") || id.startsWith("obstacle:") || id === "remembers" || id === "open_moments" ? replayAct(id) : void act(id))}
          quiet={phase === "quiet"}
          {...(barHint ? { placeholder: barHint } : {})}
          awaitingSeal={view.awaitingSeal}
          onSeal={() => controller.send({ kind: "tap", control: "seal" })}
          onChoice={(label) => controller.send({ kind: "say", words: label, via: "typed" })}
          onUndo={() => controller.send({ kind: "tap", control: "undo" })}
          onClose={() => closeOneBreath(router as never, pathname)}
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
