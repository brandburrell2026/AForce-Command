/**
 * WhyCompact — the secondary "why" block for the One-Command OS home.
 *
 * Stripped-down sibling of WhyThisScore: no card chrome, no full-breakdown
 * link, max two reasons surfaced. Designed to support — never compete with —
 * the PrimaryCommandCard above it.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ScoreReason } from '../types';
import { Colors } from '../theme/colors';

interface Props {
  reasons: ScoreReason[];
  onOpenBreakdown?: () => void;
  /** Maximum reasons shown inline. Default 2 keeps the block 3 lines tall. */
  limit?: number;
}

export function WhyCompact({ reasons, onOpenBreakdown, limit = 2 }: Props) {
  const visible = reasons.slice(0, limit);
  if (visible.length === 0) return null;
  return (
    <Pressable
      onPress={onOpenBreakdown}
      disabled={!onOpenBreakdown}
      style={styles.container}
      accessibilityRole={onOpenBreakdown ? 'button' : undefined}
      accessibilityLabel="Why this command — tap to see full breakdown"
    >
      <Text style={styles.label}>WHY</Text>
      <View style={styles.list}>
        {visible.map((r) => (
          <View key={r.id} style={styles.row}>
            <Feather
              name={r.weight === 'positive' ? 'arrow-up' : r.weight === 'negative' ? 'arrow-down' : 'minus'}
              size={11}
              color={
                r.weight === 'positive'
                  ? Colors.states.PEAK.primary
                  : r.weight === 'negative'
                  ? Colors.states.DEPLETED.primary
                  : Colors.text.muted
              }
            />
            <Text style={styles.text} numberOfLines={1}>{r.text}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '700',
  },
  list: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default WhyCompact;
