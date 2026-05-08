/**
 * Welcome — first-launch screen (System-Initializing edition).
 *
 * Mission-control aesthetic: pure black, single ambient red glow
 * pulsing in the lower third, all-white typography in one weight.
 * Sequential fade-in cascade on mount.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat,
  withSequence, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const C = {
  bg:        '#000000',
  primary:   '#DC2626',
  white:     '#FFFFFF',
  text40:    'rgba(255,255,255,0.40)',
  text35:    'rgba(255,255,255,0.35)',
  text30:    'rgba(255,255,255,0.30)',
};

const F = {
  display: 'Inter_700Bold',
  body:    'Inter_500Medium',
};

const REVEAL = { dur: 500, ease: Easing.out(Easing.cubic) };
const D = { identity: 0, headline: 200, descriptor: 400, button: 600 };

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const glowO = useSharedValue(0.08);

  const idO = useSharedValue(0);  const idY = useSharedValue(12);
  const hO  = useSharedValue(0);  const hY  = useSharedValue(12);
  const dO  = useSharedValue(0);  const dY  = useSharedValue(12);
  const bO  = useSharedValue(0);  const bY  = useSharedValue(12);
  const press = useSharedValue(0);

  React.useEffect(() => {
    glowO.value = withRepeat(
      withSequence(
        withTiming(0.18, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.08, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, false,
    );

    const reveal = (o: typeof idO, y: typeof idY, delay: number) => {
      o.value = withDelay(delay, withTiming(1, { duration: REVEAL.dur, easing: REVEAL.ease }));
      y.value = withDelay(delay, withTiming(0, { duration: REVEAL.dur, easing: REVEAL.ease }));
    };
    reveal(idO, idY, D.identity);
    reveal(hO,  hY,  D.headline);
    reveal(dO,  dY,  D.descriptor);
    reveal(bO,  bY,  D.button);

    return () => {
      cancelAnimation(glowO);
      cancelAnimation(idO); cancelAnimation(idY);
      cancelAnimation(hO);  cancelAnimation(hY);
      cancelAnimation(dO);  cancelAnimation(dY);
      cancelAnimation(bO);  cancelAnimation(bY);
      cancelAnimation(press);
    };
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowO.value }));
  const idStyle = useAnimatedStyle(() => ({ opacity: idO.value, transform: [{ translateY: idY.value }] }));
  const hStyle  = useAnimatedStyle(() => ({ opacity: hO.value,  transform: [{ translateY: hY.value }] }));
  const dStyle  = useAnimatedStyle(() => ({ opacity: dO.value,  transform: [{ translateY: dY.value }] }));
  const bStyle  = useAnimatedStyle(() => ({ opacity: bO.value,  transform: [{ translateY: bY.value }] }));
  const btnPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.02 }] }));

  const handleBegin = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    router.replace('/(auth)/sign-up');
  };
  const onPressIn  = () => { press.value = withTiming(1, { duration: 90 }); };
  const onPressOut = () => { press.value = withTiming(0, { duration: 180 }); };

  // Ambient glow geometry — radius ~60% of screen width, centered
  // at 65% down the screen. Bleeds soft, no hard edge.
  const glowSize = Math.max(width, height) * 1.2;

  return (
    <View style={styles.root}>
      {/* Ambient red glow — sits behind everything, pulses slowly */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            left: (width - glowSize) / 2,
            top: height * 0.65 - glowSize / 2,
          },
          glowStyle,
        ]}
      />

      {/* Top status line — recessive, technical */}
      <View style={[styles.topRow, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.statusLine} numberOfLines={1}>
          01 — WELCOME  ·  AFORCE OS  ·  2026
        </Text>
      </View>

      {/* Center column — identity + headline + descriptor */}
      <View style={styles.column}>
        <View style={styles.center}>
          <Animated.View style={[styles.identity, idStyle]}>
            <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              AFORCE OS
            </Text>
            <Text style={styles.brandSub}>
              THE PERFORMANCE OPERATING SYSTEM
            </Text>
          </Animated.View>

          <Animated.View style={[styles.headlineWrap, hStyle]}>
            <Text style={styles.headline}>Performance is</Text>
            <Text style={styles.headline}>non-negotiable.</Text>
          </Animated.View>

          <Animated.Text style={[styles.descriptor, dStyle]}>
            Closed-loop  ·  Real-time  ·  Deterministic
          </Animated.Text>
        </View>
      </View>

      {/* Bottom CTA — full width, sharp corners, system command */}
      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: insets.bottom + 32 },
          bStyle,
        ]}
      >
        <Pressable
          onPress={handleBegin}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Begin protocol"
          hitSlop={8}
        >
          <Animated.View style={[styles.ctaBtn, btnPressStyle]}>
            <Text style={styles.ctaLabel}>BEGIN PROTOCOL</Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    overflow: 'hidden',
  },

  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(220,38,38,1)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(160px)' } as object)
      : {
          shadowColor: '#DC2626',
          shadowOpacity: 0.6,
          shadowRadius: 160,
          shadowOffset: { width: 0, height: 0 },
        }),
  },

  topRow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 24,
    zIndex: 5,
  },
  statusLine: {
    fontFamily: F.body,
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.text30,
  },

  column: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'flex-start',
    gap: 40,
  },

  identity: {
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  brand: {
    fontFamily: F.display,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1,
    color: C.white,
  },
  brandSub: {
    fontFamily: F.body,
    fontSize: 10,
    letterSpacing: 3,
    color: C.text35,
  },

  headlineWrap: {
    width: '100%',
  },
  headline: {
    fontFamily: F.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: C.white,
  },

  descriptor: {
    fontFamily: F.body,
    fontSize: 11,
    letterSpacing: 2,
    color: C.text40,
  },

  ctaWrap: {
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  ctaBtn: {
    height: 58,
    borderRadius: 4,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: F.display,
    fontSize: 13,
    letterSpacing: 3,
    color: C.white,
  },
});
