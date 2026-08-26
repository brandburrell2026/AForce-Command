/**
 * HomeScreenV2 — the Phase 2 · S3 Home redesign (spec §8.2), rendered only when
 * `spec_home` is on. The spec's reduced hierarchy: wordmark + freshness →
 * dominant readiness value with a thin arc → one "Your next move" command card →
 * three quiet signal metrics. One score, one command, one CTA.
 *
 * Same live engine data as the legacy Home (score, command, signals) — no
 * scoring change (statusColor/scoringEngine untouched).
 *
 * HONEST STATUS (RC-1 verdict-pass correction — a prior version of this
 * comment claimed the legacy Home's four detail zones were "relocated" into
 * Readiness Insights with "nothing missing," then a later version claimed
 * they were "still reachable" because `spec_home` defaults OFF; both claims
 * are false): the legacy Home's four detail zones — MetabolicReadinessZone,
 * PerformanceAgeZone, VoiceCheckInZone, ActivationJourneyZone (all in
 * components/home/) — are rendered ONLY by HomeScreenLegacy
 * (`components/home/HomeScreenLegacy.tsx`, React.lazy-loaded from
 * `app/(tabs)/index.tsx`). Tapping the arc opens Readiness Insights, which
 * shows a chart + drivers + insight, not those four zones.
 *
 * `featureFlags/flags.ts` sets `spec_home: true` in `DEFAULT_FLAGS`, and
 * `app/(tabs)/index.tsx`'s `HomeScreen` is a ternary —
 * `specHome ? <HomeScreenV2 /> : <HomeScreenLegacy />` — that
 * renders EITHER this component OR the legacy screen, never both. There is
 * no code path today where both render "alongside" each other. That means
 * the four legacy detail zones are ALREADY orphaned/unreachable in today's
 * default build, not merely "at risk of becoming orphaned" on some future
 * flag flip. Restoring them (in some form, somewhere) or explicitly retiring
 * them needs a founder decision — this file must not claim that decision
 * has already happened, and must not understate that the orphaning has
 * already occurred.
 *
 * E1 — Elite Home (flag `elite_home_experience_enabled`, default OFF):
 * PRESENTATION-ONLY elevation layered on the exact same data. When on, it adds a
 * truthful score count-up, a larger arc, a state pill, and band-aware signal
 * ordering — all decided by the pure, tested `homePresentation.ts`. It never
 * touches the score, command, eligibility, timing, or safety logic
 * (Score-Protection); reduced-motion collapses every animation back to the
 * static Home.
 *
 * WAVE 5 — MOTION. This screen used to stagger FIVE entrances (header, hero,
 * command, moments, signals) behind that flag, which is "animate everything"
 * wearing a flag, and none of it shipped because the flag is off. Home now
 * carries exactly TWO of the product's four signature moments, and they are
 * not flag-gated because a signature moment that never plays is not one:
 *
 *   1. HYDROSTATE REVEAL — the readiness arc draws itself in on first paint.
 *      The arc is the instrument; drawing it is what makes the number read as
 *      MEASURED rather than printed. (The count-up of the numeral stays behind
 *      `elite_home_experience_enabled` — one moving thing, not two.)
 *   2. COMMAND REVEAL — the one command card arrives a beat after the reading,
 *      so the hierarchy (what you are → what to do) is felt, not just laid out.
 *
 * Header, hero wrapper, moments and signals no longer animate at all. Both
 * moments collapse to the static render under reduced motion, both are finite,
 * and neither costs anything once settled (Wave-4 rule).
 *
 * WAVE 5 — the band accent is NOT part of that flag any more. It used to be:
 * flag-off pinned `accent = af.red` and the state word to `af.redText`, so the
 * arc, the trend line and the state word rendered in ALARM RED for every band —
 * a member at PEAK read "ASCENDING" in the same red a DEPLETED member sees.
 * Signal Red must be meaningful and restrained, and visual certainty must track
 * what the data says, so the accent now always comes from
 * `resolveHomePresentation(level)`. Text/glyphs take `accentText` (Signal Red
 * fails AA as text on dark — see theme/afTokens.ts); fills and strokes keep
 * `accent`. This intentionally changes the flag-off render.
 *
 * WAVE 5 — FIRST-LAUNCH EVIDENCE GATE (founder ruling 2026-08-12). Home used
 * to greet a brand-new member with a confident BALANCED 76, because
 * `data/mockData.ts`'s seeded demo day (5 units / 45 oz) flows through the
 * engine like any other day. Neither the seed nor the scoring engine is
 * touched — this screen simply stops PRESENTING the result as the member's
 * state until `resolveHomeEvidence` (homeBaselineState.ts) says AForce has
 * observed something. Three renders of the hero slot, never two: `established`
 * is today's arc + trend line unchanged, `building` is `HomeBaselineHero`, and
 * the short `pending` window between them holds the slot's shape rather than
 * painting a number the next frame would have to take back.
 *
 * WAVE 5 — CONFIDENCE PROPORTIONAL TO EVIDENCE (residual A, founder
 * 2026-08-12). That gate is BINARY, and binary was the residual: one logged
 * drink flipped Home all the way to the full arc, the band word and the trend
 * line, so a member with one sip and no wearable read with exactly the
 * authority of a member with a week of logs and a connected provider. The gate
 * is unchanged — the founder approved `building` for ZERO evidence and the
 * score is not re-hidden — but the `established` reading now carries the
 * shipped `ConfidenceChip`, resolved by the pure `homeConfidence.ts` from the
 * existing §54 signal-quality / §53 freshness / §55 coverage modules. Same
 * treatment PerformanceSignalV3 has worn since Wave 5: a small affordance on
 * the reading, never a second hero — one dominant number, band-aware colour,
 * WHY inline, secondary information quiet, all unchanged. It reads the store
 * state this screen ALREADY subscribes to, so it adds no slice, no network read
 * and no timer.
 *
 * CORRECTION 6 — NAME THE HERO, PRINT THE BAND ONCE (build 61, after build 60
 * failed physical-device QA). Copy and presentation only: no symbol renamed, no
 * math touched, no second score. The device pass found FOUR alarming-looking
 * strings stacked in the hero where there is ONE reading:
 *
 *   1. the numeral, labelled READINESS — a word the founder could not connect
 *      to the product, because "HydroState" was rendered NOWHERE in the app;
 *   2. the band word under it (`engine.performanceState.level`);
 *   3. the SAME variable again, title-cased, in the "Recovery" signal tile;
 *   4. the Wave-5 confidence token ("LIMITED") a few points away, a bare
 *      structural word that reads like a fourth verdict on the body.
 *
 * Three of those four were the same underlying value. The corrections:
 * `home.v2.readiness_label` now says HYDROSTATE in all 11 locales (an
 * untranslated structural token in every one of them, so key parity is
 * untouched — see `homeHeroNamingLock.test.ts`); the Recovery tile renders the
 * honest-data em dash instead of restating the band; and the confidence chip
 * carries the noun that names its domain ("EVIDENCE: LIMITED") so it qualifies
 * the reading instead of competing with it.
 *
 * The approved shape is unchanged and is now locked: ONE hero state (the arc +
 * numeral, band-aware colour), ONE band/status word, ONE quiet secondary
 * evidence indicator, ONE command.
 *
 * CORRECTION 2 — LOG WATER OPENS A LOGGING SURFACE (build 61, after build 60
 * failed physical-device QA). The most important control in the product was
 * wired like this:
 *
 *     onPrimary={() => {
 *       fireMoment('command_completed');
 *       void logIntake('water', { silent: true, ozOverride: parseDoseOz(...) });
 *     }}
 *
 * Three defects in four lines. (1) The TAP WAS THE COMMIT — no picker, no
 * amount, no confirm, no cancel, so a mis-tap was a durable intake event and
 * the member never said how much they drank. (2) `silent: true` sets
 * `showCycleSuccess: false` in the reducer, and the repo's only
 * `<CycleSuccessOverlay>` mount lived in `HomeScreenLegacy`, which
 * `spec_home: true` makes unreachable — so even without `silent` there was no
 * renderer. Nothing acknowledged the act. (3) The haptic fired on PRESS, so the
 * hand was told "logged" before the write had even been attempted, and it still
 * said "logged" when the write failed.
 *
 * The fix re-mounts SHIPPED, ALREADY-TESTED UI rather than building anything:
 * `components/WaterAmountModal.tsx` (the 8/12/16/20/24/32 oz presets + ±2 oz
 * stepper, previously reachable only through the orphaned `LogIntakeRow`) and
 * `components/CycleSuccessOverlay.tsx` (the hero confirmation the legacy Home
 * used to own). The loop is now: tap → picker → the member's own amount →
 * ONE durable event → the reading recomputes → the confirmation says so.
 *
 * Opening the logger is deliberately inert: no intake, no score, no haptic
 * moment until the member confirms an amount. Score-Protection is untouched —
 * this screen still never computes anything; it hands `ozOverride` to the same
 * `logIntake` action every other intake surface calls.
 *
 * AMENDMENT §2 — SAFE-AREA / TAB-BAR CLEARANCE. Home applied no device-derived
 * bottom inset at all: `AFScreen` defaults `edges={['top']}`, this screen sets
 * no `contentInsetAdjustmentBehavior`, and the tab bar is `position: 'absolute'`
 * — react-navigation renders scenes at `absoluteFill` and only PUBLISHES the
 * bar's height via `BottomTabBarHeightContext`, injecting no padding. So Home
 * substituted a hard-coded 128 (`Spacing[24] + Spacing[8]`) on the V3 path and a
 * flat 40 otherwise, against a real bar of `49 + insets.bottom` — 49pt on an SE,
 * 83pt on a notched device. Both numbers were device-blind, and the flat 40
 * parked the last 9–43pt of Home permanently underneath the bar.
 *
 * The padding is now DERIVED from the height the navigator already published,
 * plus one spacing token of breathing room (`homeSafeArea.ts`). The CONTEXT is
 * read directly rather than via `useBottomTabBarHeight()`, because that hook
 * THROWS when the context is undefined and Home must stay mountable outside the
 * tab navigator for its render harnesses. No device is named, measured or
 * guessed at anywhere on this screen.
 *
 * AMENDMENTS §1/§3/§4/§5/§6 — HOME HIERARCHY (founder, 2026-08-13).
 * PRESENTATION ONLY: no HydroState math, no threshold, no decay, no evidence
 * CALCULATION, no band semantics, no trend logic, no intake or logging path is
 * touched, and no shared primitive is modified — every change below is HOW HOME
 * COMPOSES what already ships. The approved order, with nothing competing:
 *
 *     HYDROSTATE SCORE → BAND → EVIDENCE CONFIDENCE → COMMAND → ACTION
 *
 * The device build put five things in the first glance instead of one. What
 * changed, and why:
 *
 *   §1 CRITICAL is gone from HOME (not from the product). See the `trendVerb`
 *      derivation below — `services/statusVerb.ts` is untouched.
 *   §3 'AForce OS' is KEPT and demoted from `afType.title1` to the eyebrow
 *      register: a product identifier, not the second-largest object on screen.
 *   §4 The evidence chip is metadata about the READING, not a fourth verdict
 *      about the body — same chip, same rating, moved out of the verdict column
 *      and pinned to the number it qualifies. `homeConfidence.ts` is untouched.
 *   §5 The hero keeps its size. The ring is NOT enlarged — premium comes from
 *      restraint, not scale — so the gain is spacing, tracking and breathing
 *      room around one dominant numeral.
 *   §6 The command card is separated from the hero by a section-scale gap so it
 *      stops reading as a second hero. Its content, its WHY and its primary
 *      action are unchanged.
 *
 * Net effect on the first paint of a DEPLETED member: they used to meet a 32pt
 * product name, a 76pt number, a band word, an evidence token and a red
 * "● CRITICAL" — five objects, three of them saying the same thing. They now
 * meet the number, the band, and a quiet note on how sure AForce is.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/expo';
// The CONTEXT, never `useBottomTabBarHeight()` — the hook throws when the
// context is undefined, which would make Home unmountable outside the tab
// navigator (render harnesses, deep-linked previews). Same import expo-router
// itself uses to ask "is there a bottom tab bar above me?".
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import Animated, {
  FadeInDown,
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';

import {
  AFScreen,
  AFReadinessArc,
  AFCommandCard,
  AFSectionLabel,
  AFOfflineBanner,
  AFSkeleton,
} from '@/components/ui';
import { useRouter } from 'expo-router';
import { af, afType, afMotion, Spacing, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { fireMoment } from '@/services/haptics';
import { useFeatureFlags } from '@/store/useAppStore';
import { HomeMomentsSection } from '@/components/moments/HomeMomentsSection';
import { useEngineSlice, useActionsSlice, useUserSlice, useVoiceSettingsSlice, useBootstrapSlice, useHistorySlice, useCycleSlice } from '@/store/slices';
import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';
// CORRECTION 2 — both already shipped and tested; neither is new UI. The picker
// was dead code (its only mount, `LogIntakeRow`, is imported by nothing); the
// overlay's only mount was the unreachable legacy Home.
import { WaterAmountModal } from '@/components/WaterAmountModal';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { HomeSkeleton } from './HomeSkeleton';
import { HomeBaselineHero } from './HomeBaselineHero';
import { HomeFreshnessLabel } from './HomeFreshnessLabel';
import { freshestBiometricsFetchedAt } from './homeFreshness';
import { countRealHistoryEntries, resolveHomeEvidence } from './homeBaselineState';
import { resolveHomeScrollBottomPadding } from './homeSafeArea';
import { resolveHomeConfidence } from './homeConfidence';
import { ConfidenceChip } from '@/components/ConfidenceChip';
// CORRECTION 2: `parseDoseOz` is gone from this screen on purpose. The amount
// logged is now the amount the MEMBER picked, not a number scraped out of the
// command copy and written on their behalf.
import { parseEngineActionCopy } from '@/utils/recovery/recoveryCommandFromStore';
import {
  resolveHomePresentation,
  resolveArcAnimation,
  resolveArcDimensions,
  type SignalKey,
} from './homePresentation';
import { findVoice } from '@/services/voiceCatalog';
import { coachEyebrow, coachLead, formatCommandForCoach } from '@/services/voice/coachPhrasing';
import type { FluidType } from '@/types';
import { LiveStatusLine } from './LiveStatusLine';
import { useScoreTrend } from '@/hooks/useScoreTrend';
import { getStatusVerb } from '@/services/statusVerb';
import { explainFieldArbitration } from '@/utils/biometricsAggregator';
import {
  formatSleepHours,
  formatHrvMs,
  formatHydrationPct,
  resolveHealthChip,
  EM_DASH,
} from './homeV3Presentation';
import type { IntakeSource } from '@/services/intakeSource';

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string; source?: IntakeSource },
  ) => Promise<void>;
  /** Clears the success overlay (CORRECTION 2) — the same action the legacy Home passes it. */
  dismissSuccess: () => void;
}

