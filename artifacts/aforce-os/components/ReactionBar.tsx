/**
 * Reaction bar — performance-first reaction picker. Renders only the
 * reactions appropriate for the target user's current state so coaches
 * never accidentally tell a Peak athlete to "catch up now".
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { hapticNotify } from '@/services/haptics';
import { Colors } from '@/theme/colors';
import type { ReactionId, SharedStateLabel } from '@/types/circle';
import { reactionsForState } from '@/services/reactionService';

interface Props {
  state: SharedStateLabel;
  onSend: (reaction: ReactionId) => void;
}

export const ReactionBar: React.FC<Props> = ({ state, onSend }) => {
  const options = React.useMemo(() => reactionsForState(state), [state]);
  const [sentId, setSentId] = React.useState<ReactionId | null>(null);

  const handleSend = (id: ReactionId) => {
    if (sentId === id) return;
    if (Platform.OS !== 'web') {
      hapticNotify('success');
    }
    setSentId(id);
    onSend(id);
    // Reset confirmation after a brief moment.
    setTimeout(() => setSentId(null), 1500);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>SEND A REACTION</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map(opt => {
          const sent = sentId === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => handleSend(opt.id)}
              style={[styles.chip, sent && styles.chipSent]}
              accessibilityLabel={`Send reaction: ${opt.label}`}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, sent && styles.chipTextSent]}>
                {sent ? 'SENT' : opt.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: {
    color: Colors.text.muted, fontSize: 11, letterSpacing: 3, fontWeight: '600',
  },
  row: { gap: 8, paddingRight: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  chipSent: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  chipText: {
    color: Colors.text.primary, fontSize: 11, letterSpacing: 1.5, fontWeight: '600',
  },
  chipTextSent: { color: Colors.text.inverse },
});

export default ReactionBar;
