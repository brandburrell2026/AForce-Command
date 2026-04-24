/**
 * Text-only share — preview of what gets pasted into X / Threads / iMessage.
 * Renders the exact final string composeTextShare() will send.
 *
 * Broadcast-first: composes from headline + subtext when present, falls
 * back to a single message string for legacy callers.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { composeTextShare } from '@/services/shareTemplateEngine';
import { broadcastToMessage } from '@/services/shareBroadcastEngine';
import type { BroadcastEntry } from '@/types/share';

interface Props {
  /** Preferred — broadcast-first composition. */
  broadcast?: BroadcastEntry;
  /** Fallback — legacy single-line message. */
  message?: string;
}

export const ShareText: React.FC<Props> = ({ broadcast, message }) => {
  const raw = broadcast ? broadcastToMessage(broadcast) : (message ?? '');
  const finalText = composeTextShare(raw);
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>TEXT PREVIEW</Text>
      <View style={styles.bubble}>
        <Text style={styles.text}>{finalText}</Text>
      </View>
      <Text style={styles.hint}>Optimized for X, Threads, iMessage.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  eyebrow: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
  },
  bubble: {
    backgroundColor: Colors.fill.medium,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  text: {
    color: Colors.text.primary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  hint: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 1,
  },
});

export default ShareText;
