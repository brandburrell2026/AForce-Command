/**
 * Home — AForce OS Hydration Control System.
 *
 * Minimal, score-driven command surface. Every visible element
 * (headline, orb digit, status label, consequence line, CTA, command
 * preview) is derived from the live hydration score via
 * `getHydrationStatus(score)` so nothing can be in conflicting state.
 *
 * Preserves: Clerk auth gating, expo-router tabs, the score engine,
 * the Voice Engine (score-band + risk-timer hooks, voice button +
 * overlay), Phantom Band mirroring, cycle success overlay, score
 * breakdown sheet on orb tap, and the onboarding overlay.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/Icon';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { LinearGradient } from 'expo-linear-gradient';

import { GradientBackground } from '@/components/GradientBackground';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { ScoreBreakdownSheet } from '@/components/ScoreBreakdownSheet';
import { CommandConsole } from '@/components/home/CommandConsole';
import { EntryActions } from '@/components/home/EntryActions';
import { LiveStatusLine } from '@/components/home/LiveStatusLine';
import { NotificationBanner } from '@/components/home/NotificationBanner';
import { SmartModesBanner } from '@/components/home/SmartModesBanner';
import { LocationInsightBanner } from '@/components/home/LocationInsightBanner';
import { HomeDashboard } from '@/components/home/HomeDashboard';
import { MetabolicReadinessZone } from '@/components/home/MetabolicReadinessZone';
import { PerformanceAgeZone } from '@/components/home/PerformanceAgeZone';
import { VoiceCheckInZone } from '@/components/home/VoiceCheckInZone';
import { ActivationJourneyZone } from '@/components/home/ActivationJourneyZone';
import { useAnalyticsRecorder } from '@/hooks/useAnalyticsRecorder';
import { useScoreTrend } from '@/hooks/useScoreTrend';
import { getStatusVerb } from '@/services/statusVerb';
import { AIVideoPlayer } from '@/components/AIVideoPlayer';
import { matchVideo } from '@/services/videoEngine';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { VoiceButton } from '@/components/VoiceButton';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { StatusPulseOrb } from '@/components/StatusPulseOrb';
import { FlavorPickerModal, type FlavorChoice } from '@/components/FlavorPickerModal';
import { BiometricDetailSheet, type BiometricSheetPayload } from '@/components/home/BiometricDetailSheet';
import { deriveRecoveryLoad, type StrainLevel } from '@/services/biometricIntelligence';
import { homeCommand, type HomeCommandActionType } from '@/utils/homeCommand';
import type { VoiceState } from '@/types/voice';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { WEB_TOP_PADDING, WEB_BOTTOM_PADDING, TAB_BAR_HEIGHT } from '@/constants/layout';
import { useScoreBandVoice } from '@/hooks/useScoreBandVoice';
import { useRiskTimerVoice } from '@/hooks/useRiskTimerVoice';
import { useHeatGuard } from '@/hooks/useHeatGuard';
import { DisplayedAccentProvider, useDisplayedAccent } from '@/hooks/useDisplayedAccent';
import type { HeatRiskBand } from '@/types/heat';
import {
  getHeatBandFromCelsius,
  TEMP_HEAT_BAND_COLOR,
  TEMP_HEAT_BAND_LABEL,
  type TempHeatBand,
} from '@/utils/heatBand';

import { useAppStore } from '@/store/useAppStore';
import {
  useEngineSlice,
  useUserSlice,
  useIntakeSlice,
  useCycleSlice,
  useActionsSlice,
} from '@/store/slices';
import { phantomBandService } from '@/services/phantomBandService';
import { Colors } from '@/theme/colors';
import {
  getHydrationStatus,
  formatTemperatureF,
  minutesSince,
} from '@/services/hydrationStatus';
import type { FluidType } from '@/types';

// Phase 2 (June 2026) — "simplify after the opening": the Home surface is
// trimmed to the four essentials (Readiness hero · Hydration Status · one
// command · one CTA). The modules below the CTA are kept mounted in code but
// NOT rendered on Home, gated by this single flag so the trim is fully
// reversible and the engines they read stay alive ("Build 100% · Show 10%").
// Flip to `true` to restore the expanded Home.
const SHOW_EXPANDED_HOME = false;

// Recovery Load sheet copy (mirrors EntryActions) — used by the `recover`
// command CTA to host the BiometricDetailSheet directly on Home.
const STRAIN_LABEL: Record<StrainLevel, string> = {
  low: 'Minimal load',
  moderate: 'Moderate load',
  elevated: 'Elevated strain',
  high: 'High strain',
};

// ─── Header ──────────────────────────────────────────────────────────

function useNow(intervalMs: number = 30_000): Date {
  const [now, setNow] = React.useState<Date>(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

interface HeaderProps {
  greetingName: string;
  city: string | null;
  tempLabel: string | null;
  onShare?: () => void;
}

function MinimalHeader({ greetingName, city, tempLabel, onShare }: HeaderProps) {
  const segments = [city, tempLabel].filter(
    (s): s is string => !!s && s.length > 0,
  );
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>Welcome, {greetingName}</Text>
          <Text style={styles.brand}>AForce OS</Text>
        </View>
        {onShare && (
          <TouchableOpacity
            onPress={onShare}
            activeOpacity={0.85}
            style={styles.shareBtn}
            accessibilityRole="button"
            accessibilityLabel="Share your status"
            testID="home-share-button"
          >
            <Icon name="share" size={15} color={Colors.text.primary} />
          </TouchableOpacity>
        )}
      </View>
      {segments.length > 0 && (
        <View style={styles.statusBar} testID="home-location-line">
          <View style={styles.statusDot} />
          {segments.map((seg, i) => (
            <React.Fragment key={`${seg}-${i}`}>
              {i > 0 && <View style={styles.statusSep} />}
              <Text style={styles.statusSegment}>{seg}</Text>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Score-driven body (consumes DisplayedAccentProvider) ────────────

// ─── Live Signals strip (Heat) ───────────────────────────────────────

// Heat-pill colors and labels are sourced from the temperature-band
// helper so this component, the voice escalation gate, and any other
// heat-pill consumer share the same source of truth.
const HEAT_BAND_COLOR = TEMP_HEAT_BAND_COLOR;
const HEAT_BAND_LABEL = TEMP_HEAT_BAND_LABEL;

interface SignalPillProps {
  icon: IconName;
  label: string;
  value: string;
  tint: string;
  active?: boolean;
  onPress: () => void;
  testID: string;
}

function SignalPill({ icon, label, value, tint, active, onPress, testID }: SignalPillProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      testID={testID}
      style={[
        styles.signalPill,
        {
          borderColor: active ? tint : `${tint}55`,
          backgroundColor: active ? `${tint}1A` : 'rgba(255,255,255,0.03)',
        },
      ]}
    >
      <Icon name={icon} size={12} color={tint} />
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={[styles.signalValue, { color: tint }]}>{value}</Text>
    </TouchableOpacity>
  );
}

interface BodyProps {
  onOpenBreakdown: () => void;
  onCommandCta: (actionType: HomeCommandActionType) => void;
  onTapHeat: () => void;
  isCompletingCycle: boolean;
  lastIntakeMinutes: number | null;
  voiceCoachEnabled: boolean;
  orbSize: number;
  heatBand: TempHeatBand;
  heatTempLabel: string | null;
  /** True when an actionable protocol step is queued (drives the command). */
  protocolAvailable: boolean;
}

