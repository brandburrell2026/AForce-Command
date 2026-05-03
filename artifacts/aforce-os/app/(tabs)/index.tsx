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
import { useUser } from '@clerk/expo';

import { GradientBackground } from '@/components/GradientBackground';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { ScoreBreakdownSheet } from '@/components/ScoreBreakdownSheet';
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
import { DisplayedAccentProvider, useDisplayedAccent } from '@/hooks/useDisplayedAccent';

import { useAppStore } from '@/store/useAppStore';
import {
  useEngineSlice,
  useUserSlice,
  useIntakeSlice,
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
}

function MinimalHeader({ greetingName, city, tempLabel }: HeaderProps) {
  const now = useNow();
  const locationLine = [city, formatTime(now), tempLabel]
    .filter((s) => s && s.length > 0)
    .join(' · ');
  return (
    <View style={styles.header}>
      <Text style={styles.welcome}>Welcome, {greetingName}</Text>
      <Text style={styles.brand}>AForce OS</Text>
      {locationLine.length > 0 && (
        <Text style={styles.locationLine} testID="home-location-line">
          {locationLine}
        </Text>
      )}
    </View>
  );
}

// ─── Score-driven body (consumes DisplayedAccentProvider) ────────────

interface BodyProps {
  onOpenBreakdown: () => void;
  onPrimaryCta: () => void;
  isCompletingCycle: boolean;
  cycleProgress: { current: number; target: number };
  lastIntakeMinutes: number | null;
  voiceCoachEnabled: boolean;
  orbSize: number;
}

function ScoreDrivenBody({
  onOpenBreakdown,
  onPrimaryCta,
  isCompletingCycle,
  cycleProgress,
  lastIntakeMinutes,
  voiceCoachEnabled,
  orbSize,
}: BodyProps) {
  const engine = useEngineSlice();
  const intake = useIntakeSlice();
  // Use the in-flight tweened score when available so headline / orb /
  // CTA all flip bands on the same frame.
  const displayed = useDisplayedAccent();
  const displayedScore = displayed?.displayedScore ?? engine.score;
  const status = React.useMemo(
    () => getHydrationStatus(displayedScore),
    [displayedScore],
  );

  return (
    <>
      {/* 1 — Status headline above the orb */}
      <Text
        style={[styles.statusHeadline, { color: status.color.primary }]}
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
        style={[styles.statusLabel, { color: status.color.primary }]}
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
            borderColor: status.color.primary,
            backgroundColor: `${status.color.primary}1A`,
            shadowColor: status.color.primary,
            opacity: isCompletingCycle ? 0.55 : 1,
          },
        ]}
      >
        <Text style={[styles.ctaText, { color: status.color.primary }]}>
          {status.ctaText}
        </Text>
      </TouchableOpacity>

      {/* 6 — Command preview */}
      <View
        style={[styles.commandCard, { borderColor: `${status.color.primary}40` }]}
        testID="home-command-preview"
      >
        <Text style={styles.commandEyebrow}>NEXT COMMAND</Text>
        <Text style={styles.commandText}>{status.command}</Text>
      </View>

      {/* 7 — Minimal secondary data */}
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

      {/* 8 — AI Coach · Live */}
      <View
        style={[styles.coachCard, { borderColor: `${status.color.primary}33` }]}
        testID="home-ai-coach"
      >
        <View style={styles.coachHeader}>
          <View style={[styles.coachDot, { backgroundColor: status.color.primary }]} />
          <Text style={styles.coachEyebrow}>AI COACH · LIVE</Text>
          {voiceCoachEnabled && (
            <View style={styles.voiceBadge}>
              <Feather name="volume-2" size={10} color={Colors.text.secondary} />
              <Text style={styles.voiceBadgeText}>VOICE</Text>
            </View>
          )}
        </View>
        <Text style={styles.commandText}>
          {engine.command?.action ?? status.command}
        </Text>
      </View>
    </>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────

interface CtaActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

export default function HomeScreen() {
  const { state, dismissSuccess, completeOnboarding, voiceCoachEnabled } = useAppStore();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const clerkUser = useUser().user;

  const engine = useEngineSlice();
  const userState = useUserSlice();
  const intake = useIntakeSlice();
  const { logIntake } = useActionsSlice<CtaActions>();
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
  const [voiceBtnState, setVoiceBtnState] = React.useState<VoiceState>('idle');

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
            <MinimalHeader greetingName={greetingName} city={city} tempLabel={tempLabel} />

            <ScoreDrivenBody
              onOpenBreakdown={openBreakdown}
              onPrimaryCta={onPrimaryCta}
              isCompletingCycle={state.isCompletingCycle}
              cycleProgress={cycleProgress}
              lastIntakeMinutes={lastIntakeMinutes}
              voiceCoachEnabled={voiceCoachEnabled}
              orbSize={layout.orbSize}
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

  header: { marginBottom: 24 },
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
    marginTop: 2,
  },
  locationLine: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.text.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8,
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

  commandCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 16,
  },
  commandEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: Colors.text.secondary,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  commandText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
  },

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

  coachCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  coachDot: { width: 8, height: 8, borderRadius: 4 },
  coachEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: Colors.text.secondary,
    letterSpacing: 2.5,
    flex: 1,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  voiceBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: Colors.text.secondary,
    letterSpacing: 1.4,
  },

  voiceFab: { position: 'absolute', right: 20, alignItems: 'flex-end' },
});
