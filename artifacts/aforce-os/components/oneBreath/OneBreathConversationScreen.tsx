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
 * NOT ROUTED. No screen opens this until it has passed device testing and the
 * wording has been reviewed (founder decision, 2026-11-20). A test keeps it
 * out of `app/` until then.
 */
import React from "react";
import { AppState, KeyboardAvoidingView, Platform, StyleSheet, type TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { countRealHistoryEntries, resolveHomeEvidence } from "@/components/home/homeBaselineState";
import { useOneBreathVoice } from "@/hooks/useOneBreathVoice";
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
          learningOn: false,
          interpreterReachable: true,
          networkUp: true,
          // HydroState is worked out from what the member logged, so it is an estimate.
          ...(hasState
            ? { hydroState: { value: Math.max(0, Math.min(100, Math.round(e.score))), word: bandWord(e.performanceState?.level), estimated: true, source: "what you’ve logged" } }
            : { hydroStateCollecting: true }),
          ...(store.hydrated ? { upcoming: upcomingForOneBreath(store.moments, nowMs) } : {}),
          // The hydration rules' own words for a drink that does not move HydroState yet.
          creditNote: (categoryId) => (countsAsWater(categoryId) ? "" : `${RECORDED_DRINK_TITLE}. ${RECORDED_DRINK_DETAIL}`),
        };
      },
      owners: {
        commitMoment: commitReviewedMoment,
        lockIn: lockInWithoutReminders,
        logWater: (oz) => live.current.app.logIntake("water", { source: "manual", ozOverride: oz }),
        recordDrink: postRecordedDrink,
        moments: () => live.current.moments.moments,
        command: () => live.current.app.state.engineOutput.command,
      },
      openScreen: (screen) => {
        const route = ONE_BREATH_ROUTES[screen];
        if (!route) return false;
        live.current.router.push(route as never);
        return true;
      },
    };
    return createOneBreathConversation(host);
  }, []);

  const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  // Leaving, or the app going to the background, puts Undo out of reach: a held drink is logged now, once.
  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") controller.interrupt();
    });
    return () => {
      sub.remove();
      controller.interrupt();
      controller.dispose();
    };
  }, [controller]);

  const [words, setWords] = React.useState("");
  const inputRef = React.useRef<TextInput>(null);
  const voice = useOneBreathVoice((text, info) => {
    if (info.final && text.trim()) controller.send({ kind: "say", words: text.trim(), via: "spoken" });
  });
  const send = () => {
    const said = words.trim();
    if (!said) return;
    voice.cancel();
    setWords("");
    controller.send({ kind: "say", words: said, via: "typed" });
  };

  const results = { done: snapshot.done, failed: snapshot.failed };
  const view = conversationView(snapshot.entries, results, {
    state: snapshot.session,
    planRows: snapshot.planRows,
    planNote: snapshot.planNote,
    planError: snapshot.planError,
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <View style={[s.body, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <OneBreathConversation
          social={false}
          status={conversationStatus(snapshot.entries, results, voice.listening)}
          items={view.items}
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
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.ink },
  body: { flex: 1, paddingHorizontal: 28 },
});
