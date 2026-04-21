/**
 * Square card share — Instagram-grid optimized. Premium, dark, minimal.
 * This is the *visual* preview rendered inside the app; image export is
 * a future cycle (view-shot).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import type { ShareContext, StateLabel } from '@/types/share';

interface Props {
  message: string;
  context: ShareContext;
}

const ACCENT_FOR_STATE: Record<StateLabel, string> = {
  Peak:       Colors.states.PEAK.primary,
  Balanced:   Colors.states.BALANCED.primary,
  Recovering: Colors.states.RECOVERING.primary,
  Depleted:   Colors.states.DEPLETED.primary,
};

export const ShareCard: React.FC<Props> = ({ message, context }) => {
  const accent = (context.state && ACCENT_FOR_STATE[context.state]) || Colors.states.BALANCED.primary;
  const big = context.score != null
    ? String(context.score)
    : context.delta != null
      ? (context.delta >= 0 ? `+${context.delta}` : `${context.delta}`)
      : context.streakDays != null
        ? `${context.streakDays}`
        : '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.eyebrow}>AFORCE</Text>
      </View>

      {big ? <Text style={styles.big}>{big}</Text> : null}

      <Text style={[styles.line, { color: accent }]} numberOfLines={2}>
        {message}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.brand}>aforce.os</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: 24,
    padding: 28,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  eyebrow: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
  },
  big: {
    color: Colors.text.primary,
    fontSize: 96,
    fontWeight: '200',
    letterSpacing: -2,
    marginTop: 'auto',
    marginBottom: 4,
  },
  line: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 24,
  },
  footer: { marginTop: 16 },
  brand: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
  },
});

export default ShareCard;
