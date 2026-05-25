/**
 * Activation — "Ready" screen (Buy → Activate stage).
 *
 * Spec Rule #9:
 *   Headline: YOUR RECOVERY SYSTEM IS READY
 *   Button:   ACTIVATE NOW
 *
 * Copy is sourced verbatim from services/activationFlow.ts.
 * Tap advances the stage to `install` and routes forward to the
 * First Command screen. If the user has already completed the
 * funnel (stage ≥ 'return'), this screen short-circuits straight
 * to /(tabs) so the dashboard is not re-blocked.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  ACTIVATION_COPY,
  getActivationState,
  isStageReached,
  setActivationStage,
} from '@/services/activationFlow';
import { Colors } from '../../theme/colors';

const LIME = '#B6FF00';

export default function ActivationReady() {
  const [ready, setReady] = useState(false);

  // Skip the funnel for users who have already passed it.
  useEffect(() => {
    let cancelled = false;
    void getActivationState().then((state) => {
      if (cancelled) return;
      if (isStageReached(state, 'return')) {
        router.replace('/(tabs)');
      } else {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Slow breathing glow behind the headline so the screen feels
  // alive rather than static.
  const glow = useSharedValue(0.55);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(0.95, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const onActivate = React.useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    await setActivationStage('install');
    router.replace('/(activation)/first-command');
  }, []);

  if (!ready) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Text style={styles.headline}>{ACTIVATION_COPY.headline}</Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={onActivate}
          accessibilityRole="button"
          accessibilityLabel={ACTIVATION_COPY.activateButton}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonLabel}>
            {ACTIVATION_COPY.activateButton}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 56,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: LIME,
    opacity: 0.18,
    // Soft halo behind the headline.
    shadowColor: LIME,
    shadowOpacity: 0.8,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  headline: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 1.2,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  button: {
    backgroundColor: LIME,
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 999,
    minWidth: 260,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: '#000000',
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 15,
    letterSpacing: 1.4,
  },
});
