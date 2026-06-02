/**
 * WhyThisScore — Shows 2–4 concise reasons for current performance score.
 * The entire card is the single CTA into the full ScoreBreakdownSheet
 * (chevron in the header signals "tap to open"). The previous separate
 * "FULL BREAKDOWN" button has been collapsed into this card-wide tap.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from './Icon';
import type { ScoreReason } from '../types';
import { Colors } from '../theme/colors';

interface Props {
  reasons: ScoreReason[];
  onOpenBreakdown?: () => void;
}

function ReasonsList({ reasons }: { reasons: ScoreReason[] }) {
  return (
    <View style={styles.list}>
      {reasons.map((reason) => (
        <View key={reason.id} style={styles.reasonRow}>
          <Icon
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
  );
}

function WhyThisScoreImpl({ reasons, onOpenBreakdown }: Props) {
  if (onOpenBreakdown) {
    return (
      <Pressable
        onPress={onOpenBreakdown}
        accessibilityRole="button"
        accessibilityLabel="Why this score — tap to open the full breakdown"
        testID="why-this-score"
        style={styles.container}
      >
        <View style={styles.headerRow}>
          <Text style={styles.label}>WHY THIS SCORE</Text>
          <Icon name="chevron-right" size={14} color={Colors.text.muted} />
        </View>
        <ReasonsList reasons={reasons} />
      </Pressable>
    );
  }
  return (
    <View testID="why-this-score" style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>WHY THIS SCORE</Text>
      </View>
      <ReasonsList reasons={reasons} />
    </View>
  );
}

export const WhyThisScore = React.memo(WhyThisScoreImpl);

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
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
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
