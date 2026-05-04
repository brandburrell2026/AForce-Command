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
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';

import { GradientBackground } from '@/components/GradientBackground';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { ScoreBreakdownSheet } from '@/components/ScoreBreakdownSheet';
import { SocialModeSheet } from '@/components/SocialModeSheet';
import { CommandConsole } from '@/components/home/CommandConsole';
import { EntryActions } from '@/components/home/EntryActions';
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
import type { DrinkType } from '@/types';

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
  const now = useNow();
  const segments = [city, formatTime(now), tempLabel].filter(
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
            <Feather name="share" size={15} color={Colors.text.primary} />
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

// ─── Live Signals strip (Heat + Social) ──────────────────────────────

const HEAT_BAND_COLOR: Record<HeatRiskBand, string> = {
  STABLE: Colors.text.secondary,
  ELEVATED: '#FFD60A',
  WARNING: '#FF8C1A',
  HIGH_RISK: '#FF2D55',
  CRITICAL: '#FF2D55',
};
const HEAT_BAND_LABEL: Record<HeatRiskBand, string> = {
  STABLE: 'STABLE',
  ELEVATED: 'ELEVATED',
  WARNING: 'WARNING',
  HIGH_RISK: 'HIGH RISK',
  CRITICAL: 'CRITICAL',
};

interface SignalPillProps {
  icon: React.ComponentProps<typeof Feather>['name'];
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
      <Feather name={icon} size={12} color={tint} />
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={[styles.signalValue, { color: tint }]}>{value}</Text>
    </TouchableOpacity>
  );
}

interface BodyProps {
  onOpenBreakdown: () => void;
  onPrimaryCta: () => void;
  onOpenSocial: () => void;
  onTapHeat: () => void;
  isCompletingCycle: boolean;
  cycleProgress: { current: number; target: number };
  lastIntakeMinutes: number | null;
  voiceCoachEnabled: boolean;
  orbSize: number;
  heatBand: HeatRiskBand;
  heatTempLabel: string | null;
  socialActive: boolean;
  socialDrinks: number;
}

