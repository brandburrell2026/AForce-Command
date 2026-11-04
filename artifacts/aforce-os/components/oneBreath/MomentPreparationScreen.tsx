import React from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Moment, MomentPreparation } from "@/types/moments";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { useAppStore } from "@/store/useAppStore";
import {
  commitReviewedMoment,
  hydrateMoments,
  pruneMomentSafetyContext,
  useMomentsStore,
} from "@/services/momentsStore";
import {
  createConfirmedMoment,
  validateMomentDraft,
  type MomentDraft,
} from "@/services/momentDraft";
import { suggestMomentDraft } from "@/services/oneBreathDraft";
import { evaluateMomentSafety } from "@/utils/intelligence/decisionGuard";
import {
  reviewedPreparationSteps,
  isDayMoment,
  momentReturnLabel,
  rideHandoffUrl,
  PREPARATION_POLICY_VERSION,
} from "@/services/momentPreparation";
import { captureScope, isScopeCurrent } from "@/services/scopedWriteQueue";
import { getScopeState } from "@/services/userScope";
import { useOneBreathVoice } from "@/hooks/useOneBreathVoice";
import { hapticImpact, hapticSelection } from "@/services/haptics";
import { PreparationMark } from "./PreparationMark";
import { PreparationOrb } from "./PreparationOrb";
import { lockInWithoutReminders } from "@/services/quietDelivery";
import {
  activeAlcoholContext,
  alcoholDisclosure,
  configuredMomentSafetyPolicy,
  withAlcoholContext,
} from "@/services/momentSafetyContext";
import { stopSpeaking } from "@/services/textToSpeech";

type Screen =
  | "noticed"
  | "capture"
  | "mirror"
  | "plan"
  | "seal"
  | "lock"
  | "quiet"
  | "change"
  | "return"
  | "next";
