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
  useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming,
  withRepeat, withSequence, interpolate, interpolateColor,
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
// Orb composition sizes — mirror StatusPulseOrb's GLOW_RATIO 1.85 so
// the red pulse on this lobby reads as the same visual instrument as
// the hydration orb on the home screen, just in DEPLETED red.
const GLOW_SIZE = Math.round(RING_SIZE * 1.85);
const RIPPLE_SIZE = RING_SIZE + 24;
// A second, slightly brighter inner halo at 70% of the outer glow,
// matching the orb's `innerGlow` layer.
const INNER_GLOW_SIZE = Math.round(GLOW_SIZE * 0.7);
const ORB_BG = '#0A0A0A';

// ─── Dynamic state boot palette ──────────────────────────────────────
// As the O draws around the ring (0 → 1 over 3s) the stroke sweeps
// through every performance band — same narrative arc as the home
// orb's boot. At 0–25% the ring is critical red, 25–50% amber, 50–75%
// teal, 75–100% WHOOP lime. The moment the O completes the ring
// settles into the screen's actual state (CRITICAL on this lobby) via
// the static `color` prop crossfade.
const BOOT_RED = '#E53935';
const BOOT_AMBER = '#FFC93C';
const BOOT_TEAL = '#1FB8A6';
const BOOT_LIME = '#B6FF00';

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

