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
import { WorldPhotoGap, WorldPhotoHero } from "@/components/world/WorldPhoto";
import { worldBreathPhotoForMoment, worldPhoto } from "@/components/world/worldPhotoSources";
import { REPLAY_SCENE } from "@/utils/worldPhoto";
import {
  REPLAY_ANSWERS,
  REPLAY_NOTE_MAX,
  cleanReplayNote,
  replayNoteLine,
  replayObstacleOptions,
  replayStep,
  type ReplayAnswer,
  type ReplayObstacle,
} from "@/utils/replayFollowUp";
import {
  approveLessonFromReplay,
  hydrateMomentLessons,
  lessonForMoment,
  useMomentLessons,
} from "@/services/momentLessons";
import { lessonScopeLabel, planLessonOffers, togglePlanLesson } from "@/utils/lessonPresentation";
import { MOMENT_LESSON_TEXT_MAX } from "@/config/hydroStateModel";
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
import {
  suggestMomentDraft,
  suggestTimeQuestion,
  type TimeQuestion,
} from "@/services/oneBreathDraft";
import { exerciseRow, workoutFocus } from "@/utils/oneBreath/workoutFocus";
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
import { MomentTimingPicker } from "./MomentTimingPicker";
import { OneBreathCapture } from "./OneBreathCapture";
import { SealRing } from "./SealRing";
import { ORB_HIDDEN_PREPARATION_SCREENS, useHideOrbWhile } from "@/services/orbVisibility";
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
import { speak, stopSpeaking } from "@/services/textToSpeech";
import {
  beginReadBack,
  classifyUtterance,
  heard,
  initialWindow,
  planReadBack,
  readBackDurationMs,
  readBackFinished,
  sealedByHold,
  tick,
  windowEndLine,
  windowOpenLine,
  windowStrip,
  type WindowState,
} from "@/utils/oneBreath/confirmationWindow";
import { changedDate, changedTime } from "@/utils/oneBreath/timeChange";
import { screenAnswer, type ScreenAnswer } from "@/utils/oneBreath/screenAnswer";
import { OneBreathStatusAnswer } from "./OneBreathStatusAnswer";
import { isTripSentence } from "@/utils/travel/tripWords";
import { travelPilotAvailable } from "@/featureFlags/flags";
import {
  LOCK_IN_NOT_YET,
  lockInOpensInMs,
} from "@/utils/oneBreath/lockInWindow";
import { ONE_BREATH_SEAL_UNDO_MS } from "@/config/hydroStateModel";

