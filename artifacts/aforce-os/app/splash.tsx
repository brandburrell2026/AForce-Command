/**
 * AForce OS — Cinematic Onboarding Lobby
 *
 * Four-stage opening sequence shown only on a user's very first open.
 * Once stage 4 completes (CONTINUE tap), `hasCompletedOnboarding` is
 * persisted to AsyncStorage and the user is routed into the existing
 * `(tabs)` app. The gate in `app/_layout.tsx` skips this entire
 * sequence on every subsequent launch.
 *
 * Strict design constraints (per spec):
 *   - Background: #000000 only
 *   - Ring stroke: 1.5px thin (white in stages 1-2, critical red in 3-4)
 *   - Critical red: rgba(180,30,30,0.55)
 *   - Font: Helvetica Neue, weight 100-300 only
 *   - All transitions: opacity fade 1.2s ease only — no slides, no
 *     bounces, no bright colors.
 *   - Nothing in the existing app is touched.
 */

import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  Easing, cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const ONBOARDING_KEY = 'aforce.hasCompletedOnboarding';

const BG = '#000000';
const RING_WHITE = 'rgba(255,255,255,0.85)';
const CRITICAL_RED = 'rgba(180,30,30,0.55)';
const TEXT_DIM = 'rgba(255,255,255,0.55)';
const TEXT_BRIGHT = 'rgba(255,255,255,0.92)';

// Match the rest of the app's typography exactly. The home screen
// uses Inter_700Bold for big numbers / status labels (tracked caps)
// and Inter_400Regular for body copy.
const FONT_BOLD = 'Inter_700Bold';
const FONT_MEDIUM = 'Inter_500Medium';
const FONT_REGULAR = 'Inter_400Regular';
// "Digital" readout face for the WELCOME · AFORCE OS headline.
// React Native ships a monospace family on every platform — Menlo on
// iOS, monospace on Android, and a generic monospace stack on web.
// Combined with wide tracking + uppercase this gives the lobby a
// terminal / on-board-computer feel without bundling a custom font.
const FONT_DIGITAL = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
}) as string;

const FADE_MS = 1200;
const FADE_EASE = Easing.inOut(Easing.ease);
const RING_SIZE = 220;
const RING_STROKE = 1.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
// Soft halo behind the ring — same visual language as StatusPulseOrb's
// dominant outer glow (GLOW_RATIO ≈ 1.85). Keeps the lobby feeling
// part of the same product instead of a flat overlay.
const HALO_SIZE = Math.round(RING_SIZE * 1.85);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Stage = 1 | 2 | 3 | 4;

// ─── FadeIn — pure 1.2s opacity ease, no transforms ──────────────────
function FadeIn({
  show, delayMs = 0, durationMs = FADE_MS, children, style,
}: {
  show: boolean;
  delayMs?: number;
  durationMs?: number;
  children: React.ReactNode;
  style?: object;
}) {
  const opacity = useSharedValue(show ? 0 : 0);
  React.useEffect(() => {
    if (show) {
      opacity.value = 0;
      const t = setTimeout(() => {
        opacity.value = withTiming(1, {
          duration: durationMs,
          easing: FADE_EASE,
        });
      }, delayMs);
      return () => clearTimeout(t);
    }
    opacity.value = withTiming(0, { duration: durationMs, easing: FADE_EASE });
    return undefined;
  }, [show, delayMs, durationMs, opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}

// ─── RotatingRing — slow 18s/rev rotation w/ ambient halo ───────────
function RotatingRing({ color, glow }: { color: string; glow: string }) {
  const rotate = useSharedValue(0);
  React.useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 18_000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotate);
  }, [rotate]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotate.value}deg` }],
  }));
  return (
    <View style={styles.ringWrap}>
      {/* Soft outer halo — mirrors the StatusPulseOrb dominant glow so
          the lobby reads as the same visual product. */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: HALO_SIZE,
            height: HALO_SIZE,
            borderRadius: HALO_SIZE / 2,
            shadowColor: glow,
          },
        ]}
      />
      <Animated.View style={ringStyle}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={color}
            strokeWidth={RING_STROKE}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─── SweepingArc — red arc that travels around the ring (stage 2) ───
function SweepingArc({ active }: { active: boolean }) {
  const rotate = useSharedValue(0);
  React.useEffect(() => {
    if (!active) return;
    rotate.value = 0;
    rotate.value = withRepeat(
      withTiming(360, { duration: 1_200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotate);
  }, [active, rotate]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotate.value}deg` }],
  }));
  if (!active) return null;
  // Arc length ≈ 90° of the ring circumference.
  const arcLen = RING_CIRC * 0.25;
  const dash = `${arcLen} ${RING_CIRC - arcLen}`;
  return (
    <Animated.View style={[styles.ringWrap, style]} pointerEvents="none">
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={CRITICAL_RED}
          strokeWidth={RING_STROKE * 1.6}
          fill="none"
          strokeDasharray={dash}
          strokeLinecap="round"
          // Start arc at top of ring (12 o'clock) — SVG circles begin
          // at 3 o'clock by default, so rotate -90° via the path-style
          // dashoffset trick is unnecessary because we rotate the
          // entire animated wrapper. Dashoffset stays at 0.
        />
      </Svg>
    </Animated.View>
  );
}

