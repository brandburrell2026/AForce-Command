/**
 * ScanAICoachCard — the AI Coach voice surface on the Hydration Scan
 * screen. Reads the comparison narrative out loud (via ElevenLabs with
 * device-TTS fallback) and renders a side-by-side metric breakdown
 * scanned-vs-AForce so the user can see what the coach is saying.
 *
 * Auto-speaks once per new scan (gated on the user's voice toggle
 * inside `textToSpeech.speak()`). The play/stop button lets the user
 * replay or silence at any point.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { Colors } from '@/theme/colors';
import type { ScanCoachScript } from '@/services/scanCoachVoice';
import type { PerformanceLevel } from '@/types';

interface Props {
  script: ScanCoachScript;
  /** Stable token (e.g. ScanResult.scannedAt) — drives auto-speak. */
  scanKey: string;
  /** Drives TTS persona rate / pitch. */
  level: PerformanceLevel;
  scannedName: string;
  aforceName?: string;
  onSpeak: (text: string, level: PerformanceLevel) => void;
  onStop: () => void;
}

export function ScanAICoachCard({
  script,
  scanKey,
  level,
  scannedName,
  aforceName,
  onSpeak,
  onStop,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const accent = Colors.states.PEAK.primary;

  // Tracks any in-flight "estimated finish" timer so we can cancel it on
  // unmount, on re-toggle, or on a fresh scan — prevents a stale timeout
  // from flipping isPlaying false on an unmounted component.
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFinishTimer = () => {
    if (finishTimerRef.current !== null) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const scheduleFinishFlip = (transcript: string) => {
    clearFinishTimer();
    // We don't get a precise "ended" event from the unified TTS layer, so
    // flip back to "ready to replay" after a generous estimated window.
    // ~180 wpm average — pad with 1.2s warm-up / network buffer.
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const estimateMs = Math.round((wordCount / 180) * 60_000) + 1200;
    finishTimerRef.current = setTimeout(() => {
      finishTimerRef.current = null;
      setIsPlaying(false);
    }, estimateMs);
  };

  // Auto-speak each new scan — onSpeak() is a no-op if voice playback is off.
  useEffect(() => {
    onSpeak(script.transcript, level);
    setIsPlaying(true);
    scheduleFinishFlip(script.transcript);
    return () => {
      clearFinishTimer();
      onStop();
      setIsPlaying(false);
    };
    // Re-run only when a fresh scan arrives, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanKey]);

  const onToggle = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    if (isPlaying) {
      clearFinishTimer();
      onStop();
      setIsPlaying(false);
    } else {
      onSpeak(script.transcript, level);
      setIsPlaying(true);
      scheduleFinishFlip(script.transcript);
    }
  };

  return (
    <View
      style={[styles.card, { borderColor: `${accent}55` }]}
      testID="scan-ai-coach-card"
    >
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: `${accent}1A`, borderColor: `${accent}66` }]}>
          <Feather name="message-circle" size={11} color={accent} />
          <Text style={[styles.badgeText, { color: accent }]}>AI COACH</Text>
        </View>
        {script.hasComparison && (
          <Text style={styles.headerHint}>Scanned vs AForce</Text>
        )}
      </View>

      <Text style={styles.headline} numberOfLines={3}>
        {script.headline}
      </Text>

      {script.hasComparison && script.bullets.length > 0 && (
        <View style={styles.comparison} testID="scan-ai-coach-comparison">
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonHeaderLabel} numberOfLines={1}>
              {scannedName}
            </Text>
            <Text style={styles.comparisonHeaderMetric}>METRIC</Text>
            <Text style={[styles.comparisonHeaderLabel, { textAlign: 'right', color: accent }]} numberOfLines={1}>
              {aforceName ?? 'AForce'}
            </Text>
          </View>
          {script.bullets.map((b) => {
            const sColor =
              b.winner === 'scanned'
                ? Colors.states.PEAK.primary
                : b.winner === 'tie'
                ? Colors.text.primary
                : Colors.text.muted;
            const aColor =
              b.winner === 'aforce'
                ? accent
                : b.winner === 'tie'
                ? Colors.text.primary
                : Colors.text.muted;
            return (
              <View key={b.label} style={styles.comparisonRow}>
                <Text style={[styles.comparisonValue, { color: sColor }]}>{b.scanned}</Text>
                <Text style={styles.comparisonLabel} numberOfLines={1}>
                  {b.label}
                </Text>
                <Text style={[styles.comparisonValue, { color: aColor, textAlign: 'right' }]}>
                  {b.aforce}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.transcript}>{script.transcript}</Text>

      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.cta,
          {
            borderColor: `${accent}66`,
            backgroundColor: `${accent}10`,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Stop AI Coach' : 'Hear AI Coach'}
        testID="scan-ai-coach-toggle"
      >
        <Feather
          name={isPlaying ? 'square' : 'play'}
          size={14}
          color={accent}
        />
        <Text style={[styles.ctaText, { color: accent }]}>
          {isPlaying ? 'STOP' : 'HEAR IT AGAIN'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  headerHint: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.4,
  },
  headline: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  transcript: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 18,
  },

  comparison: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border.subtle,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  comparisonHeaderLabel: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.2,
  },
  comparisonHeaderMetric: {
    width: 96,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.4,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  comparisonValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
  comparisonLabel: {
    width: 96,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
  },
});
