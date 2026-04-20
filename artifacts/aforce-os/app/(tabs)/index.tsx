/**
 * Autopilot Screen — Main performance command center.
 * The core AForce OS experience.
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GradientBackground } from '@/components/GradientBackground';
import { LiveStatusStrip } from '@/components/LiveStatusStrip';
import { StatusPulseOrb } from '@/components/StatusPulseOrb';
import { WhyThisScore } from '@/components/WhyThisScore';
import { RiskTimerDisplay } from '@/components/RiskTimerDisplay';
import { SystemCommandCard } from '@/components/SystemCommandCard';
import { WaterCycleBar } from '@/components/WaterCycleBar';
import { PhantomSignal } from '@/components/PhantomSignal';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';

import { useAppStore } from '@/store/useAppStore';
import { Colors } from '@/theme/colors';
import { Feather } from '@expo/vector-icons';

export default function AutopilotScreen() {
  const { state, completeCycle, snooze, dismissSuccess } = useAppStore();
  const { engineOutput, userState, showCycleSuccess, lastCycleResult, isCompletingCycle, timerSeconds } = state;
  const { performanceState, score, reasons, command } = engineOutput;
  const insets = useSafeAreaInsets();

  const stateColor = performanceState.color;

  const handleCompleteCycle = () => {
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
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* 1. Live Status Strip */}
          <LiveStatusStrip
            performanceState={performanceState}
            unitsToday={userState.unitsConsumedToday}
            dailyTarget={userState.dailyTarget}
          />

          {/* 2. Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.screenTitle}>AUTOPILOT</Text>
              <Text style={styles.screenSubtitle}>Performance Command System</Text>
            </View>
            <View style={[styles.statePill, { borderColor: `${stateColor}44`, backgroundColor: `${stateColor}12` }]}>
              <Text style={[styles.stateLabel, { color: stateColor }]}>{performanceState.level}</Text>
            </View>
          </View>

          {/* 3. Central Status Pulse Orb */}
          <View style={styles.orbContainer}>
            <StatusPulseOrb performanceState={performanceState} score={score} />
          </View>

          {/* 4. Why This Score */}
          <WhyThisScore reasons={reasons} />

          <View style={styles.spacer} />

          {/* 5. Risk Timer */}
          <RiskTimerDisplay timerSeconds={timerSeconds} performanceState={performanceState} />

          <View style={styles.spacer} />

          {/* 6. System Command */}
          <SystemCommandCard command={command} performanceState={performanceState} />

          <View style={styles.spacerLg} />

          {/* 7. Primary CTA */}
          <TouchableOpacity
            style={[
              styles.ctaButton,
              { borderColor: `${stateColor}55` },
              isCompletingCycle && styles.ctaDisabled,
            ]}
            onPress={handleCompleteCycle}
            activeOpacity={0.8}
            disabled={isCompletingCycle}
          >
            <View style={[styles.ctaGlow, { backgroundColor: `${stateColor}25` }]} />
            <Feather name="check-circle" size={20} color={isCompletingCycle ? Colors.text.muted : stateColor} />
            <Text style={[styles.ctaText, { color: isCompletingCycle ? Colors.text.muted : Colors.text.primary }]}>
              {isCompletingCycle ? 'LOGGING...' : 'COMPLETE CYCLE'}
            </Text>
          </TouchableOpacity>

          {/* 8. Snooze */}
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

          {/* 9. Water Cycle Bar */}
          <WaterCycleBar
            unitsConsumed={userState.unitsConsumedToday}
            dailyTarget={userState.dailyTarget}
            performanceState={performanceState}
          />

          <View style={styles.spacer} />

          {/* 10. Phantom Signal */}
          <PhantomSignal />
        </ScrollView>

        {/* Cycle Success Overlay */}
        {showCycleSuccess && lastCycleResult && (
          <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
        )}
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  screenTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 3,
  },
  screenSubtitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  statePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  stateLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  orbContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  spacer: {
    height: 12,
  },
  spacerLg: {
    height: 20,
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
  ctaGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
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
});
