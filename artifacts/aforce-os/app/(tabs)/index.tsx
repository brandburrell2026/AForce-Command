/**
 * Home — Hydration Control Center.
 *
 * Per spec, top to bottom:
 *   1. Live status strip
 *   2. Status Pulse + Performance score + State label
 *   3. Why this score
 *   4. AI command card
 *   5. Primary CTA + Quick intake controls
 *   6. Recheck timing / next action
 *   7. Water cycle visualization
 *   8. Phantom signal (live sensor strip)
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
import { LiveStatusStrip } from '@/components/LiveStatusStrip';
import { StatusPulseOrb } from '@/components/StatusPulseOrb';
import { WhyThisScore } from '@/components/WhyThisScore';
import { RiskTimerDisplay } from '@/components/RiskTimerDisplay';
import { AICommandCard } from '@/components/AICommandCard';
import { WaterCycleBar } from '@/components/WaterCycleBar';
import { PhantomSignal } from '@/components/PhantomSignal';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { LogIntakeRow } from '@/components/LogIntakeRow';
import { ScoreBreakdownSheet } from '@/components/ScoreBreakdownSheet';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { AIVideoPlayer } from '@/components/AIVideoPlayer';
import { VoiceButton } from '@/components/VoiceButton';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { PhantomBandCard } from '@/components/PhantomBandCard';
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
          {heatScore.band !== 'STABLE' && (
            <View style={{ marginBottom: 12 }} testID="heat-alert-banner">
              <HeatAlertBanner score={heatScore.score} band={heatScore.band} />
            </View>
          )}

          <LiveStatusStrip
            performanceState={performanceState}
            unitsToday={userState.unitsConsumedToday}
            dailyTarget={userState.dailyTarget}
          />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>HYDRATION CONTROL CENTER</Text>
              <Text style={styles.title}>AForce OS</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                router.push('/share');
              }}
              activeOpacity={0.85}
              style={styles.shareIconBtn}
              accessibilityLabel="Share your performance"
              testID="home-share-button"
            >
              <Feather name="share" size={14} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={[styles.statePill, { borderColor: `${stateColor}55`, backgroundColor: `${stateColor}14` }]}>
              <View style={[styles.dot, { backgroundColor: stateColor }]} />
              <Text style={[styles.stateLabel, { color: stateColor }]}>{performanceState.level}</Text>
            </View>
          </View>

          <View style={styles.orbContainer}>
            <StatusPulseOrb
              pulseConfig={pulseConfig}
              score={score}
              burstAt={lastIntakeBurstAt}
              onTap={openBreakdown}
            />
            <Text style={styles.orbHint}>TAP ORB FOR FULL BREAKDOWN</Text>
          </View>

          <WhyThisScore reasons={reasons} onOpenBreakdown={openBreakdown} />
          <View style={styles.spacer} />

          <AICommandCard command={command} performanceState={performanceState} />
          <View style={styles.spacer} />

          <AIVideoPlayer
            video={matchVideo({ engineOutput, userState })}
            command={command}
            timerSeconds={timerSeconds}
          />
          <View style={styles.spacer} />

          {/*
            Action row — icon-only pills in the Phantom-card aesthetic so all
            six destinations fit on any phone width without a horizontal
            scroll. Each tile is square + flex:1 (so they share the row evenly
            and never overflow). The DEPLETED state still tints the Compare
            tile with the live state color, mirroring how the Phantom card
            promotes its LIVE pill. Screen-reader labels preserve the names.
          */}
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
            ] as const).map((item) => {
              const isAccent = 'accent' in item && item.accent;
              const tint = isAccent ? stateColor : Colors.text.primary;
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
                  <Feather name={item.icon} size={18} color={tint} />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.spacer} />

          <RiskTimerDisplay timerSeconds={timerSeconds} performanceState={performanceState} />
          <View style={styles.spacerLg} />

          <TouchableOpacity
            style={[
              styles.ctaButton,
              { borderColor: `${stateColor}66` },
              isCompletingCycle && styles.ctaDisabled,
            ]}
            onPress={handleComplete}
            activeOpacity={0.85}
            disabled={isCompletingCycle}
          >
            <View style={[styles.ctaGlow, { backgroundColor: `${stateColor}1F` }]} />
            <Feather name="check-circle" size={20} color={isCompletingCycle ? Colors.text.muted : stateColor} />
            <Text style={[styles.ctaText, { color: isCompletingCycle ? Colors.text.muted : Colors.text.primary }]}>
              {isCompletingCycle ? 'LOGGING…' : 'LOG AFORCE STICK'}
            </Text>
          </TouchableOpacity>

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

          <View style={styles.spacer} />
          <LogIntakeRow accentColor={stateColor} />

          <View style={styles.spacer} />
          <WaterCycleBar
            unitsConsumed={userState.unitsConsumedToday}
            dailyTarget={userState.dailyTarget}
            performanceState={performanceState}
          />

          <View style={styles.spacer} />
          <PhantomSignal />

          <View style={styles.spacer} />
          <PhantomBandCard />
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
  // Icon-only tile — Phantom-card aesthetic (Colors.fill.light + subtle border,
  // borderRadius 14). flex:1 + aspectRatio:1 makes them square and evenly
  // distributed across the row, so 6 tiles always fit any phone width.
  actionTile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.fill.light,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  voiceFab: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
  },
});
