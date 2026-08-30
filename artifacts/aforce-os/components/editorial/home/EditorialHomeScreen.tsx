/**
 * EditorialHomeScreen — HOME, The Cover (E2, founder ruling 2026-08-29).
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

import { AFScreen, AFOfflineBanner, AFSkeleton } from '@/components/ui';
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
import { edInkFor, edRhythm, edStock, edType } from '@/theme/editorialTokens';
import type { FluidType } from '@/types';
import type { IntakeSource } from '@/services/intakeSource';

import {
  EdEvidenceLine,
  EdMasthead,
  EdNumber,
  EdPressureField,
  EdRule,
  EdStateWord,
  EdStatement,
  EdSurface,
  useEdSettle,
} from '../index';
import { EdHomeCommand } from './EdHomeCommand';
import { EdHomeSignalFooter } from './EdHomeSignalFooter';
import { EdNextMomentLine } from './EdNextMomentLine';
import {
  mastheadDateLabel,
  memberFurniture,
  pressureIntensity,
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
  const member = memberFurniture(clerkUser?.firstName);
  const intensity = pressureIntensity(score);
  const momentsOn = flags.moments_enabled;

  return (
    <View style={styles.root} testID="editorial-home-root">
      <EdSurface stock="black" style={styles.fill}>
        <AFScreen scroll contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
          <Animated.View style={settle}>
            <EdMasthead left={`AFORCE · ${dateLabel}`} right={member ?? undefined} />
            <View style={styles.furnitureRow}>
              {signalData.chip ? (
                <Text
                  style={[edType.micro as TextStyle, { color: ink.quiet }]}
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
                fetchedAtMs={freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics)}
                hasProviderArtifact={hasAnyProviderArtifact(userState.appleHealth, userState.biometrics)}
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
            </View>
            <AFOfflineBanner pendingCount={outboxPendingCount} hasFailedItem={outboxHasFailedItem} />

            {!isHydrated ? (
              <HomeSkeleton signals="row3" />
            ) : (
              <>
                {/* Hero — exactly one of three, never a blend (Wave 5). */}
                {evidence === 'pending' ? (
                  <View style={styles.heroSlot}>
                    <AFSkeleton width={220} height={220} radius={110} testID="editorial-baseline-pending" />
                  </View>
                ) : evidence === 'building' ? (
                  <View style={styles.heroSlot} testID="editorial-baseline-hero">
                    <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>
                      {t('home.v2.readiness_label')}
                    </Text>
                    <EdStatement style={styles.buildingTitle}>{t('home.v2.baseline_title')}</EdStatement>
                    <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 10 }]}>
                      {t('home.v2.baseline_body')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.heroSlot}>
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
                        <EdPressureField size={300} intensity={intensity ?? 0}>
                          <EdNumber value={score} role="numberHero" caption={t('home.v2.readiness_label')} />
                        </EdPressureField>
                        <EdStateWord word={engine.performanceState.level} style={styles.stateWord} />
                      </View>
                    </Pressable>
                    <View style={styles.evidenceRow}>
                      <ConfidenceChip
                        label={t('home.v2.confidence_chip', { rating: confidence.chip.label })}
                        opacity={confidence.chip.opacity}
                        a11yContext={t('home.v2.confidence_a11y_context')}
                      />
                    </View>
                    <LiveStatusLine
                      direction={trend.direction}
                      delta={trend.delta}
                      ageSec={trend.ageSec}
                      verb={trendVerb}
                      accent={presentation.accentText}
                      testID="editorial-live-status-line"
                    />
                  </View>
                )}

                <EdRule />
                {/* Kicker + why label are AFCommandCard's own hardcoded
                    defaults, reproduced verbatim for copy parity. */}
                <EdHomeCommand
                  kicker="Your next move"
                  title={title || t('home.v2.default_command_title')}
                  instruction={instruction}
                  rationale={engine.command.explanation || undefined}
                  whyLabel="Why this command"
                  primaryLabel={t('home.v2.log_water')}
                  onPrimary={openWaterPicker}
                  primaryLoading={isCompletingCycle}
                />

                {momentsOn ? (
                  <View style={styles.momentsSection}>
                    <EdNextMomentLine
                      fixtureMoments={momentsFixture?.moments}
                      fixtureNowIso={momentsFixture?.nowIso}
                    />
                  </View>
                ) : null}

                <View style={styles.footerSection}>
                  <EdHomeSignalFooter
                    signals={[
                      { label: t('home.v2.signal_hydration'), value: signalData.hydrationText },
                      { label: t('home.v2.signal_recovery'), value: EM_DASH },
                      { label: t('home.v3.signal_sleep'), value: signalData.sleepText },
                      { label: t('home.v3.signal_hrv'), value: signalData.hrvText },
                    ]}
                  />
                  {/* Folio furniture is the locale-formatted date alone: no
                      issue number (R1) and no new untranslated English in an
                      11-locale app. */}
                  <View style={styles.folio}>
                    <EdEvidenceLine parts={[dateLabel]} />
                  </View>
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
  furnitureRow: {
    marginTop: 10,
    rowGap: 4,
  },
  heroSlot: {
    marginTop: 26,
    marginBottom: 8,
  },
  heroInner: {
    alignItems: 'center',
  },
  freshness: {
    ...edType.micro,
    color: edInkFor('black').quiet,
    marginTop: 2,
  },
  staleNotice: {
    ...edType.micro,
    color: edInkFor('black').quiet,
    marginTop: 2,
  },
  heroPress: {
    alignItems: 'center',
    minHeight: edRhythm.minTarget,
  },
  stateWord: {
    marginTop: 2,
  },
  buildingTitle: {
    marginTop: 12,
  },
  evidenceRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  momentsSection: {
    marginTop: 18,
  },
  footerSection: {
    marginTop: 26,
  },
  folio: {
    marginTop: 16,
  },
});