/** The screens that sit on the Moment's photograph: from understood to Quiet. */
const BREATH_SCENE_SCREENS: readonly string[] = ["mirror", "plan", "seal", "lock", "quiet"];

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
  // Replay: where the member is on screen before anything is saved.
  const [replayEditing, setReplayEditing] = React.useState<"ask" | "other" | "rule" | null>(null);
  const [replayRuleText, setReplayRuleText] = React.useState("");
  // The member's own lessons, on this phone only.
  const lessonState = useMomentLessons();
  React.useEffect(() => {
    void hydrateMomentLessons();
  }, []);
  const [replayNoteText, setReplayNoteText] = React.useState("");
  const { state: app } = useAppStore();
  const [scope] = React.useState(captureScope);
  const scrollRef = React.useRef<ScrollView>(null);
  const headingRef = React.useRef<Text>(null);
  const [screen, setScreen] = React.useState<Screen>("capture");
  // Screen Upgrade v1.1 §1: the tab-bar orb is not shown on Seal or Quiet.
  useHideOrbWhile(ORB_HIDDEN_PREPARATION_SCREENS.includes(screen));
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
  // One Breath's answer to words that are not a plan (shown on the opening screen).
  const [answer, setAnswer] = React.useState<ScreenAnswer | null>(null);
  // Lock In belongs to the Moment's start, not to sealing (One Breath Final
  // Build Spec). Personal One Breath only: the Social flow's Lock In also
  // opens Return, and narrowing that is a founder decision.
  const [lockInClock, setLockInClock] = React.useState(() => Date.now());
  const lockInWaitMs = social
    ? 0
    : lockInOpensInMs(review?.startAtIso, lockInClock);
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
  // Confirmation window (spec v1.8.2 Parts 6.1, 8.1). Rules live in
  // utils/oneBreath/confirmationWindow.ts; this screen only feeds them.
  const [win, setWin] = React.useState<WindowState>(() => initialWindow("seal"));
  const winRef = React.useRef(win);
  const [winNow, setWinNow] = React.useState(() => Date.now());
  const [readBack, setReadBack] = React.useState("");
  const [winLines, setWinLines] = React.useState<string[]>([]);
  const [reply, setReply] = React.useState("");
  const [undoUntil, setUndoUntil] = React.useState<number | null>(null);
  // One clarification for a bare clock time (spec v1.8.2 Part 7.2, CB3).
  const [timeQuestion, setTimeQuestion] = React.useState<TimeQuestion | null>(
    null,
  );
  // "Updated from your correction" only after a real correction (Part 8.2.3).
  const [corrected, setCorrected] = React.useState(false);
  const readBackTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const busy = React.useRef(false);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewedBase = React.useRef<Moment | undefined>(undefined);
  const screenRef = React.useRef<Screen>(screen);
  screenRef.current = screen;
  const utteranceRef = React.useRef<
    (text: string, confidence: number | undefined, how: "voice" | "typed") => void
  >(() => {});
  // On the seal and sealed views, a final transcript is a reply to the
  // read-back; everywhere else it is the member's words for a new Moment.
  const voice = useOneBreathVoice((text, info) => {
    if (screenRef.current === "seal" || screenRef.current === "lock") {
      if (info.final) utteranceRef.current(text, info.confidence, "voice");
    } else setWords(text);
  });
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
  // The orange day accent is retired (Master Brief §2): one accent, day or night.
  // Blue belongs to a Social Moment only (Master Brief §2); everywhere else
  // the small labels are muted.
  const accent = social ? T.blueHi : T.muted;
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
    if (screen !== "lock") return;
    setLockInClock(Date.now());
    if (lockInWaitMs <= 0) return;
    // One timer to the moment the window opens. No polling.
    const id = setTimeout(
      () => setLockInClock(Date.now()),
      Math.min(lockInWaitMs, 2147483647),
    );
    return () => clearTimeout(id);
  }, [screen, lockInWaitMs]);
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
    if (key === "date" || key === "time" || key === "timeZone")
      setOccurringNow(false);
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
    // Not a plan: answer in place or go where it lives. A plan, and anything
    // the rules are unsure of, falls through to Mirror exactly as before.
    const reply = screenAnswer(words, {
      social,
      moments: store.moments,
      nowMs: Date.now(),
    });
    if (reply) {
      setWords("");
      if (reply.kind === "open") {
        setAnswer(null);
        router.push(reply.route as never);
      } else if (reply.kind === "moment") {
        setAnswer(null);
        router.replace({ pathname: "/one-breath", params: { momentId: reply.momentId } });
      } else setAnswer(reply);
      return;
    }
    setAnswer(null);
    // A flight is a trip, not an ordinary Moment: hand the words to trip entry,
    // which shows them on a card and saves nothing until the member confirms.
    // Only where Travel is available, and never from Social.
    if (
      !social &&
      !!app.featureFlags &&
      travelPilotAvailable(app.featureFlags) &&
      isTripSentence(words, new Date())
    ) {
      router.push({ pathname: "/travel-intelligence", params: { trip: words } } as never);
      setWords("");
      return;
    }
    const suggested = suggestMomentDraft(words);
    setDraft(suggested);
    setTimeQuestion(suggested.time ? null : suggestTimeQuestion(words));
    setCorrected(false);
    move("mirror");
  };
  const liveDraft = draft;
  const makePlan = (
    override?: MomentDraft,
    target: Screen = "plan",
  ): Moment | null => {
    const draft = override ?? liveDraft;
    if (!draft) return null;
    if (
      evaluateMomentSafety(
        draft.title,
        alcoholMentioned || activeAlcoholContext(current),
      )
    ) {
      setChanges(draft.title);
      move("change");
      return null;
    }
    const result = validateMomentDraft(
      draft,
      occurringNow ? Number.NEGATIVE_INFINITY : Date.now(),
    );
    if (!result.ok) {
      setTimingOpen(true);
      setError(result.error);
      return null;
    }
    const disclosed =
      alcoholMentioned ||
      alcoholDisclosure(words) ||
      alcoholDisclosure(draft.title);
    if (alcoholDisclosure(draft.title) || alcoholDisclosure(draft.prepGoal)) {
      setError(
        "Use a Moment name and priority without alcohol details. That context stays separate and temporary.",
      );
      return null;
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
        return null;
      }
      if (
        calendarChanged ||
        preparationContextKey(origin) !== calendarOrigin.current.key
      ) {
        setCalendarChanged(true);
        setError(CALENDAR_CHANGED);
        return null;
      }
      if (unconfirmedPreparationExpired(origin, Date.now())) {
        setError(CANDIDATE_ENDED);
        return null;
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
    const reviewed = { ...updated, preparation };
    setReview(reviewed);
    setHoldId(preparation.transactionId);
    move(target);
    return reviewed;
  };
  const commit = async (
    moment: Moment,
    expected: Moment | undefined,
    target: Screen,
  ): Promise<Moment | undefined> => {
    if (busy.current) return undefined;
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
      return result;
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
    return undefined;
  };
  const seal = (
    by: NonNullable<MomentPreparation["sealedBy"]> = { method: "hold" },
  ) => {
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
          sealedBy: by,
        },
      },
      reviewedBase.current,
      "lock",
    ).then((result) => {
      // Undo is offered after a spoken or typed seal (Part 6.1.7).
      if (result && by.method !== "hold")
        setUndoUntil(Date.now() + ONE_BREATH_SEAL_UNDO_MS);
    });
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
      sealByHold();
    }, T.holdMs);
  };
  const updateWin = (next: WindowState) => {
    winRef.current = next;
    setWin(next);
  };
  const pushLine = (line: string) => {
    if (line) setWinLines((lines) => [...lines.slice(-3), line]);
  };
  /** The end-state line when `after` recorded a new window end, else "". */
  const endLine = (before: WindowState, after: WindowState) => {
    const last = after.history[after.history.length - 1];
    return after.history.length > before.history.length && last
      ? windowEndLine(last.end, after.intent)
      : "";
  };
  const clearReadBack = () => {
    if (readBackTimer.current) clearTimeout(readBackTimer.current);
    readBackTimer.current = null;
  };
  /** Full read-back, then (and only then) the next numbered window. */
  const startReadBack = (moment: Moment | null | undefined) => {
    if (!moment) return;
    clearReadBack();
    // The mic never listens while the plan is read aloud; the member taps
    // Speak again to reply. (Self-echo is also ignored by classifyUtterance.)
    voice.cancel();
    const text = planReadBack({
      title: moment.title,
      startAtIso: moment.startAtIso,
      nowMs: Date.now(),
      ...(draft?.timeZone ? { timeZone: draft.timeZone } : {}),
    });
    setReadBack(text);
    updateWin(beginReadBack(winRef.current));
    speak(text);
    readBackTimer.current = setTimeout(() => {
      readBackTimer.current = null;
      if (screenRef.current !== "seal") return;
      const opened = readBackFinished(winRef.current, Date.now());
      if (opened === winRef.current) return;
      updateWin(opened);
      setWinNow(Date.now());
      pushLine(windowOpenLine(opened));
    }, readBackDurationMs(text));
  };
  const openSeal = () => {
    setCorrected(false);
    setWinLines([]);
    updateWin(initialWindow("seal"));
    move("seal");
    startReadBack(current);
  };
  const sealByHold = () => {
    const before = winRef.current;
    const after = sealedByHold(before);
    updateWin(after);
    pushLine(endLine(before, after));
    seal({ method: "hold", ...(before.number ? { window: before.number } : {}) });
  };
  const undoSeal = () => {
    const sealed = saved;
    if (
      !undoUntil ||
      Date.now() >= undoUntil ||
      !sealed?.preparation?.sealedAtIso
    )
      return;
    setUndoUntil(null);
    const { sealedBy: _undone, ...unsealed } = sealed.preparation;
    void commit(
      {
        ...sealed,
        preparation: {
          ...unsealed,
          sealedAtIso: "",
          transactionId: transaction(),
        },
      },
      sealed,
      "seal",
    ).then((result) => {
      if (!result) return;
      reviewedBase.current = result;
      setHoldId(transaction());
      setWinLines(["Seal undone · awaiting seal"]);
      startReadBack(result);
    });
  };
  /** One heard or typed reply to the read-back. Voice and text share it. */
  const handleUtterance = (
    text: string,
    confidence: number | undefined,
    how: "voice" | "typed",
  ) => {
    const u = classifyUtterance(text, confidence);
    if (screenRef.current === "lock") {
      if (u.kind === "undo") undoSeal();
      return;
    }
    if (screenRef.current !== "seal" || saving || holding) return;
    const before = winRef.current;
    const r = heard(before, u, Date.now());
    updateWin(r.state);
    const ended = endLine(before, r.state);
    switch (r.effect) {
      case "confirm":
        pushLine(r.message);
        seal({ method: how, window: before.number });
        return;
      case "cancel":
        pushLine(ended);
        pushLine(r.message);
        return;
      case "rebuild": {
        pushLine(ended);
        const time = draft ? changedTime(draft.time, text) : null;
        const date = changedDate(text);
        if (!draft || (!time && !date)) {
          setTimingOpen(true);
          move("mirror");
          setError("Change the day or time below, then review again.");
          return;
        }
        const changed = {
          ...draft,
          ...(time ? { time } : {}),
          ...(date ? { date } : {}),
        };
        // makePlan shows its own reason (or the safety view) when it can't
        // rebuild; the draft only takes the new time once the plan does.
        const rebuilt = makePlan(changed, "seal");
        if (rebuilt) {
          setDraft(changed);
          setCorrected(true);
          startReadBack(rebuilt);
        }
        return;
      }
      case "answer":
        pushLine(ended);
        pushLine(
          "I don’t have a reviewed answer for that yet. Your plan is still waiting for you to seal it.",
        );
        startReadBack(current);
        return;
      case "read_again":
        startReadBack(current);
        return;
      default:
        pushLine(r.message);
    }
  };
  utteranceRef.current = handleUtterance;
  React.useEffect(() => {
    if (win.phase !== "open") return;
    const id = setInterval(() => {
      const now = Date.now();
      setWinNow(now);
      const before = winRef.current;
      const after = tick(before, now);
      if (after !== before) {
        updateWin(after);
        pushLine(endLine(before, after));
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.phase, win.number]);
  React.useEffect(() => {
    if (screen === "seal") return;
    // Leaving the seal view closes any window; an open one ends as corrected.
    clearReadBack();
    const before = winRef.current;
    if (before.phase === "open")
      updateWin(heard(before, { kind: "change" }, Date.now()).state);
    else if (before.phase === "reading")
      updateWin({ ...before, phase: "closed", closesAtMs: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  React.useEffect(() => {
    if (undoUntil === null) return;
    const id = setTimeout(
      () => setUndoUntil(null),
      Math.max(0, undoUntil - Date.now()),
    );
    return () => clearTimeout(id);
  }, [undoUntil]);
  React.useEffect(() => () => clearReadBack(), []);
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
  const textButton = (label: string, action: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => {
        hapticSelection();
        action();
      }}
      style={s.textButton}
    >
      <Text style={s.textButtonText}>{label}</Text>
    </Pressable>
  );
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
        // Warm white is the primary; blue belongs to Social only (Master Brief §2).
        primary && { backgroundColor: social ? T.blue : T.bone, borderColor: social ? T.blue : T.bone },
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.buttonText, primary && { color: social ? T.onBlue : T.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
  // A Replay choice: the prototype's full-width chip. The chosen one is
  // marked by a brighter edge and said to a screen reader as selected.
  const replayChip = (label: string, chosen: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: saving, selected: chosen }}
      aria-disabled={saving}
      aria-selected={chosen}
      disabled={saving}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={[s.replayChip, chosen && s.replayChipChosen]}
    >
      <Text style={s.replayChipText}>{label}</Text>
    </Pressable>
  );
  // Every Replay save is the member's own answer about this one Moment. A new
  // answer clears the follow-up that belonged to the old one.
  const answerReplay = (replay: ReplayAnswer) => {
    setReplayEditing(null);
    setReplayNoteText("");
    transition({ replay, replayObstacle: undefined, replayNote: undefined }, "next");
  };
  const answerObstacle = (replayObstacle: ReplayObstacle, replayNote?: string) => {
    setReplayEditing(null);
    transition({ replayObstacle, replayNote }, "next");
  };
  const replayCard = (eyebrow: string, line: string, testID: string) => (
    <View style={s.replayCard} testID={testID}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.replayCardText}>{line}</Text>
    </View>
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
  const replayPrep = saved?.preparation;
  const replayAt = replayStep(replayPrep, replayEditing);
  const replayAnswerLine = replayNoteLine(replayPrep, current?.type);
  // The member's own lessons for this kind of Moment, offered on the plan
  // before it is sealed. Nothing is on the plan until they add it.
  const planLessons = planLessonOffers({
    lessons: lessonState.lessons,
    learningOn: lessonState.hydrated && lessonState.learningOn,
    type: review?.type,
    added: review?.preparation?.lessons,
  });
  const addedLessons = current?.preparation?.lessons ?? [];
  const togglePlan = (offer: { id: string; text: string }) =>
    setReview((r) =>
      r?.preparation && !r.preparation.sealedAtIso
        ? { ...r, preparation: { ...r.preparation, lessons: togglePlanLesson(r.preparation.lessons, offer) } }
        : r,
    );
  const replayLesson = lessonForMoment(lessonState.lessons, current?.id);
  const replayScope = lessonScopeLabel(current?.type);
  const approveRule = () => {
    if (!current) return;
    const result = approveLessonFromReplay({
      text: replayRuleText,
      scope: current.type,
      momentId: current.id,
      momentAtIso: current.startAtIso,
      nowIso: new Date().toISOString(),
    });
    if (result === "saved") {
      setError("");
      setReplayEditing(null);
    } else if (result === "full") {
      setError("You have the most lessons this phone keeps. Delete one in What AFORCE remembers first.");
    } else if (result !== "empty") {
      setError("That did not save. Try again.");
    }
  };
  // Replay's own World photograph, internal builds only.
  const replayPhoto = worldPhoto(REPLAY_SCENE);
  // One Breath's scene, as the prototype shows it: nothing while it listens,
  // then the Moment's own photograph fades in behind everything once the
  // Moment is understood, and turns right down in Quiet.
  const breathPhoto = BREATH_SCENE_SCREENS.includes(screen)
    ? worldBreathPhotoForMoment(current)
    : undefined;
  // From the member's own words only; a goal never sets the workout type.
  const focus = workoutFocus(words || current?.title || "");
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
      style={[s.root, screen === "quiet" && { backgroundColor: T.ink }]}
    >
      <WorldPhotoHero
        source={breathPhoto}
        fill
        wash={screen === "quiet" ? "breathQuiet" : "breath"}
        fadeMs={1400}
        // Blue belongs to Social only (Master Brief §2): a Social Moment's
        // photograph carries the prototype's light blue tint.
        tint={social ? T.blue : undefined}
        testID="one-breath-scene"
      />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
        ]}
      >
        {screen === "capture" && !reservationOpen ? null : (
          <View style={s.header}>
            <Text style={[s.eyebrow, social && { color: accent }]}>
              {social ? "SOCIAL ONE BREATH" : "ONE BREATH"}
            </Text>
            {textButton("Close", () => {
              voice.cancel();
              router.back();
            })}
          </View>
        )}
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
            {!reservationOpen ? (
              <OneBreathCapture
                social={social}
                headingProps={headingProps}
                alert={
                  error === CANDIDATE_ENDED || error === MOMENT_REMOVED
                    ? error
                    : null
                }
                voiceAvailable={voice.available}
                voiceListening={voice.listening}
                voiceBusy={voice.busy}
                voiceError={voice.error}
                onTalk={() => {
                  if (voice.busy) voice.stop();
                  else void voice.start();
                }}
                onClose={() => {
                  voice.cancel();
                  router.back();
                }}
                words={words}
                onChangeWords={(value) => {
                  voice.cancel();
                  setWords(value);
                }}
                onFocusWords={voice.cancel}
                inputRef={wordsInput}
                sendDisabled={!words.trim() || voice.busy || saving}
                answer={
                  answer?.kind === "status" ? (
                    <OneBreathStatusAnswer social={social} />
                  ) : answer?.kind === "text" ? (
                    <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={s.answerText}>
                      {answer.text}
                    </Text>
                  ) : undefined
                }
                onSend={reviewWords}
                press={(action) => () => {
                  hapticSelection();
                  action();
                }}
              />
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
              WHAT I HEARD
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

            {timeQuestion && !draft.time ? (
              <View style={s.row}>
                <Text style={s.body}>{timeQuestion.question}</Text>
                {timeQuestion.options.map((option) =>
                  button(option.label, () => {
                    field("time", option.time);
                    setTimeQuestion(null);
                  }),
                )}
              </View>
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
                    timeZone: draft.timeZone || undefined,
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
                          timeZone: undefined,
                        }
                      : d,
                  );
                })}
                {occurringNow ? (
                  <Text style={s.muted}>
                    Happening now · review before sealing.
                  </Text>
                ) : null}
                <MomentTimingPicker
                  draft={draft}
                  onChange={(key, value) => {
                    setTimingOpen(true);
                    field(key, value);
                  }}
                />
                <Text style={s.muted}>Or enter the date and 24-hour time:</Text>
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
              social ? "Priority" : "Goal",
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
              Your plan
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
            {draft?.timeZone && current ? (
              <Text style={s.body}>
                Moment time ·{" "}
                {new Date(current.startAtIso).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: draft.timeZone,
                  timeZoneName: "short",
                })}{" "}
                · {draft.timeZone}
              </Text>
            ) : null}
            <Text style={s.muted}>
              Preparation times use your phone’s local time.
            </Text>
            {/* Plan rows as the prototype lists them: the time at the left,
                the step beside it, a hairline between rows. */}
            {steps.map((step, i) => (
              <View key={i} style={s.planRow}>
                <Text style={[s.eyebrow, s.planTime, { color: accent }]}>
                  {clock(step.atIso)}
                </Text>
                <Text style={[s.body, s.planText]}>{step.action}</Text>
              </View>
            ))}
            {!steps.some((step) => step.commandId) ? (
              <Text style={s.muted}>
                Check your current guidance when you’re ready to prepare.
              </Text>
            ) : null}
            {focus ? (
              <View style={s.planRow}>
                <Text style={[s.eyebrow, s.planTime, { color: accent }]}>EXERCISES</Text>
                <Text style={[s.body, s.planText]}>{exerciseRow(focus)}</Text>
              </View>
            ) : null}
            {planLessons.length > 0 ? (
              <View style={s.planLessons} testID="plan-lessons">
                <Text style={s.eyebrow}>FROM YOUR LESSONS</Text>
                <Text style={s.muted}>
                  Yours to add. Nothing joins this plan unless you choose it.
                </Text>
                {planLessons.map((l) => (
                  <View key={l.id} style={s.replayCard} testID={`plan-lesson-${l.id}`}>
                    <Text style={s.replayRuleText}>{l.text}</Text>
                    <Text style={s.muted}>{l.reason}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        l.added ? `Remove from this plan: ${l.text}` : `Add to this plan: ${l.text}`
                      }
                      accessibilityState={{ selected: l.added }}
                      aria-selected={l.added}
                      onPress={() => {
                        hapticSelection();
                        togglePlan(l);
                      }}
                      style={[s.planLessonChip, l.added && s.planLessonChipOn]}
                      testID={`plan-lesson-${l.id}-toggle`}
                    >
                      <Text style={[s.planLessonChipText, l.added && s.planLessonChipTextOn]}>
                        {l.added ? "In this plan · remove" : "Add to this plan"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
                {textButton("Manage in What AFORCE remembers", () => router.push("/remembers" as never))}
              </View>
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
            {button("Review & seal", openSeal, true)}
            {button("Edit", () => move("mirror"))}
          </>
        ) : null}
        {screen === "seal" ? (
          <>
            <Text style={s.eyebrow}>SEAL</Text>
            <Text {...headingProps} style={[s.title, accessibleHeading]}>
              Only what you approve becomes your plan.
            </Text>
            {addedLessons.length > 0 ? (
              <View testID="seal-lessons">
                {addedLessons.map((l) => (
                  <View key={l.id} style={s.planRow}>
                    <Text style={[s.eyebrow, s.planTime, { color: accent }]}>YOUR LESSON</Text>
                    <Text style={[s.body, s.planText]}>{l.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {draft?.timeZone && current ? (
              <Text style={s.body}>
                {current.title} ·{" "}
                {new Date(current.startAtIso).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: draft.timeZone,
                  timeZoneName: "short",
                })}{" "}
                · {draft.timeZone}
              </Text>
            ) : null}
            {readBack ? (
              <View style={s.row}>
                <Text style={[s.eyebrow, { color: accent }]}>READ-BACK</Text>
                {corrected ? (
                  <Text style={s.muted}>Updated from your correction</Text>
                ) : null}
                <Text style={s.body}>{readBack}</Text>
              </View>
            ) : null}
            <Text accessibilityLiveRegion="polite" style={s.muted}>
              {windowStrip(win, winNow) ||
                (win.number > 0
                  ? "Listening is closed. Hear it again to reopen."
                  : "")}
            </Text>
            {winLines.map((line, i) => (
              <Text key={`${i}:${line}`} style={s.muted}>
                {line}
              </Text>
            ))}
            {voice.available
              ? button(voice.listening ? "Stop listening" : "Speak", () => {
                  if (voice.busy) voice.stop();
                  else void voice.start();
                })
              : null}
            {input("Or type it", reply, setReply, "Seal it, or a change")}
            {button(
              "Reply",
              () => {
                const typed = reply;
                setReply("");
                handleUtterance(typed, undefined, "typed");
              },
              false,
              !reply.trim(),
            )}
            {win.phase === "closed" && win.number > 0
              ? button("Hear it again", () => startReadBack(current))
              : null}
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
              onAccessibilityTap={sealByHold}
              style={s.seal}
            >
              {/* The prototype's ring: an arc fills while the member holds. */}
              <SealRing progress={progress} social={social}>
                <Text style={s.sealLabel}>
                  {saving ? "Saving…" : holding ? "Keep holding" : "Hold to seal"}
                </Text>
              </SealRing>
            </Pressable>
            <Text style={[s.muted, s.centered]}>
              Release early to cancel. Nothing is saved until sealed.
            </Text>
            <Text style={s.body}>
              {saved ? "Updates" : "Adds"} 1 Moment · {steps.length} preparation
              steps.
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
            <Text style={[s.eyebrow, s.centered]}>SEALED</Text>
            <PreparationOrb social={social} day={day} size={170} />
            <Text {...headingProps} style={[s.title, s.centered, accessibleHeading]}>
              Your plan is yours.
            </Text>
            {lockInWaitMs > 0 ? (
              <Text style={[s.body, s.centered]}>{LOCK_IN_NOT_YET}</Text>
            ) : null}
            {undoUntil !== null ? button("Undo", undoSeal) : null}
            {lockInWaitMs > 0
              ? null
              : button(
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
              <Text style={[s.eyebrow, s.centered, { color: accent }]}>LOCKED IN</Text>
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
                <Text
                  {...headingProps}
                  style={[s.safetyTitle, accessibleHeading]}
                >
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
            <WorldPhotoHero source={replayPhoto} bleed={28} lift={120} height={300} testID="replay-photo" />
            <WorldPhotoGap source={replayPhoto} height={70} />
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
                {/* Replay, laid out as the prototype shows it: the plan that
                    was sealed, the one question, answers as full-width
                    chips. Same question, same two answers, same save. */}
                {(steps.length > 0 || addedLessons.length > 0) && replayAt === "ask" ? (
                  <View testID="replay-sealed-plan">
                    <Text style={s.eyebrow}>THE PLAN YOU SEALED</Text>
                    {steps.map((step, i) => (
                      <View key={i} style={s.planRow}>
                        <Text style={[s.eyebrow, s.planTime]}>{clock(step.atIso)}</Text>
                        <Text style={[s.muted, s.planText]}>{step.action}</Text>
                      </View>
                    ))}
                    {addedLessons.map((l) => (
                      <View key={l.id} style={s.planRow}>
                        <Text style={[s.eyebrow, s.planTime]}>YOUR LESSON</Text>
                        <Text style={[s.muted, s.planText]}>{l.text}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {replayAt === "ask" ? (
                  <>
                    <Text style={s.replayQuestion}>Did that plan work for you?</Text>
                    <Text style={s.muted}>Private. Only you see this.</Text>
                    <View style={s.replayChips} testID="replay-answers">
                      {REPLAY_ANSWERS.map((a) =>
                        replayChip(a.label, replayPrep?.replay === a.value, () =>
                          answerReplay(a.value),
                        ),
                      )}
                    </View>
                    {textButton("Skip", () => answerReplay("skipped"))}
                  </>
                ) : null}
                {replayAt === "miss" ? (
                  <>
                    <Text style={s.muted}>You said: {replayAnswerLine}</Text>
                    <Text style={s.replayQuestion}>What got in the way?</Text>
                    <Text style={s.muted}>
                      Pick one, or skip. It stays a private note. Your next plan stays the same.
                    </Text>
                    <View style={s.replayChips} testID="replay-obstacles">
                      {replayObstacleOptions(current?.type).map((o) =>
                        replayChip(o.label, false, () =>
                          o.value === "other"
                            ? setReplayEditing("other")
                            : answerObstacle(o.value),
                        ),
                      )}
                    </View>
                    {textButton("Skip", () => answerObstacle("skipped"))}
                  </>
                ) : null}
                {replayAt === "other" ? (
                  <View style={s.field} testID="replay-own-words">
                    <Text style={s.replayQuestion}>In your words</Text>
                    <TextInput
                      accessibilityLabel="What got in the way?"
                      value={replayNoteText}
                      onChangeText={setReplayNoteText}
                      placeholder="What got in the way?"
                      placeholderTextColor={T.muted}
                      maxLength={REPLAY_NOTE_MAX}
                      multiline
                      style={[s.input, s.replayNoteInput]}
                    />
                    <Text style={s.muted}>
                      Saved as a private note on this phone. It never becomes a rule.
                    </Text>
                    {button(
                      "Save note",
                      () => answerObstacle("other", cleanReplayNote(replayNoteText)),
                      true,
                      saving,
                    )}
                    {textButton("Cancel", () => setReplayEditing(null))}
                  </View>
                ) : null}
                {replayAt === "yes"
                  ? replayCard(
                      "SAME PLAN NEXT TIME",
                      "AFORCE won’t change what’s working. Your answer is saved as a private note.",
                      "replay-closed-yes",
                    )
                  : null}
                {replayAt === "skipped"
                  ? replayCard(
                      "SKIPPED",
                      "No answer saved. This Replay is closed.",
                      "replay-closed-skipped",
                    )
                  : null}
                {replayAt === "noted" ? (
                  <>
                    {replayCard(
                      "SAVED AS A NOTE",
                      "Your next plan stays the same. Your answer is a private note only.",
                      "replay-closed-noted",
                    )}
                    {replayAnswerLine ? (
                      <Text style={s.muted} testID="replay-note-line">
                        You said: {replayAnswerLine}
                      </Text>
                    ) : null}
                    {/* The member's own rule. AFORCE suggests nothing here. */}
                    {replayLesson ? (
                      <View style={s.replayCard} testID="replay-lesson">
                        <Text style={s.eyebrow}>YOUR RULE FOR NEXT TIME</Text>
                        <Text style={s.replayRuleText}>{replayLesson.text}</Text>
                        <Text style={s.muted}>
                          Only for {replayScope}. Offered on your next one, and added only if you choose.
                          Change, pause or delete it anytime.
                        </Text>
                      </View>
                    ) : null}
                    {lessonState.hydrated && lessonState.learningOn
                      ? button(replayLesson ? "Edit your rule" : "Write a rule for next time", () => {
                          setReplayRuleText(replayLesson?.text ?? "");
                          setReplayEditing("rule");
                        })
                      : null}
                    {lessonState.hydrated && !lessonState.learningOn ? (
                      <Text style={s.muted} testID="replay-learning-off">
                        Learning is off, so Replay saves notes only.
                      </Text>
                    ) : null}
                    {textButton("What AFORCE remembers", () => router.push("/remembers" as never))}
                  </>
                ) : null}
                {replayAt === "rule" ? (
                  <View style={s.field} testID="replay-rule">
                    <Text style={s.replayQuestion}>Your rule for next time</Text>
                    <TextInput
                      accessibilityLabel="Your rule for next time"
                      value={replayRuleText}
                      onChangeText={setReplayRuleText}
                      placeholder="In your own words"
                      placeholderTextColor={T.muted}
                      maxLength={MOMENT_LESSON_TEXT_MAX}
                      multiline
                      style={[s.input, s.replayNoteInput]}
                    />
                    <Text style={s.muted}>
                      Only for {replayScope}. Kept on this phone, private to you. It is offered on a
                      matching plan and joins only if you add it. It changes no target or score.
                    </Text>
                    {button("Approve", approveRule, true, saving || !replayRuleText.trim())}
                    {textButton("Cancel", () => setReplayEditing(null))}
                  </View>
                ) : null}
                {replayAt === "yes" || replayAt === "skipped" || replayAt === "noted"
                  ? textButton("Change answer", () => {
                      setReplayNoteText(replayPrep?.replayNote ?? "");
                      setReplayEditing("ask");
                    })
                  : null}
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
  answerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16.5,
    lineHeight: 24,
    color: T.bone,
  },
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
  title: { ...T.headline, color: T.bone, marginTop: 16 },
  accessibleHeading: { fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  body: { ...T.body, color: T.bone },
  muted: { ...T.body, color: T.muted, fontSize: 14, lineHeight: 21 },
  eyebrow: { ...T.eyebrow, color: T.muted },
  button: {
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 999,
    justifyContent: "center",
  },
  textButton: { minHeight: 44, justifyContent: "center", alignSelf: "center", paddingHorizontal: 12 },
  textButtonText: { fontFamily: "Inter_500Medium", fontSize: 14, color: T.muted, textAlign: "center" },
  captureTitle: { textAlign: "center", marginTop: 24 },
  centered: { textAlign: "center" },
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
  // The hold-to-seal control is the prototype's 150pt ring (SealRing).
  seal: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 18,
  },
  sealLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: T.bone, textAlign: "center" },
  planRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: T.rule,
  },
  planTime: { width: 84 },
  planText: { flex: 1 },
  replayQuestion: { fontFamily: "Inter_600SemiBold", fontSize: 24, lineHeight: 28, letterSpacing: -0.4, color: T.bone },
  replayChips: { gap: 8 },
  replayChip: {
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 14,
    justifyContent: "center",
  },
  replayChipChosen: { borderColor: T.bone },
  replayCard: {
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 14,
  },
  planLessons: { gap: 10, marginTop: 8 },
  planLessonChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 22,
    alignSelf: "flex-start",
    justifyContent: "center",
  },
  planLessonChipOn: { backgroundColor: T.bone, borderColor: T.bone },
  planLessonChipText: { fontFamily: "Inter_500Medium", fontSize: 14, color: T.bone },
  planLessonChipTextOn: { color: T.ink },
  replayRuleText: { fontFamily: "Inter_600SemiBold", fontSize: 17, lineHeight: 23, color: T.bone },
  replayCardText: { ...T.body, color: T.bone, fontSize: 16, lineHeight: 23 },
  replayNoteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    textAlignVertical: "top",
  },
  replayChipText: { fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 20, color: T.bone },
  safetyLine: { height: 2, backgroundColor: T.red },
  safetyTitle: { ...T.headline, fontSize: 28, lineHeight: 34, color: T.bone },
});
