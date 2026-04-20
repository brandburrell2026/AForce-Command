/**
 * CycleSuccessOverlay — Premium micro-animation shown after completing a cycle.
 * Shows performance gain, identity message, and next cycle hint.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import type { CycleResult } from '../types';
import { Colors } from '../theme/colors';
import { getStateColors } from '../theme/colors';

interface Props {
  result: CycleResult;
  onDismiss: () => void;
}

export function CycleSuccessOverlay({ result, onDismiss }: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const gainScale = useSharedValue(0);

  const stateColors = getStateColors(result.state);
  const color = stateColors.primary;

  useEffect(() => {
    // Enter animation
    opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });

    // Delayed gain counter pop
    setTimeout(() => {
      gainScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 250 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      );
    }, 200);
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const gainStyle = useAnimatedStyle(() => ({
    transform: [{ scale: gainScale.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.card, cardStyle, { borderColor: `${color}40` }]}>
        {/* Glow */}
        <View style={[styles.glow, { backgroundColor: `${color}15` }]} />

        {/* Check icon */}
        <View style={[styles.iconCircle, { backgroundColor: `${color}20`, borderColor: `${color}44` }]}>
          <Feather name="check" size={28} color={color} />
        </View>

        {/* Gain */}
        <Animated.Text style={[styles.gainText, { color }, gainStyle]}>
          {result.gainDisplay}
        </Animated.Text>

        {/* Identity message */}
        <Text style={styles.identityText}>{result.identityMessage}</Text>

        {/* Score delta */}
        <View style={styles.scoreRow}>
          <Text style={styles.scoreFrom}>{result.scoreBefore}</Text>
          <Feather name="arrow-right" size={14} color={Colors.text.muted} />
          <Text style={[styles.scoreTo, { color }]}>{result.scoreAfter}</Text>
        </View>

        {/* Next hint */}
        <View style={[styles.hintRow, { borderColor: Colors.border.subtle }]}>
          <Feather name="clock" size={12} color={Colors.text.muted} />
          <Text style={styles.hintText}>{result.nextCycleHint}</Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>CONTINUE</Text>
          <Feather name="arrow-right" size={12} color={Colors.text.muted} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,26,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.background.elevated,
    borderRadius: 28,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -60,
    left: -60,
    right: -60,
    height: 200,
    borderRadius: 100,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  gainText: {
    fontSize: 52,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -2,
    marginBottom: 8,
  },
  identityText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  scoreFrom: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
  },
  scoreTo: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    width: '100%',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
  },
});
