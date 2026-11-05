import {
  preparationClosed,
  unconfirmedPreparationExpired,
} from "@/services/momentPreparationLifecycle";
import React from "react";
import { MomentProposalPrefsControl } from "./MomentProposalPrefsControl";
import { useMomentsData } from "@/components/moments/useMomentsData";
import { recordMomentProposal } from "@/services/momentNotifications";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Linking,
  Platform,
  findNodeHandle,
  useWindowDimensions,
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
import { suggestReservationDraft } from "@/services/reservationDraft";
import { evaluateMomentSafety } from "@/utils/intelligence/decisionGuard";
import {
  nextPreparationContext,
  reviewedNextPreparationContext,
  isRealPreparationMoment,
  reviewedPreparationSteps,
  preparationReviewMatches,
  preparationContextKey,
  preparationTimeZoneKey,
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
  matchesMomentSafetyConsent,
  type MomentSafetyConsent,
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
const MOMENT_REMOVED =
  "That Moment is no longer available. You can start a new plan.";
const TIME_ZONE_CHANGED =
  "Your time zone changed. Review the local date and time before sealing.";
const CALENDAR_CHANGED =
  "Calendar details changed. Review the plan again using the updated event.";
const draftForMoment = (moment: Moment): MomentDraft => {
  const at = new Date(moment.startAtIso);
  return {
    title: moment.title,
    date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`,
    time: `${at.getHours().toString().padStart(2, "0")}:${at.getMinutes().toString().padStart(2, "0")}`,
    type: moment.type,
    prepGoal: moment.prepGoal ?? "",
  };
};
const CANDIDATE_ENDED =
  "That Moment has ended. Describe what’s happening now to start a new plan.";
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
  const { fontScale } = useWindowDimensions();
  // At accessibility sizes, keep display headings closer to body size. Native
  // text scaling remains enabled, including for instructions and safety copy.
  const accessibleHeading = fontScale >= 2 ? s.accessibleHeading : undefined;
  const params = useLocalSearchParams<{
    momentId?: string;
    proposal?: string;
  }>();
  const store = useMomentsStore();
  const sharedMoments = useMomentsData();
  const [calendarChanged, setCalendarChanged] = React.useState(false);
  const [declineOptions, setDeclineOptions] = React.useState(false);
  const [nextChoice, setNextChoice] = React.useState<string | null>(null);
  const [timingOpen, setTimingOpen] = React.useState(false);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const { state: app } = useAppStore();
  const [scope] = React.useState(captureScope);
  const scrollRef = React.useRef<ScrollView>(null);
  const headingRef = React.useRef<Text>(null);
  const [screen, setScreen] = React.useState<Screen>("capture");
  const [candidateEndAt, setCandidateEndAt] = React.useState<string | null>(
    null,
  );
  const [words, setWords] = React.useState("");
  const wordsInput = React.useRef<TextInput>(null);
  const [reservationOpen, setReservationOpen] = React.useState(false);
  const [reservationText, setReservationText] = React.useState("");
  const [reservationReview, setReservationReview] = React.useState(false);
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
  const [safetyConsent, setSafetyConsent] =
    React.useState<MomentSafetyConsent | null>(null);
  const safetyPolicy = configuredMomentSafetyPolicy();
  const retainContext = matchesMomentSafetyConsent(safetyPolicy, safetyConsent);
  const attemptedConsent = React.useRef<MomentSafetyConsent | null>(null);
  const consentRef = React.useRef(safetyConsent);
  consentRef.current = safetyConsent;
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
  // Only valid, explicitly reviewed local timing can style or anchor a draft.
  // Invalid partial dates must not be normalized into invented context.
  const draftTiming = draft
    ? validateMomentDraft(draft, Number.NEGATIVE_INFINITY)
    : null;
  const draftedStart = draftTiming?.ok
    ? Date.parse(draftTiming.startAtIso)
    : NaN;
  const anchor = draftTiming?.ok
    ? { id: current?.id ?? "draft", startAtIso: draftTiming.startAtIso }
    : current;
  const day = isDayMoment(anchor ?? { startAtIso: new Date().toISOString() });
  const accent = day ? T.dayAccent : T.nightAccent;
  const next = nextPreparationContext(
    sharedMoments.surfaced,
    anchor,
    sharedMoments.nowIso,
  );
  const selectedNext = next && nextChoice === next.id ? next : null;
  const followUp = current?.preparation?.nextMoment
    ? reviewedNextPreparationContext(
        current,
        sharedMoments.surfaced,
        sharedMoments.nowIso,
      )
    : next;
  // Hold callbacks use live inputs, never the closure captured on press-in.
  const liveInputs = React.useRef({
    command: app.engineOutput.command,
    moments: sharedMoments.surfaced,
  });
  liveInputs.current = {
    command: app.engineOutput.command,
    moments: sharedMoments.surfaced,
  };
  const memberOrigin = React.useRef<string | null>(null);
  const reviewedContext = React.useRef("none");
  const reviewedTimeZone = React.useRef<string | null>(null);
  const timeZoneChanged = (moment: Moment) =>
    !reviewedTimeZone.current ||
    reviewedTimeZone.current !== preparationTimeZoneKey(moment.startAtIso);
  // Read-only provenance stays in RAM. A reviewed calendar candidate is
  // converted to an explicit manual Moment, never persisted as an import.
  const calendarOrigin = React.useRef<{ id: string; key: string } | null>(null);
  const reviewStillCurrent = (moment: Moment): boolean => {
    const live = liveInputs.current;
    return (
      !timeZoneChanged(moment) &&
      (!candidateEndAt || Date.parse(candidateEndAt) > Date.now()) &&
      (!moment.safetyContext ||
        matchesMomentSafetyConsent(
          configuredMomentSafetyPolicy(),
          safetyConsent,
        )) &&
      (!calendarOrigin.current ||
        calendarOrigin.current.key ===
          preparationContextKey(
            live.moments.find((m) => m.id === calendarOrigin.current!.id) ??
              null,
          )) &&
      preparationReviewMatches(moment, live.command, Date.now()) &&
      preparationContextKey(
        nextPreparationContext(live.moments, moment, new Date().toISOString()),
      ) === reviewedContext.current
    );
  };
  const safety = evaluateMomentSafety(
    screen === "change" ? changes : words,
    alcoholMentioned || activeAlcoholContext(current),
  );
  // A new lifecycle view starts at its heading. Editing within a view must not
  // steal focus from fields. A newly revealed safety screen is its own view.
  const focusKey =
    screen === "change"
      ? `${screen}:${safety ?? "edit"}`
      : screen === "capture"
        ? `${screen}:${reservationOpen}`
        : screen;
  React.useEffect(() => {
    let cancelled = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") {
      headingRef.current?.focus();
    } else {
      void AccessibilityInfo.isScreenReaderEnabled()
        .then((enabled) => {
          if (!enabled || cancelled || !headingRef.current) return;
          const node = findNodeHandle(headingRef.current);
          if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
        })
        .catch(() => {
          /* Accessibility availability never blocks the plan. */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [focusKey]);
  const headingProps = {
    ref: headingRef,
    accessible: true,
    accessibilityRole: "header" as const,
    ...(Platform.OS === "web" ? { tabIndex: -1 as const } : {}),
  };
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
    const id = memberOrigin.current;
    if (
      !id ||
      !store.hydrated ||
      busy.current ||
      store.moments.some((m) => m.id === id)
    )
      return;
    // The store owns deletion. Do not let a cached view or delayed Prepare
    // acknowledgement keep its words, private context or lifecycle alive.
    memberOrigin.current = null;
    calendarOrigin.current = null;
    cancelHold();
    voice.cancel();
    setReview(null);
    setDraft(null);
    setWords("");
    setChanges("");
    setAlcoholMentioned(false);
    setSafetyConsent(null);
    attemptedConsent.current = null;
    setCandidateEndAt(null);
    setCalendarChanged(false);
    setNextChoice(null);
    setMethod(null);
    setDestination("");
    setContactShown(false);
    setContactNumber("");
    setReservationText("");
    setReservationOpen(false);
    setReservationReview(false);
    setScreen("capture");
    setError(MOMENT_REMOVED);
  }, [store.hydrated, store.moments, saving, cancelHold, voice.cancel]);
  React.useEffect(() => {
    if (
      !saved?.preparation ||
      !preparationClosed(saved.preparation) ||
      busy.current ||
      JSON.stringify(review) === JSON.stringify(saved)
    )
      return;
    // Another shared surface can close this Moment while this view is open.
    // Follow that acknowledged outcome; never offer an old Quiet/Return action.
    cancelHold();
    voice.cancel();
    setReview(saved);
    setDraft(null);
    setWords("");
    setChanges("");
    setAlcoholMentioned(false);
    setSafetyConsent(null);
    setContactShown(false);
    setContactNumber("");
    setCandidateEndAt(null);
    setScreen("next");
    setError("");
  }, [saved, saving, cancelHold, voice.cancel]);
  React.useEffect(() => {
    const origin = calendarOrigin.current;
    if (!origin || busy.current) return;
    const visible = sharedMoments.surfaced.find((m) => m.id === origin.id);
    if (
      visible &&
      visible.source === "calendar" &&
      isRealPreparationMoment(visible) &&
      !visible.masked &&
      !visible.preparedAtIso &&
      visible.title.trim() &&
      !unconfirmedPreparationExpired(visible, Date.now())
    ) {
      if (
        preparationContextKey(visible) !== origin.key &&
        screen === "noticed"
      ) {
        // No review has been accepted yet: keep the proposal current without
        // advancing it. A pending Prepare still compares its clicked snapshot.
        calendarOrigin.current = {
          id: visible.id,
          key: preparationContextKey(visible),
        };
        setReview(visible);
        setCandidateEndAt(
          visible.endAtIso &&
            Number.isFinite(Date.parse(visible.endAtIso)) &&
            Date.parse(visible.endAtIso) > Date.parse(visible.startAtIso)
            ? visible.endAtIso
            : null,
        );
        return;
      }
      if (
        preparationContextKey(visible) !== origin.key &&
        visible.endAtIso &&
        Number.isFinite(Date.parse(visible.endAtIso)) &&
        Date.parse(visible.endAtIso) > Date.parse(visible.startAtIso) &&
        (!candidateEndAt ||
          Date.parse(visible.endAtIso) < Date.parse(candidateEndAt))
      ) {
        // An earlier source end can narrow validity immediately. An extension
        // only becomes the reviewed deadline after the member accepts it.
        setCandidateEndAt(visible.endAtIso);
      }
      if (preparationContextKey(visible) !== origin.key && !calendarChanged) {
        cancelHold();
        setCalendarChanged(true);
        setDraft(
          (previous) => previous ?? (current ? draftForMoment(current) : null),
        );
        setScreen("mirror");
        setError(CALENDAR_CHANGED);
      }
      return;
    }
    // Revoked calendar access, masking, or cancellation cannot leave a readable
    // source candidate on screen or allow it to be committed later.
    calendarOrigin.current = null;
    setCalendarChanged(false);
    setCandidateEndAt(null);
    cancelHold();
    setReview(null);
    setDraft(null);
    setNextChoice(null);
    setWords("");
    setMethod(null);
    setDestination("");
    setScreen("capture");
    setError(
      visible && unconfirmedPreparationExpired(visible, Date.now())
        ? CANDIDATE_ENDED
        : "That calendar event is no longer available. You can type a new Moment.",
    );
  }, [
    sharedMoments.surfaced,
    cancelHold,
    saving,
    calendarChanged,
    screen,
    candidateEndAt,
  ]);
  React.useEffect(() => {
    if (resumed || !store.hydrated) return;
    setResumed(true);
    const existing = params.momentId
      ? (store.moments.find((m) => m.id === params.momentId) ??
        sharedMoments.surfaced.find(
          (m) =>
            m.id === params.momentId &&
            m.source === "calendar" &&
            !m.masked &&
            m.title.trim(),
        ))
      : store.moments.find(
          (m) =>
            m.preparation?.context === context &&
            !preparationClosed(m.preparation),
        );
    if (existing && unconfirmedPreparationExpired(existing, Date.now())) {
      setError(CANDIDATE_ENDED);
      return;
    }
    if (!existing || !isRealPreparationMoment(existing)) {
      const previous = [...store.moments]
        .filter(
          (m) =>
            !!m.preparation?.sealedAtIso && m.preparation.context === context,
        )
        .sort(
          (a, b) =>
            Date.parse(b.preparation!.sealedAtIso) -
            Date.parse(a.preparation!.sealedAtIso),
        )[0]?.preparation;
      if (previous) {
        setMethod(previous.returnMethod);
        setDestination(previous.destination);
        setEmergency(previous.emergencyNumber);
      }
      return;
    }
    if (existing.source !== "calendar") memberOrigin.current = existing.id;
    if (existing.source === "calendar") {
      calendarOrigin.current = {
        id: existing.id,
        key: preparationContextKey(existing),
      };
    }
    setCandidateEndAt(
      !existing.preparation?.sealedAtIso &&
        existing.endAtIso &&
        Number.isFinite(Date.parse(existing.endAtIso)) &&
        Date.parse(existing.endAtIso) > Date.parse(existing.startAtIso)
        ? existing.endAtIso
        : null,
    );
    setReview(existing);
    if (existing.preparation) {
      setMethod(existing.preparation.returnMethod);
      setDestination(existing.preparation.destination);
      setEmergency(existing.preparation.emergencyNumber);
      setScreen(
        preparationClosed(existing.preparation)
          ? "next"
          : existing.preparation.lockedInAtIso
            ? "quiet"
            : "lock",
      );
    } else setScreen("noticed");
  }, [
    store.hydrated,
    store.moments,
    sharedMoments.surfaced,
    params.momentId,
    resumed,
    context,
  ]);
  React.useEffect(() => {
    if (!candidateEndAt || current?.preparation?.sealedAtIso) return;
    const end = Date.parse(candidateEndAt);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const remaining = end - Date.now();
      if (remaining > 0) {
        timer = setTimeout(check, Math.min(remaining, 2147483647));
        return;
      }
      // An approval already awaiting durable acknowledgement must resolve
      // honestly. Failure rechecks this deadline when saving becomes false.
      if (busy.current) return;
      cancelHold();
      voice.cancel();
      calendarOrigin.current = null;
      setCalendarChanged(false);
      setCandidateEndAt(null);
      setReview(null);
      setDraft(null);
      setNextChoice(null);
      setScreen("capture");
      setError(CANDIDATE_ENDED);
    };
    check();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    candidateEndAt,
    current?.preparation?.sealedAtIso,
    saving,
    cancelHold,
    voice.cancel,
  ]);
  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") pruneMomentSafetyContext();
      if (s !== "active") {
        cancelHold();
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
  React.useEffect(() => {
    if (screen !== "noticed" || !current || params.proposal !== "1") return;
    const token = captureScope();
    void recordMomentProposal(current, "shown").catch(() => {
      if (isScopeCurrent(token))
        setError(
          "Could not remember this suggestion. Your Moment is unchanged.",
        );
    });
  }, [screen, current?.id, params.proposal]);
  const proposalResponse = async (
    outcome: "accepted" | "declined",
    neverType = false,
  ): Promise<boolean> => {
    if (!current || !allowed()) return false;
    if (params.proposal !== "1" && !neverType) return true;
    setSaving(true);
    try {
      await recordMomentProposal(current, outcome, neverType);
      return allowed();
    } catch {
      if (allowed())
        setError("Could not save that preference. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };
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
    setCandidateEndAt(null);
    setCalendarChanged(false);
    setReservationReview(false);
    setReservationOpen(false);
    setReservationText("");
    voice.cancel();
    setNextChoice(null);
    setTimingOpen(false);
    setReturnOpen(false);
    if (calendarOrigin.current) {
      calendarOrigin.current = null;
      setReview(null);
    }
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
      setTimingOpen(true);
      setError(result.error);
      return;
    }
    const disclosed =
      alcoholMentioned ||
      alcoholDisclosure(words) ||
      alcoholDisclosure(draft.title);
    if (alcoholDisclosure(draft.title) || alcoholDisclosure(draft.prepGoal)) {
      setError(
        "Use a Moment name and priority without alcohol details. That context stays separate and temporary.",
      );
      return;
    }
    const policy = configuredMomentSafetyPolicy();
    if (calendarOrigin.current) {
      const origin = sharedMoments.surfaced.find(
        (m) => m.id === calendarOrigin.current!.id,
      );
      if (!origin || origin.masked) {
        setError(
          "That calendar event is no longer available. Start a new Moment to choose your own plan.",
        );
        return;
      }
      if (
        calendarChanged ||
        preparationContextKey(origin) !== calendarOrigin.current.key
      ) {
        setCalendarChanged(true);
        setError(CALENDAR_CHANGED);
        return;
      }
      if (unconfirmedPreparationExpired(origin, Date.now())) {
        setError(CANDIDATE_ENDED);
        return;
      }
    }
    let moment =
      review && review.source !== "calendar"
        ? review
        : createConfirmedMoment(draft, result.startAtIso);
    if (calendarOrigin.current) {
      const origin = sharedMoments.surfaced.find(
        (m) => m.id === calendarOrigin.current!.id,
      )!;
      moment = {
        ...moment,
        calendarSource: {
          eventId: origin.calendarEventId ?? origin.id,
          startAtIso: origin.startAtIso,
        },
      };
    }
    if (
      disclosed &&
      policy &&
      matchesMomentSafetyConsent(policy, safetyConsent)
    ) {
      moment = withAlcoholContext(moment, policy, safetyConsent);
      attemptedConsent.current = safetyConsent;
    } else moment = { ...moment, safetyContext: undefined };
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
      { happeningNow: occurringNow },
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
      ...(selectedNext
        ? {
            nextMoment: {
              id: selectedNext.id,
              startAtIso: selectedNext.startAtIso,
            },
          }
        : {}),
      steps,
      policyVersion: PREPARATION_POLICY_VERSION,
    };
    reviewedContext.current = preparationContextKey(
      nextPreparationContext(
        sharedMoments.surfaced,
        updated,
        new Date().toISOString(),
      ),
    );
    reviewedTimeZone.current = preparationTimeZoneKey(updated.startAtIso);
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
        : commitReviewedMoment(
            moment,
            expected,
            target === "lock" ? () => reviewStillCurrent(moment) : undefined,
          ));
      if (!allowed()) return;
      if (target === "lock") {
        calendarOrigin.current = null;
        setCandidateEndAt(null);
      }
      memberOrigin.current = result.id;
      setReview(result);
      move(target);
      if (target === "lock") hapticImpact("medium");
    } catch {
      if (allowed()) {
        if (target === "lock" && !reviewStillCurrent(moment)) {
          move("mirror");
          if (timeZoneChanged(moment)) setTimingOpen(true);
        }
        setError(
          target === "lock"
            ? timeZoneChanged(moment)
              ? TIME_ZONE_CHANGED
              : "Not sealed yet. Review your plan and try again."
            : target === "quiet"
              ? "Could not enter Quiet. Please try Lock In again."
              : "Could not save that change. Please try again.",
        );
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const seal = () => {
    if (!review?.preparation) return;
    const p = review.preparation;
    if (!reviewStillCurrent(review)) {
      move("mirror");
      if (timeZoneChanged(review)) setTimingOpen(true);
      setError(
        timeZoneChanged(review)
          ? TIME_ZONE_CHANGED
          : "Your preparation or upcoming context changed. Review the plan again before sealing.",
      );
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
    const base =
      patch.returnedAtIso || patch.cancelledAtIso
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
      aria-disabled={disabled || saving}
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
      preparationClosed(saved.preparation) ||
      !alcoholMentioned ||
      !retainContext ||
      attemptedConsent.current === safetyConsent ||
      activeAlcoholContext(saved) ||
      !allowed()
    )
      return;
    const policy = configuredMomentSafetyPolicy();
    if (!policy || !matchesMomentSafetyConsent(policy, safetyConsent)) return;
    const token = captureScope();
    let stale = false;
    attemptedConsent.current = safetyConsent;
    void commitReviewedMoment(
      {
        ...withAlcoholContext(saved, policy, safetyConsent),
        preparation: { ...saved.preparation, transactionId: transaction() },
      },
      saved,
    )
      .then(async (result) => {
        // Withdrawal while an acknowledged write was in flight queues a clear;
        // optimistic concurrency cannot overwrite a later Return or plan edit.
        if (
          isScopeCurrent(token) &&
          !matchesMomentSafetyConsent(
            configuredMomentSafetyPolicy(),
            consentRef.current,
          )
        ) {
          await commitReviewedMoment(
            {
              ...result,
              safetyContext: undefined,
              preparation: {
                ...result.preparation!,
                transactionId: transaction(),
              },
            },
            result,
          );
        }
      })
      .catch(() => {
        if (!stale && isScopeCurrent(token))
          setError(
            "Could not retain this context after a restart. Keep this screen open for safety options.",
          );
      });
    return () => {
      stale = true;
    };
  }, [saved, alcoholMentioned, retainContext, safetyConsent]);
  const clearPrivateContext = () => {
    consentRef.current = null;
    setSafetyConsent(null);
    setAlcoholMentioned(true);
    if (saved?.preparation && saved.safetyContext) {
      void commit(
        {
          ...saved,
          safetyContext: undefined,
          preparation: { ...saved.preparation, transactionId: transaction() },
        },
        saved,
        screen,
      );
    }
  };
  const contextControl =
    alcoholMentioned || activeAlcoholContext(current) ? (
      <View style={s.row}>
        {safetyPolicy ? (
          <>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`I am at least ${safetyPolicy.minimumAge} and want to retain this private context for ${safetyPolicy.retentionHours} ${safetyPolicy.retentionHours === 1 ? "hour" : "hours"}`}
              accessibilityState={{ checked: retainContext, disabled: saving }}
              aria-checked={retainContext}
              aria-disabled={saving}
              disabled={saving}
              onPress={() => {
                if (retainContext) clearPrivateContext();
                else {
                  consentRef.current = { ...safetyPolicy };
                  setSafetyConsent(consentRef.current);
                }
              }}
              style={s.button}
            >
              <Text style={s.buttonText}>
                {retainContext ? "✓ " : ""}I am at least{" "}
                {safetyPolicy.minimumAge} and want to retain this private
                context for {safetyPolicy.retentionHours}{" "}
                {safetyPolicy.retentionHours === 1 ? "hour" : "hours"}.
              </Text>
            </Pressable>
            <Text style={s.muted}>
              Region: {safetyPolicy.region}. This is a self-confirmation, not
              identity verification.
            </Text>
          </>
        ) : null}
        {activeAlcoholContext(saved)
          ? button("Clear private context", clearPrivateContext)
          : null}
        <Text style={s.muted}>
          {retainContext
            ? "Private context expires automatically and clears when you return."
            : activeAlcoholContext(saved)
              ? "Previously confirmed private context remains until expiry or Return. You can clear it now."
              : "Without confirmation, alcohol context is not retained after this session. You can still save your plan and use safety options now."}{" "}
          Expiry never means you are able to drive.
        </Text>
      </View>
    ) : null;
  return (
    <View
      style={[s.root, screen === "quiet" && { backgroundColor: T.midnight }]}
    >
      <ScrollView
        ref={scrollRef}
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
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              {current.title}?
            </Text>
            <Text style={s.body}>
              {clock(current.startAtIso)}. Want me to prepare around it?
            </Text>
            {button(
              "Prepare",
              async () => {
                if (!(await proposalResponse("accepted"))) return;
                if (
                  current.source !== "calendar" &&
                  (memberOrigin.current !== current.id ||
                    !liveInputs.current.moments.some(
                      (m) => m.id === current.id,
                    ))
                )
                  return;
                if (current.source === "calendar") {
                  const latest = liveInputs.current.moments.find(
                    (m) => m.id === current.id,
                  );
                  if (
                    !latest ||
                    latest.source !== "calendar" ||
                    latest.masked ||
                    !!latest.preparedAtIso ||
                    !latest.title.trim() ||
                    unconfirmedPreparationExpired(latest, Date.now())
                  ) {
                    calendarOrigin.current = null;
                    setCalendarChanged(false);
                    setCandidateEndAt(null);
                    setReview(null);
                    move("capture");
                    setError(
                      latest &&
                        unconfirmedPreparationExpired(latest, Date.now())
                        ? CANDIDATE_ENDED
                        : "That calendar event is no longer available. You can type a new Moment.",
                    );
                    return;
                  }
                  if (
                    preparationContextKey(latest) !==
                    preparationContextKey(current)
                  ) {
                    calendarOrigin.current = {
                      id: current.id,
                      key: preparationContextKey(current),
                    };
                    setDraft(draftForMoment(current));
                    setCalendarChanged(true);
                    move("mirror");
                    setError(CALENDAR_CHANGED);
                    return;
                  }
                }
                if (unconfirmedPreparationExpired(current, Date.now())) {
                  setCandidateEndAt(null);
                  setReview(null);
                  move("capture");
                  setError(CANDIDATE_ENDED);
                  return;
                }
                setDraft(draftForMoment(current));
                move("mirror");
              },
              true,
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not this one"
              accessibilityHint="Long press for more suggestion preferences"
              disabled={saving}
              onLongPress={() => setDeclineOptions(true)}
              onPress={() => {
                void proposalResponse("declined").then((ok) => {
                  if (ok) router.back();
                });
              }}
              style={s.button}
            >
              <Text style={s.buttonText}>Not this one</Text>
            </Pressable>
            {button("Suggestion options", () => setDeclineOptions((v) => !v))}
            {declineOptions ? (
              <>
                <Text style={s.muted}>
                  Stop preparation suggestions for {current.type} Moments. You
                  can still prepare manually.
                </Text>
                {button("Never for things like this", () => {
                  void proposalResponse("declined", true).then((ok) => {
                    if (ok) router.back();
                  });
                })}
              </>
            ) : null}
          </>
        ) : null}
        {screen === "capture" ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>
              {social ? "SOCIAL ONE BREATH" : "ONE BREATH"}
            </Text>
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              What would make {day ? "today" : "tonight"} go well?
            </Text>
            {error === CANDIDATE_ENDED || error === MOMENT_REMOVED ? (
              <Text accessibilityRole="alert" style={s.body}>
                {error}
              </Text>
            ) : null}
            {!reservationOpen ? (
              <>
                {voice.available ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      voice.listening ? "Stop listening" : "Speak your moment"
                    }
                    onPress={() => {
                      if (voice.busy) voice.stop();
                      else void voice.start();
                    }}
                    onAccessibilityTap={() => {
                      if (voice.busy) voice.stop();
                      else void voice.start();
                    }}
                  >
                    <PreparationOrb social={social} day={false} />
                  </Pressable>
                ) : (
                  <PreparationOrb social={social} day={false} />
                )}
                <Text style={s.muted}>
                  {voice.available
                    ? voice.listening
                      ? "Listening… Tap to stop."
                      : voice.busy
                        ? "Starting voice… Tap to cancel."
                        : "Tap to speak · or type"
                    : "Type your moment"}
                </Text>
                {button(voice.available ? "Type instead" : "Type your moment", () => {
                  voice.cancel();
                  wordsInput.current?.focus();
                })}
                <Text style={s.muted}>Your moment</Text>
                <TextInput
                  ref={wordsInput}
                  accessibilityLabel="Your moment"
                  value={words}
                  onFocus={voice.cancel}
                  onChangeText={(value) => {
                    voice.cancel();
                    setWords(value);
                  }}
                  multiline
                  maxLength={160}
                  placeholder="Dinner tomorrow at 7:30 PM. I want to arrive relaxed."
                  placeholderTextColor={T.muted}
                  style={[s.input, s.words]}
                />
                {voice.error ? (
                  <Text accessibilityRole="alert" style={s.body}>
                    {voice.error}
                  </Text>
                ) : null}
                {button(
                  "Review my moment",
                  reviewWords,
                  true,
                  !words.trim() || voice.busy,
                )}
                {button("Use reservation details", () => {
                  voice.cancel();
                  setReservationOpen(true);
                })}
              </>
            ) : null}
            {reservationOpen ? (
              <>
                <Text style={s.muted}>
                  Paste the restaurant or event, date and time using labels such
                  as Restaurant:, Date: and Time:. Review the local time before
                  sealing. No booking is checked or changed.
                </Text>
                <TextInput
                  accessibilityLabel="Reservation details"
                  value={reservationText}
                  onChangeText={setReservationText}
                  multiline
                  maxLength={4000}
                  placeholder={
                    "Restaurant: Lilia\nDate: November 6, 2026\nTime: 7:30 PM"
                  }
                  placeholderTextColor={T.muted}
                  style={[s.input, s.words]}
                />
                {button(
                  "Review reservation",
                  () => {
                    const candidate = suggestReservationDraft(reservationText);
                    calendarOrigin.current = null;
                    setCalendarChanged(false);
                    setCandidateEndAt(null);
                    setReview(null);
                    setWords("");
                    setNextChoice(null);
                    setOccurringNow(false);
                    setDraft(candidate);
                    setTimingOpen(true);
                    setReturnOpen(false);
                    setReservationText("");
                    setReservationOpen(false);
                    setReservationReview(true);
                    move("mirror");
                  },
                  true,
                  !reservationText.trim(),
                )}
                {button("Cancel reservation details", () => {
                  setReservationText("");
                  setReservationOpen(false);
                })}
              </>
            ) : null}
            <MomentProposalPrefsControl />
          </>
        ) : null}
        {screen === "mirror" && draft ? (
          <>
            <Text {...headingProps} style={[s.eyebrow, { color: accent }]}>
              HERE’S WHAT I HEARD
            </Text>
            {error && !(calendarChanged && error === CALENDAR_CHANGED) ? (
              <Text accessibilityRole="alert" style={s.body}>
                {error}
              </Text>
            ) : null}
            {calendarChanged ? (
              <View style={s.row}>
                <Text accessibilityRole="alert" style={s.body}>
                  {CALENDAR_CHANGED}
                </Text>
                <Text style={s.muted}>
                  Reviewing the update replaces this draft with the latest event
                  details.
                </Text>
                {button(
                  "Review updated event",
                  () => {
                    if (!allowed()) {
                      setError(
                        "Your account changed. Close this plan and start again.",
                      );
                      return;
                    }
                    const latest = liveInputs.current.moments.find(
                      (m) => m.id === calendarOrigin.current?.id,
                    );
                    if (
                      !latest ||
                      latest.source !== "calendar" ||
                      latest.masked ||
                      !!latest.preparedAtIso ||
                      !latest.title.trim() ||
                      !isRealPreparationMoment(latest)
                    ) {
                      setError(
                        "That calendar event is no longer available. Start a new Moment.",
                      );
                      return;
                    }
                    if (unconfirmedPreparationExpired(latest, Date.now())) {
                      calendarOrigin.current = null;
                      setCalendarChanged(false);
                      setCandidateEndAt(null);
                      setReview(null);
                      setDraft(null);
                      move("capture");
                      setError(CANDIDATE_ENDED);
                      return;
                    }
                    calendarOrigin.current = {
                      id: latest.id,
                      key: preparationContextKey(latest),
                    };
                    setDraft(draftForMoment(latest));
                    setReview(latest);
                    setCandidateEndAt(
                      latest.endAtIso &&
                        Number.isFinite(Date.parse(latest.endAtIso)) &&
                        Date.parse(latest.endAtIso) >
                          Date.parse(latest.startAtIso)
                        ? latest.endAtIso
                        : null,
                    );
                    setOccurringNow(false);
                    setNextChoice(null);
                    setTimingOpen(true);
                    setCalendarChanged(false);
                    setError("");
                  },
                  true,
                )}
              </View>
            ) : null}
            {reservationReview ? (
              <Text style={s.muted}>
                Reservation details · confirm the name, date and local time.
                Only reviewed fields are saved at Seal. The pasted confirmation
                is discarded.
              </Text>
            ) : null}
            {input("Moment", draft.title, (v) => field("title", v))}
            {calendarOrigin.current ? (
              <Text style={s.muted}>
                Calendar suggestion · review the details. Only the plan you
                confirm is saved.
              </Text>
            ) : null}

            {!timingOpen && Number.isFinite(draftedStart) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit date and time"
                accessibilityState={{ expanded: false }}
                aria-expanded={false}
                onPress={() => setTimingOpen(true)}
                style={s.row}
              >
                <Text style={s.eyebrow}>WHEN</Text>
                <Text style={s.body}>
                  {occurringNow ? "Happening now · " : ""}
                  {new Date(draftedStart).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  })}{" "}
                  · Edit
                </Text>
              </Pressable>
            ) : (
              <>
                {button("This is happening now", () => {
                  const now = new Date();
                  setError("");
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
                {input("Date · YYYY-MM-DD", draft.date, (v) =>
                  field("date", v),
                )}
                {input("Time · HH:mm", draft.time, (v) => field("time", v))}
                <Text style={s.muted}>
                  Device time zone:{" "}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </Text>
                {Number.isFinite(draftedStart)
                  ? button("Done editing time", () => setTimingOpen(false))
                  : null}
              </>
            )}
            {input(
              "Priority",
              draft.prepGoal,
              (v) => field("prepGoal", v),
              "How do you want to arrive?",
            )}
            {next ? (
              <View style={s.row}>
                <Text style={s.eyebrow}>WHAT’S NEXT</Text>
                <Text style={s.body}>
                  {next.title} ·{" "}
                  {new Date(next.startAtIso).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Include this next Moment in my plan"
                  accessibilityState={{
                    checked: !!selectedNext,
                    disabled: saving,
                  }}
                  aria-checked={!!selectedNext}
                  aria-disabled={saving}
                  disabled={saving}
                  onPress={() => setNextChoice(selectedNext ? null : next.id)}
                  style={s.button}
                >
                  <Text style={s.buttonText}>
                    {selectedNext ? "✓ " : ""}Plan around this Moment
                  </Text>
                </Pressable>
                <Text style={s.muted}>
                  Review its current guidance after you return. No extra
                  reminders.
                </Text>
              </View>
            ) : null}
            <Text style={s.body}>
              Anything you want handled before you go perform?
            </Text>
            {social ? (
              <>
                <Text style={s.eyebrow}>GETTING BACK</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose getting-back plan"
                  accessibilityState={{ expanded: returnOpen }}
                  aria-expanded={returnOpen}
                  onPress={() => setReturnOpen((open) => !open)}
                  style={s.button}
                >
                  <Text style={s.buttonText}>
                    {method
                      ? {
                          none: "Nothing, I'm good",
                          ride: "Ride",
                          walking: "Walking",
                          passenger: "Someone’s driving me",
                          staying: "Staying here",
                        }[method]
                      : "Choose"}
                    {method && method !== "none" && destination
                      ? ` · ${destination}`
                      : ""}
                  </Text>
                </Pressable>
                {returnOpen ? (
                  <>
                    <View style={s.choices}>
                      {(
                        [
                          "none",
                          "ride",
                          "walking",
                          "passenger",
                          "staying",
                        ] as const
                      ).map((m, i) =>
                        button(
                          `${method === m ? "✓ " : ""}${["Nothing, I'm good", "Ride", "Walking", "Someone’s driving me", "Staying here"][i]}`,
                          () => setMethod(m),
                        ),
                      )}
                    </View>
                    {method && method !== "none"
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
                    {button("Done choosing return", () => setReturnOpen(false))}
                  </>
                ) : null}
                <Text style={s.muted}>Your plan stays private.</Text>
              </>
            ) : null}
            {contextControl}
            {button("Continue", makePlan, true, calendarChanged)}
            {button("Edit my words", () => move("capture"))}
          </>
        ) : null}
        {screen === "plan" ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>
              YOUR PLAN · NOT SEALED YET
            </Text>
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              Prepared for your moment.
            </Text>
            {current?.preparation?.nextMoment && next ? (
              <Text style={s.body}>
                Next in your plan · {next.title} ·{" "}
                {new Date(next.startAtIso).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            ) : null}
            {steps.map((step, i) => (
              <View key={i} style={s.row}>
                <Text style={[s.eyebrow, { color: accent }]}>
                  {clock(step.atIso)}
                </Text>
                <Text style={s.body}>{step.action}</Text>
              </View>
            ))}
            {!steps.some((step) => step.commandId) ? (
              <Text style={s.muted}>
                Check your current guidance when you’re ready to prepare.
              </Text>
            ) : null}
            <Text style={s.muted}>No reminders during Quiet.</Text>
            {method && method !== "none" ? (
              <Text style={s.body}>
                Heading back · {method} ·{" "}
                {destination || "Choose in your ride app"}
              </Text>
            ) : null}
            {alcoholMentioned ? (
              <Text style={s.muted}>
                {current?.safetyContext
                  ? "Private context retained under your age and retention confirmation."
                  : "Alcohol context will not be retained after this session."}
              </Text>
            ) : null}
            {button("Review & seal", () => move("seal"), true)}
            {button("Edit", () => move("mirror"))}
          </>
        ) : null}
        {screen === "seal" ? (
          <>
            <Text style={s.eyebrow}>SEAL</Text>
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              Only what you approve becomes your plan.
            </Text>
            <Pressable
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Hold to seal"
              accessibilityState={{ disabled: saving, busy: saving }}
              aria-disabled={saving}
              aria-busy={saving}
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
              {saved ? "Updates" : "Adds"} 1 Moment · {steps.length} preparation steps.
            </Text>
            {current?.preparation?.nextMoment && next ? (
              <Text style={s.body}>
                Next · {next.title}. Adds no extra Moment or reminder.
              </Text>
            ) : null}
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
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              Your plan is yours.
            </Text>
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
              <Text
                {...headingProps}
                style={[s.title, { textAlign: "center" }]}
              >
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
                <Text {...headingProps} style={[s.safetyTitle, accessibleHeading]}>
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
                <Text {...headingProps} style={[s.title, accessibleHeading]}>
                  What changed?
                </Text>
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
                    { cancelledAtIso: new Date().toISOString() },
                    "next",
                  ),
                )}
                {button("Back to Quiet", () => move("quiet"))}
              </>
            )}
            {contextControl}
            {button(`Emergency? ${emergency}`, () => {
              void open(`tel:${emergency}`);
            })}
          </>
        ) : null}
        {screen === "return" ? (
          <>
            <Text style={[s.eyebrow, { color: accent }]}>HEADING BACK?</Text>
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              Made it back.
            </Text>
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
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              {current?.preparation?.cancelledAtIso
                ? "Plan cancelled."
                : momentReturnLabel(new Date())}
            </Text>
            {current?.preparation?.cancelledAtIso ? (
              <Text style={s.muted}>
                Your plan has ended. This does not record a return or check-in.
              </Text>
            ) : null}
            {followUp ? (
              <>
                <Text style={s.body}>
                  {followUp.title} ·{" "}
                  {new Date(followUp.startAtIso).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                {button(
                  "Prepare this Moment",
                  () => {
                    if (!current) return;
                    if (!allowed()) {
                      setError(
                        "Your account changed. Close this plan and start again.",
                      );
                      return;
                    }
                    const live = liveInputs.current;
                    const fresh = current.preparation?.nextMoment
                      ? reviewedNextPreparationContext(
                          current,
                          live.moments,
                          new Date().toISOString(),
                        )
                      : nextPreparationContext(
                          live.moments,
                          current,
                          new Date().toISOString(),
                        );
                    if (
                      !fresh ||
                      fresh.id !== followUp.id ||
                      fresh.startAtIso !== followUp.startAtIso
                    ) {
                      setError(
                        "That Moment changed. Open Moments to review it.",
                      );
                      return;
                    }
                    router.replace({
                      pathname: "/one-breath",
                      params: { momentId: fresh.id },
                    });
                  },
                  true,
                )}
              </>
            ) : current?.preparation?.nextMoment ? (
              <Text style={s.muted}>
                Your chosen next Moment is no longer available at the reviewed
                time. Open Moments to choose again.
              </Text>
            ) : null}
            {!current?.preparation?.cancelledAtIso ? (
              <>
                <Text style={s.body}>Did it go the way you wanted?</Text>
                {button("Yes", () => transition({ replay: "yes" }, "next"))}
                {button("Not really", () =>
                  transition({ replay: "not_really" }, "next"),
                )}
                {saved?.preparation?.replay ? (
                  <Text style={s.muted}>Your Replay stays private.</Text>
                ) : null}
              </>
            ) : null}
            {button(
              "Open Moments",
              () => router.replace("/moments-tab"),
              !followUp,
            )}
          </>
        ) : null}
        {error &&
        !(
          screen === "capture" &&
          (error === CANDIDATE_ENDED || error === MOMENT_REMOVED)
        ) &&
        screen !== "mirror" ? (
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
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brand: { ...T.eyebrow, color: T.muted, fontSize: 10 },
  title: { ...T.headline, color: T.bone, marginTop: 16 },
  accessibleHeading: { fontSize: 18, lineHeight: 24, letterSpacing: 0 },
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
  words: {
    minHeight: 110,
    fontSize: 21,
    lineHeight: 29,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 14,
  },
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
