/**
 * Activation — "First Command" screen (Install → First Command).
 *
 * Spec Rule #9:
 *   Activation: Recovery Activated
 *   Open:       First Command → "Drink 12 oz water."
 *
 * Shows the "Recovery Activated" status pip followed by the
 * single first command card. The "I drank it" affordance calls
 * markFirstCommandComplete(now), which advances stage to
 * 'return' and stamps firstCommandCompletedAt — flipping
 * isSignalUnlocked to true.
 */
import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  ACTIVATION_COPY,
  markFirstCommandComplete,
} from '@/services/activationFlow';
import { Colors } from '../../theme/colors';

const LIME = '#B6FF00';

export default function ActivationFirstCommand() {
  const pip = useSharedValue(0);
  const card = useSharedValue(0);

  useEffect(() => {
    pip.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    card.value = withDelay(
      520,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );
  }, [pip, card]);

  const pipStyle = useAnimatedStyle(() => ({
    opacity: pip.value,
    transform: [{ translateY: (1 - pip.value) * -6 }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ translateY: (1 - card.value) * 12 }],
  }));

  const onConfirm = useCallback(async () => {
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    await markFirstCommandComplete(new Date().toISOString());
    router.replace('/(activation)/complete');
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.pip, pipStyle]}>
        <View style={styles.pipDot} />
        <Text style={styles.pipLabel}>{ACTIVATION_COPY.activated}</Text>
      </Animated.View>

      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.commandKicker}>FIRST COMMAND</Text>
        <Text style={styles.command}>{ACTIVATION_COPY.firstCommand}</Text>

        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel="I drank it"
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonLabel}>I DRANK IT</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 28,
    paddingTop: 96,
    paddingBottom: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(182,255,0,0.35)',
    backgroundColor: 'rgba(182,255,0,0.06)',
  },
  pipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIME,
    shadowColor: LIME,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pipLabel: {
    color: LIME,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 18,
    marginBottom: 48,
  },
  commandKicker: {
    color: Colors.text.muted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 2,
  },
  command: {
    color: Colors.text.primary,
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    backgroundColor: LIME,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    minWidth: 240,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: '#000000',
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 14,
    letterSpacing: 1.4,
  },
});
