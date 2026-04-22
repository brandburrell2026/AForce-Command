/**
 * CommandConfirmPrompt — Asks the user "Did you follow the command?"
 * once the recheck timer hits 0. Honest +3 / -3 score swing per spec.
 *
 * Renders inline (not a modal) so it doesn't fight other overlays on
 * web, and so it stays anchored to the command region of Home where
 * the answer matters.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';

interface Props {
  onAnswer: (followed: boolean) => void;
  inClutch?: boolean;
}

export function CommandConfirmPrompt({ onAnswer, inClutch }: Props) {
  // Guard against double-taps and out-of-order async answers — once the
  // user picks Yes/No we lock the prompt locally until the parent
  // unmounts it (after the store dispatch lands).
  const [submitted, setSubmitted] = React.useState(false);

  const tap = (followed: boolean) => {
    if (submitted) return;
    setSubmitted(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(
        followed ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
      ).catch(() => {});
    }
    onAnswer(followed);
  };

  return (
    <View style={styles.wrap} testID="command-confirm-prompt">
      <View style={styles.headerRow}>
        <Feather name="help-circle" size={14} color={Colors.text.primary} />
        <Text style={styles.title}>DID YOU FOLLOW THE LAST COMMAND?</Text>
      </View>
      <Text style={styles.body}>
        Recheck timer hit zero. Confirm so the score reflects what you
        actually did{inClutch ? ' — Clutch is live, so misses cost more.' : '.'}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => tap(true)}
          disabled={submitted}
          style={({ pressed }) => [styles.btn, styles.yes, (pressed || submitted) && { opacity: 0.85 }]}
          testID="command-confirm-yes"
          accessibilityLabel="Yes, I followed the command"
        >
          <Feather name="check" size={14} color="#0a1f12" />
          <Text style={[styles.btnLabel, { color: '#0a1f12' }]}>YES · +3</Text>
        </Pressable>
        <Pressable
          onPress={() => tap(false)}
          disabled={submitted}
          style={({ pressed }) => [styles.btn, styles.no, (pressed || submitted) && { opacity: 0.85 }]}
          testID="command-confirm-no"
          accessibilityLabel="No, I missed it"
        >
          <Feather name="x" size={14} color="#fff" />
          <Text style={[styles.btnLabel, { color: '#fff' }]}>NO · -3</Text>
        </Pressable>
      </View>
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
  yes: { backgroundColor: Colors.success },
  no: { backgroundColor: Colors.danger },
  btnLabel: {
    fontSize: 12,
    letterSpacing: 1.4,
    fontFamily: 'Inter_700Bold',
  },
});
