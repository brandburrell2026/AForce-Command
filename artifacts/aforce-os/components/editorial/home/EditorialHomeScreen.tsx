/**
 * EditorialHomeScreen — HOME, The Cover (E2, founder ruling 2026-08-29;
 * Black Issue restyle, founder decision D4, 2026-10-06).
 *
 * BLACK ISSUE (D4): the Cover now carries the card-and-list layout of the
 * reference (docs/pr-evidence/black-issue/figma/01-home.png): masthead →
 * state statement + cover numeral → YOUR NEXT MOVE → four signals →
 * SIGNALS card → NEXT MOMENT → full-width CTA. The pressure field and the
 * И mark are retired from Home; the state word is the SAME canonical band
 * token rendered as the statement (EdStateWord variant="statement"). Every
 * value still arrives from the production chain below; the reference's
 * weather/city furniture has no source on Home and is not rendered.
 *
 * The Editorial OS composition of the SAME Home truth. Every value on this
 * screen comes from the exact production chain HomeScreenV2 consumes:
 * the guarded engine slice (Decision Guard seam), the Wave-5 evidence gate,
 * the §53/§54/§55 confidence/freshness resolvers, the biometrics
 * arbitration winners, and the guarded Moments lane. This file makes no
 * intelligence read HomeScreenV2 does not already make, and authors no
 * copy the engine did not author.
 *
 * Locked rulings enforced here and by editorialHomeLaw.test.ts:
 *  R1 — date furniture only, no issue number.
 *  R3 — a known member name is subordinate masthead furniture; unknown
 *       identity renders nothing.
 *  Pressure field — presentation of the canonical score alone; absent when
 *       the reading is withheld.
 *  Command — the guarded canonical string through the SAME parse; verbatim.
 *  Missing data — silence and em-dashes; nothing is manufactured.
 *
 * The water-logging wiring (open-only picker, synchronous double-log ref,
 * settled-cycle haptic, store-settled confirmation overlay) is duplicated
 * verbatim from HomeScreenV2 so the flag-OFF path stays byte-untouched —
 * both screens dispatch the identical single `logIntake`.
 *
 * TWO DELIBERATE DIVERGENCES FROM HomeScreenV2 (both surfaced in the E2
 * review; neither changes production behavior, since both flags below are
 * OFF in DEFAULT_FLAGS — recorded here so they are decisions, not drift):
 *
 *  1. `elite_voice_coach_enabled` is NOT wired. V2 re-voices the command
 *     through coachPhrasing when that flag is on — a POST-guard rewrite of
 *     delivered copy. The E2 command ruling is that the Cover renders the
 *     guarded canonical command verbatim, so the editorial path deliberately
 *     has no re-voicing lane. In the demo profile (where the flag is on) the
 *     two Home paths therefore phrase the same command differently.
 *  2. `home_v3_dashboard_enabled` does not gate the signal surfaces here.
 *     V2 treats the chip + Sleep/HRV as additive V3 sections; on the Cover
 *     the honest-signals footer IS the composition's signal register, so it
 *     always renders — from the same resolvers, with the same em-dashes and
 *     the same never-connected silence. The flag is ON in production, so
 *     production sees no difference. (The V2-only heat tile has no Cover
 *     equivalent — it exists solely on V2's flag-OFF path.)
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/expo';
import { Animated, Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

import { AFCard, AFMasthead, AFPrimaryButton, AFScreen, AFOfflineBanner, AFSkeleton } from '@/components/ui';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { WaterAmountModal } from '@/components/WaterAmountModal';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';
import { HomeFreshnessLabel } from '@/components/home/HomeFreshnessLabel';
import { LiveStatusLine } from '@/components/home/LiveStatusLine';
import { countRealHistoryEntries, resolveHomeEvidence } from '@/components/home/homeBaselineState';
import { resolveHomeConfidence } from '@/components/home/homeConfidence';
import { freshestBiometricsFetchedAt, hasAnyProviderArtifact } from '@/components/home/homeFreshness';
import { resolveHomePresentation } from '@/components/home/homePresentation';
import { resolveHomeScrollBottomPadding } from '@/components/home/homeSafeArea';
import {
  EM_DASH,
  formatHydrationPct,
  formatHrvMs,
  formatSleepHours,
  resolveHealthChip,
} from '@/components/home/homeV3Presentation';
import { fireMoment } from '@/services/haptics';
import { getStatusVerb } from '@/services/statusVerb';
import { useAppStateGatedInterval } from '@/hooks/useAppStateGatedInterval';
import { useScoreTrend } from '@/hooks/useScoreTrend';
import { useFeatureFlags } from '@/store/useAppStore';
import {
  useActionsSlice,
  useBootstrapSlice,
  useCycleSlice,
  useEngineSlice,
  useHistorySlice,
  useUserSlice,
} from '@/store/slices';
import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';
import { explainFieldArbitration } from '@/utils/biometricsAggregator';
import { parseEngineActionCopy } from '@/utils/recovery/recoveryCommandFromStore';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { edInkFor, edRhythm, edStock, edType } from '@/theme/editorialTokens';
import type { FluidType } from '@/types';
import type { IntakeSource } from '@/services/intakeSource';

import {
  EdRule,
  EdStateWord,
  EdStatement,
  EdSurface,
  useEdSettle,
} from '../index';
import { EdHomeCommand } from './EdHomeCommand';
import { ConciergeEntryCard } from '@/components/concierge/ConciergeEntryCard';
import { SocialModeIndicator } from '@/components/social/SocialModeIndicator';
import { EdHomeSignalFooter } from './EdHomeSignalFooter';
import { EdNextMomentLine } from './EdNextMomentLine';
import {
  mastheadDateLabel,
  mastheadTimeLabel,
  memberFurniture,
} from './editorialHomePresentation';

/** Date furniture re-check cadence — foreground-gated, like every other
 *  Home tick. One minute is enough to cross midnight honestly. */
