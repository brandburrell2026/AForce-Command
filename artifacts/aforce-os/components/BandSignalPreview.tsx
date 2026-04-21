/**
 * BandSignalPreview — visual mockup of the Phantom Band hardware.
 *
 * Renders an abstract band silhouette with a single LED dot that mirrors the
 * current LedPattern (color + pulse cadence). Animates entirely with the JS
 * driver since it must run on web too.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Easing } from 'react-native';
import { Colors } from '../theme/colors';
import type { LedPattern } from '../types/hardware';
import { ledLabel } from '../services/ledSignalService';

interface Props {
  pattern: LedPattern;
  /** Optional sub-label, e.g. "MIRRORING BALANCED". */
  caption?: string;
}

export function BandSignalPreview({ pattern, caption }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop();
    pulse.setValue(0);

    let active: Animated.CompositeAnimation;
    if (pattern.periodMs === 0) {
      // Steady — ramp once and hold. Track the handle so cleanup can stop it
      // if the component unmounts (or the pattern changes) mid-ramp.
      active = Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: false });
    } else {
      const half = Math.max(180, pattern.periodMs / 2);
      active = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: half, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: half, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]),
      );
    }
    loopRef.current = active;
    active.start();
    return () => { active.stop(); };
  }, [pattern, pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.35] });

  return (
    <View style={styles.container} testID="band-signal-preview">
      <View style={styles.bandFrame}>
        <View style={styles.strapLeft} />
        <View style={styles.body}>
          <Animated.View
            style={[
              styles.halo,
              { backgroundColor: pattern.hex, opacity: haloOpacity, transform: [{ scale }] },
            ]}
          />
          <Animated.View
            testID="band-led-dot"
            style={[
              styles.led,
              {
                backgroundColor: pattern.hex,
                opacity,
                shadowColor: pattern.hex,
              },
            ]}
          />
        </View>
        <View style={styles.strapRight} />
      </View>
      <Text style={styles.label} testID="band-led-label">{ledLabel(pattern)}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  bandFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
  },
  strapLeft: {
    width: 70,
    height: 14,
    backgroundColor: '#1B1F23',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRightWidth: 0,
  },
  strapRight: {
    width: 70,
    height: 14,
    backgroundColor: '#1B1F23',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderLeftWidth: 0,
  },
  body: {
    width: 64,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0E1114',
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  led: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    marginTop: 14,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    color: Colors.text.secondary,
  },
  caption: {
    marginTop: 4,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.text.muted,
  },
});