function ScoreDrivenBody({
  onOpenBreakdown,
  onPrimaryCta,
  onOpenSocial,
  onTapHeat,
  isCompletingCycle,
  cycleProgress,
  lastIntakeMinutes,
  voiceCoachEnabled,
  orbSize,
  heatBand,
  heatTempLabel,
  socialActive,
  socialDrinks,
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
  // Color the surrounding titles + CTA from the *orb's* live accent so
  // the headline / STABLE label / "Maintain rhythm." / CTA all flip to
  // the same hue the ring is currently rendering. Falls back to the
  // band color from getHydrationStatus when no in-flight tween exists.
  const orbColor = displayed?.primary ?? status.color.primary;

  return (
    <>
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
        />
      </View>

      {/* 3 — Status label */}
      <Text
        style={[styles.statusLabel, { color: orbColor }]}
        testID="home-status-label"
      >
        {status.label}
      </Text>

      {/* 4 — Consequence line */}
      <Text style={styles.consequence} testID="home-consequence">
        {status.consequence}
      </Text>

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

      {/* 6 — Next Command (light, not a heavy card) */}
      <View style={styles.nextCommand} testID="home-command-preview">
        <Text style={[styles.nextCommandEyebrow, { color: orbColor }]}>NEXT COMMAND</Text>
        <Text style={styles.nextCommandText}>{status.command}</Text>
        {engine.command?.estimatedImpact ? (
          <Text style={styles.nextCommandImpact}>
            Projected: {engine.command.estimatedImpact}
          </Text>
        ) : null}
      </View>

      {/* ── Layer 2: AI Coach · Live ─────────────────────────────────
          Below-the-fold deeper-intelligence layer. Visually demoted
          (lower opacity, generous top spacing) so it never competes
          with the orb / CTA / Next Command above. */}
      <View style={styles.coachSectionHeader}>
        <View style={[styles.coachLiveDot, { backgroundColor: orbColor }]} />
        <Text style={styles.coachSectionTitle}>AI COACH</Text>
        <Text style={styles.coachSectionDot}>·</Text>
        <Text style={[styles.coachSectionLive, { color: orbColor }]}>LIVE</Text>
      </View>

      <View style={styles.coachLayer}>
        <View style={styles.coachWrapper} testID="home-ai-coach">
          <CommandConsole
            command={engine.command}
            performanceState={engine.performanceState}
            accentOverride={displayed?.primary}
          />
        </View>

        {/* Cinematic AI Coach video card (tap → fullscreen overlay) */}
        <View style={styles.coachVideoWrapper} testID="home-ai-coach-video">
          <AIVideoPlayer
            video={matchVideo({ engineOutput: engine, userState })}
            command={engine.command}
            timerSeconds={timerSeconds}
            score={displayedScore}
          />
        </View>
      </View>

      {/* ── Layer 3: Telemetry — minimal secondary data ───────────── */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>WATER CYCLE</Text>
          <Text style={styles.metaValue} testID="home-cycle-progress">
            {cycleProgress.current}/{cycleProgress.target}
          </Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>LAST INTAKE</Text>
          <Text style={styles.metaValue} testID="home-last-intake">
            {lastIntakeMinutes != null ? `${lastIntakeMinutes} min ago` : '—'}
          </Text>
        </View>
      </View>

      {/* Quick-action tile grid — Scan, Compete, Circles, Territory */}
      <View style={styles.entryActionsRow}>
        <EntryActions />
      </View>

      {/* Live Signals strip (Heat Guard + Social Mode) */}
      <View style={styles.signalsRow} testID="home-live-signals">
        <SignalPill
          icon="thermometer"
          label="HEAT"
          value={heatTempLabel ? `${heatTempLabel} · ${HEAT_BAND_LABEL[heatBand]}` : HEAT_BAND_LABEL[heatBand]}
          tint={HEAT_BAND_COLOR[heatBand]}
          active={heatBand !== 'STABLE'}
          onPress={onTapHeat}
          testID="home-heat-pill"
        />
        <SignalPill
          icon="users"
          label="SOCIAL"
          value={socialActive ? `${socialDrinks} drink${socialDrinks === 1 ? '' : 's'}` : 'OFF'}
          tint={socialActive ? '#7C5CFF' : Colors.text.secondary}
          active={socialActive}
          onPress={onOpenSocial}
          testID="home-social-pill"
        />
      </View>
    </>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
  activateSocialMode: () => Promise<void>;
  logSocialDrink: (type: DrinkType) => Promise<void>;
  confirmSocialHydration: (confirmed: boolean) => Promise<void>;
  deactivateSocialMode: () => Promise<void>;
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
  const {
    logIntake,
    activateSocialMode,
    logSocialDrink,
    confirmSocialHydration,
    deactivateSocialMode,
  } = useActionsSlice<HomeActions>();
  const { showCycleSuccess, lastCycleResult, hasSeenOnboarding } = state;

  // Voice Engine — preserve existing score-band + risk-timer hooks.
  useScoreBandVoice();
  useRiskTimerVoice();

  // Mirror current performance level into the Phantom Band LED.
  React.useEffect(() => {
    phantomBandService.mirrorPerformance(engine.performanceState.level);
  }, [engine.performanceState.level]);

  // Local UI state.
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [voiceAutoStart, setVoiceAutoStart] = React.useState(false);
  const [flavorOpen, setFlavorOpen] = React.useState(false);
  const [socialOpen, setSocialOpen] = React.useState(false);
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

  const openSocial = React.useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSocialOpen(true);
  }, []);
  const closeSocial = React.useCallback(() => setSocialOpen(false), []);
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
  const greetingName =
    clerkUser?.firstName ||
    clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Athlete';
  const city = userState.weatherCity ?? null;
  const tempLabel = formatTemperatureF(userState.weatherTempC);

  // Cycle progress (units consumed / daily target). Spec asks for
  // "Water Cycle 6/8" framing — we render units-against-target which
  // is the closest existing metric.
  const cycleProgress = React.useMemo(
    () => ({
      current: Math.max(0, Math.round(userState.unitsConsumedToday ?? 0)),
      target: Math.max(1, Math.round(userState.dailyTarget ?? 8)),
    }),
    [userState.unitsConsumedToday, userState.dailyTarget],
  );

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
                paddingBottom: bottomPadding + 32,
                ...(layout.isWide
                  ? { maxWidth: layout.contentMaxWidth, alignSelf: 'center', width: '100%' }
                  : null),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <MinimalHeader greetingName={greetingName} city={city} tempLabel={tempLabel} onShare={onShare} />

            <ScoreDrivenBody
              onOpenBreakdown={openBreakdown}
              onPrimaryCta={onPrimaryCta}
              onOpenSocial={openSocial}
              onTapHeat={onTapHeat}
              isCompletingCycle={state.isCompletingCycle}
              cycleProgress={cycleProgress}
              lastIntakeMinutes={lastIntakeMinutes}
              voiceCoachEnabled={voiceCoachEnabled}
              orbSize={layout.orbSize}
              heatBand={heat.band}
              heatTempLabel={tempLabel}
              socialActive={!!userState.socialMode?.active}
              socialDrinks={userState.socialMode?.drinks?.length ?? 0}
            />
          </ScrollView>

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

          <SocialModeSheet
            visible={socialOpen}
            onDismiss={closeSocial}
            socialMode={userState.socialMode}
            social={engine.social}
            onActivate={() => { void activateSocialMode?.(); }}
            onLogDrink={(type) => { void logSocialDrink?.(type); }}
            onConfirmHydration={(c) => { void confirmSocialHydration?.(c); }}
            onDeactivate={() => { void deactivateSocialMode?.(); }}
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: Colors.text.primary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  statusHeadline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 12,
  },

  orbWrap: { alignItems: 'center', marginBottom: 8 },

  statusLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 4,
    marginTop: 14,
  },
  consequence: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
    paddingHorizontal: 18,
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
    marginBottom: 16,
  },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    letterSpacing: 3,
  },

  // "Next Command" — light, no card chrome. Sits as a quiet
  // continuation of the CTA, not a competing surface.
  nextCommand: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 12,
  },
  nextCommandEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  nextCommandText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  nextCommandImpact: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.text.muted,
    letterSpacing: 0.4,
    marginTop: 6,
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
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: Colors.text.secondary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  metaValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.text.primary,
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
    marginTop: 16,
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
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: Colors.text.secondary,
    letterSpacing: 1.6,
  },
  signalValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    marginLeft: 'auto',
  },
});
