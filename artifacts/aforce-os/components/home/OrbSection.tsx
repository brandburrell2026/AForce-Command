/**
 * OrbSection — Status Pulse Orb + prediction strip OR 24h empty-state.
 *
 * The empty-state ("No intake in 24h — log a drink to start") is driven
 * by `IntakeSlice.noRecentIntake`, which is derived from the count of
 * intake events whose `loggedAt` falls inside the last 24h window.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../../theme/colors';
import { StatusPulseOrb } from '../StatusPulseOrb';
import { useEngineSlice, useIntakeSlice } from '../../store/slices';
import { useDisplayedAccent } from '../../hooks/useDisplayedAccent';

interface Props {
  onOpenBreakdown: () => void;
  orbSize: number;
}

function OrbSectionImpl({ onOpenBreakdown, orbSize }: Props) {
  const { t } = useTranslation();
  const engine = useEngineSlice();
  const intake = useIntakeSlice();
  // Prefer the displayed (in-flight) accent so the orb digit, ring,
  // glow, and prediction strip recolour on the same frame as every
  // other state-tinted element on the home screen. Falls back to the
  // engine's instantaneous accent when the provider isn't mounted.
  const displayed = useDisplayedAccent();
  const stateColor = displayed?.primary ?? engine.performanceState.color;

  const onTap = React.useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onOpenBreakdown();
  }, [onOpenBreakdown]);

  const socialOverlay = engine.social?.active
    ? {
        alcoholLoad: Math.min(1, Math.max(0, (engine.social.alcoholMultiplier - 1) * 2)),
        unstable:
          engine.social.impairment.level === 'HIGH' ||
          engine.social.impairment.level === 'CRITICAL',
      }
    : undefined;

  return (
    <View style={styles.orbContainer}>
      <StatusPulseOrb
        pulseConfig={engine.pulseConfig}
        score={engine.score}
        burstAt={intake.lastIntakeBurstAt}
        onTap={onTap}
        size={orbSize}
        socialOverlay={socialOverlay}
        displayedAccent={displayed ? { primary: displayed.primary, glow: displayed.glow } : undefined}
        displayedScore={displayed?.displayedScore}
      />
      <Text style={styles.orbHint}>TAP ORB FOR FULL BREAKDOWN</Text>
      {intake.noRecentIntake ? (
        <View
          style={[
            styles.predictionStrip,
            { borderColor: `${Colors.text.muted}33`, backgroundColor: `${Colors.text.muted}14` },
          ]}
          testID="no-recent-intake"
          accessibilityLabel="No intake logged in the last 24 hours. Log a drink to start your day."
        >
          <Feather name="droplet" size={12} color={Colors.text.muted} />
          <Text style={[styles.predictionText, { color: Colors.text.secondary }]}>
            {t('home.no_recent_intake')}
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.predictionStrip,
            { borderColor: `${stateColor}33`, backgroundColor: `${stateColor}10` },
          ]}
          testID="prediction-strip"
        >
          <View style={[styles.dot, { backgroundColor: stateColor }]} />
          <Text style={[styles.predictionText, { color: stateColor }]}>
            {engine.prediction.label}
          </Text>
        </View>
      )}
    </View>
  );
}

export const OrbSection = React.memo(OrbSectionImpl);

const styles = StyleSheet.create({
  orbContainer: { alignItems: 'center', paddingVertical: 24, marginBottom: 8, overflow: 'visible' },
  orbHint: {
    fontSize: 8, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 2.5,
    marginTop: 12, opacity: 0.45,
  },
  predictionStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  predictionText: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
