/**
 * Home — One-Command OS.
 *
 * This screen is a decision engine, not a dashboard. The brief is strict:
 * in under one second the user must know their state, what to do, and why.
 *
 * Hierarchy (top to bottom):
 *   1. System alert       — Heat Guard banner, ONLY when band !== STABLE
 *   2. Core state         — animated orb + score + state label
 *   3. Primary command    — DOMINANT card with action + recheck + CTA
 *   4. Why                — compact, max 2 reasons supporting (3)
 *   5. Quick action       — small inline Water/Stick/RTD log shortcuts
 *   6. System signal      — one condensed line of body + env signals
 *   7. Phantom Band       — subtle one-line connection status
 *   ─ More tray (nav)     — small icons preserving access to other screens
 *
 * Anything that competed with the primary command — duplicate AI Coach
 * card, separate timer block, separate water-cycle bar, the standalone
 * AI video player — has been removed or folded into the components above.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GradientBackground } from '@/components/GradientBackground';
import { HeatAlertBanner } from '@/components/HeatAlertBanner';
import { StatusPulseOrb } from '@/components/StatusPulseOrb';
import { PrimaryCommandCard } from '@/components/PrimaryCommandCard';
import { WhyCompact } from '@/components/WhyCompact';
import { QuickActionInline } from '@/components/QuickActionInline';
import { SystemSignalLine } from '@/components/SystemSignalLine';
import { PhantomBandLine } from '@/components/PhantomBandLine';
import { ClimateLine } from '@/components/ClimateLine';
import { AIVideoPlayer } from '@/components/AIVideoPlayer';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { ScoreBreakdownSheet } from '@/components/ScoreBreakdownSheet';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { VoiceButton } from '@/components/VoiceButton';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import type { VoiceState } from '@/types/voice';
import { phantomBandService } from '@/services/phantomBandService';

import { useAppStore } from '@/store/useAppStore';
import { matchVideo } from '@/services/videoEngine';
import { evaluateHeatRisk } from '@/services/heatRiskEngine';
import { renderTemplate } from '@/services/voiceTemplateEngine';
import { speak } from '@/services/textToSpeech';
import { resolvePersona } from '@/services/voicePersonaService';
import type { VoiceContext } from '@/types/voicePersona';
import type { HeatSymptom, HeatRiskBand } from '@/types/heat';
import { Colors } from '@/theme/colors';
import { Feather } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  const { state, completeCycle, snooze, dismissSuccess, completeOnboarding } = useAppStore();
  const {
    engineOutput, userState, showCycleSuccess, lastCycleResult,
    isCompletingCycle, timerSeconds, lastIntakeBurstAt, hasSeenOnboarding,
  } = state;
  const { performanceState, score, reasons, command, pulseConfig, breakdown } = engineOutput;
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [voiceAutoStart, setVoiceAutoStart] = React.useState(false);
  // Mirror the overlay's lifecycle on the floating button so its visual
  // state matches what's happening inside the sheet (idle vs listening).
  const [voiceBtnState, setVoiceBtnState] = React.useState<VoiceState>('idle');
  React.useEffect(() => {
    setVoiceBtnState(voiceOpen ? 'listening' : 'idle');
  }, [voiceOpen]);

  // Heat Guard escalation — when the heat band crosses STABLE → anything else,
  // fire the heat_warning voice template once. Calm coach, not an alarm:
  // we speak the line and surface the voice overlay so the user can react.
  const prevHeatBandRef = React.useRef<HeatRiskBand>('STABLE');
  const heatEscalate = React.useCallback((band: HeatRiskBand, score: number) => {
    const persona = resolvePersona(performanceState.level);
    const ctx: VoiceContext = {
      mode: persona.mode,
      score,
      heat_band: band,
    };
    const line = renderTemplate('heat_warning', ctx);
    speak(line.spoken);
    if (Platform.OS !== 'web') {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch { /* ignore */ }
    }
    setVoiceAutoStart(false);
    setVoiceOpen(true);
  }, [performanceState.level]);

  // Mirror current performance level into the Phantom Band so the LED matches
  // app state. Runs whenever the engine emits a new level.
  React.useEffect(() => {
    phantomBandService.mirrorPerformance(performanceState.level);
  }, [performanceState.level]);

  // Listen for band-initiated voice triggers (double-tap / press-and-hold).
  // Band only triggers — all STT + intent + AI runs on the phone.
  React.useEffect(() => {
    return phantomBandService.on('voice_trigger', () => {
      // Per spec: band double-tap → app immediately begins listening.
      setVoiceAutoStart(true);
      setVoiceOpen(true);
    });
  }, []);

  // After heatScore is computed below, watch for STABLE → escalation crossings
  // and trigger the Heat Guard voice. Defined here so the effect reads the
  // memoized heatScore.
  // (effect is placed after the useMemo so it always reads the latest band.)

  // Derive a quick Heat Guard read from current user state. The banner only
  // surfaces when band !== STABLE so we never nag the user for no reason.
  const heatScore = React.useMemo(() => {
    const SYMPTOM_IDS: HeatSymptom[] = ['dizziness','headache','nausea','cramping','chills','confusion','fatigue'];
    const symptoms: HeatSymptom[] = (userState.symptoms ?? []).filter(
      (s): s is HeatSymptom => (SYMPTOM_IDS as string[]).includes(s),
    );
    return evaluateHeatRisk({
      hydrationScore: score,
      recentFluidOz: 0,
      minutesSinceLastIntake: Math.max(
        0,
        Math.round((Date.now() - new Date(userState.lastIntakeTime).getTime()) / 60000),
      ),
      ambientTempF: 78 + (userState.heatLoad ?? 0) * 22,
      humidityPct: 50 + (userState.heatLoad ?? 0) * 25,
      sunExposure: Math.min(1, (userState.heatLoad ?? 0)),
      continuousActiveMin: Math.round((userState.activityLevel ?? 0) * 60),
      activityIntensity: userState.activityLevel ?? 0,
      heartRateBpm: 110 + Math.round((userState.activityLevel ?? 0) * 60),
      hrRecoveryDelaySec: Math.round((userState.activityLevel ?? 0) * 25),
      sweatLossOzPerHr: (userState.sweatRate ?? 0) * 30,
      bodyWeightLbs: userState.bodyWeightLbs || 175,
      recoveryMomentum: 1 - (userState.heatLoad ?? 0),
      symptoms,
      urineSignal: userState.urineSignal ?? 2,
      energyState:
        userState.energyState === 'crashed' ? 'crashed'
        : userState.energyState === 'low' ? 'low'
        : userState.energyState === 'peak' ? 'peak' : 'steady',
      sleepDeficitHrs: 0,
      recentHeatEvent: false,
    });
  }, [
    score, userState.lastIntakeTime, userState.heatLoad, userState.activityLevel,
    userState.sweatRate, userState.bodyWeightLbs, userState.symptoms,
    userState.urineSignal, userState.energyState,
  ]);

  // Heat Guard escalation effect — fires when band crosses STABLE → non-STABLE,
  // and again whenever the severity steps up (e.g. WARNING → HIGH_RISK). We
  // don't fire on de-escalation, and we never fire on initial mount — the
  // first observed band only seeds prevHeatBandRef.
  const heatDidMountRef = React.useRef(false);
  React.useEffect(() => {
    const SEVERITY: Record<HeatRiskBand, number> = {
      STABLE: 0, ELEVATED: 1, WARNING: 2, HIGH_RISK: 3, CRITICAL: 4,
    };
    const next = heatScore.band;
    if (!heatDidMountRef.current) {
      heatDidMountRef.current = true;
      prevHeatBandRef.current = next; // seed silently — never alert on mount
      return;
    }
    const prev = prevHeatBandRef.current;
    if (SEVERITY[next] > SEVERITY[prev] && next !== 'STABLE') {
      heatEscalate(next, heatScore.score);
    }
    prevHeatBandRef.current = next;
  }, [heatScore.band, heatScore.score, heatEscalate]);

  const openBreakdown = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setBreakdownOpen(true);
  };
  const insets = useSafeAreaInsets();
  const stateColor = performanceState.color;

  const handleComplete = () => {
    if (isCompletingCycle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    completeCycle();
  };

  const handleSnooze = () => {
    Haptics.selectionAsync();
    snooze();
  };

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. SYSTEM ALERT — only renders when heat band escalates above STABLE */}
          {heatScore.band !== 'STABLE' && (
            <View style={{ marginBottom: 12 }} testID="heat-alert-banner">
              <HeatAlertBanner score={heatScore.score} band={heatScore.band} />
            </View>
          )}

          {/* 1b. CLIMATE — outside temp + humidity + auto-detected city. Sits
              directly under the Heat Guard banner so the environmental
              context that drives the alert reads as a single unit. Taps
              into the Heat Risk screen for the full breakdown. */}
          <ClimateLine onPress={() => router.push('/heat')} />

          {/* Header — eyebrow + bold brand title (restored to its previous
              prominence) + the live performance-state pill on the right. */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>HYDRATION CONTROL CENTER</Text>
              <Text style={styles.title}>AForce OS</Text>
            </View>
            <View style={[styles.statePill, { borderColor: `${stateColor}55`, backgroundColor: `${stateColor}14` }]}>
              <View style={[styles.dot, { backgroundColor: stateColor }]} />
              <Text style={[styles.stateLabel, { color: stateColor }]}>{performanceState.level}</Text>
            </View>
          </View>

          {/* 2. CORE STATE — animated orb is the identity of the product */}
          <View style={styles.orbContainer}>
            <StatusPulseOrb
              pulseConfig={pulseConfig}
              score={score}
              burstAt={lastIntakeBurstAt}
              onTap={openBreakdown}
            />
          </View>

          {/* 3. PRIMARY COMMAND — the dominant element. Recheck minutes are
              derived from the live timer (rounded up) so the user reads
              whole minutes, not seconds. */}
          <PrimaryCommandCard
            command={command}
            performanceState={performanceState}
            recheckMinutes={Math.max(0, Math.ceil(timerSeconds / 60))}
            isLogging={isCompletingCycle}
            onLog={handleComplete}
          />

          {/* 4. WHY — compact, supporting only. Tap to open full breakdown. */}
          <WhyCompact reasons={reasons} onOpenBreakdown={openBreakdown} />

          {/* 4b. AI COACHING — compact inline video. Sits BELOW the Primary
              Command Card so it visually supports the command (matched to the
              same engine output) rather than competing with it. Compact mode
              keeps it short; the recheck timer overlay reinforces the same
              countdown the command card already shows. */}
          <AIVideoPlayer
            video={matchVideo({ engineOutput, userState })}
            command={command}
            compact
            timerSeconds={timerSeconds}
          />

          {/* 5. QUICK ACTION — Water · Stick · RTD log shortcuts */}
          <QuickActionInline />

          {/* Snooze affordance lives here as a single low-weight line */}
          {!userState.isSnoozed ? (
            <TouchableOpacity style={styles.snoozeBtn} onPress={handleSnooze} activeOpacity={0.7}>
              <Feather name="clock" size={12} color={Colors.text.muted} />
              <Text style={styles.snoozeText}>Snooze 20 minutes</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.snoozeBtn}>
              <Feather name="moon" size={12} color={Colors.states.RECOVERING.primary} />
              <Text style={[styles.snoozeText, { color: Colors.states.RECOVERING.primary }]}>
                Snoozed — Next alert in 20 min
              </Text>
            </View>
          )}

          {/* 6. SYSTEM SIGNAL — one condensed line + interpretive verdict */}
          <SystemSignalLine performanceLevel={performanceState.level} />

          {/* 7. PHANTOM BAND — subtle hardware status one-liner. Tappable so
              users can drill into pairing / band status without losing the
              dedicated screen the old PhantomBandCard exposed. */}
          <PhantomBandLine onPress={() => router.push('/phantom')} />

          {/*
            More tray — preserves navigation to deeper screens (Scan, Compare,
            Products, Compete, Circles, Territory, Share) without competing
            with the primary command. Deliberately the lightest-weight row
            on the page; users who need it know to scroll.
          */}
          <View style={styles.moreLabelRow}>
            <Text style={styles.moreLabel}>MORE</Text>
          </View>
          <View style={styles.actionRow}>
            {([
              { key: 'scan',      icon: 'maximize',    label: 'Scan',      onPress: () => router.push('/scan') },
              { key: 'compare',   icon: 'bar-chart-2', label: 'Compare',   onPress: () => router.push('/compare'),
                accent: performanceState.level === 'DEPLETED' },
              { key: 'products',  icon: 'package',     label: 'Products',  onPress: () => router.push('/products') },
              { key: 'compete',   icon: 'award',       label: 'Compete',   onPress: () => router.push('/competition') },
              { key: 'circles',   icon: 'users',       label: 'Circles',   onPress: () => router.push('/circles'),
                testID: 'home-circles-button' },
              { key: 'territory', icon: 'map',         label: 'Territory', onPress: () => router.push('/territory'),
                testID: 'home-territory-button' },
              { key: 'share',     icon: 'share',       label: 'Share',     onPress: () => router.push('/share'),
                testID: 'home-share-button' },
            ] as const).map((item) => {
              const isAccent = 'accent' in item && item.accent;
              const tint = isAccent ? stateColor : Colors.text.secondary;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    item.onPress();
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.actionTile,
                    isAccent && { borderColor: stateColor, backgroundColor: `${stateColor}10` },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  testID={'testID' in item ? item.testID : undefined}
                >
                  <Feather name={item.icon} size={16} color={tint} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {showCycleSuccess && lastCycleResult && (
          <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
        )}

        <ScoreBreakdownSheet
          visible={breakdownOpen}
          onDismiss={() => setBreakdownOpen(false)}
          score={score}
          contributions={breakdown}
          performanceState={performanceState}
        />

        <OnboardingOverlay
          visible={!hasSeenOnboarding}
          onDismiss={completeOnboarding}
        />

        {/* Floating voice mic — sits above the tab bar. */}
        <View
          pointerEvents="box-none"
          style={[styles.voiceFab, { bottom: bottomPadding - 56 }]}
        >
          <VoiceButton
            state={voiceBtnState}
            onPress={() => { setVoiceAutoStart(false); setVoiceOpen(true); }}
          />
        </View>

        <VoiceOverlay
          visible={voiceOpen}
          autoStart={voiceAutoStart}
          onClose={() => { setVoiceOpen(false); setVoiceAutoStart(false); }}
        />
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { gap: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 8,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  shareIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
    marginRight: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stateLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  orbContainer: { alignItems: 'center', paddingVertical: 8, marginBottom: 4 },
  orbHint: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
    marginTop: -6,
  },
  spacer: { height: 12 },
  spacerLg: { height: 20 },
  moreLabelRow: { marginTop: 12, paddingHorizontal: 4 },
  moreLabel: {
    color: Colors.text.muted,
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: '700',
  },
  ctaButton: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: Colors.background.elevated,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  ctaGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  snoozeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  // Low-weight nav chip for the MORE tray. Deliberately short (32px) and
  // borderless so the row reads as a quiet utility strip, never competing
  // with the dominant Primary Command Card above. flex:1 keeps the row
  // balanced across the 7 destinations on any phone width.
  actionTile: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  voiceFab: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
  },
});
