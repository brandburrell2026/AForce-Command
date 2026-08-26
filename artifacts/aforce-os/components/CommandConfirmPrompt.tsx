/**
 * CommandConfirmPrompt — Asks the user how they followed the last command
 * once the recheck timer hits 0.
 *
 * Three answers:
 *   • WATER     → real intake calculation (logIntake('water'))
 *   • AFORCE RTD → real intake calculation (logIntake('aforce_rtd'))
 *   • MISSED IT → -3 confirmation penalty (confirmCommand(false))
 *
 * Renders inline (not a modal) so it doesn't fight other overlays on
 * web, and so it stays anchored to the command region of Home where
 * the answer matters.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Icon } from './Icon';
import { hapticImpact } from '@/services/haptics';
import { Colors } from '../theme/colors';
import type { FluidType } from '../types';

export type ConfirmAnswer =
  | { kind: 'intake'; fluidType: Extract<FluidType, 'water' | 'aforce_rtd'> }
  | { kind: 'missed' };

interface Props {
  onAnswer: (answer: ConfirmAnswer) => void;
  inClutch?: boolean;
}

export function CommandConfirmPrompt({ onAnswer, inClutch }: Props) {
  // Guard against double-taps and out-of-order async answers — once the
  // user picks an option we lock the prompt locally until the parent
  // unmounts it (after the store dispatch lands).
  const [submitted, setSubmitted] = React.useState(false);

  const tap = (answer: ConfirmAnswer) => {
    if (submitted) return;
    setSubmitted(true);
    hapticImpact(answer.kind === 'intake' ? 'light' : 'medium');
    onAnswer(answer);
  };

  return (
    <View style={styles.wrap} testID="command-confirm-prompt">
      <View style={styles.headerRow}>
        <Icon name="help-circle" size={14} color={Colors.text.primary} />
        <Text style={styles.title}>WHAT DID YOU DRINK?</Text>
      </View>
      <Text style={styles.body}>
        Recheck timer hit zero. Pick what you actually had so the score
        runs the real calculation{inClutch ? ' — Clutch is live, so misses cost more.' : '.'}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => tap({ kind: 'intake', fluidType: 'water' })}
          disabled={submitted}
          style={({ pressed }) => [styles.btn, styles.water, (pressed || submitted) && { opacity: 0.85 }]}
          testID="command-confirm-water"
          accessibilityLabel="I had water"
        >
          <Icon name="droplet" size={14} color="#0a1f12" />
          <Text style={[styles.btnLabel, { color: '#0a1f12' }]}>WATER</Text>
        </Pressable>
        <Pressable
          onPress={() => tap({ kind: 'intake', fluidType: 'aforce_rtd' })}
          disabled={submitted}
          style={({ pressed }) => [styles.btn, styles.rtd, (pressed || submitted) && { opacity: 0.85 }]}
          testID="command-confirm-rtd"
          accessibilityLabel="I had an AForce RTD"
        >
          <Icon name="zap" size={14} color="#0a1f12" />
          <Text style={[styles.btnLabel, { color: '#0a1f12' }]}>AFORCE RTD</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => tap({ kind: 'missed' })}
        disabled={submitted}
        style={({ pressed }) => [styles.btn, styles.missed, (pressed || submitted) && { opacity: 0.85 }]}
        testID="command-confirm-missed"
        accessibilityLabel="I missed the command"
      >
        <Icon name="x" size={14} color="#fff" />
        <Text style={[styles.btnLabel, { color: '#fff' }]}>MISSED IT · -3</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.text.primary,
    fontFamily: 'Inter_700Bold',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text.muted,
    fontFamily: 'Inter_400Regular',
  },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  water: { backgroundColor: '#7DD3FC' },
  rtd: { backgroundColor: Colors.success },
  missed: { backgroundColor: Colors.danger },
  btnLabel: {
    fontSize: 12,
    letterSpacing: 1.4,
    fontFamily: 'Inter_700Bold',
  },
});
