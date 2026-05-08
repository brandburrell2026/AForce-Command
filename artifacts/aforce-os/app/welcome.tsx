/**
 * Welcome — first-launch cinematic intro (Deck-aligned edition).
 *
 * Re-skinned to match the AForce investor deck's visual language:
 *   • Deep blue-black canvas (#08080F)
 *   • Editorial left-aligned hierarchy
 *   • Red primary (#E53341), Yellow accent (#F5D637), Blue ambient (#5478D5)
 *   • "AForce" set in proper case as a red display wordmark
 *   • Massive headline with mixed-color spans ("non-negotiable." in red)
 *   • Multi-color tagline: Pause.(red) Hydrate.(white) Lock in.(yellow) Perform.(white)
 *
 * Reveal timeline (ms from mount):
 *   0     ambient blue halo (left) + red halo (right) start breathing
 *   180   top meta row (01 — WELCOME / AFORCE OS · 2026)
 *   420   "AForce" wordmark + tracked subtitle fade in
 *   820   "Performance is" rises into place
 *   1120  "non-negotiable." snaps in (red, slight scale pop)
 *   1550  tagline words appear with 140 ms stagger
 *   2300  standard line ("This is beyond a hydration brand…")
 *   2700  red CTA "Begin" pill rises
 *   3100  hairline microcopy
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat,
  withSequence, withSpring, Easing, cancelAnimation, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

// ─── Deck-aligned palette ─────────────────────────────────────────
const C = {
  bg:       '#000000',
  bgEdge:   '#04040A',
  primary:  '#E53341', // red — wordmark, "non-negotiable.", CTA, "Pause."
  accent:   '#F5D637', // yellow — "Lock in."
  secondary:'#5478D5', // blue — left ambient halo
  white:    '#FFFFFF',
  text90:   'rgba(255,255,255,0.92)',
  text65:   'rgba(255,255,255,0.65)',
  text45:   'rgba(255,255,255,0.45)',
  text25:   'rgba(255,255,255,0.25)',
  hair:     'rgba(255,255,255,0.10)',
};

// Typography — Inter is the only family loaded; we use weight to do
// the work display fonts normally would.
const F = {
  display: 'Inter_700Bold',
  body:    'Inter_500Medium',
  bodyR:   'Inter_400Regular',
};

const TAGLINE: { word: string; color: string }[] = [
  { word: 'Pause.',    color: C.primary },
  { word: 'Hydrate.',  color: C.white },
  { word: 'Lock in.',  color: C.accent },
  { word: 'Perform.',  color: C.white },
];

const T = {
  meta:       { delay: 180,  dur: 600 },
  brandRow:   { delay: 420,  dur: 700 },
  headline1:  { delay: 820,  dur: 700 }, // "Performance is"
  headline2:  { delay: 1120, dur: 700 }, // "non-negotiable."
  taglineBase:1550,
  taglineStagger: 140,
  standard:   { delay: 2300, dur: 600 }, // "This is beyond..."
  cta:        { delay: 2700, dur: 600 },
  micro:      { delay: 3100, dur: 500 },
};

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // ─── Shared values ─────────────────────────────────────────────
  const blueGlow = useSharedValue(0.45);
  const redGlow  = useSharedValue(0.30);

  const metaO = useSharedValue(0); const metaY = useSharedValue(-6);
  const brandO = useSharedValue(0); const brandY = useSharedValue(8);
  const h1O = useSharedValue(0); const h1Y = useSharedValue(14);
  const h2O = useSharedValue(0); const h2Y = useSharedValue(18); const h2S = useSharedValue(0.96);
  // 4 tagline words, declared individually for Rules of Hooks.
  const t0O = useSharedValue(0); const t0Y = useSharedValue(10);
  const t1O = useSharedValue(0); const t1Y = useSharedValue(10);
  const t2O = useSharedValue(0); const t2Y = useSharedValue(10);
  const t3O = useSharedValue(0); const t3Y = useSharedValue(10);
  const tagOs = [t0O, t1O, t2O, t3O];
  const tagYs = [t0Y, t1Y, t2Y, t3Y];

  const stdO = useSharedValue(0); const stdY = useSharedValue(8);
  const ctaO = useSharedValue(0); const ctaY = useSharedValue(20);
  const microO = useSharedValue(0);
  const ctaPress = useSharedValue(0);

  // ─── Reveal sequence ───────────────────────────────────────────
  React.useEffect(() => {
    // Ambient breathing halos — desync slightly so they don't pulse
    // in lockstep, which reads as "broken" instead of "alive".
    blueGlow.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 3400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.42, { duration: 3400, easing: Easing.inOut(Easing.quad) }),
      ), -1, false,
    );
    redGlow.value = withDelay(900, withRepeat(
      withSequence(
        withTiming(0.50, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.28, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
      ), -1, false,
    ));

    const out = (d: number, dur: number) =>
      withDelay(d, withTiming(0, { duration: dur, easing: Easing.out(Easing.cubic) }));
    const inO = (d: number, dur: number) =>
      withDelay(d, withTiming(1, { duration: dur, easing: Easing.out(Easing.cubic) }));

    metaO.value = inO(T.meta.delay, T.meta.dur);
    metaY.value = out(T.meta.delay, T.meta.dur);

    brandO.value = inO(T.brandRow.delay, T.brandRow.dur);
    brandY.value = out(T.brandRow.delay, T.brandRow.dur);

    h1O.value = inO(T.headline1.delay, T.headline1.dur);
    h1Y.value = out(T.headline1.delay, T.headline1.dur);

    h2O.value = inO(T.headline2.delay, T.headline2.dur);
    h2Y.value = out(T.headline2.delay, T.headline2.dur);
    h2S.value = withDelay(T.headline2.delay,
      withSpring(1, { damping: 16, stiffness: 180, mass: 0.7 }));

    TAGLINE.forEach((_, i) => {
      const d = T.taglineBase + i * T.taglineStagger;
      tagOs[i].value = withDelay(d,
        withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
      tagYs[i].value = withDelay(d,
        withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));
    });

    stdO.value = inO(T.standard.delay, T.standard.dur);
    stdY.value = out(T.standard.delay, T.standard.dur);

    ctaO.value = inO(T.cta.delay, T.cta.dur);
    ctaY.value = out(T.cta.delay, T.cta.dur);

    microO.value = inO(T.micro.delay, T.micro.dur);

    return () => {
      cancelAnimation(blueGlow);
      cancelAnimation(redGlow);
    };
  }, []);

  // ─── Animated styles ───────────────────────────────────────────
  const blueGlowStyle = useAnimatedStyle(() => ({ opacity: blueGlow.value }));
  const redGlowStyle  = useAnimatedStyle(() => ({ opacity: redGlow.value }));
  const metaStyle  = useAnimatedStyle(() => ({ opacity: metaO.value, transform: [{ translateY: metaY.value }] }));
  const brandStyle = useAnimatedStyle(() => ({ opacity: brandO.value, transform: [{ translateY: brandY.value }] }));
  const h1Style    = useAnimatedStyle(() => ({ opacity: h1O.value, transform: [{ translateY: h1Y.value }] }));
  const h2Style    = useAnimatedStyle(() => ({
    opacity: h2O.value,
    transform: [{ translateY: h2Y.value }, { scale: h2S.value }],
  }));
  const stdStyle   = useAnimatedStyle(() => ({ opacity: stdO.value, transform: [{ translateY: stdY.value }] }));
  const ctaWrap    = useAnimatedStyle(() => ({ opacity: ctaO.value, transform: [{ translateY: ctaY.value }] }));
  const ctaBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - ctaPress.value * 0.03 }] }));
  const microStyle = useAnimatedStyle(() => ({ opacity: microO.value }));

  // ─── Handlers ──────────────────────────────────────────────────
  const handleBegin = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    router.replace('/(auth)/sign-up');
  };
  const onPressIn  = () => { ctaPress.value = withTiming(1, { duration: 90 }); };
  const onPressOut = () => { ctaPress.value = withTiming(0, { duration: 180 }); };

  // Halo geometry — sized so they bleed off-screen without overflow.
  const blueSize = Math.min(width, height) * 1.3;
  const redSize  = Math.min(width, height) * 1.1;

  // Responsive headline size — sized so the longest word
  // ("non-negotiable.", 15 chars) always fits on ONE line within
  // the editorial column's horizontal padding (26 each side).
  // adjustsFontSizeToFit is unreliable on RN-Web, so we compute it.
  const headlineSize = Math.min(72, Math.max(26, (width - 52) / 8));

  return (
    <View style={styles.root}>
      {/* Pure black canvas — matches the rest of the app.
           (Ambient blue/red halos removed by request.) */}

      {/* ─── Top meta row ────────────────────────────────────── */}
      <Animated.View
        style={[styles.metaRow, { paddingTop: insets.top + 16 }, metaStyle]}
      >
        <View style={styles.metaLeft}>
          <View style={styles.metaDot} />
          <Text style={styles.metaTextRed}>01 — WELCOME</Text>
        </View>
        <Text style={styles.metaTextMuted}>AFORCE OS · 2026</Text>
      </Animated.View>

      {/* ─── Editorial stack ─────────────────────────────────── */}
      <View style={[styles.editorial, { paddingTop: insets.top + 64 }]}>
        {/* Brand row — "AForce" red display + tracked subtitle */}
        <Animated.View style={[styles.brandRow, brandStyle]}>
          <Text
            style={styles.brand}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            AForce OS
          </Text>
          <Text style={styles.brandSubtitle}>
            THE PERFORMANCE OPERATING SYSTEM
          </Text>
        </Animated.View>

        {/* Headline — two-line reveal so "non-negotiable." lands hard */}
        <View style={styles.headlineWrap}>
          <Animated.Text
            style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineSize * 0.95 }, h1Style]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            Performance is
          </Animated.Text>
          <Animated.Text
            style={[styles.headlineRed, { fontSize: headlineSize, lineHeight: headlineSize * 0.95 }, h2Style]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            non-negotiable.
          </Animated.Text>
        </View>

        {/* Tagline — multi-color word reveal */}
        <View style={styles.taglineRow}>
          {TAGLINE.map((t, i) => (
            <TagWord
              key={t.word}
              word={t.word}
              color={t.color}
              opacity={tagOs[i]}
              translateY={tagYs[i]}
            />
          ))}
        </View>

        {/* Standard line */}
        <Animated.Text style={[styles.standard, stdStyle]}>
          This is beyond a hydration brand.{' '}
          <Text style={styles.standardEm}>This is a performance standard.</Text>
        </Animated.Text>
      </View>

      {/* ─── Bottom CTA — inline (not absolute) so it can never
           collide with the editorial stack on tall viewports ─── */}
      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom + 22, 30) },
          ctaWrap,
        ]}
      >
        <Pressable
          onPress={handleBegin}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Begin"
          hitSlop={12}
        >
          <Animated.View style={[styles.ctaBtn, ctaBtnStyle]}>
            <Text style={styles.ctaLabel}>BEGIN</Text>
            <View style={styles.ctaArrow}>
              <Feather name="arrow-right" size={16} color={C.white} />
            </View>
          </Animated.View>
        </Pressable>

        <Animated.View style={[styles.microRow, microStyle]}>
          <View style={styles.microHair} />
          <Text style={styles.microText}>
            Tap to activate your performance OS
          </Text>
          <View style={styles.microHair} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── TagWord — own component so each useAnimatedStyle hook is at the