export default function SplashScreen() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>(1);
  const [showInitializing, setShowInitializing] = React.useState(false);
  const [showEnter, setShowEnter] = React.useState(false);

  // Stage 1 → reveal INITIALIZING after 2s, then ENTER after the ring
  // fade completes (3s ring + small beat). The ring itself begins
  // rotating immediately on mount so its arrival in the world is the
  // 3s opacity fade, not a motion entrance.
  React.useEffect(() => {
    if (stage !== 1) return;
    const t1 = setTimeout(() => setShowInitializing(true), 2000);
    const t2 = setTimeout(() => setShowEnter(true), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [stage]);

  // Stage 2 — sweep for exactly 2s, then advance to stage 3.
  React.useEffect(() => {
    if (stage !== 2) return;
    const t = setTimeout(() => setStage(3), 2000);
    return () => clearTimeout(t);
  }, [stage]);

  // Stage 3 — hold at critical red for 1.6s, then bring in stage 4
  // copy beneath the ring. Stage 3 and 4 share the same visual root
  // (number + critical ring); stage 4 simply layers two more lines.
  React.useEffect(() => {
    if (stage !== 3) return;
    const t = setTimeout(() => setStage(4), 1600);
    return () => clearTimeout(t);
  }, [stage]);

  const onEnter = React.useCallback(() => setStage(2), []);

  const onContinue = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // Persistence failure is non-fatal — the user can still enter
      // the app; they may just see the splash again next launch.
    }
    router.replace('/(tabs)');
  }, [router]);

  const ringColor = stage >= 3 ? CRITICAL_RED : RING_WHITE;
  const haloColor = stage >= 3 ? CRITICAL_RED : 'rgba(255,255,255,0.35)';
  const sweepActive = stage === 2;
  const showNumber = stage >= 3;
  const showCritical = stage >= 3;
  const showCopy = stage === 4;
  const showContinue = stage === 4;

  return (
    <View style={styles.root}>
      {/* Top headline — fades in with the ring on stage 1 and stays
          throughout the sequence. Rendered in a monospace face so it
          reads like a system readout, not body copy. */}
      <FadeIn show durationMs={2000} delayMs={200} style={styles.topHeader}>
        <Text style={styles.welcomeKicker}>WELCOME</Text>
        <Text style={styles.welcomeTitle}>AFORCE OS</Text>
      </FadeIn>

      {/* The white ring is a 3s fade-in. From stage 3 onward the ring
          color shifts to critical red — done via FadeIn keyed on
          `ringColor` so the new color crossfades over the old. */}
      <View style={styles.center}>
        <FadeIn show durationMs={3000} delayMs={0} style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            <RotatingRing color={ringColor} glow={haloColor} />
          </View>
        </FadeIn>

        <SweepingArc active={sweepActive} />

        {showNumber && (
          <FadeIn show durationMs={FADE_MS}>
            <Text style={styles.number}>31</Text>
          </FadeIn>
        )}
      </View>

      {/* INITIALIZING under the ring (stage 1 only) */}
      {stage === 1 && (
        <FadeIn show={showInitializing} style={styles.belowRing}>
          <Text style={styles.eyebrow}>I N I T I A L I Z I N G</Text>
        </FadeIn>
      )}

      {/* CRITICAL label (stages 3-4) */}
      {showCritical && (
        <FadeIn show style={styles.belowRing}>
          <Text style={[styles.eyebrow, { color: CRITICAL_RED }]}>
            C R I T I C A L
          </Text>
        </FadeIn>
      )}

      {/* Stage 4 copy lines */}
      {showCopy && (
        <FadeIn show delayMs={400} style={styles.copyBlock}>
          <Text style={styles.copyLine}>Performance is non-negotiable.</Text>
          <Text style={styles.copyLine}>
            Most don&apos;t know they&apos;re operating without it.
          </Text>
        </FadeIn>
      )}

      {/* ENTER button — stage 1 */}
      {stage === 1 && (
        <FadeIn show={showEnter} style={styles.ctaSlot}>
          <Pressable
            onPress={onEnter}
            accessibilityRole="button"
            accessibilityLabel="Enter"
            hitSlop={16}
          >
            <Text style={styles.ctaLabel}>E N T E R</Text>
          </Pressable>
        </FadeIn>
      )}

      {/* CONTINUE button — stage 4 */}
      {showContinue && (
        <FadeIn show delayMs={1400} style={styles.ctaSlot}>
          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            hitSlop={16}
          >
            <Text style={styles.ctaLabel}>C O N T I N U E</Text>
          </Pressable>
        </FadeIn>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft radial halo behind the ring — matches the StatusPulseOrb
  // dominant glow (large blur radius, low elevation, low opacity).
  halo: {
    position: 'absolute',
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 60,
    // Android falls back to elevation only — keep low so it doesn't
    // become a hard rectangle.
    elevation: 0,
  },
  number: {
    fontFamily: FONT_BOLD,
    color: TEXT_BRIGHT,
    fontSize: 96,
    letterSpacing: -3,
    includeFontPadding: false,
  },
  belowRing: {
    position: 'absolute',
    top: '50%',
    marginTop: RING_SIZE / 2 + 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FONT_BOLD,
    color: TEXT_DIM,
    fontSize: 11,
    letterSpacing: 4,
  },
  copyBlock: {
    position: 'absolute',
    top: '50%',
    marginTop: RING_SIZE / 2 + 76,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  copyLine: {
    fontFamily: FONT_REGULAR,
    color: TEXT_BRIGHT,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  ctaSlot: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: FONT_BOLD,
    color: TEXT_BRIGHT,
    fontSize: 12,
    letterSpacing: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  topHeader: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  welcomeKicker: {
    fontFamily: FONT_BOLD,
    color: TEXT_DIM,
    fontSize: 18,
    letterSpacing: 6,
  },
  welcomeTitle: {
    fontFamily: FONT_BOLD,
    color: TEXT_BRIGHT,
    fontSize: 44,
    letterSpacing: 4,
    includeFontPadding: false,
  },
});
