/**
 * Home — Hydration Control Center (orchestrator).
 *
 * Visual layout lives in `components/home/*`:
 *   <HomeHeader/>   → welcome, identity, status strip
 *   <OrbSection/>   → Status Pulse Orb + prediction strip / 24h empty-state
 *   <CommandStack/> → Why-this-score → AI command → AI video
 *   <PrimaryCTA/>   → "Become AForce" + Snooze + flavor picker
 *   <EntryActions/> → Quick action tile grid
 *   <SignalsZone/>  → Bottom signals stack (timer, water cycle, Phantom, heat, social)
 *
 * This file owns: side effects (band mirroring, voice triggers), the
 * heat-guard hook + voice overlay, the breakdown / social / onboarding
 * overlays, and the phone-vs-foldable layout switch. Everything else is
 * delegated to memoized children that subscribe to focused store slices,
 * so unrelated state updates don't re-render the whole screen.
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { WEB_TOP_PADDING, WEB_BOTTOM_PADDING, TAB_BAR_HEIGHT } from '@/constants/layout';
import { useFoldableState } from '@/hooks/useFoldableState';
import { useHeatGuard } from '@/hooks/useHeatGuard';
import { ScoreBreakdownSheet } from '@/components/ScoreBreakdownSheet';
import { SocialModeSheet } from '@/components/SocialModeSheet';
import { OnboardingOverlay } from '@/components/OnboardingOverlay';
import { VoiceButton } from '@/components/VoiceButton';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import type { VoiceState } from '@/types/voice';
import { phantomBandService } from '@/services/phantomBandService';

import { HomeHeader } from '@/components/home/HomeHeader';
import { OrbSection } from '@/components/home/OrbSection';
import { SignalsZone } from '@/components/home/SignalsZone';
import { EntryActions } from '@/components/home/EntryActions';
import { CommandStack } from '@/components/home/CommandStack';
import { PrimaryCTA } from '@/components/home/PrimaryCTA';
import { TodayQuote } from '@/components/home/TodayQuote';
import { useScoreBandVoice } from '@/hooks/useScoreBandVoice';
import { useRiskTimerVoice } from '@/hooks/useRiskTimerVoice';

import { useAppStore } from '@/store/useAppStore';
import { DisplayedAccentProvider } from '@/hooks/useDisplayedAccent';
import { Colors } from '@/theme/colors';

export default function HomeScreen() {
  const {
    state, dismissSuccess, completeOnboarding,
    activateSocialMode, logSocialDrink, confirmSocialHydration, deactivateSocialMode,
  } = useAppStore();
  const layout = useResponsiveLayout();
  const foldable = useFoldableState();
  const {
    engineOutput, userState, showCycleSuccess, lastCycleResult, hasSeenOnboarding,
  } = state;

  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [socialOpen, setSocialOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [voiceAutoStart, setVoiceAutoStart] = React.useState(false);
  const [voiceBtnState, setVoiceBtnState] = React.useState<VoiceState>('idle');

  // AForce Command Voice Engine — score-band + risk-timer alert hooks.
  // Both consume the store internally (no props needed) and are gated
  // by voiceCoachEnabled + voiceScope. Mounted here so they live on
  // Home for the duration of every session.
  useScoreBandVoice();
  useRiskTimerVoice();

  React.useEffect(() => {
    setVoiceBtnState(voiceOpen ? 'listening' : 'idle');
  }, [voiceOpen]);

  // Mirror current performance level into the Phantom Band LED.
  React.useEffect(() => {
    phantomBandService.mirrorPerformance(engineOutput.performanceState.level);
  }, [engineOutput.performanceState.level]);

  // Band-initiated voice trigger (double-tap / press-and-hold).
  React.useEffect(() => {
    return phantomBandService.on('voice_trigger', () => {
      setVoiceAutoStart(true);
      setVoiceOpen(true);
    });
  }, []);

  // Heat-guard hook — derives the band, fires the warning voice on
  // STABLE → escalation crossings, and surfaces the voice overlay.
  const onHeatEscalate = React.useCallback(() => {
    setVoiceAutoStart(false);
    setVoiceOpen(true);
  }, []);
  const heatScore = useHeatGuard({ onEscalate: onHeatEscalate });

  const openBreakdown = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      // Lazy-load haptics so the orchestrator stays import-light.
      import('expo-haptics').then((m) => m.selectionAsync().catch(() => {}));
    }
    setBreakdownOpen(true);
  }, []);
  const openSocial = React.useCallback(() => setSocialOpen(true), []);
  const closeSocial = React.useCallback(() => setSocialOpen(false), []);
  const closeBreakdown = React.useCallback(() => setBreakdownOpen(false), []);
  const closeVoice = React.useCallback(() => {
    setVoiceOpen(false);
    setVoiceAutoStart(false);
  }, []);
  const openVoice = React.useCallback(() => {
    setVoiceAutoStart(false);
    setVoiceOpen(true);
  }, []);

  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;

  return (
    <View style={styles.root}>
      <GradientBackground>
        {/*
          DisplayedAccentProvider runs ONE shared 900ms tween from the
          previous score to the new score and exposes the in-flight
          (rounded) value plus its band-correct accent. Every state-
          tinted child on this screen — the orb digit, the prediction
          strip, the AI Coach card, the "Become AForce" CTA — reads
          from this provider, so they all recolour on the exact frame
          the orb number rolls into the next band. Without it, the
          colour flips were instant while the digit was still tweening.
        */}
        <DisplayedAccentProvider score={engineOutput.score}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: topPadding + 8,
              paddingBottom: bottomPadding + 24,
              ...(layout.isWide
                ? { maxWidth: layout.contentMaxWidth, alignSelf: 'center', width: '100%' }
                : null),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <HomeHeader />

          {foldable.isExpanded ? (
            <View style={styles.twoCol} testID="home-two-col">
              <View style={[styles.col, styles.colLeft]}>
                <OrbSection onOpenBreakdown={openBreakdown} orbSize={layout.orbSize} />
                <TodayQuote />
                <CommandStack onOpenBreakdown={openBreakdown} />
                <View style={styles.spacerLg} />
                <PrimaryCTA layout={layout} />
              </View>
              <View style={[styles.col, styles.colRight]} testID="home-right-col">
                <SignalsZone
                  heatScore={heatScore}
                  onOpenSocial={openSocial}
                  includeEntryActions
                  entryActions={<EntryActions />}
                />
              </View>
            </View>
          ) : (
            <>
              <OrbSection onOpenBreakdown={openBreakdown} orbSize={layout.orbSize} />
              <TodayQuote />
              <CommandStack onOpenBreakdown={openBreakdown} />
              <View style={styles.spacer} />
              <EntryActions />
              <View style={styles.spacerLg} />
              <PrimaryCTA layout={layout} />
              <View style={styles.spacerSm} />
              <SignalsZone heatScore={heatScore} onOpenSocial={openSocial} />
            </>
          )}
        </ScrollView>

        {showCycleSuccess && lastCycleResult && (
          <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
        )}

        <SocialModeSheet
          visible={socialOpen}
          onDismiss={closeSocial}
          socialMode={userState.socialMode}
          social={engineOutput.social}
          onActivate={activateSocialMode}
          onLogDrink={logSocialDrink}
          onConfirmHydration={confirmSocialHydration}
          onDeactivate={deactivateSocialMode}
        />

        <ScoreBreakdownSheet
          visible={breakdownOpen}
          onDismiss={closeBreakdown}
          score={engineOutput.score}
          contributions={engineOutput.breakdown}
          performanceState={engineOutput.performanceState}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { gap: 0 },
  spacer: { height: 12 },
  spacerSm: { height: 6 },
  spacerLg: { height: 20 },
  twoCol: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 16, paddingHorizontal: 8, marginTop: 4,
  },
  col: { flex: 1 },
  colLeft: { flex: 1.05 },
  colRight: { flex: 0.95 },
  voiceFab: { position: 'absolute', right: 20, alignItems: 'flex-end' },
});
