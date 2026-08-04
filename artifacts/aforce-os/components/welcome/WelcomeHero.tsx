/**
 * WelcomeHero — AForce OS first-launch "front door".
 *
 * A full-bleed PHOTO welcome surface (WHOOP-style) that plays *after* the
 * cold-launch cinematic (components/opening/OpeningSequence.tsx). It is
 * mounted as an overlay in app/_layout.tsx (AppShell), UNDER the cinematic
 * (zIndex 999 vs the cinematic's 1000), so when the cinematic fades out it
 * crossfades into this photo with no black flash and no app bleed-through —
 * it touches NO routing itself; the buttons call back into AppShell which
 * navigates + dismisses.
 *
 * Unlike the cinematic, this screen does NOT auto-dismiss and has NO
 * tap-to-skip: it waits for the user to choose GET STARTED (→ onboarding)
 * or SIGN IN (→ sign-in). The hero image, scrim, wordmark and buttons are
 * pure presentation — nothing here awards, mutates, or reads score
 * (Score-Protection unchanged).
 *
 * Motion (Apple-Vision-Pro pacing, reduced-motion aware):
 *   - Subtle Ken Burns push-in on the IMAGE only (scale 1.0→1.06, ~12s loop).
 *   - Staggered entrance once `active`: eyebrow → wordmark → tagline → buttons.
 *   - CRITICAL: the looping Ken Burns transform lives on its OWN node; every
 *     intro opacity/translate animation lives on SEPARATE <Reveal> nodes. A
 *     forwards-fill opacity animation and a looping transform on the same node
 *     fight each other and render the element invisible.
 */

import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const BG = Colors.background.primary; // cinematic black #0D0D0D
const BONE = Colors.bone; // #F5F0E8
const SIGNAL = Colors.accent.brand; // signal red #C1281B

const FONT_DISPLAY = Typography.roles.display; // Archivo Black — wordmark
const FONT_MONO = Typography.roles.eyebrow; // IBM Plex Mono — eyebrow / labels

const EASE = Easing.inOut(Easing.ease);

// Athlete welcome still: a Black male athlete shot three-quarter, face lifted
// into a hard rim light — short hair, beard, dark performance top, deep cinematic
// shadow all around (premium WHOOP/Nike mood). The marketing copy that was baked
// into the source composite (eyebrow / AFORCE wordmark / tagline / CTAs) has been
// cleaned off the pixels so the live, TRANSLATABLE coded overlay below renders on
// top instead. Cover-cropped centred (see contentPosition) so the face stays
// framed on a phone; the dark surround falls under the eyebrow up top and the
// bottom scrim below.
const HERO = require('../../assets/images/welcome-hero.png');

// Bottom-weighted scrim: the top half stays airy (the dark portrait reads through,
// ~no scrim), then it ramps from transparent around the vertical midpoint down to
// near-solid cinematic black at the very bottom — so the lower-third type and the
// CTAs sit on deep black (bone stays legible) while the rim-lit face up top stays clear.
const SCRIM_COLORS = [
  'rgba(13,13,13,0)',
  'rgba(13,13,13,0)',
  'rgba(13,13,13,0.62)',
  'rgba(13,13,13,0.90)',
  'rgba(13,13,13,0.95)',
] as const;
const SCRIM_LOCATIONS = [0, 0.46, 0.72, 0.88, 1] as const;

interface Props {
  /** Flips true once the cinematic has finished — triggers the staggered
   *  entrance. While false the composition stays hidden behind the cinematic. */
  active: boolean;
  /** GET STARTED — routes new users into the existing onboarding flow. */
  onGetStarted: () => void;
  /** SIGN IN — routes returning users into the existing sign-in route. */
  onSignIn: () => void;
}

// ─── Reveal — gated opacity (+optional rise) entrance ────────────────
// Mirrors the OpeningSequence Reveal so the two surfaces share one motion
// vocabulary. Opacity + translateY only; never a looping transform.
function Reveal({
  active,
  delay = 0,
  dy = 8,
  duration = 650,
  reduce = false,
  style,
  children,
}: {
  active: boolean;
  delay?: number;
  dy?: number;
  duration?: number;
  reduce?: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const o = useSharedValue(0);
  const ty = useSharedValue(reduce ? 0 : dy);
  React.useEffect(() => {
    const d = reduce ? 220 : duration;
    const dl = reduce ? Math.min(delay, 120) : delay;
    if (active) {
      o.value = withDelay(dl, withTiming(1, { duration: d, easing: EASE }));
      ty.value = withDelay(dl, withTiming(0, { duration: d, easing: EASE }));
    } else {
      o.value = 0;
      ty.value = reduce ? 0 : dy;
    }
  }, [active, delay, duration, dy, reduce, o, ty]);
  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: ty.value }],
  }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}

