/**
 * AICommandCard — Performance Decision Engine output.
 * Format: WHAT to do + WHEN/HOW MUCH + OUTCOME. Command authority. No chatbot phrasing.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Command, PerformanceState } from '../types';
import { Colors } from '../theme/colors';
import { speak, stopSpeaking } from '../services/textToSpeech';

interface Props {
  command: Command;
  performanceState: PerformanceState;
}

const URGENCY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  low: 'check-circle',
  medium: 'zap',
  high: 'alert-triangle',
  critical: 'alert-octagon',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'HOLD THE LINE',
  medium: 'ACT NOW',
  high: 'HIGH PRIORITY',
  critical: 'CRITICAL',
};

export function AICommandCard({ command, performanceState }: Props) {
  const { color } = performanceState;
  const icon = URGENCY_ICONS[command.urgencyLevel] ?? 'zap';
  const label = URGENCY_LABELS[command.urgencyLevel] ?? 'ACT NOW';

  const [isSpeaking, setIsSpeaking] = React.useState(false);

  React.useEffect(() => {
    // Stop any in-flight speech when the command itself changes.
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.action, command.explanation]);

  React.useEffect(() => {
    return () => { stopSpeaking(); };
  }, []);

  // Detect speech end on web so the button toggles back to idle.
  React.useEffect(() => {
    if (!isSpeaking || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    if (!synth) return;
    const interval = setInterval(() => {
      if (!synth.speaking && !synth.pending) {
        setIsSpeaking(false);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    const line = `${command.action}. ${command.explanation}`;
    speak(line);
    setIsSpeaking(true);
  };

  return (
    <View style={[styles.container, { borderColor: `${color}30` }]}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>AFORCE COMMAND</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={handleSpeak}
            accessibilityRole="button"
            accessibilityLabel={isSpeaking ? 'Stop coach voice' : 'Hear coach recommendation'}
            hitSlop={10}
            style={({ pressed }) => [
              styles.speakBtn,
              {
                backgroundColor: isSpeaking ? `${color}26` : `${color}14`,
                borderColor: isSpeaking ? `${color}99` : `${color}55`,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name={isSpeaking ? 'volume-x' : 'volume-2'} size={12} color={color} />
            <Text style={[styles.speakLabel, { color }]}>
              {isSpeaking ? 'STOP' : 'HEAR IT'}
            </Text>
          </Pressable>
          <View style={[styles.urgencyBadge, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
            <Feather name={icon} size={10} color={color} />
            <Text style={[styles.urgencyLabel, { color }]}>{label}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.commandText, { color: Colors.text.primary }]}>
        {command.action}
      </Text>

      <Text style={styles.explanation}>{command.explanation}</Text>

      <View style={[styles.impactRow, { borderTopColor: Colors.border.subtle }]}>
        <Feather name="trending-up" size={12} color={color} />
        <Text style={[styles.impactText, { color }]}>Projected: {command.estimatedImpact}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  speakLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  urgencyLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  commandText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    lineHeight: 25,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  explanation: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  impactText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
});
