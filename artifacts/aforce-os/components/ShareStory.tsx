/**
 * Vertical story share — IG/Snap/TikTok ratio (9:16). Bolder visual, less
 * text. Same data as ShareCard, different composition.
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

export const ShareStory: React.FC<Props> = ({ message, context }) => {
  const accent = (context.state && ACCENT_FOR_STATE[context.state]) || Colors.states.BALANCED.primary;
  const big = context.score != null
    ? String(context.score)
    : context.delta != null
      ? (context.delta >= 0 ? `+${context.delta}` : `${context.delta}`)
      : context.streakDays != null
        ? `${context.streakDays}`
        : '';

  return (
    <View style={styles.story}>
      <View style={styles.glowTop} pointerEvents="none">
        <View style={[styles.glow, { backgroundColor: accent }]} />
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>AFORCE</Text>
        {big ? <Text style={styles.big}>{big}</Text> : null}
        <Text style={[styles.line, { color: accent }]}>{message}</Text>
      </View>

      <Text style={styles.brand}>aforce.os</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  story: {
    aspectRatio: 9 / 16,
    backgroundColor: Colors.background.primary,
    borderRadius: 24,
    padding: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    justifyContent: 'space-between',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: -50,
    right: -50,
    alignItems: 'center',
  },
  glow: {
    width: 260,
    height: 260,
    borderRadius: 200,
    opacity: 0.18,
  },
  body: { flex: 1, justifyContent: 'center', gap: 12 },
  eyebrow: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
  },
  big: {
    color: Colors.text.primary,
    fontSize: 120,
    fontWeight: '200',
    letterSpacing: -3,
    lineHeight: 124,
  },
  line: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  brand: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ShareStory;
