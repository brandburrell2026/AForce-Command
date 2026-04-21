/**
 * Floating mic button shown above the tab bar on the Home screen.
 *
 * - Idle: subtle outer glow that breathes.
 * - Listening: solid lime ring + inner pulse.
 * - Processing: dimmed mic + outer ring spinner-style pulse.
 *
 * The button is intentionally a single tap-to-start/tap-to-stop interaction.
 * Press-and-hold is also supported by exposing `onPressIn` / `onPressOut`
 * (the parent decides which mode to use).
 */

import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, Animated, Easing, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import type { VoiceState } from '../types/voice';

interface Props {
  state: VoiceState;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
}

const SIZE = 64;

export function VoiceButton({ state, onPress, onPressIn, onPressOut }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    if (state === 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ).start();
    } else if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ).start();
    } else if (state === 'processing') {
      Animated.loop(
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      ).start();
    } else {
      pulse.setValue(0);
    }
  }, [state, pulse]);

  const accent =
    state === 'listening' ? Colors.states.PEAK.primary
    : state === 'processing' ? Colors.states.RECOVERING.primary
    : state === 'error' ? Colors.states.DEPLETED.primary
    : Colors.text.primary;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, state === 'listening' ? 1.45 : 1.18] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.shadow}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { borderColor: accent, transform: [{ scale: ringScale }], opacity: ringOpacity },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voice command"
          testID="voice-button"
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={({ pressed }) => [
            styles.btn,
            { borderColor: accent, backgroundColor: state === 'listening' ? `${accent}22` : Colors.background.elevated },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
        >
          <Feather
            name={state === 'processing' ? 'loader' : 'mic'}
            size={26}
            color={accent}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 30px rgba(0,0,0,0.55)' } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.55,
          shadowRadius: 18,
          elevation: 12,
        }),
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