function ScoreDrivenBody({
  onOpenBreakdown,
  onCommandCta,
  onTapHeat,
  isCompletingCycle,
  lastIntakeMinutes,
  voiceCoachEnabled,
  orbSize,
  heatBand,
  heatTempLabel,
  protocolAvailable,
}: BodyProps) {
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const intake = useIntakeSlice();
  const { timerSeconds } = useCycleSlice();
  // Use the in-flight tweened score when available so headline / orb /
  // CTA all flip bands on the same frame.
  const displayed = useDisplayedAccent();
  const displayedScore = displayed?.displayedScore ?? engine.score;
  const status = React.useMemo(
    () => getHydrationStatus(displayedScore),
    [displayedScore],
  );
  // Live trend over the rendered score — drives the trend arrow,
  // live status verb, and the orb's glow lean-in / soft-fade response.
  const trend = useScoreTrend(displayedScore);
  const statusVerb = React.useMemo(
    () => getStatusVerb(engine.performanceState.level, trend.direction),
    [engine.performanceState.level, trend.direction],
  );
  // Color the surrounding titles + CTA from the *orb's* live accent so
  // the headline / STABLE label / "Maintain rhythm." / CTA all flip to
  // the same hue the ring is currently rendering. Falls back to the
  // band color from getHydrationStatus when no in-flight tween exists.
  const orbColor = displayed?.primary ?? status.color.primary;

  // Phase 3 — derive the SINGLE behavior-first Home command from already-
  // computed state. Pure + read-only (Score-Protection): it never logs,
  // awards points, or mutates score — it only picks which command to show.
  // Water-First is enforced inside `homeCommand` (the water branch leads).
  const command = React.useMemo(
    () =>
      homeCommand({
        score: engine.score,
        unitsConsumedToday: userState.unitsConsumedToday,
        minutesSinceLastIntake: lastIntakeMinutes,
        inRecoveryWindow: engine.social?.inRecoveryWindow ?? false,
        performanceLevel: engine.performanceState.level,
        protocolAvailable,
      }),
    [
      engine.score,
      userState.unitsConsumedToday,
      lastIntakeMinutes,
      engine.social?.inRecoveryWindow,
      engine.performanceState.level,
      protocolAvailable,
    ],
  );

  return (
    <>
      {/* 0 — Readiness eyebrow — reframes the orb as the readiness
          score without touching the score engine or its copy. */}
      <Text style={styles.readinessEyebrow} testID="home-readiness-eyebrow">
        READINESS SCORE
      </Text>

      {/* 1 — Status headline above the orb */}
      <Text
        style={[styles.statusHeadline, { color: orbColor }]}
        testID="home-status-headline"
      >
        {status.headline}
      </Text>

      {/* 2 — Status Pulse Orb */}
      <View style={styles.orbWrap}>
        <StatusPulseOrb
          pulseConfig={engine.pulseConfig}
          score={engine.score}
          burstAt={intake.lastIntakeBurstAt}
          onTap={onOpenBreakdown}
          size={orbSize}
          displayedAccent={
            displayed
              ? { primary: displayed.primary, glow: displayed.glow }
              : undefined
          }
          displayedScore={displayedScore}
          trend={trend.direction}
        />
      </View>

      {/* 3 — Status label */}
      <Text
        style={[styles.statusLabel, { color: orbColor }]}
        testID="home-status-label"
      >
        {status.label}
      </Text>

      {/* 3a — Live Status Line — trend arrow + delta window + status verb.
          Sits between the status label and the consequence line so the
          orb reads as a real-time signal, not a static dial. */}
      <LiveStatusLine
        direction={trend.direction}
        delta={trend.delta}
        ageSec={trend.ageSec}
        verb={statusVerb}
        accent={orbColor}
        testID="home-live-status-line"
      />

      {/* 4 — Consequence line */}
      <Text style={styles.consequence} testID="home-consequence">
        {status.consequence}
      </Text>

      {/* ── Hydration Status (Water Cycle slot) ──────────────────────────
          Moved directly under the readiness hero so Home reads top-to-
          bottom: readiness score → hydration status → one command → one
          CTA. Every value is a projection of real logged behaviour
          (utils/homeDashboard) — Score-Protection safe. */}
      <HomeDashboard showScanButton={SHOW_EXPANDED_HOME} />

      {/* ── Today's command (Phase 3) ────────────────────────────────────
          The SINGLE behavior-first instruction, derived by the pure
          `homeCommand` helper. Water-First: the water branch leads whenever
          hydration needs correction or upkeep, so a product can never be
          recommended before water. Read-only — never mutates score. */}
      <View style={styles.commandBlock} testID="home-command-block">
        <Text style={styles.commandEyebrow} testID="home-command-eyebrow">
          {command.eyebrow}
        </Text>
        <Text style={styles.commandTitle} testID="home-command-title">
          {command.title}
        </Text>
        <Text style={styles.commandBody} testID="home-command-body">
          {command.body}
        </Text>
      </View>

      {/* ── The one primary CTA ───────────────────────────────────────────
          Wired by `command.actionType` to the existing flows (log water /
          start protocol / scan / recover). The tap NEVER logs or mutates
          score — it only opens the relevant surface (Score-Protection). */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onCommandCta(command.actionType)}
        disabled={isCompletingCycle}
        accessibilityRole="button"
        accessibilityLabel={command.ctaLabel}
        testID="home-primary-cta"
        style={[
          styles.cta,
          {
            borderColor: orbColor,
            backgroundColor: `${orbColor}1A`,
            shadowColor: orbColor,
            opacity: isCompletingCycle ? 0.55 : 1,
          },
        ]}
      >
        <Text style={[styles.ctaText, { color: orbColor }]}>
          {command.ctaLabel}
        </Text>
      </TouchableOpacity>

      {/* ── Trimmed Home modules (Phase 2) ───────────────────────────────
          Everything below is intentionally NOT rendered on the simplified
          Home (gated by SHOW_EXPANDED_HOME). The components + their imports
          stay so the engines they read remain alive and the trim is one
          flag-flip away from reverting:
            • EntryActions quick-action grid
            • Metabolic Readiness / Performance Age / Voice Check-In zones
            • Activation Journey card
            • Last-intake meta row
            • AI Coach video card
            • Heat Guard signal pill                                       */}
      {SHOW_EXPANDED_HOME && (
        <>
          <View style={styles.entryActionsRow}>
            <EntryActions />
          </View>

          <MetabolicReadinessZone />
          <PerformanceAgeZone />
          <VoiceCheckInZone />
          <ActivationJourneyZone />

          {lastIntakeMinutes != null && (
            <View style={styles.lastIntakeRow}>
              <Text style={styles.metaLabel}>Last intake</Text>
              <Text style={styles.metaValue} testID="home-last-intake">
                {lastIntakeMinutes} min ago
              </Text>
            </View>
          )}

          <View style={styles.coachLayer}>
            <View style={styles.coachVideoWrapper} testID="home-ai-coach-video">
              <AIVideoPlayer
                video={matchVideo({ engineOutput: engine, userState })}
                command={engine.command}
                timerSeconds={timerSeconds}
                score={displayedScore}
              />
            </View>
          </View>

          {heatBand !== 'NORMAL' && (
            <View style={styles.signalsRow} testID="home-live-signals">
              <SignalPill
                icon="thermometer"
                label="Heat"
                value={heatTempLabel ? `${heatTempLabel} · ${HEAT_BAND_LABEL[heatBand]}` : HEAT_BAND_LABEL[heatBand]}
                tint={HEAT_BAND_COLOR[heatBand]}
                active
                onPress={onTapHeat}
                testID="home-heat-pill"
              />
            </View>
          )}
        </>
      )}
    </>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

export default function HomeScreen() {
  const { state, dismissSuccess, completeOnboarding, voiceCoachEnabled } = useAppStore();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clerkUser = useUser().user;

  const engine = useEngineSlice();
  const userState = useUserSlice();
  const intake = useIntakeSlice();
  const { logIntake } = useActionsSlice<HomeActions>();
  const { showCycleSuccess, lastCycleResult, hasSeenOnboarding } = state;

  // Voice Engine — preserve existing score-band + risk-timer hooks.
  useScoreBandVoice();
  useRiskTimerVoice();

  // Internal Analytics Layer (Priority #4) — records session, streak,
  // and win signals. No UI, no navigation; powers the engine only.
  useAnalyticsRecorder();

  // Mirror current performance level into the Phantom Band LED.
  React.useEffect(() => {
    phantomBandService.mirrorPerformance(engine.performanceState.level);
  }, [engine.performanceState.level]);

  // Local UI state.
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [voiceAutoStart, setVoiceAutoStart] = React.useState(false);
  const [flavorOpen, setFlavorOpen] = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);
  const [voiceBtnState, setVoiceBtnState] = React.useState<VoiceState>('idle');

  // Heat Guard — auto-fires voice escalations on STABLE → ELEVATED+
  // crossings. Mounted here so Heat warnings continue to surface even
  // though the verbose Heat card is gone from the minimal home.
  const onHeatEscalate = React.useCallback(() => {
    setVoiceAutoStart(false);
    setVoiceOpen(true);
  }, []);
  const heat = useHeatGuard({ onEscalate: onHeatEscalate });

  React.useEffect(() => {
    setVoiceBtnState(voiceOpen ? 'listening' : 'idle');
  }, [voiceOpen]);

  // Band-initiated voice trigger from Phantom Band hardware.
  React.useEffect(() => {
    return phantomBandService.on('voice_trigger', () => {
      setVoiceAutoStart(true);
      setVoiceOpen(true);
    });
  }, []);

  const openBreakdown = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setBreakdownOpen(true);
  }, []);
  const closeBreakdown = React.useCallback(() => setBreakdownOpen(false), []);
  const openVoice = React.useCallback(() => {
    setVoiceAutoStart(false);
    setVoiceOpen(true);
  }, []);
  const closeVoice = React.useCallback(() => {
    setVoiceOpen(false);
    setVoiceAutoStart(false);
  }, []);

  // The single Home CTA. Routed by the command's actionType to the existing
  // flows. The tap itself NEVER logs or mutates score (Score-Protection):
  //   • log_water     → open the flavor picker (water leads; logging only
  //                     happens on confirm via logIntake = completed behavior)
  //   • start_protocol→ navigate to the protocol screen
  //   • scan_drink    → navigate to the scan screen
  //   • recover       → open the advisory Recovery Load sheet
  const onCommandCta = React.useCallback(
    (actionType: HomeCommandActionType) => {
      if (state.isCompletingCycle) return;
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      switch (actionType) {
        case 'log_water':
          setFlavorOpen(true);
          break;
        case 'start_protocol':
          router.push('/protocol');
          break;
        case 'scan_drink':
          router.push('/scan');
          break;
        case 'recover':
          setRecoveryOpen(true);
          break;
      }
    },
    [state.isCompletingCycle, router],
  );

  const onShare = React.useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const level = engine.performanceState.level;
    const stateLabel =
      level === 'PEAK' ? 'Peak'
      : level === 'RECOVERING' ? 'Recovering'
      : level === 'DEPLETED' ? 'Depleted'
      : 'Balanced';
    router.push(`/share?type=score&score=${engine.score}&state=${stateLabel}`);
  }, [router, engine.score, engine.performanceState.level]);

  const onTapHeat = React.useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setVoiceAutoStart(false);
    setVoiceOpen(true);
  }, []);

  const onChooseFlavor = React.useCallback(
    (flavor: FlavorChoice | null) => {
      setFlavorOpen(false);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }
      // Water-First: the LOG WATER command CTA is the only opener of this
      // picker and the water option leads inside the modal, so skipping
      // flavor selection logs plain water (never a product) — the default
      // action stays hydration-first.
      const fluid: FluidType = flavor?.fluid ?? 'water';
      const opts = flavor
        ? {
            flavorLabel: flavor.label,
            ...(flavor.ozOverride != null ? { ozOverride: flavor.ozOverride } : {}),
          }
        : undefined;
      void logIntake?.(fluid, opts);
    },
    [logIntake],
  );

  // Header derived data.
  // Personalized welcome — uses Clerk first name when signed in, falls
  // back to the email local-part, then to 'Brandon' as the demo /
  // pre-auth default so the home greeting always reads as a real
  // person's account rather than a generic 'Athlete'.
  const greetingName =
    clerkUser?.firstName ||
    clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Brandon';
  const city = userState.weatherCity ?? null;
  const tempLabel = formatTemperatureF(userState.weatherTempC);

  // Last intake — newest event in the last 24h window.
  const lastIntakeMinutes = React.useMemo(() => {
    const events = intake.recentEvents ?? [];
    if (events.length === 0) return null;
    const latest = events.reduce<number>((acc, evt) => {
      const ms = evt.loggedAt instanceof Date
        ? evt.loggedAt.getTime()
        : new Date(evt.loggedAt as unknown as string).getTime();
      return Number.isFinite(ms) && ms > acc ? ms : acc;
    }, 0);
    return minutesSince(latest);
  }, [intake.recentEvents]);

  // Whether an actionable protocol step is queued — true once a sweat session
  // has set an autopilot recovery protocol. Read-only signal used only to pick
  // the Home command; it never awards or mutates score (Score-Protection).
  const protocolAvailable = !!state.sweatAutopilot;

  // Recovery Load sheet — hosted directly on Home so the `recover` command CTA
  // can open it without leaving the screen (mirrors EntryActions' recovery
  // tile). Display-only/advisory: opening or reading it never mutates score.
  const recoveryHeatBand = getHeatBandFromCelsius(userState.weatherTempC);
  const recoveryLoad = React.useMemo(
    () => deriveRecoveryLoad(userState, engine, recoveryHeatBand),
    [userState, engine, recoveryHeatBand],
  );
  const recoveryPayload: BiometricSheetPayload = React.useMemo(() => {
    const loadAccent =
      recoveryLoad.strain === 'low' ? Colors.states.PEAK.primary
      : recoveryLoad.strain === 'moderate' ? Colors.states.BALANCED.primary
      : recoveryLoad.strain === 'elevated' ? Colors.states.RECOVERING.primary
      : Colors.states.DEPLETED.primary;
    return {
      eyebrow: 'RECOVERY LOAD',
      accent: loadAccent,
      icon: 'activity',
      heroValue: `${recoveryLoad.loadScore}`,
      heroLabel: STRAIN_LABEL[recoveryLoad.strain],
      subline: recoveryLoad.headline,
      metrics: [
        {
          label: 'HEAT',
          value: `${recoveryLoad.heatImpact}%`,
          valueColor: recoveryLoad.heatImpact >= 60 ? Colors.states.DEPLETED.primary : undefined,
        },
        { label: 'ENVIRONMENT', value: `${recoveryLoad.environmentalLoad}%` },
        { label: 'HYDRATION', value: `${recoveryLoad.hydrationStress}%` },
      ],
    };
  }, [recoveryLoad]);

  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <DisplayedAccentProvider score={engine.score}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: topPadding + 12,
                paddingBottom: bottomPadding + 88,
                ...(layout.isWide
                  ? { maxWidth: layout.contentMaxWidth, alignSelf: 'center', width: '100%' }
                  : null),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <MinimalHeader greetingName={greetingName} city={city} tempLabel={tempLabel} onShare={onShare} />

            {/* Phase 2 — these contextual banners belong to the expanded
                Home and are gated off on the simplified surface. They self-
                hide anyway when nothing is active; the flag keeps the trim
                consistent and one flip away from reverting. */}
            {SHOW_EXPANDED_HOME && (
              <>
                <NotificationBanner />
                <SmartModesBanner />
                <LocationInsightBanner />
              </>
            )}

            <ScoreDrivenBody
              onOpenBreakdown={openBreakdown}
              onCommandCta={onCommandCta}
              onTapHeat={onTapHeat}
              isCompletingCycle={state.isCompletingCycle}
              lastIntakeMinutes={lastIntakeMinutes}
              voiceCoachEnabled={voiceCoachEnabled}
              orbSize={layout.orbSize}
              heatBand={getHeatBandFromCelsius(userState.weatherTempC)}
              heatTempLabel={tempLabel}
              protocolAvailable={protocolAvailable}
            />
          </ScrollView>

          {/* Persistent AForce brand signature pinned just above the tab
              bar — always visible. A short fade lets Home content scroll
              cleanly underneath; purely decorative (pointerEvents none,
              no score interaction). */}
          <View
            pointerEvents="none"
            style={[styles.brandFooterFixed, { bottom: bottomPadding }]}
          >
            <LinearGradient
              colors={['transparent', Colors.background.primary]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.brandFooterHairline} />
            <Text style={styles.brandFooterWordmark}>AFORCE</Text>
          </View>

          {showCycleSuccess && lastCycleResult && (
            <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
          )}

          <ScoreBreakdownSheet
            visible={breakdownOpen}
            onDismiss={closeBreakdown}
            score={engine.score}
            contributions={engine.breakdown}
            performanceState={engine.performanceState}
          />

          <FlavorPickerModal
            visible={flavorOpen}
            format="both"
            onCancel={() => setFlavorOpen(false)}
            onConfirm={onChooseFlavor}
          />

          {/* Recovery Load sheet — opened by the `recover` command CTA.
              Advisory only; opening or reading it never mutates score. */}
          <BiometricDetailSheet
            visible={recoveryOpen}
            payload={recoveryOpen ? recoveryPayload : null}
            onDismiss={() => setRecoveryOpen(false)}
          />

          <OnboardingOverlay visible={!hasSeenOnboarding} onDismiss={completeOnboarding} />

          {/* Phase 2 — the Voice FAB is hidden on the simplified Home (voice
              still triggers via Heat-Guard escalation + Phantom Band). The
              VoiceOverlay below stays mounted so the engine stays alive. */}
          {SHOW_EXPANDED_HOME && (
            <View pointerEvents="box-none" style={[styles.voiceFab, { bottom: bottomPadding - 56 }]}>
              <VoiceButton state={voiceBtnState} onPress={openVoice} />
            </View>
          )}

          <VoiceOverlay
            visible={voiceOpen}
            autoStart={voiceAutoStart}
            onClose={closeVoice}
          />
        </DisplayedAccentProvider>
      </GradientBackground>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: 'stretch' },

  // Persistent AForce brand signature pinned just above the tab bar.
  brandFooterFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingTop: 32,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  brandFooterHairline: {
    width: 26,
    height: 1,
    backgroundColor: Colors.accent.brand,
    opacity: 0.8,
    marginBottom: 10,
  },
  brandFooterWordmark: {
    fontFamily: 'ArchivoBlack_400Regular',
    fontSize: 14,
    letterSpacing: 4,
    color: Colors.bone,
    opacity: 0.5,
  },

  header: { marginBottom: 20 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 6,
  },
  welcome: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text.secondary,
    letterSpacing: 0.6,
  },
  brand: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: Colors.text.primary,
    letterSpacing: -0.4,
    marginTop: 1,
  },
  // Status-bar treatment for the city · time · temp line — sits as a
  // discrete pill under the brand so it reads like a piece of HUD
  // telemetry, not body copy.
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.text.primary,
    opacity: 0.85,
    marginRight: 8,
  },
  statusSep: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.text.muted,
    marginHorizontal: 8,
    opacity: 0.7,
  },
  statusSegment: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },

  readinessEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent.brand,
    textAlign: 'center',
    marginBottom: 8,
  },

  statusHeadline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 14,
  },

  orbWrap: { alignItems: 'center', marginBottom: 10 },

  statusLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 1.6,
    marginTop: 18,
  },
  consequence: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    paddingHorizontal: 24,
    lineHeight: 20,
  },

  // Phase 3 — Today's command block (eyebrow + title + body) above the CTA.
  commandBlock: {
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  commandEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent.brand,
    textAlign: 'center',
    marginBottom: 8,
  },
  commandTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  commandBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },

  cta: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    marginBottom: 20,
  },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    letterSpacing: 1.2,
  },

  // Section header that visually separates the deeper-intelligence
  // AI Coach layer from the decision/action layer above it.
  coachSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 44,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  coachLiveDot: { width: 6, height: 6, borderRadius: 3 },
  coachSectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.text.secondary,
    letterSpacing: 2.5,
  },
  coachSectionDot: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.text.muted,
  },
  coachSectionLive: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
  },
  // Subtle visual demotion so the Coach layer never out-shouts the
  // orb / CTA / Next Command above it.
  coachLayer: { opacity: 0.96 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 16,
  },
  metaCell: { flex: 1 },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: 12,
  },
  metaLabel: {
    // Contrast bump (Inter_500Medium @ 12 + brighter alpha) for the
    // "Last intake" / meta-row labels — beautiful on OLED but weak in
    // sunlight at the previous 55% alpha. Now 75%.
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  metaValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  lastIntakeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  // CommandConsole brings its own marginHorizontal: 20 — negate the
  // surrounding scrollContent padding so the card stretches edge-to-edge
  // like the other premium cards. Top spacing now comes from
  // coachSectionHeader so this is flush with the section title.
  coachWrapper: { marginHorizontal: -20, marginTop: 0 },
  coachVideoWrapper: { marginHorizontal: -20, marginTop: 12 },

  voiceFab: { position: 'absolute', right: 20, alignItems: 'flex-end' },

  // Quick-action tile grid wrapper. Negative horizontal margin cancels
  // the parent `content` 20px padding so EntryActions can apply its own
  // 20px (matching the rest of the home rhythm) — keeps tiles flush
  // with the metaRow / signalsRow above and below.
  entryActionsRow: {
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: -20,
  },
  signalsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  signalPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  signalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.text.secondary,
    letterSpacing: 0.2,
  },
  signalValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    letterSpacing: 0.1,
    marginLeft: 'auto',
  },
});
