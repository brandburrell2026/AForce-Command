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
import { RecoveryCoachEntry } from '@/components/home/RecoveryCoachEntry';
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
  onPrimaryCta: () => void;
  onTapHeat: () => void;
  isCompletingCycle: boolean;
  lastIntakeMinutes: number | null;
  voiceCoachEnabled: boolean;
  orbSize: number;
  heatBand: TempHeatBand;
  heatTempLabel: string | null;
}

function ScoreDrivenBody({
  onOpenBreakdown,
  onPrimaryCta,
  onTapHeat,
  isCompletingCycle,
  lastIntakeMinutes,
  voiceCoachEnabled,
  orbSize,
  heatBand,
  heatTempLabel,
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

      {/* 4b — Today's Command — names the single water-first action that the
          primary CTA below executes. A compact, subordinate strip (NOT a
          second CTA): it expresses the COMMAND step of
          State → Command → Action → Tools → Progress. Read-only projection of
          status.command (never awards or mutates score — Score-Protection). */}
      <View style={styles.commandStrip} testID="home-today-command">
        <Text style={styles.commandEyebrow}>TODAY’S COMMAND</Text>
        <Text style={styles.commandBody}>{status.command}</Text>
      </View>

      {/* 5 — Primary action button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPrimaryCta}
        disabled={isCompletingCycle}
        accessibilityRole="button"
        accessibilityLabel={`${status.ctaText} — log hydration`}
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
          {status.ctaText}
        </Text>
      </TouchableOpacity>

      {/* Quick-action tile grid — Check · Sweat · Heat · Recover.
          Sits directly under the primary CTA. (HydroScan is reached from
          the Hydration Status card's "Scan a drink" chip below.) */}
      <View style={styles.entryActionsRow}>
        <EntryActions />
      </View>

      {/* ── Water Cycle — Hydration Status ───────────────────────────
          The Hydration Status card now occupies the Water Cycle slot
          (owner request, June 2026). The old WATER CYCLE 8-cell telemetry
          bar was removed from Home; the WaterCycleBar component remains in
          the codebase (still used by SignalsZone) so the change is
          reversible. Every value is a projection of real logged behaviour
          (utils/homeDashboard) — Score-Protection safe. `showScanButton`
          surfaces the subordinate, advisory "SCAN A DRINK" chip (routes to
          /scan only; HydroScan stays non-scoring) as the ACTION step below the
          primary water CTA — water still leads. */}
      <HomeDashboard showScanButton />

      {/* ── Metabolic Readiness (AForce Athlete tier) ───────────────────
          Additive, feature-flagged (metabolic_readiness_enabled) card.
          Renders nothing when the flag is off. Display-only wellness
          ESTIMATES (muscle + cognitive) — a one-directional projection of
          the hydration + recovery engines that never awards or mutates
          score (Score-Protection). Non-entitled users see a locked teaser
          that routes to the Athlete plan. */}
      <MetabolicReadinessZone />

      {/* ── Performance Age™ ─────────────────────────────────────────────
          Additive, feature-flagged (performance_age_enabled) headline
          ESTIMATE. Renders nothing when the flag is off (ships off in
          prod). A display-only projection of the hydration + recovery
          engines and the analytics layer that never awards or mutates
          score (Score-Protection). NOT entitlement-gated — the primary
          consumer headline metric. Carries the required disclaimer on
          every state. */}
      <PerformanceAgeZone />

      {/* ── Voice Check-In™ read-outs ────────────────────────────────────
          Additive, feature-flagged (voice_checkin_enabled) Brain Energy™ +
          Performance Memory™ cards. Renders nothing when the flag is off
          (ships off in prod, on in DEMO). A display-only projection of the
          morning check-in self-report and the recovery engine that never
          awards or mutates score (Score-Protection). */}
      <VoiceCheckInZone />

      {/* ── Activation Journey (QR-activation Day-7 offer) ────────────────
          Additive, feature-flagged (spec_activation) consumer card. Renders
          nothing when the flag is off. A display-only projection of two
          on-device milestones (onboarding done + first command followed) and
          the pure Day-7 offer timer — it never awards or mutates score
          (Score-Protection). Emits `day7_subscription_offer` only when the
          offer is actually shown (open phase). No new tab/route. */}
      <ActivationJourneyZone />

      {lastIntakeMinutes != null && (
        <View style={styles.lastIntakeRow}>
          <Text style={styles.metaLabel}>Last intake</Text>
          <Text style={styles.metaValue} testID="home-last-intake">
            {lastIntakeMinutes} min ago
          </Text>
        </View>
      )}

      {/* Biometric Intelligence now lives as three tiles inside
          EntryActions (Sweat / Forecast / Recovery), each opening a
          BiometricDetailSheet on tap. Keeps the home surface light
          while the data stays one tap away. */}

      {/* Command Voice Engine — cinematic AI Coach video card
          (tap → fullscreen overlay). The "AFORCE COMMAND" text card
          above it has been removed; this voice/video surface stays. */}
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

      {/* Live Signals strip (Heat Guard).
          The HEAT pill is hidden entirely when ambient temperature is
          below 75 °F (band === 'NORMAL').
          Social Mode lives on its own tab now (subscriber-only). */}
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

  // Primary CTA → haptic + open flavor picker → log intake.
  const onPrimaryCta = React.useCallback(() => {
    if (state.isCompletingCycle) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setFlavorOpen(true);
  }, [state.isCompletingCycle]);

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
      const fluid: FluidType = flavor?.fluid ?? 'aforce_stick';
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

            {/* Spec Rule #10 cadence (Day 0/1/3/7) — single in-app
                banner gated by spec_notifications. Self-hides when
                nothing is due or when all 4 have been delivered. */}
            <NotificationBanner />

            {/* Priority #7 — Smart Modes: surfaces the active context mode
                (Heat · Workout · Travel · Recovery) and water-first
                guidance. Additive, self-hides when no mode is active. */}
            <SmartModesBanner />

            {/* S1 — flag-gated entry to the full-screen Recovery Coach. Self-
                hides unless spec_recoveryCoach is on AND recovery is recommended.
                Dormant by default; flipping the flag is the go-live switch. */}
            <RecoveryCoachEntry />

            {/* Location Intelligence™ "Show 10%" — a quiet Water-First
                insight about what the current environment (altitude · UV ·
                air · heat+humidity) means for hydration. Flag-gated; self-
                hides when off or when the environment isn't notable. */}
            <LocationInsightBanner />

            <ScoreDrivenBody
              onOpenBreakdown={openBreakdown}
              onPrimaryCta={onPrimaryCta}
              onTapHeat={onTapHeat}
              isCompletingCycle={state.isCompletingCycle}
              lastIntakeMinutes={lastIntakeMinutes}
              voiceCoachEnabled={voiceCoachEnabled}
              orbSize={layout.orbSize}
              heatBand={getHeatBandFromCelsius(userState.weatherTempC)}
              heatTempLabel={tempLabel}
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

          <OnboardingOverlay visible={!hasSeenOnboarding} onDismiss={completeOnboarding} />

          <View pointerEvents="box-none" style={[styles.voiceFab, { bottom: bottomPadding - 56 }]}>
            <VoiceButton state={voiceBtnState} onPress={openVoice} />
          </View>

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

  // Today's Command — compact, subordinate strip between the consequence line
  // and the primary CTA. Reads as "the one action", never a second hero CTA.
  commandStrip: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 20,
  },
  commandEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: 6,
  },
  commandBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.primary,
    textAlign: 'center',
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