// ─── HeroImage — full-bleed photo + looping Ken Burns (own node) ─────
function HeroImage({ reduce }: { reduce: boolean }) {
  const scale = useSharedValue(1);
  React.useEffect(() => {
    if (reduce) {
      cancelAnimation(scale);
      scale.value = 1;
      return undefined;
    }
    scale.value = withRepeat(
      withTiming(1.06, { duration: 12000, easing: EASE }),
      -1,
      true,
    );
    return () => cancelAnimation(scale);
  }, [reduce, scale]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, st]}
    >
      <Image
        source={HERO}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // Centre the crop: the face sits dead-centre in the source (its aspect
        // ~matches a phone), so anchor at 50% to keep the portrait framed.
        contentPosition={{ left: '50%', top: '50%' }}
        transition={0}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

// ─── PillButton ──────────────────────────────────────────────────────
function PillButton({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
}) {
  const handlePress = React.useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`welcome-${primary ? 'get-started' : 'sign-in'}`}
      style={({ pressed }) => [
        styles.pill,
        primary ? styles.pillPrimary : styles.pillSecondary,
        pressed && styles.pillPressed,
      ]}
    >
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── WelcomeHero ─────────────────────────────────────────────────────
export function WelcomeHero({ active, onGetStarted, onSignIn }: Props) {
  const insets = useSafeAreaInsets();
  // RC-1 Wave-2A gating fix: this read the OS reduce-motion setting via raw
  // `AccessibilityInfo` polling — one of the three inconsistent ways the app
  // used to check reduced motion (see hooks/useReducedMotion.ts's own
  // doc-comment). The looping Ken Burns pan in <HeroImage> below was already
  // correctly gated + cancelAnimation-cleaned up; this swap only makes the
  // SIGNAL it gates on match every other elite motion surface in the app.
  const reduce = useReducedMotion();

  return (
    <View
      style={styles.root}
      // While the cinematic is still on top (active=false), keep the hero
      // inert: no phantom button taps and no screen-reader focus. It only
      // becomes an interactive modal once it has been handed off.
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityViewIsModal={active}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <HeroImage reduce={reduce} />
      <LinearGradient
        pointerEvents="none"
        colors={SCRIM_COLORS as unknown as [string, string, ...string[]]}
        locations={SCRIM_LOCATIONS as unknown as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* TOP — thesis eyebrow */}
        <Reveal
          active={active}
          reduce={reduce}
          dy={6}
          style={[styles.topZone, { paddingTop: insets.top + 12 }]}
        >
          <Text
            style={styles.eyebrow}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            PERFORMANCE IS NON-NEGOTIABLE
          </Text>
        </Reveal>

        {/* CENTER — wordmark + tagline, biased just below true center */}
        <View style={styles.centerZone}>
          <Reveal active={active} reduce={reduce} delay={250} dy={8} duration={800}>
            <Text style={styles.wordmark}>AFORCE</Text>
          </Reveal>
          <Reveal active={active} reduce={reduce} delay={450} dy={8}>
            <Text style={styles.tagline}>
              BUILT FOR PEOPLE{'\n'}WHO DON&apos;T GET TO BE OFF
            </Text>
          </Reveal>
        </View>

        {/* BOTTOM — universal entry buttons (no gate) */}
        <Reveal
          active={active}
          reduce={reduce}
          delay={700}
          dy={10}
          style={[
            styles.bottomZone,
            { paddingBottom: insets.bottom + 20 },
          ]}
        >
          <PillButton
            label="GET STARTED"
            variant="primary"
            onPress={onGetStarted}
          />
          <View style={styles.pillGap} />
          <PillButton label="SIGN IN" variant="secondary" onPress={onSignIn} />
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 999,
    elevation: 999,
  },
  content: {
    flex: 1,
  },
  topZone: {
    alignItems: 'center',
    // Inset so the letter-spaced ticker never clips at the screen edges.
    paddingHorizontal: 24,
  },
  centerZone: {
    flex: 1,
    alignItems: 'center',
    // Cluster the wordmark + tagline into the LOWER third, just above the
    // CTAs, so the whole type block lands on the darkened bottom scrim.
    justifyContent: 'flex-end',
    paddingBottom: 28,
    paddingHorizontal: 28,
  },
  bottomZone: {
    paddingHorizontal: 28,
  },

  eyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: 2.6, // tightened so the full line fits the inset top zone
    // Bone ticker: the top of this hero is the dark shadow above the athlete's
    // head, where black type would vanish — bone reads cleanly on it (matches
    // wordmark + tagline).
    color: BONE,
    opacity: 0.7,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  wordmark: {
    fontFamily: FONT_DISPLAY,
    fontSize: 46,
    letterSpacing: 1.8, // ~0.04em
    color: BONE,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: FONT_MONO,
    fontSize: 13,
    letterSpacing: 3.4, // ~0.26em
    color: BONE,
    opacity: 0.55,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 16,
    lineHeight: 20,
  },

  pill: {
    height: 56,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pillPrimary: {
    backgroundColor: SIGNAL,
  },
  pillSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BONE,
  },
  pillPressed: {
    opacity: 0.82,
  },
  pillGap: {
    height: 16,
  },
  pillLabel: {
    fontFamily: FONT_MONO,
    fontSize: 14,
    letterSpacing: 1.7, // ~0.12em
    color: BONE,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