// top level of its own render (Rules of Hooks). ────────────────────
interface TagWordProps {
  word: string;
  color: string;
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
}
function TagWord({ word, color, opacity, translateY }: TagWordProps) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return (
    <Animated.Text style={[styles.taglineWord, { color }, style]}>
      {word}
    </Animated.Text>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    overflow: 'hidden',
  },

  // ── Ambient halos. Web uses CSS filter for a true gaussian glow;
  // native gets a tinted soft circle (close enough, no extra deps).
  haloBlue: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: C.secondary,
    opacity: 0.45,
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(150px)' } as object)
      : {
          shadowColor: C.secondary,
          shadowOpacity: 0.7,
          shadowRadius: 140,
          shadowOffset: { width: 0, height: 0 },
        }),
  },
  haloRed: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: C.primary,
    opacity: 0.30,
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(140px)' } as object)
      : {
          shadowColor: C.primary,
          shadowOpacity: 0.6,
          shadowRadius: 120,
          shadowOffset: { width: 0, height: 0 },
        }),
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? ({ background: 'radial-gradient(ellipse at 50% 60%, transparent 40%, rgba(0,0,0,0.55) 100%)' } as object)
      : { backgroundColor: 'transparent' }),
  },

  // ── Top meta row (slide-number style)
  metaRow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaDot: {
    width: 6, height: 6, borderRadius: 6,
    backgroundColor: C.primary,
    ...(Platform.OS === 'web' ? ({ boxShadow: `0 0 10px ${C.primary}` } as object) : {}),
  },
  metaTextRed: {
    fontFamily: F.display, fontSize: 10.5, letterSpacing: 3,
    color: C.primary,
  },
  metaTextMuted: {
    fontFamily: F.display, fontSize: 10.5, letterSpacing: 3,
    color: C.text45,
  },

  // ── Editorial stack — flex:1 so it claims available height and
  // pushes the CTA against the bottom; justifies its children
  // around the headline so spacing breathes on tall screens.
  editorial: {
    flex: 1,
    paddingHorizontal: 26,
    paddingBottom: 16,
    justifyContent: 'center',
    gap: 22,
  },
  brandRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
  },
  brand: {
    fontFamily: F.display,
    fontSize: 72,
    lineHeight: 76,
    color: C.primary,
    letterSpacing: -2.5,
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 0 32px rgba(229,51,65,0.45))' } as object)
      : { textShadowColor: 'rgba(229,51,65,0.45)', textShadowRadius: 32, textShadowOffset: { width: 0, height: 0 } }),
  },
  brandSubtitle: {
    fontFamily: F.display,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 2.6,
    color: C.text45,
  },

  headlineWrap: { marginTop: 6 },
  headline: {
    fontFamily: F.display,
    color: C.white,
    letterSpacing: -1.2,
  },
  headlineRed: {
    fontFamily: F.display,
    color: C.primary,
    letterSpacing: -1.6,
    ...(Platform.OS === 'web'
      ? ({ filter: 'drop-shadow(0 0 28px rgba(229,51,65,0.45))' } as object)
      : { textShadowColor: 'rgba(229,51,65,0.45)', textShadowRadius: 28, textShadowOffset: { width: 0, height: 0 } }),
  },

  taglineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 8,
    rowGap: 4,
    marginTop: 4,
  },
  taglineWord: {
    fontFamily: F.display,
    fontSize: 22,
    letterSpacing: -0.3,
  },

  standard: {
    fontFamily: F.bodyR,
    fontSize: 18,
    lineHeight: 25,
    color: C.text65,
    marginTop: 10,
    maxWidth: 480,
  },
  standardEm: {
    fontFamily: F.body,
    color: C.white,
  },

  // ── Bottom CTA — inline at the end of the root column.
  ctaWrap: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 8,
    gap: 16,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 38,
    paddingVertical: 17,
    backgroundColor: C.primary,
    borderRadius: 999,
    minWidth: 240,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 10px 40px rgba(229,51,65,0.55), 0 0 80px rgba(229,51,65,0.25)` } as object)
      : {
          shadowColor: C.primary,
          shadowOpacity: 0.6,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 8 },
        }),
  },
  ctaLabel: {
    fontFamily: F.display,
    fontSize: 14,
    letterSpacing: 4,
    color: C.white,
  },
  ctaArrow: {
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  microHair: { width: 18, height: 1, backgroundColor: C.hair },
  microText: {
    fontFamily: F.body,
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.text25,
    textTransform: 'uppercase',
  },
});
