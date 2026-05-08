/**
 * Welcome — first-launch cinematic intro.
 *
 * The frame the user sees the moment they open AForce OS for the
 * first time. WHOOP-cinematic: pure black canvas, single LED-lime
 * accent, premium display typography, staged reveal that earns the
 * "Begin" tap. No data, no chrome, no decisions — one statement of
 * intent and one CTA.
 *
 * Reveal timeline (ms from mount):
 *   0     ambient lime glow begins breathing
 *   180   top eyebrow ("AFORCE OS · 2026") fades in
 *   500   AFORCE wordmark scales + fades in
 *   1100  lime accent rule draws across (scaleX 0 → 1)
 *   1400  slogan "Performance is non-negotiable." rises into place
 *   2000  tagline words appear with 160ms stagger
 *   2900  primary CTA "Begin" fades in from below
 *   3300  microcopy hairline appears
 *
 * On Begin: routes to (auth)/sign-up so the new user lands on
 * account creation. (DEMO_MODE bypass still applies elsewhere.)
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat,
  withSequence, Easing, interpolate, cancelAnimation, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { Colors } from '@/theme/colors';

const ACCENT = Colors.accent.primary; // WHOOP lime #B6FF00
const TAGLINE_WORDS = ['Pause.', 'Hydrate.', 'Lock in.', 'Perform.'];

// Single global timing tokens so the whole reveal stays in sync.
const T = {
  eyebrow:   { delay: 180,  dur: 600 },
  wordmark:  { delay: 500,  dur: 900 },
  rule:      { delay: 1100, dur: 700 },
  slogan:    { delay: 1400, dur: 700 },
  taglineBase: 2000, // first word
  taglineStagger: 160,
  cta:       { delay: 2900, dur: 600 },
  micro:     { delay: 3300, dur: 500 },
};

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ─── Shared values ──────────────────────────────────────────────
  const eyebrowO = useSharedValue(0);
  const eyebrowY = useSharedValue(-8);
  const wordmarkO = useSharedValue(0);
  const wordmarkS = useSharedValue(0.94);
  const rule = useSharedValue(0);
  const sloganO = useSharedValue(0);
  const sloganY = useSharedValue(14);
  // Tagline shared values — declared individually (not in a loop) to
  // satisfy the Rules of Hooks. TAGLINE_WORDS has 4 entries.
  const tag0O = useSharedValue(0); const tag0Y = useSharedValue(10);
  const tag1O = useSharedValue(0); const tag1Y = useSharedValue(10);
  const tag2O = useSharedValue(0); const tag2Y = useSharedValue(10);
  const tag3O = useSharedValue(0); const tag3Y = useSharedValue(10);
  const tagOs = [tag0O, tag1O, tag2O, tag3O];
  const tagYs = [tag0Y, tag1Y, tag2Y, tag3Y];
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(20);
  const microO = useSharedValue(0);
  const glow = useSharedValue(0.55);
  const haloRot = useSharedValue(0);
  const ctaPress = useSharedValue(0);

  // ─── Reveal sequence ────────────────────────────────────────────
  React.useEffect(() => {
    // Ambient breathing glow — runs forever, subtle.
    glow.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.55, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    // Slow halo rotation — barely perceptible, adds life.
    haloRot.value = withRepeat(
      withTiming(360, { duration: 60000, easing: Easing.linear }),
      -1,
      false,
    );

    eyebrowO.value = withDelay(T.eyebrow.delay,
      withTiming(1, { duration: T.eyebrow.dur, easing: Easing.out(Easing.cubic) }));
    eyebrowY.value = withDelay(T.eyebrow.delay,
      withTiming(0, { duration: T.eyebrow.dur, easing: Easing.out(Easing.cubic) }));

    wordmarkO.value = withDelay(T.wordmark.delay,
      withTiming(1, { duration: T.wordmark.dur, easing: Easing.out(Easing.cubic) }));
    wordmarkS.value = withDelay(T.wordmark.delay,
      withTiming(1, { duration: T.wordmark.dur, easing: Easing.out(Easing.cubic) }));

    rule.value = withDelay(T.rule.delay,
      withTiming(1, { duration: T.rule.dur, easing: Easing.out(Easing.cubic) }));

    sloganO.value = withDelay(T.slogan.delay,
      withTiming(1, { duration: T.slogan.dur, easing: Easing.out(Easing.cubic) }));
    sloganY.value = withDelay(T.slogan.delay,
      withTiming(0, { duration: T.slogan.dur, easing: Easing.out(Easing.cubic) }));

    TAGLINE_WORDS.forEach((_, i) => {
      const d = T.taglineBase + i * T.taglineStagger;
      tagOs[i].value = withDelay(d,
        withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
      tagYs[i].value = withDelay(d,
        withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }));
    });

    ctaO.value = withDelay(T.cta.delay,
      withTiming(1, { duration: T.cta.dur, easing: Easing.out(Easing.cubic) }));
    ctaY.value = withDelay(T.cta.delay,
      withTiming(0, { duration: T.cta.dur, easing: Easing.out(Easing.cubic) }));

    microO.value = withDelay(T.micro.delay,
      withTiming(1, { duration: T.micro.dur, easing: Easing.out(Easing.cubic) }));

    // Stop the infinite ambient loops when the screen unmounts so we
    // don't burn cycles after the user taps Begin and routes away.
    return () => {
      cancelAnimation(glow);
      cancelAnimation(haloRot);
    };
  }, []);

  // ─── Animated styles ────────────────────────────────────────────
  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ rotate: `${haloRot.value}deg` }],
  }));
  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: eyebrowO.value,
    transform: [{ translateY: eyebrowY.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkO.value,
    transform: [{ scale: wordmarkS.value }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rule.value, [0, 1], [0, 1]),
    transform: [{ scaleX: rule.value }],
  }));
  const sloganStyle = useAnimatedStyle(() => ({
    opacity: sloganO.value,
    transform: [{ translateY: sloganY.value }],
  }));
  const ctaWrapStyle = useAnimatedStyle(() => ({
    opacity: ctaO.value,
    transform: [{ translateY: ctaY.value }],
  }));
  const ctaBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - ctaPress.value * 0.03 }],
  }));
  const microStyle = useAnimatedStyle(() => ({ opacity: microO.value }));

  // ─── Handlers ───────────────────────────────────────────────────
  const handleBegin = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    router.replace('/(auth)/sign-up');
  };

  const onPressIn = () => { ctaPress.value = withTiming(1, { duration: 90 }); };
  const onPressOut = () => { ctaPress.value = withTiming(0, { duration: 180 }); };

  // Halo size scales with the smaller viewport edge so it looks right
  // on both phone and tablet without overflowing.
  const haloSize = Math.min(width, height) * 1.4;

  return (
    <View style={styles.root}>
      {/* ─── Ambient halo ─────────────────────────────────────── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.halo,
            { width: haloSize, height: haloSize, top: height * 0.08, left: (width - haloSize) / 2 },
            haloStyle,
          ]}
        />
        {/* Vertical accent bars — barely-there left/right edge LEDs. */}
        <View style={[styles.edgeBar, styles.edgeLeft, { top: height * 0.22, height: height * 0.56 }]} />
        <View style={[styles.edgeBar, styles.edgeRight, { top: height * 0.22, height: height * 0.56 }]} />
      </View>

      {/* ─── Top eyebrow ──────────────────────────────────────── */}
      <Animated.View
        style={[styles.eyebrowWrap, { paddingTop: insets.top + 18 }, eyebrowStyle]}
      >
        <View style={styles.eyebrowDot} />
        <Text style={styles.eyebrow}>AFORCE OS · 2026</Text>
      </Animated.View>

      {/* ─── Center stack ─────────────────────────────────────── */}
      <View style={styles.center}>
        <Animated.Text
          style={[styles.wordmark, wordmarkStyle]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          AFORCE
        </Animated.Text>

        <Animated.View style={[styles.rule, ruleStyle]} />

        <Animated.Text style={[styles.slogan, sloganStyle]}>
          Performance is non-negotiable.
        </Animated.Text>

        <View style={styles.taglineRow}>
          {TAGLINE_WORDS.map((word, i) => (
            <TaglineWord
              key={word}
              word={word}
              opacity={tagOs[i]}
              translateY={tagYs[i]}
            />
          ))}
        </View>
      </View>

      {/* ─── Bottom CTA ───────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom + 28, 36) },
          ctaWrapStyle,
        ]}
      >
        <Pressable
          onPress={handleBegin}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Begin"
          hitSlop={12}
        >
          <Animated.View style={[styles.ctaBtn, ctaBtnStyle]}>
            <Text style={styles.ctaLabel}>BEGIN</Text>
            <View style={styles.ctaArrow}>
              <Feather name="arrow-right" size={16} color={Colors.text.inverse} />
            </View>
          </Animated.View>
        </Pressable>

        <Animated.View style={[styles.microRow, microStyle]}>
          <View style={styles.microHair} />
          <Text style={styles.microText}>
            Activate your performance OS
          </Text>
          <View style={styles.microHair} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── Tagline word — own component so each animated style hook is
// called at the top level of its own render (Rules of Hooks). ─────
interface TaglineWordProps {
  word: string;
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
}
function TaglineWord({ word, opacity, translateY }: TaglineWordProps) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return (
    <Animated.Text style={[styles.taglineWord, style]}>
      {word}
    </Animated.Text>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary, // #000
    overflow: 'hidden',
  },

  // Ambient halo — radial-ish glow built from a hugely rounded view
  // with a low-alpha lime fill. Cheap, web-safe, and it breathes via
  // the opacity animation.
  halo: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: ACCENT,
    opacity: 0.06,
    // Web shadow → glow halo. RN strips this on native; we still get
    // the radial color via the fill + opacity.
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(140px)' } as object)
      : { shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 120, shadowOffset: { width: 0, height: 0 } }),
  },

  edgeBar: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(182,255,0,0.18)',
  },
  edgeLeft:  { left: 18 },
  edgeRight: { right: 18 },

  // ─── Eyebrow ──────────────────────────────────────────────────
  eyebrowWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowDot: {
    width: 5, height: 5, borderRadius: 5,
    backgroundColor: ACCENT,
    ...(Platform.OS === 'web' ? ({ boxShadow: `0 0 8px ${ACCENT}` } as object) : {}),
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 3.5,
    color: 'rgba(255,255,255,0.55)',
  },

  // ─── Center stack ─────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  wordmark: {
    fontFamily: 'Inter_700Bold',
    fontSize: 76,
    lineHeight: 80,
    letterSpacing: 6,
    color: '#FFFFFF',
    textAlign: 'center',
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 0 28px rgba(255,255,255,0.18))' } as object)
      : { textShadowColor: 'rgba(255,255,255,0.18)', textShadowRadius: 28, textShadowOffset: { width: 0, height: 0 } }),
  },
  rule: {
    width: 64,
    height: 2,
    backgroundColor: ACCENT,
    marginTop: 22,
    marginBottom: 28,
    borderRadius: 2,
    ...(Platform.OS === 'web' ? ({ boxShadow: `0 0 12px ${ACCENT}` } as object) : {}),
  },
  slogan: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 36,
  },
  taglineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 6,
    paddingHorizontal: 8,
  },
  taglineWord: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
  },

  // ─── CTA ──────────────────────────────────────────────────────
  ctaWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 22,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 36,
    paddingVertical: 16,
    backgroundColor: ACCENT,
    borderRadius: 999,
    minWidth: 220,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 32px ${Colors.accent.glow}, 0 0 64px ${Colors.accent.dim}` } as object)
      : {
          shadowColor: ACCENT,
          shadowOpacity: 0.55,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        }),
  },
  ctaLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: 4,
    color: '#000000',
  },
  ctaArrow: {
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  microHair: {
    width: 22, height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  microText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10.5,
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.40)',
    textTransform: 'uppercase',
  },
});
