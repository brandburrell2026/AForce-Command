/**
 * PrimaryCommandCard — the dominant element of the One-Command OS home.
 *
 * Why this exists:
 *   The redesign brief is explicit: in under one second the user must know
 *   their state, what to do, and why. This card carries "what to do".
 *   Everything else on the home screen supports it — there is no
 *   second-tier command, no parallel CTA, no chat-style coaching block.
 *
 * Anatomy (top to bottom):
 *   1. Urgency eyebrow ("HIGH PRIORITY", "ACT NOW", etc.)
 *   2. The command line itself ("Drink 16 oz now") — large, bold, brand-tone.
 *   3. Recheck window ("Recheck in 25 minutes")
 *   4. Primary CTA — "LOG INTAKE" (full width inside the card)
 *   5. Projected impact ("Projected: +12 to score")
 *
 * Visual rules:
 *   - State-tinted glow, brand border, no competing borders nearby.
 *   - Disabled state shows muted styling + "LOGGING…" verb.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Command, PerformanceState } from '../types';
import { Colors } from '../theme/colors';

interface Props {
  command: Command;
  performanceState: PerformanceState;
  /** Recheck countdown in minutes (rounded up). Pass 0 to hide the line. */
  recheckMinutes: number;
  /** Whether a log cycle is currently in flight (disables the CTA). */
  isLogging: boolean;
  onLog: () => void;
}

const URGENCY_LABEL: Record<Command['urgencyLevel'], string> = {
  low: 'HOLD THE LINE',
  medium: 'ACT NOW',
  high: 'HIGH PRIORITY',
  critical: 'CRITICAL',
};

export function PrimaryCommandCard({
  command,
  performanceState,
  recheckMinutes,
  isLogging,
  onLog,
}: Props) {
  const accent = performanceState.color;
  // Haptics are intentionally NOT triggered here — the parent handler
  // (handleComplete in app/(tabs)/index.tsx) already fires a heavy impact
  // when this CTA invokes it. Keeping it in one place avoids the
  // double-buzz that the architect review flagged.
  const handlePress = () => {
    if (isLogging) return;
    onLog();
  };

  return (
    <View
      style={[styles.card, { borderColor: `${accent}55` }]}
      testID="primary-command-card"
    >
      {/* state-tinted glow behind the entire card */}
      <View
        style={[styles.glow, { backgroundColor: `${accent}1A` }]}
        pointerEvents="none"
      />

      <Text style={[styles.urgency, { color: accent }]}>
        {URGENCY_LABEL[command.urgencyLevel]}
      </Text>

      <Text style={styles.commandText}>{command.action}</Text>

      {recheckMinutes > 0 && (
        <View style={styles.recheckRow}>
          <Feather name="clock" size={12} color={Colors.text.muted} />
          <Text style={styles.recheckText}>
            Recheck in {recheckMinutes} {recheckMinutes === 1 ? 'minute' : 'minutes'}
          </Text>
        </View>
      )}

      <Pressable
        onPress={handlePress}
        disabled={isLogging}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: isLogging ? Colors.fill.medium : accent },
          pressed && !isLogging && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Log intake: ${command.action}`}
        testID="primary-command-cta"
      >
        <Feather
          name={isLogging ? 'loader' : 'check-circle'}
          size={18}
          color={isLogging ? Colors.text.muted : Colors.text.inverse}
        />
        <Text
          style={[
            styles.ctaText,
            { color: isLogging ? Colors.text.muted : Colors.text.inverse },
          ]}
        >
          {isLogging ? 'LOGGING…' : 'LOG INTAKE'}
        </Text>
      </Pressable>

      {!!command.estimatedImpact && (
        <Text style={styles.impactText}>
          Projected: <Text style={[styles.impactValue, { color: accent }]}>{command.estimatedImpact}</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.background.card,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 14,
  },
  glow: {
    position: 'absolute',
    top: -60,
    left: -40,
    right: -40,
    height: 180,
    borderRadius: 200,
    opacity: 0.9,
  },
  urgency: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '700',
  },
  commandText: {
    color: Colors.text.primary,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  recheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recheckText: {
    color: Colors.text.muted,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cta: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  impactText: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  impactValue: {
    fontWeight: '700',
  },
});

export default PrimaryCommandCard;