const transaction = () =>
  `seal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** The SAME Moment transaction and preparation projection for Social and One Breath. */
export function MomentPreparationScreen({
  context,
}: {
  context: "social" | "one_breath";
}) {
  const social = context === "social";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ momentId?: string }>();
  const store = useMomentsStore();
  const { state: app } = useAppStore();
  const [scope] = React.useState(captureScope);
  const [screen, setScreen] = React.useState<Screen>("capture");
  const [words, setWords] = React.useState("");
  const [draft, setDraft] = React.useState<MomentDraft | null>(null);
  const [review, setReview] = React.useState<Moment | null>(null);
  const [error, setError] = React.useState("");
  const [method, setMethod] = React.useState<
    MomentPreparation["returnMethod"] | null
  >(null);
  const [contactNumber, setContactNumber] = React.useState("");
  const [contactShown, setContactShown] = React.useState(false);
  const [destination, setDestination] = React.useState("");
  const [emergency, setEmergency] =
    React.useState<MomentPreparation["emergencyNumber"]>("911");
  const [occurringNow, setOccurringNow] = React.useState(false);
  const [changes, setChanges] = React.useState("");
  const [alcoholMentioned, setAlcoholMentioned] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [holding, setHolding] = React.useState(false);
  const [resumed, setResumed] = React.useState(false);
  const [holdId, setHoldId] = React.useState(transaction);
  const busy = React.useRef(false);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewedBase = React.useRef<Moment | undefined>(undefined);
  const voice = useOneBreathVoice(setWords);
  const dim = React.useRef(new Animated.Value(1)).current;
  const progress = React.useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReducedMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  const saved = store.moments.find((m) => m.id === review?.id);
  const current = review ?? saved;
  const day = current ? isDayMoment(current) : new Date().getHours() < 18;
  const accent = day ? T.dayAccent : T.nightAccent;
  const next = store.moments
    .filter(
      (m) =>
        m.source !== "demo" &&
        m.id !== current?.id &&
        Date.parse(m.startAtIso) > Date.now(),
    )
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso))[0];
  const safety = evaluateMomentSafety(
    screen === "change" ? changes : words,
    alcoholMentioned || activeAlcoholContext(current),
  );
  const allowed = () =>
    isScopeCurrent(scope) && getScopeState().status === "AUTHENTICATED";
  const cancelHold = React.useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    progress.stopAnimation();
    progress.setValue(0);
    setHolding(false);
  }, [progress]);
  React.useEffect(() => {
    if (!store.hydrated) void hydrateMoments();
  }, [store.hydrated]);
  React.useEffect(() => {
    if (screen === "next" && saved?.preparation?.replay === "yes")
      router.replace("/");
  }, [screen, saved?.preparation?.replay, router]);
  React.useEffect(() => {
    if (resumed || !store.hydrated) return;
    setResumed(true);
    const existing = params.momentId
      ? store.moments.find((m) => m.id === params.momentId)
      : store.moments.find(
          (m) =>
            m.preparation?.context === context && !m.preparation.returnedAtIso,
        );
    if (!existing) return;
    setReview(existing);
    if (existing.preparation) {
      setMethod(existing.preparation.returnMethod);
      setDestination(existing.preparation.destination);
      setEmergency(existing.preparation.emergencyNumber);
      setScreen(
        existing.preparation.returnedAtIso
          ? "next"
          : existing.preparation.lockedInAtIso
            ? "quiet"
            : "lock",
      );
    } else setScreen("noticed");
  }, [store.hydrated, store.moments, params.momentId, resumed, context]);
  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") pruneMomentSafetyContext();
      if (s !== "active") {
        cancelHold();
        voice.cancel();
      }
    });
    return () => {
      sub.remove();
      cancelHold();
    };
  }, [cancelHold, voice.cancel]);
  React.useEffect(() => {
    dim.setValue(1);
    if (screen !== "quiet") return;
    stopSpeaking();
    let animation: Animated.CompositeAnimation | undefined;
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive) return;
      animation = Animated.sequence([
        Animated.delay(T.quietDimMs),
        Animated.timing(dim, {
          toValue: 0.15,
          duration: reduced ? 0 : 900,
          useNativeDriver: true,
        }),
      ]);
      animation.start();
    });
    return () => {
      alive = false;
      animation?.stop();
    };
  }, [screen, dim]);
  const move = (s: Screen) => {
    cancelHold();
    setError("");
    setScreen(s);
  };
  const field = (key: keyof MomentDraft, value: string) => {
    if (key === "date" || key === "time") setOccurringNow(false);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setError("");
  };
  const reviewWords = () => {
    voice.cancel();
    if (alcoholDisclosure(words)) setAlcoholMentioned(true);
    if (
      evaluateMomentSafety(
        words,
        alcoholMentioned || activeAlcoholContext(current),
      )
    ) {
      setChanges(words);
      move("change");
      return;
    }
    setDraft(suggestMomentDraft(words));
    move("mirror");
  };
  const makePlan = () => {
    if (!draft) return;
    if (
      evaluateMomentSafety(
        draft.title,
        alcoholMentioned || activeAlcoholContext(current),
      )
    ) {
      setChanges(draft.title);
      move("change");
      return;
    }
    const result = validateMomentDraft(
      draft,
      occurringNow ? Number.NEGATIVE_INFINITY : Date.now(),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const disclosed =
      alcoholMentioned ||
      alcoholDisclosure(words) ||
      alcoholDisclosure(draft.title);
    if (alcoholDisclosure(draft.title) || alcoholDisclosure(draft.prepGoal)) {
      setError('Use a Moment name and priority without alcohol details. That context stays separate and temporary.');
      return;
    }
    const policy = configuredMomentSafetyPolicy();
    if (disclosed && !policy) {
      setError(
        "Private context settings are not configured for this internal build. You can still open a ride app or contact someone.",
      );
      return;
    }
    let moment = review ?? createConfirmedMoment(draft, result.startAtIso);
    if (disclosed && policy) moment = withAlcoholContext(moment, policy);
    const updated = {
      ...moment,
      title: draft.title.trim(),
      startAtIso: result.startAtIso,
      prepGoal: draft.prepGoal.trim() || undefined,
    };
    const steps = reviewedPreparationSteps(
      updated,
      app.engineOutput.command,
      new Date().toISOString(),
    );
    const preparation: MomentPreparation = {
      version: 1,
      context,
      transactionId: transaction(),
      reviewedAtIso: new Date().toISOString(),
      sealedAtIso: "",
      validUntilIso: new Date(
        Math.min(
          Date.now() + 5 * 60000,
          occurringNow ? Infinity : Date.parse(result.startAtIso),
        ),
      ).toISOString(),
      returnMethod: method ?? "none",
      destination,
      emergencyNumber: emergency,
      steps,
      policyVersion: PREPARATION_POLICY_VERSION,
    };
    reviewedBase.current = saved;
    setReview({ ...updated, preparation });
    setHoldId(preparation.transactionId);
    move("plan");
  };
  const commit = async (
    moment: Moment,
    expected: Moment | undefined,
    target: Screen,
  ) => {
    if (busy.current) return;
    if (!allowed()) {
      setError("Your account changed. Close this plan and start again.");
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await (target === "quiet"
        ? lockInWithoutReminders(() => commitReviewedMoment(moment, expected))
        : commitReviewedMoment(moment, expected));
      if (!allowed()) return;
      setReview(result);
      move(target);
      if (target === "lock") hapticImpact("medium");
    } catch {
      if (allowed())
        setError(
          target === "lock"
            ? "Not sealed yet. Review your plan and try again."
            : target === "quiet"
              ? "Could not enter Quiet. Please try Lock In again."
              : "Could not save that change. Please try again.",
        );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const seal = () => {
    if (!review?.preparation) return;
    const p = review.preparation;
    const reviewedCommand = p.steps.find((step) => step.commandId)?.commandId;
    if (reviewedCommand && reviewedCommand !== app.engineOutput.command.id) {
      setError(
        "Your preparation changed. Review the plan again before sealing.",
      );
      return;
    }
    if (Date.now() >= Date.parse(p.validUntilIso ?? review.startAtIso)) {
      setError("This review expired. Review your plan again.");
      return;
    }
    void commit(
      {
        ...review,
        preparation: {
          ...p,
          transactionId: holdId,
          sealedAtIso: new Date().toISOString(),
        },
      },
      reviewedBase.current,
      "lock",
    );
  };
  const startHold = () => {
    if (saving || holding) return;
    setHolding(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? 0 : T.holdMs,
      useNativeDriver: false,
    }).start();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      seal();
    }, T.holdMs);
  };
  const transition = (patch: Partial<MomentPreparation>, target: Screen) => {
    if (!saved?.preparation) return;
    const base = patch.returnedAtIso
      ? { ...saved, safetyContext: undefined }
      : saved;
    void commit(
      {
        ...base,
        preparation: {
          ...saved.preparation,
          ...patch,
          transactionId: transaction(),
        },
      },
      saved,
      target,
    );
  };
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not open that app. Contact someone or stay here.");
    }
  };
  const button = (
    label: string,
    action: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || saving }}
      disabled={disabled || saving}
      onPress={() => {
        hapticSelection();
        action();
      }}
      style={[
        s.button,
        primary && { backgroundColor: day ? T.dayButton : T.blue },
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.buttonText, primary && { color: day ? T.ink : T.bone }]}>
        {label}
      </Text>
    </Pressable>
  );
  const input = (
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    placeholder = "",
  ) => (
    <View style={s.field}>
      <Text style={s.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.muted}
        style={s.input}
      />
    </View>
  );
  const steps = current?.preparation?.steps ?? [];
  const safetyView = screen === "change" && safety !== null;
  React.useEffect(() => {
    if (
      !saved?.preparation ||
      !alcoholMentioned ||
      activeAlcoholContext(saved) ||
      !allowed()
    )
      return;
    const policy = configuredMomentSafetyPolicy();
    if (!policy) {
      setError(
        "Private context settings are not configured. Keep this screen open for safety options.",
      );
      return;
    }
    const token = captureScope();
    void commitReviewedMoment(
      {
        ...withAlcoholContext(saved, policy),
        preparation: { ...saved.preparation, transactionId: transaction() },
      },
      saved,
    ).catch(() => {
      if (isScopeCurrent(token))
        setError(
          "Could not retain this context after a restart. Keep this screen open for safety options.",
        );
    });
  }, [saved, alcoholMentioned]);
  return (
    <View
      style={[s.root, screen === "quiet" && { backgroundColor: T.midnight }]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
        ]}
      >
        <View style={s.header}>
          <PreparationMark />
          <Text style={s.brand}>AFORCE OS</Text>
          {button("Close", () => {
            voice.cancel();
            router.back();
          })}
        </View>
        {screen === "noticed" && current ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>
              AFORCE OS · YOUR MOMENT
            </Text>
            <Text style={s.title}>{current.title}?</Text>
            <Text style={s.body}>
              {clock(current.startAtIso)}. Want me to prepare around it?
            </Text>
            {button(
              "Prepare",
              () => {
                const at = new Date(current.startAtIso);
                setDraft({
                  title: current.title,
                  date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`,
                  time: `${at.getHours().toString().padStart(2, "0")}:${at.getMinutes().toString().padStart(2, "0")}`,
                  type: current.type,
                  prepGoal: current.prepGoal ?? "",
                });
                move("mirror");
              },
              true,
            )}
            {button("Not this one", () => router.back())}
          </>
        ) : null}
        {screen === "capture" ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>
              {social ? "SOCIAL ONE BREATH" : "ONE BREATH"}
            </Text>
            <Text style={s.title}>
              What would make {day ? "today" : "tonight"} go well?
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                voice.listening ? "Stop listening" : "Speak your moment"
              }
              onPressIn={() => {
                if (voice.available) void voice.start();
              }}
              onPressOut={voice.stop}
              onAccessibilityTap={() => {
                if (voice.busy) voice.stop();
                else void voice.start();
              }}
            >
              <PreparationOrb social={social} day={false} />
            </Pressable>
            <Text style={s.muted}>
              {voice.available ? "Hold to speak · or type" : "Type your moment"}
            </Text>
            <TextInput
              accessibilityLabel="Your moment"
              value={words}
              onChangeText={setWords}
              multiline
              maxLength={160}
              placeholder="Dinner tomorrow at 7:30 PM. I want to arrive relaxed."
              placeholderTextColor={T.muted}
              style={[s.input, s.words]}
            />
            {voice.error ? (
              <Text accessibilityRole="alert" style={s.body}>
                Didn't catch that. Type it or try again.
              </Text>
            ) : null}
            {button(
              "Review my moment",
              reviewWords,
              true,
              !words.trim() || voice.busy,
            )}
          </>
        ) : null}
        {screen === "mirror" && draft ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>
              HERE’S WHAT I HEARD
            </Text>
            <Text style={s.title}>Make it yours.</Text>
            {input("Moment", draft.title, (v) => field("title", v))}
            {button("This is happening now", () => {
              const now = new Date();
              setOccurringNow(true);
              setDraft((d) =>
                d
                  ? {
                      ...d,
                      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
                      time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
                    }
                  : d,
              );
            })}
            {occurringNow ? (
              <Text style={s.muted}>
                Happening now · review before sealing.
              </Text>
            ) : null}
            {input("Date · YYYY-MM-DD", draft.date, (v) => field("date", v))}
            {input("Time · HH:mm", draft.time, (v) => field("time", v))}
            {input(
              "Priority",
              draft.prepGoal,
              (v) => field("prepGoal", v),
              "How do you want to arrive?",
            )}
            <Text style={s.muted}>
              Device time zone:{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </Text>
            {next ? (
              <View style={s.row}>
                <Text style={s.eyebrow}>WHAT’S NEXT</Text>
                <Text style={s.body}>
                  {next.title} · {clock(next.startAtIso)}
                </Text>
              </View>
            ) : null}
            <Text style={s.body}>
              Anything you want handled before you go perform?
            </Text>
            {social ? (
              <>
                <Text style={s.eyebrow}>GETTING BACK</Text>
                <View style={s.choices}>
                  {(
                    ["none", "ride", "walking", "passenger", "staying"] as const
                  ).map((m, i) =>
                    button(
                      `${method === m ? "✓ " : ""}${["Nothing, I'm good", "Ride", "Walking", "Someone’s driving me", "Staying here"][i]}`,
                      () => setMethod(m),
                    ),
                  )}
                </View>
                {method !== "none"
                  ? input(
                      "Destination · Home, Hotel or saved place",
                      destination,
                      setDestination,
                      "Hotel",
                    )
                  : null}
                <Text style={s.eyebrow}>LOCAL EMERGENCY NUMBER</Text>
                <View style={s.choices}>
                  {(["911", "112", "999"] as const).map((n) =>
                    button(`${emergency === n ? "✓ " : ""}${n}`, () =>
                      setEmergency(n),
                    ),
                  )}
                </View>
                <Text style={s.muted}>
                  Check-in invitations are not enabled in this internal build.
                  Your plan stays private.
                </Text>
              </>
            ) : null}
            {button("Continue", makePlan, true)}
            {button("Edit my words", () => move("capture"))}
          </>
        ) : null}
        {screen === "plan" ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>
              YOUR PLAN · NOT SEALED YET
            </Text>
            <Text style={s.title}>Prepared for your moment.</Text>
            {steps.map((step, i) => (
              <View key={i} style={s.row}>
                <Text style={[s.eyebrow, { color: accent }]}>
                  {clock(step.atIso)}
                </Text>
                <Text style={s.body}>{step.action}</Text>
              </View>
            ))}
            <Text style={s.muted}>No reminders during Quiet.</Text>
            {method && method !== "none" ? (
              <Text style={s.body}>
                Heading back · {method} ·{" "}
                {destination || "Choose in your ride app"}
              </Text>
            ) : null}
            {button("Review & seal", () => move("seal"), true)}
            {button("Edit", () => move("mirror"))}
          </>
        ) : null}
        {screen === "seal" ? (
          <>
            <Text style={s.eyebrow}>SEAL</Text>
            <Text style={s.title}>
              Only what you approve becomes your plan.
            </Text>
            <Pressable
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Hold to seal"
              accessibilityHint="Hold for 1.2 seconds. VoiceOver users can double tap to approve this reviewed plan."
              onPressIn={startHold}
              onPressOut={cancelHold}
              onAccessibilityTap={seal}
              style={s.seal}
            >
              <Animated.View
                style={[
                  s.progress,
                  {
                    width: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
              <PreparationMark color={T.bone} size={46} />
              <Text style={s.body}>
                {saving ? "Saving…" : holding ? "Keep holding" : "Hold to seal"}
              </Text>
            </Pressable>
            <Text style={s.body}>
              Adds 1 Moment · {steps.length} preparation steps.
            </Text>
            <Text style={s.muted}>
              Quiet: no reminders. No invitations or shared status. No location
              requested. Nothing is sent to a ride provider until you open its
              app and choose your trip.
            </Text>
            {button("Review again", () => move("plan"))}
          </>
        ) : null}
        {screen === "lock" ? (
          <>
            <Text style={s.eyebrow}>SEALED</Text>
            <PreparationOrb social={social} day={day} />
            <Text style={s.title}>Your plan is yours.</Text>
            <Text style={s.body}>Go perform.</Text>
            {button(
              "Lock In",
              () =>
                transition(
                  { lockedInAtIso: new Date().toISOString() },
                  "quiet",
                ),
              true,
            )}
            {button("Open Moments", () => router.replace("/moments-tab"))}
          </>
        ) : null}
        {screen === "quiet" ? (
          <>
            <Animated.View style={{ opacity: dim }}>
              <Text style={[s.eyebrow, { color: accent }]}>LOCKED IN</Text>
              <PreparationOrb social={social} day={day} moon />
              <Text style={[s.title, { textAlign: "center" }]}>
                Go perform.
              </Text>
              <Text style={[s.muted, { textAlign: "center" }]}>
                Phone down. We'll be quiet.
              </Text>
            </Animated.View>
            {button("Plans changed?", () => move("change"))}
            {button("Heading back?", () => move("return"))}
          </>
        ) : null}
        {screen === "change" ? (
          <>
            <View style={s.safetyLine} />
            <Text style={s.eyebrow}>PLANS CHANGED</Text>
            {safetyView ? (
              <>
                <Text style={s.safetyTitle}>
                  {safety === "emergency"
                    ? "Get emergency help now."
                    : safety === "water"
                      ? "Take a break from the water."
                      : safety === "pause"
                        ? "Pause your plan. Contact someone."
                        : "AFORCE can’t assess whether you’re able to drive."}
                </Text>
                {button(
                  safety === "emergency" ? `Call ${emergency}` : "Get a ride",
                  () => {
                    if (safety === "emergency") void open(`tel:${emergency}`);
                    else move("return");
                  },
                  true,
                )}
                {button("Contact someone", () => setContactShown(true))}
                {contactShown ? (
                  <>
                    {input(
                      "Phone number",
                      contactNumber,
                      setContactNumber,
                      "+1…",
                    )}
                    {button(
                      "Call this person",
                      () => {
                        void open(
                          `tel:${contactNumber.replace(/[^+0-9]/g, "")}`,
                        );
                      },
                      false,
                      !/^\+?[0-9]{3,15}$/.test(
                        contactNumber.replace(/[ ()-]/g, ""),
                      ),
                    )}
                    <Text style={s.muted}>
                      Opens your phone app. No message or status is shared.
                    </Text>
                  </>
                ) : null}
                {button("Stay here", () => move("return"))}
              </>
            ) : (
              <>
                <Text style={s.title}>What changed?</Text>
                <TextInput
                  accessibilityLabel="What changed?"
                  value={changes}
                  onChangeText={(v) => {
                    setChanges(v);
                    if (alcoholDisclosure(v)) setAlcoholMentioned(true);
                  }}
                  multiline
                  style={s.input}
                />
                {button(
                  "Review changes",
                  () => {
                    setWords(changes);
                    setDraft(suggestMomentDraft(changes));
                    move("mirror");
                  },
                  true,
                )}
                {button("My plan is cancelled", () =>
                  transition(
                    { returnedAtIso: new Date().toISOString() },
                    "next",
                  ),
                )}
                {button("Back to Quiet", () => move("quiet"))}
              </>
            )}
            {button(`Emergency? ${emergency}`, () => {
              void open(`tel:${emergency}`);
            })}
          </>
        ) : null}
        {screen === "return" ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>HEADING BACK?</Text>
            <Text style={s.title}>Made it back.</Text>
            <Text style={s.body}>Tap once when you’re in.</Text>
            <Text style={s.muted}>Your check-in stays private.</Text>
            {current?.preparation?.destination ? (
              <Text style={s.body}>
                {current.preparation.returnMethod} ·{" "}
                {current.preparation.destination}
              </Text>
            ) : null}
            {saved?.preparation
              ? button(
                  "Made it back ✓",
                  () =>
                    transition(
                      { returnedAtIso: new Date().toISOString() },
                      "next",
                    ),
                  true,
                )
              : button("Back to my words", () => move("capture"))}
            {button("Open Uber", () => {
              void open(rideHandoffUrl("uber"));
            })}
            {button("Open Lyft", () => {
              void open(rideHandoffUrl("lyft"));
            })}
            <Text style={s.muted}>
              Choose your pickup and destination, confirm and pay in the
              provider’s app.
            </Text>
          </>
        ) : null}
        {screen === "next" ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>NEXT</Text>
            <Text style={s.title}>{momentReturnLabel(new Date())}</Text>
            {next ? (
              <Text style={s.body}>
                {next.title} · {clock(next.startAtIso)}. Let’s protect that
                first.
              </Text>
            ) : null}
            <Text style={s.body}>Did it go the way you wanted?</Text>
            {button("Yes", () => transition({ replay: "yes" }, "next"))}
            {button("Not really", () =>
              transition({ replay: "not_really" }, "next"),
            )}
            {saved?.preparation?.replay ? (
              <Text style={s.muted}>Your Replay stays private.</Text>
            ) : null}
            {button("Open Moments", () => router.replace("/moments-tab"), true)}
          </>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={s.body}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.ink },
  content: {
    paddingHorizontal: 28,
    gap: 20,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brand: { ...T.eyebrow, color: T.muted, fontSize: 10 },
  title: { ...T.headline, color: T.bone, marginTop: 16 },
  body: { ...T.body, color: T.bone },
  muted: { ...T.body, color: T.muted, fontSize: 14, lineHeight: 21 },
  eyebrow: { ...T.eyebrow, color: T.muted },
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.rule,
    borderRadius: 5,
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: T.bone,
    textAlign: "center",
  },
  disabled: { opacity: 0.4 },
  input: {
    ...T.body,
    color: T.bone,
    borderBottomWidth: 1,
    borderColor: T.rule,
    paddingVertical: 12,
    minHeight: 48,
  },
  words: { minHeight: 110, fontSize: 21, lineHeight: 29 },
  field: { gap: 6 },
  row: {
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.rule,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seal: {
    width: 210,
    height: 210,
    alignSelf: "center",
    borderRadius: 105,
    borderWidth: 2,
    borderColor: T.red,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    overflow: "hidden",
    marginVertical: 24,
  },
  progress: {
    position: "absolute",
    height: "100%",
    left: 0,
    backgroundColor: T.red,
  },
  safetyLine: { height: 2, backgroundColor: T.red },
  safetyTitle: { ...T.headline, fontSize: 28, lineHeight: 34, color: T.bone },
});
