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
import { edRhythm, edStock, edType } from '@/theme/editorialTokens';
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
  useEdInk,
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

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string; source?: IntakeSource },
  ) => Promise<void>;
  dismissSuccess: () => void;
}

export function EditorialHomeScreen() {
  const { t } = useTranslation();
  const userState = useUserSlice();
  const { isHydrated } = useBootstrapSlice();
  const engine = useEngineSlice();
  const flags = useFeatureFlags();
  const { logIntake, dismissSuccess } = useActionsSlice<HomeActions>();
  const clerkUser = useUser().user;
  const router = useRouter();
  const ink = useEdInk();
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
  const trendVerb =
    trend.direction === 'flat' || statusVerb === 'CRITICAL' ? undefined : statusVerb;

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

  const dateLabel = React.useMemo(() => mastheadDateLabel(new Date()), []);
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
              <HomeFreshnessLabel
                fetchedAtMs={freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics)}
                hasProviderArtifact={hasAnyProviderArtifact(userState.appleHealth, userState.biometrics)}
                testID="editorial-freshness"
              />
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
                      <EdPressureField size={300} intensity={intensity ?? 0}>
                        <EdNumber value={score} role="numberHero" caption={t('home.v2.readiness_label')} />
                      </EdPressureField>
                      <EdStateWord word={engine.performanceState.level} style={styles.stateWord} />
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
                    <EdNextMomentLine />
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
                  <View style={styles.folio}>
                    <EdEvidenceLine parts={['MEMBER EDITION', dateLabel]} />
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