// ─── RotatingRing — 18s rotation + StatusPulseOrb-style breathing ───
//
// Mirrors the hydration orb's BALANCED `steady_outward` wave when the
// ring is white (stages 1-2) and its DEPLETED `collapsing` wave when
// the ring shifts to critical red (stages 3-4). The pulse drives both
// a subtle scale breath and the outer halo's opacity, identical to
// the orb's `scaleAnim` + `glowAnim` pairing.
function RotatingRing({
  color, glow, critical, drawing,
}: { color: string; glow: string; critical: boolean; drawing: boolean }) {
  const rotate = useSharedValue(0);
  const pulse = useSharedValue(0);
  // Continuous outward ripple — mirrors StatusPulseOrb's `rippleStyle`
  // (scale 1 → 1.4, opacity 0.55 → 0). Only runs once the ring has
  // finished drawing the O, then loops indefinitely.
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);
  // Inward collapse ring — DEPLETED accent. Squeezes from outside in,
  // matching the orb's `collapseStyle` for the depleted band.
  const collapseScale = useSharedValue(1.5);
  const collapseOpacity = useSharedValue(0);
  // Reveal of the orb body (filled disc + glow halos) — fades in
  // smoothly the moment the stroke completes its O.
  const orbReveal = useSharedValue(0);
  // 0 = nothing drawn, 1 = full O. While `drawing`, this animates
  // from 0 → 1 over 3s, painting the stroke around the ring once.
  const draw = useSharedValue(drawing ? 0 : 1);
  // ── Dynamic state boot ────────────────────────────────────────────
  // `bandSweep` cycles 0→1 continuously during the pre-critical phase
  // and drives the colour of every chrome element on the orb (stroke,
  // body border, both glow halos, ripple + collapse rings). It maps
  // through red → amber → teal → lime as it climbs, so the whole orb
  // visibly walks up the bands instead of locking to a single hue.
  // `settle` ramps 0→1 the moment `critical` flips true, blending the
  // sweep tint into the static `color`/`glow` props supplied by the
  // parent (CRITICAL_RED + halo).
  const bandSweep = useSharedValue(0);
  const settle = useSharedValue(critical ? 1 : 0);
  // Stash the resting props in shared values so derived workers stay
  // reactive when the parent flips white → CRITICAL_RED.
  const colorSV = useSharedValue(color);
  const glowSV = useSharedValue(glow);
  React.useEffect(() => { colorSV.value = color; }, [color, colorSV]);
  React.useEffect(() => { glowSV.value = glow; }, [glow, glowSV]);

  React.useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 18_000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotate);
  }, [rotate]);

  React.useEffect(() => {
    if (drawing) {
      draw.value = 0;
      draw.value = withTiming(1, {
        duration: 3000,
        easing: Easing.inOut(Easing.cubic),
      });
    } else {
      // Snap to fully drawn — the parent flips `drawing` off only
      // *after* the 3s window, so this is just a safety net.
      draw.value = withTiming(1, { duration: 200 });
    }
  }, [drawing, draw]);

  // Sweep through the four bands as long as the orb hasn't entered
  // its critical resting state. ~3.4s per full red→lime traverse,
  // looping back-and-forth (boomerang) so the boot keeps breathing
  // through colour even after the O completes — until `critical`
  // flips and `settle` blends it into CRITICAL_RED.
  React.useEffect(() => {
    cancelAnimation(bandSweep);
    cancelAnimation(settle);
    if (!critical) {
      bandSweep.value = 0;
      bandSweep.value = withRepeat(
        withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      );
      settle.value = withTiming(0, { duration: 400 });
    } else {
      settle.value = withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      });
    }
    return () => {
      cancelAnimation(bandSweep);
      cancelAnimation(settle);
    };
  }, [critical, bandSweep, settle]);

  React.useEffect(() => {
    cancelAnimation(pulse);
    cancelAnimation(rippleScale);
    cancelAnimation(rippleOpacity);
    cancelAnimation(collapseScale);
    cancelAnimation(collapseOpacity);
    pulse.value = 0;
    rippleOpacity.value = 0;
    collapseOpacity.value = 0;
    orbReveal.value = withTiming(drawing ? 0 : 1, { duration: 600 });
    // Don't pulse while the ring is still drawing itself — let the
    // stroke complete the O cleanly first.
    if (drawing) return;

    // ── Core breathing pulse (drives orb scale + glow opacity) ──
    if (critical) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      pulse.value = withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }

    // ── Continuous outward ripple ring (matches orb's rippleStyle) ──
    const rippleMs = 1800;
    rippleScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1.4, { duration: rippleMs, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
      false,
    );
    rippleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 80 }),
        withTiming(0, { duration: rippleMs, easing: Easing.out(Easing.quad) }),
      ),
      -1,
      false,
    );

    // ── Inward collapse ring (only in DEPLETED / red mode) ──
    if (critical) {
      const collapseMs = 1600;
      collapseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 0 }),
          withTiming(1.02, { duration: collapseMs, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
      collapseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 100 }),
          withTiming(0, { duration: collapseMs, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(rippleScale);
      cancelAnimation(rippleOpacity);
      cancelAnimation(collapseScale);
      cancelAnimation(collapseOpacity);
    };
  }, [critical, drawing, pulse, rippleScale, rippleOpacity, collapseScale, collapseOpacity, orbReveal]);

  const ringStyle = useAnimatedStyle(() => {
    const scale = critical
      ? 1 + (pulse.value - 0.5) * -0.06    // collapse inward (~0.97↔1.03)
      : 1 + pulse.value * 0.05;            // expand outward (1.00↔1.05)
    return {
      transform: [
        { rotateZ: `${rotate.value}deg` },
        { scale },
      ],
    };
  });

  // ── Band-sweep tints (worklet helpers) ─────────────────────────────
  // Both helpers run inside animated style worklets. They blend the
  // live sweep colour with the resting prop colour using `settle`.
  const tintRing = (): string => {
    'worklet';
    const swept = interpolateColor(
      bandSweep.value,
      [0, 0.25, 0.5, 0.75, 1],
      [BOOT_RED, BOOT_AMBER, BOOT_TEAL, BOOT_LIME, BOOT_LIME],
    );
    return interpolateColor(settle.value, [0, 1], [swept, colorSV.value]);
  };
  const tintGlow = (): string => {
    'worklet';
    const swept = interpolateColor(
      bandSweep.value,
      [0, 0.25, 0.5, 0.75, 1],
      [BOOT_RED, BOOT_AMBER, BOOT_TEAL, BOOT_LIME, BOOT_LIME],
    );
    return interpolateColor(settle.value, [0, 1], [swept, glowSV.value]);
  };

  // ── Layered glow / ring styles (mirror StatusPulseOrb) ──
  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.18, 0.42]) * orbReveal.value,
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.98, 1.18]) }],
    backgroundColor: tintGlow(),
  }));
  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.32, 0.58]) * orbReveal.value,
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.95, 1.08]) }],
    backgroundColor: tintGlow(),
  }));
  const orbBodyStyle = useAnimatedStyle(() => {
    const scale = critical
      ? 1 + (pulse.value - 0.5) * -0.06
      : 1 + pulse.value * 0.05;
    return {
      opacity: orbReveal.value,
      transform: [{ scale }],
      borderColor: tintRing(),
    };
  });
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value * orbReveal.value,
    transform: [{ scale: rippleScale.value }],
    borderColor: tintRing(),
  }));
  const collapseRingStyle = useAnimatedStyle(() => ({
    opacity: collapseOpacity.value * orbReveal.value,
    transform: [{ scale: collapseScale.value }],
    borderColor: tintRing(),
  }));

  // SVG circles begin at 3 o'clock and run clockwise. We rotate the
  // circle by -90° so the stroke appears to begin painting at 12
  // o'clock (top), which reads more naturally as "drawing an O".
  // While the O is being painted, the stroke colour sweeps through
  // every performance band (red → amber → teal → lime) so the boot
  // reads as the user climbing out of depletion. Once the ring is
  // fully drawn (draw.value === 1) we hand off to the static `color`
  // prop, which the parent flips from white → CRITICAL_RED via a
  // separate crossfade.
  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRC * (1 - draw.value),
    stroke: tintRing(),
  }));

  return (
    <View style={styles.ringWrap}>
      {/* ── Outer soft glow halo ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: GLOW_SIZE,
            height: GLOW_SIZE,
            borderRadius: GLOW_SIZE / 2,
            backgroundColor: glow,
          },
          outerGlowStyle,
        ]}
      />
      {/* ── Inner brighter glow ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: INNER_GLOW_SIZE,
            height: INNER_GLOW_SIZE,
            borderRadius: INNER_GLOW_SIZE / 2,
            backgroundColor: glow,
          },
          innerGlowStyle,
        ]}
      />
      {/* ── Continuous outward ripple ring ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulseRing,
          {
            width: RIPPLE_SIZE,
            height: RIPPLE_SIZE,
            borderRadius: RIPPLE_SIZE / 2,
            borderColor: color,
          },
          rippleStyle,
        ]}
      />
      {/* ── Inward collapse ring (DEPLETED red only) ── */}
      {critical && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: RIPPLE_SIZE,
              height: RIPPLE_SIZE,
              borderRadius: RIPPLE_SIZE / 2,
              borderColor: color,
              borderStyle: 'dashed',
            },
            collapseRingStyle,
          ]}
        />
      )}
      {/* ── Filled inner disc with red border (the "orb") ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbBody,
          {
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
            backgroundColor: ORB_BG,
            borderColor: color,
          },
          orbBodyStyle,
        ]}
      />
      {/* ── Drawing stroke (paints the O during stage 1) ── */}
      <Animated.View style={ringStyle}>
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={color}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
            animatedProps={animatedCircleProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─── SweepingArc — red arc that travels around the ring (stage 2) ───
/**
 * TypewriterTagline — reveals the four-word manifesto one segment at
 * a time in a digital monospace face, with a blinking cursor at the
 * write head between words. Reads like a system log printing live.
 */
type Segment = { text: string; color: string };
// Narrative colour arc: soft gray (rest) → teal (replenish) → lime
// (peak readiness) → white (execute). The sequence mirrors the dynamic
// state boot on home — the user moves from depleted through the bands
// and lands on performance. INITIALIZING above the tagline stays — it
// frames the moment as OS-level, not app-level.
const TAGLINE_SEGMENTS: Segment[] = [
  { text: 'Pause', color: 'rgba(255,255,255,0.55)' },
  { text: 'Hydrate', color: '#1FB8A6' },
  { text: 'Lock In', color: '#B6FF00' },
  { text: 'Perform', color: 'rgba(255,255,255,0.96)' },
];
const TAGLINE_STEP_MS = 520;

function TypewriterTagline({ start }: { start: boolean }) {
  const [revealed, setRevealed] = React.useState(0);
  const cursor = useSharedValue(1);

  React.useEffect(() => {
    if (!start) return;
    setRevealed(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < TAGLINE_SEGMENTS.length; i += 1) {
      timers.push(setTimeout(() => setRevealed(i + 1), 600 + i * TAGLINE_STEP_MS));
    }
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, [start]);

  React.useEffect(() => {
    if (!start) return;
    cursor.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 460, easing: Easing.linear }),
        withTiming(1, { duration: 460, easing: Easing.linear }),
      ),
      -1,
      false,
    );
    return () => { cancelAnimation(cursor); };
  }, [start, cursor]);

  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursor.value }));
  const allDone = revealed >= TAGLINE_SEGMENTS.length;

  return (
    <View style={styles.taglineRow}>
      {TAGLINE_SEGMENTS.map((seg, i) => {
        const isVisible = i < revealed;
        const isLast = i === TAGLINE_SEGMENTS.length - 1;
        return (
          <View key={seg.text} style={styles.taglineSegment}>
            <Text
              style={[styles.taglineWord, { color: seg.color, opacity: isVisible ? 1 : 0 }]}
            >
              {seg.text}
            </Text>
            {!isLast && (
              <Text
                style={[styles.taglineArrowChar, { opacity: isVisible ? 1 : 0 }]}
              >
                {' → '}
              </Text>
            )}
          </View>
        );
      })}
      {!allDone && (
        <Animated.Text style={[styles.taglineCursor, cursorStyle]}>▌</Animated.Text>
      )}
    </View>
  );
}

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
  // Once the white stroke has finished painting a full O (3s), the
  // ring shifts to critical red and starts the orb-style pulse — same
  // visual language as the home screen's StatusPulseOrb.
  const [ringDrawn, setRingDrawn] = React.useState(false);

  // Stage 1 → reveal INITIALIZING after 2s, mark the ring complete at
  // 3s so it flips to red + pulse, then bring up ENTER right after.
  React.useEffect(() => {
    if (stage !== 1) return;
    const t1 = setTimeout(() => setShowInitializing(true), 2000);
    const t2 = setTimeout(() => setRingDrawn(true), 3000);
    const t3 = setTimeout(() => setShowEnter(true), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
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

  // Ring goes red the moment the O completes; halo follows.
  const isCritical = ringDrawn || stage >= 3;
  const ringColor = isCritical ? CRITICAL_RED : RING_WHITE;
  const haloColor = isCritical ? CRITICAL_RED : 'rgba(255,255,255,0.35)';
  const sweepActive = stage === 2;
  const showNumber = stage >= 3;
  const showCritical = stage >= 3;
  // Surface the manifesto from the very first frame so the opening
  // view already shows "Performance is non-negotiable." + the four-
  // word protocol tagline, not just at stage 4.
  const showCopy = true;
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
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <RotatingRing
            color={ringColor}
            glow={haloColor}
            critical={isCritical}
            drawing={!ringDrawn}
          />
        </View>

        <SweepingArc active={sweepActive} />

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
          <Text style={styles.copyHeadline}>Performance is non-negotiable.</Text>
          <TypewriterTagline start={showCopy} />
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
  // Soft radial halo behind the orb — matches StatusPulseOrb's
  // outer/inner glow layers. We use a low-opacity filled disc rather
  // than a shadow so the look is consistent across iOS / Android.
  glow: {
    position: 'absolute',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  orbBody: {
    position: 'absolute',
    borderWidth: 2.5,
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
    marginTop: RING_SIZE / 2 + 64,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  copyHeadline: {
    fontFamily: FONT_BOLD,
    color: TEXT_BRIGHT,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  taglineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taglineWord: {
    fontFamily: FONT_BOLD,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  taglineArrowChar: {
    fontFamily: FONT_MEDIUM,
    color: TEXT_DIM,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  taglineCursor: {
    fontFamily: FONT_BOLD,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 20,
    lineHeight: 26,
    marginLeft: 2,
  },
  ctaSlot: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 14,
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