const DATE_RECHECK_MS = 60 * 1000;

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string; source?: IntakeSource },
  ) => Promise<void>;
  dismissSuccess: () => void;
}

export function EditorialHomeScreen({
  momentsFixture,
}: {
  /** Gallery-only deterministic override (the momentsFixture idiom). */
  momentsFixture?: { moments: import('@/types/moments').Moment[]; nowIso: string };
} = {}) {
  const { t } = useTranslation();
  const userState = useUserSlice();
  const { isHydrated, lastRefreshStale } = useBootstrapSlice();
  const engine = useEngineSlice();
  const flags = useFeatureFlags();
  const { logIntake, dismissSuccess } = useActionsSlice<HomeActions>();
  const clerkUser = useUser().user;
  const router = useRouter();
  // This screen IS the black stock it renders below, so its inks are resolved
  // explicitly rather than through useEdInk() — a hook here would read the
  // context ABOVE this component, not the EdSurface it owns.
  const ink = edInkFor('black');
  const settle = useEdSettle();

  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const scrollBottomPadding = resolveHomeScrollBottomPadding(tabBarHeight);

  // ── Water logging — duplicated VERBATIM from HomeScreenV2 (CORRECTION 2):
  // open-only picker, synchronous double-log ref, settled-cycle haptic.
  const { showCycleSuccess, lastCycleResult, isCompletingCycle } = useCycleSlice();
  const [waterPickerOpen, setWaterPickerOpen] = React.useState(false);
  const confirmInFlightRef = React.useRef(false);
  const openWaterPicker = React.useCallback(() => {
    if (isCompletingCycle || confirmInFlightRef.current || showCycleSuccess) return;
    setWaterPickerOpen(true);
  }, [isCompletingCycle, showCycleSuccess]);
  const cancelWaterPicker = React.useCallback(() => {
    setWaterPickerOpen(false);
  }, []);
  const confirmWaterAmount = React.useCallback(
    (oz: number) => {
      if (confirmInFlightRef.current || isCompletingCycle || showCycleSuccess) return;
      confirmInFlightRef.current = true;
      setWaterPickerOpen(false);
      void logIntake('water', { ozOverride: oz, source: 'home' });
    },
    [logIntake, isCompletingCycle, showCycleSuccess],
  );
  React.useEffect(() => {
    if (!confirmInFlightRef.current) return;
    if (isCompletingCycle) return;
    confirmInFlightRef.current = false;
    if (!lastCycleResult) return;
    fireMoment('command_completed');
  }, [isCompletingCycle, lastCycleResult]);

  // Offline outbox visibility — identical flag gating to HomeScreenV2.
  const outboxState = useIntakeOutboxStore();
  const outboxPendingCount = flags.offline_intake_outbox_enabled ? selectPendingCount(outboxState) : 0;
  const outboxHasFailedItem = flags.offline_intake_outbox_enabled ? selectHasFailedItem(outboxState) : false;

  // ── Wave-5 evidence gate — same inputs, same resolver.
  const intakeEventCount = userState.intakeEvents?.length ?? 0;
  const history = useHistorySlice();
  const loggedDayCount = isHydrated ? countRealHistoryEntries(history) : null;
  const evidence = resolveHomeEvidence({ intakeEventCount, loggedDayCount });

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
  const presentation = resolveHomePresentation(engine.performanceState.level);

  // Momentum line — same two withholdings as HomeScreenV2 (founder §1).
  const trend = useScoreTrend(score);
  const statusVerb = React.useMemo(
    () => getStatusVerb(engine.performanceState.level, trend.direction),
    [engine.performanceState.level, trend.direction],
  );
  // Lane A (2026-08-30) — a third withholding beside the two founder §1
  // rules: a stale delivery's score is a local recompute the server never
  // confirmed, so the momentum claim is withheld. The reading still shows.
  const trendVerb =
    trend.direction === 'flat' || statusVerb === 'CRITICAL' || lastRefreshStale
      ? undefined
      : statusVerb;

  // ── Signals — the SAME arbitration winners and honest formatters the V3
  // grid consumes. Computed unconditionally here (the editorial footer is
  // the one signals surface on this screen; home_v3_dashboard_enabled still
  // gates the HomeScreenV2 grid on the flag-OFF path).
  const signalData = React.useMemo(() => {
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
    userState.biometrics,
    userState.appleHealth,
    userState.unitsConsumedToday,
    userState.dailyTarget,
  ]);

  // R1 — truthful date furniture. Home is the resident tab, so a mount-frozen
  // date would still read yesterday after a member returns the next morning
  // (caught in E2 review). The same app-state-gated tick the rest of Home
  // uses re-derives it; no timer runs in the background.
  const [dateTick, setDateTick] = React.useState(() => Date.now());
  useAppStateGatedInterval(() => setDateTick(Date.now()), DATE_RECHECK_MS);
  const dateLabel = React.useMemo(() => mastheadDateLabel(new Date(dateTick)), [dateTick]);
  const timeLabel = React.useMemo(() => mastheadTimeLabel(new Date(dateTick)), [dateTick]);
  const member = memberFurniture(clerkUser?.firstName);
  const momentsOn = flags.moments_enabled;
  const freshestFetchedAtMs = freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics);
  const anyProviderArtifact = hasAnyProviderArtifact(userState.appleHealth, userState.biometrics);

  return (
    <View style={styles.root} testID="editorial-home-root">
      <EdSurface stock="black" style={styles.fill}>
        <AFScreen scroll contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
          <Animated.View style={settle}>
            {/* Masthead: wordmark, the member's name as subordinate furniture
                (R3: nothing when unknown), date + clock on the right (R1). The
                reference's city/temperature has no source on Home — absent. */}
            <AFMasthead
              greeting={member ? t('home.welcome', { name: member }) : undefined}
              meta={dateLabel}
              metaSecondary={timeLabel}
              breadcrumb={`${t('tabs.home')} / ${t('home.v2.readiness_label')}`}
              testID="editorial-masthead"
            />
            <AFOfflineBanner pendingCount={outboxPendingCount} hasFailedItem={outboxHasFailedItem} />

            {!isHydrated ? (
              <HomeSkeleton signals="row3" />
            ) : (
              <>
                {/* Hero — exactly one of three, never a blend (Wave 5). */}
                {evidence === 'pending' ? (
                  <View style={styles.heroSlot}>
                    <AFSkeleton width={220} height={120} radius={12} testID="editorial-baseline-pending" />
                  </View>
                ) : evidence === 'building' ? (
                  <View style={styles.heroSlot} testID="editorial-baseline-hero">
                    <EdStatement accessibilityRole="header">{t('home.v2.baseline_title')}</EdStatement>
                    <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 10 }]}>
                      {t('home.v2.baseline_body')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroSlot}>
                    {/* The statement is the screen's header: the canonical band
                        token in sentence case (D4). */}
                    <EdStateWord word={engine.performanceState.level} variant="statement" accessibilityRole="header" style={styles.stateWord} />
                    <Pressable
                      onPress={() => router.push('/weekly-report')}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('home.v2.readiness_a11y', { score })} ${engine.performanceState.level}`}
                      style={styles.heroPress}
                      testID="editorial-hydrostate"
                    >
                      {/* Single announcement: the Pressable above speaks the
                          score + band once. Its children are hidden from the
                          reader so the hero cannot speak twice — the same
                          rule HomeScreenV2 applies via the arc's a11yHidden. */}
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={styles.heroInner}
                      >
                        <Text
                          maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
                          style={[edType.numberCover as TextStyle, styles.coverNumber, { color: ink.primary }]}
                        >
                          {score}
                        </Text>
                        <View style={styles.readinessMark}>
                          <Text style={[edType.micro as TextStyle, { color: af.redText }]}>
                            {t('home.v2.readiness_label')}
                          </Text>
                          <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 4 }]}>
                            {`0–100 · ${engine.performanceState.level}`}
                          </Text>
                          <View style={[styles.readinessTrack, { backgroundColor: ink.rule }]}>
                            <View style={[styles.readinessFill, { width: `${score}%`, backgroundColor: af.red }]} />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                    <View style={styles.evidenceRow}>
                      <ConfidenceChip
                        label={t('home.v2.confidence_chip', { rating: confidence.chip.label })}
                        opacity={confidence.chip.opacity}
                        a11yContext={t('home.v2.confidence_a11y_context')}
                      />
                      <LiveStatusLine
                        direction={trend.direction}
                        delta={trend.delta}
                        ageSec={trend.ageSec}
                        verb={trendVerb}
                        accent={presentation.accentText}
                        testID="editorial-live-status-line"
                      />
                    </View>
                  </View>
                )}

                <EdRule />
                {/* Kicker + why label are AFCommandCard's own hardcoded
                    defaults, reproduced verbatim for copy parity. The CTA
                    renders at the foot of the screen (reference layout). */}
                <EdHomeCommand
                  kicker="Your next move"
                  title={title || t('home.v2.default_command_title')}
                  instruction={instruction}
                  rationale={engine.command.explanation || undefined}
                  whyLabel="Why this command"
                />

                <View style={styles.signalsSection}>
                  <EdHomeSignalFooter
                    signals={[
                      { label: t('home.v2.signal_hydration'), value: signalData.hydrationText, accent: true },
                      { label: t('home.v2.signal_recovery'), value: EM_DASH },
                      { label: t('home.v3.signal_sleep'), value: signalData.sleepText },
                      { label: t('home.v3.signal_hrv'), value: signalData.hrvText },
                    ]}
                  />
                </View>

                {/* SIGNALS card — provenance furniture only: which source,
                    whether it is live, when it was last checked, and the
                    last-known-delivery notice. Nothing summarised, nothing
                    authored. Renders only when there is something to say. */}
                {signalData.chip || anyProviderArtifact || lastRefreshStale ? (
                  <AFCard style={styles.signalsCard} testID="editorial-signals-card">
                    <Text style={[edType.caption as TextStyle, { color: af.redText }]}>
                      {t('home.v2.signals_label').toUpperCase()}
                    </Text>
                    {signalData.chip ? (
                      <Text
                        style={[edType.confirm as TextStyle, { color: ink.primary, marginTop: 8 }]}
                        accessibilityLabel={`${signalData.chip.label} ${signalData.chip.live ? t('home.v3.chip_live') : t('home.v3.chip_synced')}`}
                        testID="editorial-health-chip"
                      >
                        {signalData.chip.label} · {signalData.chip.live ? t('home.v3.chip_live') : t('home.v3.chip_synced')}
                      </Text>
                    ) : null}
                    {/* HomeFreshnessLabel renders a bare <Text style={style}> with
                        no color of its own — an unstyled pass would paint RN's
                        default near-black on the black stock (caught in E2 review).
                        The editorial micro/quiet pairing is passed explicitly. */}
                    <HomeFreshnessLabel
                      fetchedAtMs={freshestFetchedAtMs}
                      hasProviderArtifact={anyProviderArtifact}
                      style={styles.freshness}
                      testID="editorial-freshness"
                    />
                    {/* Lane A — last-known delivery. Not an "offline" claim (the
                        producer cannot tell unreachable from rejecting), no retry
                        promise, no timestamp. */}
                    {lastRefreshStale ? (
                      <Text style={styles.staleNotice} testID="editorial-stale-notice">
                        {t('home.v2.stale_notice')}
                      </Text>
                    ) : null}
                  </AFCard>
                ) : null}

                {momentsOn ? (
                  <View style={styles.momentsSection}>
                    <EdNextMomentLine
                      fixtureMoments={momentsFixture?.moments}
                      fixtureNowIso={momentsFixture?.nowIso}
                    />
                  </View>
                ) : null}

                {/* Social Mode indicator — a live or stale open session is a fact
                    about the member's state; shown with an End-the-night control
                    so a demo tap can never silently steer the command (2026-10-06). */}
                <SocialModeIndicator testID="editorial-social-indicator" />

                {/* AForce Concierge entry — one quiet affordance; states nothing
                    about the body. Renders nothing when ai_concierge_enabled is off. */}
                <View style={styles.conciergeSection}>
                  <ConciergeEntryCard tone="editorial" testID="editorial-concierge-entry" />
                </View>

                {/* The one action: opens the logging surface, never logs
                    (open-only, CORRECTION 2). */}
                <View style={styles.ctaSection}>
                  <AFPrimaryButton
                    label={t('home.v2.log_water')}
                    onPress={openWaterPicker}
                    loading={isCompletingCycle}
                    trailingIcon="plus"
                    testID="editorial-log-water"
                  />
                </View>
              </>
            )}
          </Animated.View>
        </AFScreen>
      </EdSurface>

      <WaterAmountModal
        visible={waterPickerOpen}
        accentColor={presentation.accent}
        onCancel={cancelWaterPicker}
        onConfirm={confirmWaterAmount}
      />
      {showCycleSuccess && lastCycleResult && (
        <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: edStock.black },
  fill: { flex: 1 },
  heroSlot: {
    marginTop: 4,
    marginBottom: 14,
  },
  stateWord: {
    marginBottom: 2,
  },
  heroPress: {
    alignItems: 'flex-start',
    minHeight: edRhythm.minTarget,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 16,
    flexWrap: 'wrap',
  },
  coverNumber: {
    includeFontPadding: false,
  },
  readinessMark: {
    paddingBottom: 14,
    minWidth: 140,
    flexShrink: 1,
  },
  readinessTrack: {
    height: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  readinessFill: {
    height: 2,
  },
  freshness: {
    ...edType.micro,
    color: edInkFor('black').quiet,
    marginTop: 6,
  },
  staleNotice: {
    ...edType.micro,
    color: edInkFor('black').quiet,
    marginTop: 4,
  },
  evidenceRow: {
    marginTop: 10,
    rowGap: 6,
    alignItems: 'flex-start',
  },
  signalsSection: {
    marginTop: 14,
  },
  signalsCard: {
    marginTop: 4,
  },
  momentsSection: {
    marginTop: 22,
  },
  conciergeSection: {
    marginTop: 18,
  },
  ctaSection: {
    marginTop: 26,
  },
});
