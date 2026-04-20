/**
 * WhyThisScore — Shows 2–4 concise reasons for current performance score.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ScoreReason } from '../types';
import { Colors } from '../theme/colors';

interface Props {
  reasons: ScoreReason[];
}

export function WhyThisScore({ reasons }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>WHY THIS SCORE</Text>
      <View style={styles.list}>
        {reasons.map((reason) => (
          <View key={reason.id} style={styles.reasonRow}>
            <Feather
              name={reason.weight === 'positive' ? 'arrow-up' : reason.weight === 'negative' ? 'arrow-down' : 'minus'}
              size={12}
              color={
                reason.weight === 'positive'
                  ? Colors.states.PEAK.primary
                  : reason.weight === 'negative'
                  ? Colors.states.DEPLETED.primary
                  : Colors.text.muted
              }
            />
            <Text style={[
              styles.reasonText,
              reason.weight === 'positive' && styles.positiveText,
              reason.weight === 'negative' && styles.negativeText,
            ]}>
              {reason.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginHorizontal: 20,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reasonText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    flex: 1,
  },
  positiveText: {
    color: Colors.states.PEAK.primary,
  },
  negativeText: {
    color: 'rgba(255,255,255,0.7)',
  },
});