/** Heat-load band → i18n key suffix (translated at the call site). */
function heatBand(heatLoad: number): 'high' | 'moderate' | 'low' {
  if (heatLoad >= 60) return 'high';
  if (heatLoad >= 30) return 'moderate';
  return 'low';
}

/** Compact signal tile — fixed-width column so word values never collide. */
function Signal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signal} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.signalLabel}>{label.toUpperCase()}</Text>
      {/*
       * A11y fix (Wave-5 Phase-1 pass, Dynamic Type): this was
       * `numberOfLines={1} adjustsFontSizeToFit`, which made the value shrink
       * as the member's chosen text size grew — Dynamic Type, inverted, on the
       * four numbers Home exists to show. The tiles are `flex: 1` columns, so
       * the value has a column to wrap into; capping the scale with the
       * documented display ceiling keeps two tall tiles from pushing the row
       * off the fold. Same call the shared AFListRow / AFTopBar made.
       */}
      <Text style={styles.signalValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Elite score numeral — counts up between two *real* values (never from zero),
 * else renders the value outright. Reduced-motion is handled upstream by
 * `countUp=false`. Presentation-only; the value shown is the engine's score.
 */
function EliteScoreNumber({
  score,
  fromScore,
  countUp,
  style,
}: {
  score: number;
  fromScore: number;
  countUp: boolean;
  style: StyleProp<TextStyle>;
}) {
  const sv = useSharedValue(countUp ? fromScore : score);
  const [shown, setShown] = React.useState(countUp ? Math.round(fromScore) : score);
  React.useEffect(() => {
    if (countUp) {
      sv.value = fromScore;
      sv.value = withTiming(score, { duration: 900, easing: Easing.out(Easing.cubic) });
    } else {
      sv.value = score;
      setShown(score);
    }
  }, [score, fromScore, countUp, sv]);
  useAnimatedReaction(
    () => sv.value,
    (v) => runOnJS(setShown)(Math.round(v)),
  );
  return (
    <Text style={style} numberOfLines={1} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
      {shown}
    </Text>
  );
}

export function HomeScreenV2() {
  const { t } = useTranslation();
  const userState = useUserSlice();
  const { selectedVoiceId } = useVoiceSettingsSlice();
  const { isHydrated } = useBootstrapSlice();
  const engine = useEngineSlice();
  const flags = useFeatureFlags();
  const { logIntake, dismissSuccess } = useActionsSlice<HomeActions>();
  const clerkUser = useUser().user;
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  // ── AMENDMENT §2 — tab-bar clearance (see the file header) ─────────────────
  // The navigator lays the bar out and publishes what it ACTUALLY measured
  // (`49 + insets.bottom`, or the explicit web height); this is the only honest
  // source for it, and reading it costs no store slice, no timer and no
  // measurement pass of our own. `?? 0` is a real zero, not a fallback guess:
  // undefined means there is no bottom tab bar above this content.
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const scrollBottomPadding = resolveHomeScrollBottomPadding(tabBarHeight);

  // ── CORRECTION 2 — the water-logging surface (see the file header) ─────────
  // The cycle slice is this screen's ONE new subscription. It carries the
  // in-flight flag the primary button now shows and the settled result the
  // confirmation renders. It changes exactly three times per log (start →
  // success → dismiss) and NEVER on a timer tick — `TICK_TIMER` touches
  // `timerSeconds`/`pendingConfirmation`, neither of which is in this slice's
  // memo — so Wave-4's "no per-second renders" guarantee is untouched. The
  // render-count harness proves that rather than trusting this comment.
  const { showCycleSuccess, lastCycleResult, isCompletingCycle } = useCycleSlice();
  const [waterPickerOpen, setWaterPickerOpen] = React.useState(false);

  // A confirmed amount that has been dispatched but has not settled yet.
  // A ref, not state, because it has to be read and written SYNCHRONOUSLY
  // inside a single press: two taps in the same frame both close over the same
  // pre-render `logIntake`, whose own `state.isCompletingCycle` guard has not
  // seen the first tap yet, so the store would post two intakes for one drink.
  // This ref is what stands between a fast double-tap and a duplicate durable
  // event; `primaryLoading` and the picker guard cover the slower cases.
  const confirmInFlightRef = React.useRef(false);

  // Opening the logger is NOT logging: no intake, no score, no haptic moment.
  // Refused while a cycle is in flight because `logIntake` would drop the
  // resulting confirm on the floor (`if (state.isCompletingCycle) return;`),
  // which would leave the member believing they had logged.
  // Also refused while the confirmed-success overlay is up: that surface exists
  // to tell the member the write landed, so re-opening the logger underneath it
  // is exactly the accidental repeat this is meant to prevent. Bounded by the
  // overlay's own lifetime — dismissing it re-enables immediately, so there is
  // no arbitrary lockout.
  const openWaterPicker = React.useCallback(() => {
    if (isCompletingCycle || confirmInFlightRef.current || showCycleSuccess) return;
    setWaterPickerOpen(true);
  }, [isCompletingCycle, showCycleSuccess]);

  // Cancel and back-out are the same thing to this screen: close the surface,
  // write nothing. `WaterAmountModal` routes its X button, its backdrop tap and
  // Android hardware-back (`onRequestClose`) all to this one handler.
  const cancelWaterPicker = React.useCallback(() => {
    setWaterPickerOpen(false);
  }, []);

  // THE ONLY PLACE THIS SCREEN LOGS. `silent` is deliberately not passed: it
  // sets `showCycleSuccess: false`, which is exactly what made this action feel
  // dead, and a member-initiated log should behave like every other one.
  const confirmWaterAmount = React.useCallback(
    (oz: number) => {
      if (confirmInFlightRef.current || isCompletingCycle || showCycleSuccess) return;
      confirmInFlightRef.current = true;
      setWaterPickerOpen(false);
      void logIntake('water', { ozOverride: oz, source: 'home' });
    },
    [logIntake, isCompletingCycle, showCycleSuccess],
  );

  // COMMAND COMPLETED — one of the four named haptic moments, fired on the
  // CONFIRMED write. `logIntake` catches its own errors and resolves either
  // way, so awaiting it proves nothing; the settled cycle state is the only
  // honest success signal. CYCLE_SUCCESS lands a `lastCycleResult`,
  // CYCLE_FAILURE clears it, and no other cycle can settle in between because
  // the store serialises on `isCompletingCycle`.
  React.useEffect(() => {
    if (!confirmInFlightRef.current) return;
    if (isCompletingCycle) return; // still writing — nothing to confirm yet
    confirmInFlightRef.current = false;
    if (!lastCycleResult) return; // CYCLE_FAILURE: there is no success to claim
    fireMoment('command_completed');
  }, [isCompletingCycle, lastCycleResult]);

  // RC-1 Wave-2B (item 1) — offline intake outbox visibility. Flag-gated:
  // while `offline_intake_outbox_enabled` is off the outbox is never
  // hydrated/written (see `services/intakeOutbox.ts`), so this stays at its
  // inert 0/false default and `AFOfflineBanner` renders nothing.
  const outboxState = useIntakeOutboxStore();
  const outboxPendingCount = flags.offline_intake_outbox_enabled ? selectPendingCount(outboxState) : 0;
  const outboxHasFailedItem = flags.offline_intake_outbox_enabled ? selectHasFailedItem(outboxState) : false;

  // ── WAVE 5 first-launch evidence gate (see the file header) ────────────────
  // Both signals are already in the store, so the gate costs NO network read
  // of its own: `intakeEvents` answers "has AForce observed this member?"
  // locally and synchronously, and cycle history arrives with the mount-time
  // /v1/home fetch every Home render already waits on. Home is the hottest
  // screen in the app and Wave-4's rule is no extra refetching — an added
  // journal read here would have fired on every cold open for anyone who had
  // not logged in the last 24h, which is a quiet morning, not a first launch.
  // Before hydration the history answer is `null` — "not known yet", never
  // "none" — so the hero holds its shape instead of flashing a claim.
  const intakeEventCount = userState.intakeEvents?.length ?? 0;
  const history = useHistorySlice();
  const loggedDayCount = isHydrated ? countRealHistoryEntries(history) : null;
  const evidence = resolveHomeEvidence({ intakeEventCount, loggedDayCount });

  // ── WAVE 5 residual A — how MUCH has it observed? ──────────────────────────
  // The gate above is binary; this is the gradient beside the number. Same
  // three inputs already read on this screen (intake events, cycle history,
  // the provider snapshot), graded by the shipped confidence modules — no new
  // hook, no fetch, and `Date.now()` read once inside the memo exactly as the
  // V3 block below does, so nothing here ticks.
  const confidence = React.useMemo(
    () =>
      resolveHomeConfidence({
        intakeEvents: userState.intakeEvents,
        history,
        biometrics: userState.biometrics,
        now: Date.now(),
      }),
    [userState.intakeEvents, userState.biometrics, history],
  );

  const score = Math.max(0, Math.min(100, Math.round(engine.score)));
  const { title, instruction } = parseEngineActionCopy(engine.command.action);
  const hydrationPct =
    userState.dailyTarget > 0
      ? Math.round((userState.unitsConsumedToday / userState.dailyTarget) * 100)
      : 0;
  const greeting = clerkUser?.firstName ?? t('home.v2.greeting_default');

  // ── E1 elite presentation (flag-gated, presentation-only) ──────────────────
  const elite = flags.elite_home_experience_enabled;
  const presentation = resolveHomePresentation(engine.performanceState.level);
  const prevScoreRef = React.useRef<number | null>(null);
  const arcPlan = resolveArcAnimation({
    elite,
    reducedMotion,
    score,
    prevScore: prevScoreRef.current,
  });
  React.useEffect(() => {
    prevScoreRef.current = score;
  }, [score]);

  // Fills/strokes take `accent`; text + icon glyphs take the AA-clean
  // `accentText` twin (Wave 5 — see the file header).
  const accent = presentation.accent;
  const accentText = presentation.accentText;
  // SIGNATURE MOMENT 2 — the command reveal, and the ONLY entrance on this
  // screen. The delay lets the arc's own draw-in (moment 1) land first so the
  // two read as one sentence: here is your state, here is your move. Under
  // reduced motion `entering` is undefined, which is React Native's own "do
  // not animate" — the card is simply present on first paint.
  const commandReveal = reducedMotion
    ? undefined
    : FadeInDown.duration(afMotion.durations.entrance).delay(afMotion.durations.standard);

  // Premium arc hero (elite): a larger, bolder, band-glowing readiness gauge so
  // it reads as the single instrument. Flag-off keeps the shipped 240/6 arc
  // byte-for-byte. Decision lives in the pure, tested homePresentation module.
  const arcDims = resolveArcDimensions(elite);

  // RC-1 fix (P0 vs founder's 3-second brief): momentum was missing from
  // Home — the tested, existing `LiveStatusLine` (trend arrow + delta
  // window + status verb) lived only on the legacy Home. Same hook/service
  // pair the legacy screen uses (app/(tabs)/index.tsx), tinted with V2's own
  // `accentText` so it stays in this screen's spare visual language instead of
  // reaching into the legacy band-color selector.
  const trend = useScoreTrend(score);
  const statusVerb = React.useMemo(
    () => getStatusVerb(engine.performanceState.level, trend.direction),
    [engine.performanceState.level, trend.direction],
  );
  // ── FOUNDER §1 (2026-08-13) — CRITICAL LEAVES THE HOME HIERARCHY ──────────
  // `getStatusVerb` is a band × trend composite, but at DEPLETED the trend axis
  // collapses: two of its three directions return CRITICAL. What reached the
  // member was therefore not momentum, it was the BAND WORD SAID AGAIN, louder,
  // in `af.redText`, one line under the hero that had already said DEPLETED —
  // and because `useScoreTrend` initialises to 'flat', it arrived on FIRST
  // PAINT with no delta and no window behind it. Home's approved hierarchy is
  // score → band → evidence → command → action; a second verdict competing with
  // the band is exactly the card-competition the premium standard removes.
  //
  // The SERVICE IS UNTOUCHED — `services/statusVerb.ts` still returns CRITICAL,
  // its tests still pass, and `LiveStatusLine` still resolves the i18n key —
  // because this is a presentation decision belonging to this screen, not a
  // change to what the verb means. Two withholdings, one rule: Home renders a
  // verb only when the trend has a real direction to report, and never the one
  // that merely restates the band. With neither, the line renders nothing.
  const trendVerb =
    trend.direction === 'flat' || statusVerb === 'CRITICAL' ? undefined : statusVerb;

  // ── E4 elite voice-coach delivery (flag-gated; phrasing/delivery ONLY) ──────
  // Same command/dose/timing/evidence for every coach — only the eyebrow + tone
  // change, via the fail-safe, §64-guarded coachPhrasing adapter.
  const voiceElite = flags.elite_voice_coach_enabled;
  const archetype = findVoice(selectedVoiceId)?.archetype ?? 'push';
  const commandEyebrow = voiceElite ? coachEyebrow(archetype) : undefined;
  const commandInstruction = voiceElite
    ? instruction
      ? formatCommandForCoach(instruction, archetype)
      : coachLead(archetype)
    : instruction;

  // CORRECTION 6 (build-61 device QA) — the Recovery tile is NOT a recovery
  // reading. It was `titleCase(engine.performanceState.level)`: the same
  // variable the hero already prints as the band word, restated title-cased one
  // section down. Home therefore printed the band twice (plus the confidence
  // token nearby), and the founder read three alarming strings where there is
  // one underlying value and one measurement.
  //
  // A duplicate is not a second measurement, so this renders the honest-data
  // contract's em dash — the SAME glyph the Sleep/HRV tiles already use for a
  // reading nobody took — until a real recovery input exists. Nothing truthful
  // is erased: the band word still appears exactly once, in the hero, where it
  // is the reading. (The previous `evidence === 'established'` gate is now
  // redundant rather than removed — the em dash was already what the
  // pre-evidence branch rendered, and it is now what both branches render.)
  const recoveryText = EM_DASH;

  const signalTiles: Record<SignalKey, React.ReactNode> = {
    hydration: <Signal label={t('home.v2.signal_hydration')} value={`${hydrationPct}%`} />,
    heat: <Signal label={t('home.v2.signal_heat')} value={t(`home.v2.heat_${heatBand(userState.heatLoad)}`)} />,
    recovery: <Signal label={t('home.v2.signal_recovery')} value={recoveryText} />,
  };
  const signalOrder: SignalKey[] = elite
    ? presentation.signalOrder
    : ['hydration', 'heat', 'recovery'];

  // ── Home V3 dashboard (flag-gated, presentation-only; founder comps
  // 2026-08-10) — every value below is derived from state this screen ALREADY
  // reads (userState / engine); no new store hooks, so the render-count
  // guarantees hold. Honest-data contract lives in homeV3Presentation.ts:
  // missing readings render an em dash and the chip renders nothing when no
  // provider has contributed. Sleep/HRV values come from
  // explainFieldArbitration — the SAME per-field winner the scoring path's
  // freshestNonNull selects (parity-proven in its test suite).
  const v3 = flags.home_v3_dashboard_enabled;
  const momentsOn = flags.moments_enabled;
  const v3Data = React.useMemo(() => {
    if (!v3) return null;
    const now = Date.now();
    const sleep = explainFieldArbitration(userState.biometrics, 'sleepHoursLastNight', now).winner;
    const hrv = explainFieldArbitration(userState.biometrics, 'hrvSdnn', now).winner;
    const sources = Object.entries(userState.biometrics ?? {})
      .filter(([, snap]) => snap != null)
      .map(([id]) => id as import('@/data/healthProviders').HealthProviderId);
    const chip = resolveHealthChip({
      sources,
      freshestFetchedAtMs: freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics),
      now,
    });
    return {
      chip,
      sleepText: formatSleepHours(sleep ? (sleep.value as number) : null),
      hrvText: formatHrvMs(hrv ? (hrv.value as number) : null),
      hydrationText: formatHydrationPct(userState.unitsConsumedToday, userState.dailyTarget),
    };
  }, [
    v3,
    userState.biometrics,
    userState.appleHealth,
    userState.unitsConsumedToday,
    userState.dailyTarget,
  ]);

  return (
    // The overlay host. AFScreen renders its children INSIDE a ScrollView, so a
    // success overlay mounted in there would be positioned against the scrolling
    // content box, not the viewport — it would slide away under the member's
    // thumb. This non-scrolling wrapper is the frame the confirmation fills.
    <View style={styles.root}>
      {/* One derived padding for BOTH signal layouts. The V3 grid used to get
          its own larger hard-coded constant, but the thing that has to clear the
          bar is the same thing in both — the last pixel of the scroll — and the
          derivation covers it identically, so the branch was carrying a second
          magic number for no behavioural reason. */}
      <AFScreen scroll contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
        {/* Wordmark + freshness (+ V3 health-connection chip — renders nothing
            when no provider has contributed data).

            FOUNDER §3 — 'AForce OS' STAYS, DEMOTED. It shipped at `afType.title1`
            (32/38), which made the app's own name the second-largest object on
            the screen, competing with the 76pt HydroState numeral for the first
            glance — the product announcing itself above the member's state. It
            is not deleted and it is not turned into a marketing splash: the same
            key renders in the same place, in the eyebrow register, as a
            restrained product identifier. Reading order is unchanged, so the
            approved sequence — quiet contextual greeting → subordinate brand →
            dominant HYDROSTATE — is exactly what the eye and VoiceOver get. */}
        <View style={styles.header}>
          <Text style={styles.welcome}>{t('home.welcome', { name: greeting })}</Text>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>{t('home.subtitle_title')}</Text>
            {v3Data?.chip ? (
              <View
                style={styles.v3Chip}
                accessible
                accessibilityLabel={`${v3Data.chip.label} ${v3Data.chip.live ? t('home.v3.chip_live') : t('home.v3.chip_synced')}`}
                testID="home-v3-health-chip"
              >
                <View style={[styles.v3ChipDot, !v3Data.chip.live && styles.v3ChipDotIdle]} />
                <Text style={styles.v3ChipText} numberOfLines={1}>
                  {v3Data.chip.label} · {v3Data.chip.live ? t('home.v3.chip_live') : t('home.v3.chip_synced')}
                </Text>
              </View>
            ) : null}
          </View>
          <HomeFreshnessLabel
            fetchedAtMs={freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics)}
            style={styles.freshness}
            testID="home-v2-freshness"
          />
        </View>

        {/* RC-1 Wave-2B (item 1) — offline intake outbox visibility. */}
        <AFOfflineBanner pendingCount={outboxPendingCount} hasFailedItem={outboxHasFailedItem} />

        {!isHydrated ? (
          /* The skeleton has to stand in for the signal block this screen is
             ABOUT to render, not the one it used to: V3's four-tile grid is two
             rows, and shaping three tiles in one row dropped a row of content on
             the reader the instant hydration landed. */
          <HomeSkeleton signals={v3 ? 'grid4' : 'row3'} />
        ) : (
          <>
            {/* THE HERO SLOT — exactly one of three, never a blend. */}
            {evidence === 'pending' ? (
              /* Evidence not known yet. Rendering the score here, even for the
                 one frame before the journal read lands, is precisely the
                 fabricated "BALANCED 76" this gate exists to prevent — so the
                 slot holds its shape and claims nothing. Short-lived by
                 construction: it is only reachable with no local intake. */
              <View style={styles.arcWrap}>
                <AFSkeleton
                  width={arcDims.size}
                  height={arcDims.size}
                  radius={arcDims.size / 2}
                  testID="home-baseline-pending"
                />
              </View>
            ) : evidence === 'building' ? (
              /* No entrance: BUILDING YOUR BASELINE is a statement about what we
                 do not know yet. Sliding it in would dress up an absence. */
              <HomeBaselineHero testID="home-baseline-hero" />
            ) : (
              /* Dominant readiness value + thin arc (tap → insights). The hero
                 wrapper is static — the arc's own draw-in IS the reveal, and
                 animating the container too would move the same thing twice. */
              <View>
                <Pressable
                  style={[styles.arcWrap, elite && styles.arcWrapPremium]}
                  onPress={() => router.push('/weekly-report')}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('home.v2.readiness_a11y', { score })} ${engine.performanceState.level}`}
                  testID="home-readiness-arc"
                >
                  {/* a11yHidden: the Pressable above already announces score + band,
                      so an inner progressbar would make the hero speak twice. */}
                  {/* SIGNATURE MOMENT 1 — the HydroState reveal. */}
                  <AFReadinessArc score={score} size={arcDims.size} stroke={arcDims.stroke} color={accent} animate={arcPlan.animateRing} a11yHidden>
                    {elite ? (
                      <EliteScoreNumber
                        score={score}
                        fromScore={arcPlan.fromScore}
                        countUp={arcPlan.countUp}
                        style={styles.score}
                      />
                    ) : (
                      <Text style={styles.score} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{score}</Text>
                    )}
                    <Text style={styles.scoreLabel}>{t('home.v2.readiness_label')}</Text>
                    {elite ? (
                      <View style={[styles.statePill, { borderColor: accent }]}>
                        <Text style={[styles.statePillText, { color: accentText }]}>
                          {engine.performanceState.level}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.stateLabel, { color: accentText }]}>
                        {engine.performanceState.level}
                      </Text>
                    )}
                  </AFReadinessArc>
                </Pressable>
                {/* The reading's evidence, stated where the reading is. One
                    quiet chip — 5px dot + a 9pt structural token, differentiated
                    by opacity only — so it qualifies the number without becoming
                    a second thing to look at. It is deliberately NOT inside the
                    arc and NOT a card: the hierarchy is one dominant number, and
                    this is a footnote on it. Only the `established` branch has a
                    reading to qualify, so only this branch carries it.

                    CORRECTION 6 (build-61 device QA) — the chip used to render
                    the bare rating token ("LIMITED"), which sits inches under a
                    band word and reads as a fourth verdict about the member's
                    body rather than a statement about the DATA. The rating is
                    unchanged (`homeConfidence` still resolves it, opacity ramp
                    untouched); it is now prefixed with the noun that names its
                    domain — "EVIDENCE: LIMITED" — so its role is unmistakable at
                    a glance and not only to a screen reader, which has carried
                    that noun via `a11yContext` since Wave 5. Composed at the call
                    site so the shared chip primitive keeps its one grammar. */}
                <View style={styles.confidenceRow}>
                  <ConfidenceChip
                    label={t('home.v2.confidence_chip', { rating: confidence.chip.label })}
                    opacity={confidence.chip.opacity}
                    a11yContext={t('home.v2.confidence_a11y_context')}
                  />
                </View>
                {/* Momentum, not a verdict (founder §1). `trendVerb` is
                    withheld when the trend is flat or when the verb would be
                    CRITICAL, and with nothing to report the line renders
                    NOTHING — so the run under the hero is band → evidence, and
                    the third line only appears when the score has actually
                    moved. */}
                <LiveStatusLine
                  direction={trend.direction}
                  delta={trend.delta}
                  ageSec={trend.ageSec}
                  verb={trendVerb}
                  accent={accentText}
                  testID="home-v2-live-status-line"
                />
              </View>
            )}

            {/* One command — SIGNATURE MOMENT 2 (the command reveal).

                CORRECTION 2 — `onPrimary` OPENS the logging surface. It does not
                log, does not credit and does not congratulate: the member has
                not said how much they drank yet. The write and the haptic moment
                both live on the confirm path. `primaryLoading` is the in-flight
                state the card has always accepted and this screen never passed —
                it also makes the button inert while a write is outstanding.

                FOUNDER §6 — the card is the FIFTH thing in the hierarchy, not
                the second hero. Nothing inside it changes here: `AFCommandCard`
                is composed by other surfaces and stays untouched, the primary
                action is preserved exactly, and WHY still reaches the member
                inline (the card's own one-line reason) with the full rationale
                one tap away. What changes is the SEPARATION Home gives it —
                previously the card began ~2pt under the trend line, so the
                reading and the instruction read as two stacked cards competing
                at the same altitude. A section-scale gap above it is what makes
                the eye finish the reading before it arrives at the move, and it
                applies to all three hero states so the rhythm never depends on
                how much evidence exists. */}
            <Animated.View style={styles.command} entering={commandReveal}>
              <AFCommandCard
                eyebrow={commandEyebrow}
                title={title || t('home.v2.default_command_title')}
                instruction={commandInstruction}
                primaryLabel={t('home.v2.log_water')}
                onPrimary={openWaterPicker}
                primaryLoading={isCompletingCycle}
                rationale={engine.command.explanation || undefined}
              />
              {voiceElite && (
                <Text style={styles.trust} testID="home-coach-trust">
                  {t('coach.trust_line')}
                </Text>
              )}
            </Animated.View>

            {/* AForce Moments (Phases 1–2, flag OFF in production) — NEXT MOMENT
                + today's preparation-relevant list. Additive section; renders
                nothing when the flag is off or no moments exist. */}
            {momentsOn && (
              <View style={styles.momentsSection}>
                <HomeMomentsSection />
              </View>
            )}

            {/* Signals — V3: four live-signal tiles (Hydration / Recovery /
                Sleep / HRV, missing readings render an em dash); flag off: the
                shipped three-tile row, byte-identical. */}
            <View style={styles.signalsSection}>
              <AFSectionLabel label={t(v3 ? 'home.v3.live_signals' : 'home.v2.signals_label')} />
              {v3 && v3Data ? (
                <View style={styles.v3Grid}>
                  <View style={styles.signals}>
                    <Signal label={t('home.v2.signal_hydration')} value={v3Data.hydrationText} />
                    <Signal label={t('home.v2.signal_recovery')} value={recoveryText} />
                  </View>
                  <View style={styles.signals}>
                    <Signal label={t('home.v3.signal_sleep')} value={v3Data.sleepText} />
                    <Signal label={t('home.v3.signal_hrv')} value={v3Data.hrvText} />
                  </View>
                </View>
              ) : (
                <View style={styles.signals}>
                  {signalOrder.map((key) => (
                    <React.Fragment key={key}>{signalTiles[key]}</React.Fragment>
                  ))}
                </View>
              )}
            </View>

            {/* WAVE 5 — the V3 "Completed today" section (three protocol rows +
                n/N count + streak / recovery-trend stat tiles) was DELETED here.
                Two reasons, both about honesty and hierarchy:

                TRUST — the rows were derived from `deriveTodaysProtocol`, which
                checked off "Hydration Stick" at one logged serving and "AForce
                Can" at half the daily target. A member who drank tap water got a
                green check asserting they had consumed a specific AForce product.
                A green check is the strongest certainty signal on the screen and
                it was backed by the weakest evidence. (There is no can data —
                sticks only, per the founder.)

                HIERARCHY — the day-streak numeral rendered at afType.title2 26pt,
                the second-largest number on Home. HydroState must not read as
                points or a game score, and nothing should compete with the arc.

                Nothing is lost: the streak lives on StreakCard / Progress, and the
                trend is already the LiveStatusLine directly under the arc. */}
          </>
        )}
      </AFScreen>

      {/* CORRECTION 2 — the logging surface. Shipped component, re-mounted:
          6 presets + a ±2 oz stepper, because real containers vary (a 16.9 oz
          bottle, a 24 oz tumbler, a 32 oz Nalgene) and the amount belongs to
          the member. Cancel / backdrop / hardware-back all write nothing.
          `accent` (not `accentText`) is correct here: the modal spends it on
          the confirm button's FILL and a 56pt numeral, and fills take the fill
          token. It stays mounted with `visible=false` so the picker's own
          reset-to-16 effect runs on every open. */}
      <WaterAmountModal
        visible={waterPickerOpen}
        accentColor={accent}
        onCancel={cancelWaterPicker}
        onConfirm={confirmWaterAmount}
      />

      {/* CORRECTION 2 — the acknowledgement. This overlay is the repo's
          shipped confirmation moment and its ONLY previous mount was inside
          `HomeScreenLegacy`, which `spec_home: true` makes unreachable — so a
          member on the live Home logged water and the product said nothing.
          Rendered from the cycle slice's own settled result (never from local
          state), so it can only appear for a write the store actually
          committed, and it carries the real before → after score. */}
      {showCycleSuccess && lastCycleResult && (
        <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // CORRECTION 2 — the non-scrolling overlay host (see the return statement).
  root: { flex: 1 },
  // AMENDMENT §2 — the bottom padding is NOT a static style any more. It has to
  // be `published tab-bar height + breathing room`, and the published height is
  // only knowable at render time, so it lives at the call site and its rule
  // lives in `homeSafeArea.ts`. Nothing device-specific may return here.
  momentsSection: { marginTop: 4 },
  // ── FOUNDER §5 — ONE VERTICAL RHYTHM, FROM SPACING TOKENS ──────────────────
  // The header used to claim almost as much vertical space as the instrument
  // (97pt vs 288pt on a 667pt device, from ad-hoc 8s and a 32pt brand line),
  // which is what made Home read as a stack of equal sections rather than one
  // reading with context around it. The header is now the SMALLEST block on the
  // screen and the hero the largest, all of it stepped off `Spacing[]` so the
  // rhythm is one scale instead of three loose numerics.
  header: { marginTop: Spacing[1], marginBottom: Spacing[3] },
  welcome: { ...afType.secondary, color: af.textTertiary },
  // FOUNDER §3 — kept, demoted (was `afType.title1`, 32/38, textPrimary: the
  // second-largest object on Home). The eyebrow register is what the product
  // already uses for structural identifiers, and `textSecondary` keeps it
  // legible and branded while conceding the glance to the numeral. No new
  // token, no new colour, no casing transform — the locale value renders as
  // written, in every language.
  brand: { ...afType.eyebrow, color: af.textSecondary, marginTop: Spacing[1] },
  freshness: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  // The hero owns the most negative space on the screen — above the ring, so
  // the reading arrives clear of the header; tight below it, so the evidence
  // chip reads as a caption ON the instrument (§4) rather than as the next
  // entry in a column of verdicts.
  arcWrap: { alignItems: 'center', marginTop: Spacing[6], marginBottom: Spacing[3] },
  // FOUNDER §4 — EVIDENCE IS METADATA, NOT A FOURTH JUDGEMENT. Same chip, same
  // rating, same opacity ramp, `homeConfidence.ts` untouched: what changes is
  // where it sits and what it belongs to. The ring's edge is the separation —
  // score, HYDROSTATE and the band word are INSIDE the instrument (they are the
  // reading); this sits just outside and just below it, pinned to the number it
  // qualifies. It is the lowest-weight text on the screen (a 5px dot + a 9pt
  // structural token on a monochrome opacity ramp — never a band colour), so it
  // answers "how sure is AForce?" and can never be mistaken for "how bad am I?".
  confidenceRow: { alignItems: 'center', marginBottom: 8 },
  // Premium arc hero gets more vertical presence (elite path only).
  arcWrapPremium: { marginTop: Spacing[8], marginBottom: Spacing[4] },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  // The name of the number, not a verdict about it — held close to the numeral
  // so the two read as one object.
  scoreLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: Spacing[1] },
  // The band word: second in the hierarchy, and the only interpretation Home
  // prints. Colour is applied at the call site from the band's `accentText` — a
  // fixed red here made every band's state word read as an alarm (Wave 5).
  // Tracking (the same device `afType.eyebrow` and LiveStatusLine already use
  // for structural caps) is what separates it from body copy at the SAME size —
  // it now reads as a state token rather than a 13pt sentence shouted in caps,
  // without gaining a single point of size.
  stateLabel: { ...afType.caption, letterSpacing: 1.2, marginTop: Spacing[2] },
  // FOUNDER §6 — the section-scale gap that stops the command card reading as a
  // second hero. Applies to every hero state (established / building / pending)
  // so the rhythm never depends on how much evidence exists.
  command: { marginTop: Spacing[7] },
  // Band-tinted state pill (accent from homePresentation; never statusColor).
  statePill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statePillText: { ...afType.eyebrow },
  signalsSection: { marginTop: 28, gap: 12 },
  signals: { flexDirection: 'row', gap: 12 },
  signal: {
    flex: 1,
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
  },
  signalLabel: { ...afType.eyebrow, color: af.textTertiary },
  signalValue: { ...afType.title3, color: af.textPrimary },
  trust: { ...afType.caption, color: af.textTertiary, marginTop: 10, lineHeight: 17 },
  // ── Home V3 dashboard (home_v3_dashboard_enabled) ──
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  v3Chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  v3ChipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: af.green },
  v3ChipDotIdle: { backgroundColor: af.textTertiary },
  v3ChipText: { ...afType.caption, color: af.textSecondary },
  v3Grid: { gap: 12 },
});
