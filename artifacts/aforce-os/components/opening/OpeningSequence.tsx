/**
 * OpeningSequence — AForce OS cold-launch cinematic.
 *
 * A four-stage, full-screen opening experience that plays once per cold
 * launch on top of every other surface, then fades out to reveal
 * whatever the app routed to underneath (home / onboarding / sign-in).
 * It is mounted as an overlay in `app/_layout.tsx` (AppShell) — it does
 * NOT touch routing, so there is no redirect-loop risk and the first-run
 * onboarding wizard is left completely intact.
 *
 *   1. Symbol      — white AForce water-drop mark, breathing fade-in.
 *   2. Brand       — AFORCE wordmark + "Performance Is Non-Negotiable".
 *   3. Ritual      — PAUSE ↓ HYDRATE ↓ LOCK IN ↓ PERFORM, one at a time.
 *   4. Readiness   — TODAY'S READINESS + count-up score + READY TO PERFORM.
 *
 * Design lock compliance:
 *   - Pure black canvas; white type; brand red (#FF3B30) used only as
 *     thin hairlines / eyebrows (sparse), never as fills.
 *   - Score-Protection: the readiness number is a *display* of the live
 *     engine score (falls back to a cinematic default before state
 *     loads). Nothing here awards, mutates, or fabricates score.
 *   - Reduced-motion aware: collapses to short cross-fades with no
 *     looping breath / translate when the OS setting is enabled.
 *   - Tap anywhere to skip.
 */

import React from 'react';
import {
  AccessibilityInfo,
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
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';

const BG = '#000000';
const WHITE = Colors.text.primary;
const DIM = Colors.text.secondary;
const MUTED = Colors.text.muted;
const BRAND = Colors.accent.brand;

const FONT_EXTRABOLD = 'Inter_800ExtraBold';
const FONT_BOLD = 'Inter_700Bold';
const FONT_MEDIUM = 'Inter_500Medium';

const EASE = Easing.inOut(Easing.ease);

type Stage = 1 | 2 | 3 | 4;

const DEFAULT_SCORE = 92;

interface Props {
  /** Live readiness score to count up to. Falls back to a cinematic
   *  default when the store has not yet loaded a real value. */
  readinessScore?: number;
  /** Band-aware readiness caption (e.g. REHYDRATE NOW for DEPLETED). A
   *  DEPLETED user must never be told "READY TO PERFORM". */
  statusLabel?: string;
  /** Called once the sequence has fully faded out (or is skipped). */
  onFinish: () => void;
}

// ─── Reveal — gated opacity (+optional rise) entrance ────────────────
function Reveal({
  active,
  delay = 0,
  dy = 12,
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

// ─── StageLayer — absolute-fill crossfade container ──────────────────
function StageLayer({
  active,
  reduce,
  children,
}: {
  active: boolean;
  reduce: boolean;
  children: React.ReactNode;
}) {
  const o = useSharedValue(0);
  React.useEffect(() => {
    o.value = withTiming(active ? 1 : 0, {
      duration: reduce ? 200 : 600,
      easing: EASE,
    });
  }, [active, reduce, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.layer, st]}
    >
      {children}
    </Animated.View>
  );
}

// ─── Stage 1 — Symbol ────────────────────────────────────────────────
const DROP =
  'M32 4 C 32 4 12 30 12 48 C 12 59 21 68 32 68 C 43 68 52 59 52 48 C 52 30 32 4 32 4 Z';

function StageSymbol({ active, reduce }: { active: boolean; reduce: boolean }) {
  const breath = useSharedValue(0);
  React.useEffect(() => {
    if (active && !reduce) {
      breath.value = withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breath);
      breath.value = 0;
    }
    return () => cancelAnimation(breath);
  }, [active, reduce, breath]);
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.04 }],
    opacity: 0.9 + breath.value * 0.1,
  }));
  return (
    <StageLayer active={active} reduce={reduce}>
      <View style={styles.center}>
        <Reveal active={active} reduce={reduce} dy={0} duration={900}>
          <View style={styles.symbolWrap}>
            <View style={styles.symbolGlow} />
            <Animated.View style={markStyle}>
              <Svg width={132} height={165} viewBox="0 0 64 80">
                <Path d={DROP} fill={WHITE} />
              </Svg>
            </Animated.View>
          </View>
        </Reveal>
      </View>
    </StageLayer>
  );
}

// ─── Stage 2 — Brand reveal ──────────────────────────────────────────
function StageBrand({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <StageLayer active={active} reduce={reduce}>
      <View style={styles.center}>
        <Reveal active={active} reduce={reduce} dy={10} duration={900}>
          <Text style={styles.wordmark}>AFORCE</Text>
        </Reveal>
        <Reveal active={active} reduce={reduce} delay={500} dy={8}>
          <View style={styles.brandRule} />
        </Reveal>
        <Reveal active={active} reduce={reduce} delay={620} dy={8}>
          <Text style={styles.tagline}>Performance Is Non-Negotiable</Text>
        </Reveal>
      </View>
    </StageLayer>
  );
}

// ─── Stage 3 — The ritual ────────────────────────────────────────────
const RITUAL = ['PAUSE', 'HYDRATE', 'LOCK IN', 'PERFORM'];

function StageRitual({ active, reduce }: { active: boolean; reduce: boolean }) {
  const step = reduce ? 90 : 500;
  return (
    <StageLayer active={active} reduce={reduce}>
      <View style={styles.center}>
        {RITUAL.map((word, i) => (
          <React.Fragment key={word}>
            <Reveal active={active} reduce={reduce} delay={i * step} dy={10}>
              <Text style={styles.ritualWord}>{word}</Text>
            </Reveal>
            {i < RITUAL.length - 1 && (
              <Reveal
                active={active}
                reduce={reduce}
                delay={i * step + step / 2}
                dy={0}
              >
                <Text style={styles.ritualArrow}>↓</Text>
              </Reveal>
            )}
          </React.Fragment>
        ))}
        <Reveal
          active={active}
          reduce={reduce}
          delay={RITUAL.length * step + 200}
          dy={8}
          style={styles.ritualFootnoteWrap}
        >
          <Text style={styles.ritualFootnote}>
            Your Readiness Ritual Starts Now
          </Text>
        </Reveal>
      </View>
    </StageLayer>
  );
}

// ─── Stage 4 — Daily readiness reveal ────────────────────────────────
function StageReadiness({
  active,
  reduce,
  target,
  statusLabel,
}: {
  active: boolean;
  reduce: boolean;
  target: number;
  statusLabel: string;
}) {
  const [count, setCount] = React.useState(0);
  const targetRef = React.useRef(target);
  targetRef.current = target;

  React.useEffect(() => {
    if (!active) {
      setCount(0);
      return undefined;
    }
    const to = Math.max(0, Math.round(targetRef.current));
    if (reduce) {
      setCount(to);
      return undefined;
    }
    const duration = 1500;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(to * eased));
      if (t >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [active, reduce]);

  return (
    <StageLayer active={active} reduce={reduce}>
      <View style={styles.center}>
        <Reveal active={active} reduce={reduce} dy={8}>
          <Text style={styles.readinessEyebrow}>TODAY&apos;S READINESS</Text>
        </Reveal>
        <Reveal active={active} reduce={reduce} delay={120} dy={10}>
          <Text style={styles.readinessNumber}>{count}</Text>
        </Reveal>
        <Reveal active={active} reduce={reduce} delay={900} dy={8}>
          <View style={styles.brandRule} />
        </Reveal>
        <Reveal active={active} reduce={reduce} delay={1000} dy={8}>
          <Text style={styles.readinessStatus}>{statusLabel}</Text>
        </Reveal>
      </View>
    </StageLayer>
  );
}

// ─── OpeningSequence ─────────────────────────────────────────────────
export function OpeningSequence({
  readinessScore,
  statusLabel,
  onFinish,
}: Props) {
  const [stage, setStage] = React.useState<Stage>(1);
  const [reduce, setReduce] = React.useState(false);
  const finishedRef = React.useRef(false);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const master = useSharedValue(1);

  // Hold onFinish in a ref so finish()'s identity stays stable across
  // parent re-renders. The engine score lands on mount and refreshes
  // every ~30s; an inline onFinish would otherwise rebuild finish →
  // tear down + reschedule the whole timeline mid-sequence (visible
  // stage regression) or strand the overlay during fade-out.
  const onFinishRef = React.useRef(onFinish);
  React.useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const target =
    typeof readinessScore === 'number' && readinessScore > 0
      ? readinessScore
      : DEFAULT_SCORE;

  // Honour the OS reduce-motion setting.
  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => setReduce(v),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const finish = React.useCallback(
    (fast: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimers();
      master.value = withTiming(
        0,
        { duration: fast ? 260 : 520, easing: EASE },
      );
      // Stored in its OWN ref (never timersRef) so the timeline effect's
      // cleanup cannot clear the pending onFinish and strand the overlay
      // at opacity 0 over an absolute-fill Pressable.
      finishTimerRef.current = setTimeout(
        () => onFinishRef.current(),
        fast ? 280 : 540,
      );
    },
    [clearTimers, master],
  );

  // Drive the stage timeline once reduce-motion is resolved.
  React.useEffect(() => {
    clearTimers();
    if (finishedRef.current) return undefined;
    // [symbol, brand, ritual, readiness] hold durations (ms).
    const hold = reduce ? [700, 900, 1300, 1200] : [1900, 2200, 3400, 2800];
    let t = 0;
    timersRef.current.push(setTimeout(() => setStage(2), (t += hold[0])));
    timersRef.current.push(setTimeout(() => setStage(3), (t += hold[1])));
    timersRef.current.push(setTimeout(() => setStage(4), (t += hold[2])));
    timersRef.current.push(setTimeout(() => finish(false), (t += hold[3])));
    return clearTimers;
  }, [reduce, clearTimers, finish]);

  // Unmount cleanup: clear the staged timers AND the separate finish
  // timer (the latter lives outside timersRef on purpose).
  React.useEffect(
    () => () => {
      clearTimers();
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    },
    [clearTimers],
  );

  const onSkip = React.useCallback(() => {
    if (finishedRef.current) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    finish(true);
  }, [finish]);

  const masterStyle = useAnimatedStyle(() => ({ opacity: master.value }));

  return (
    <Animated.View
      style={[styles.root, masterStyle]}
      accessibilityViewIsModal
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip the opening sequence"
        testID="opening-skip"
      >
        <StageSymbol active={stage === 1} reduce={reduce} />
        <StageBrand active={stage === 2} reduce={reduce} />
        <StageRitual active={stage === 3} reduce={reduce} />
        <StageReadiness
          active={stage === 4}
          reduce={reduce}
          target={target}
          statusLabel={statusLabel ?? 'READY TO PERFORM'}
        />

        <Reveal
          active
          reduce={reduce}
          delay={reduce ? 200 : 1200}
          dy={0}
          style={styles.skipHintWrap}
        >
          <Text style={styles.skipHint}>TAP TO SKIP</Text>
        </Reveal>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 1000,
    elevation: 1000,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Stage 1
  symbolWrap: { alignItems: 'center', justifyContent: 'center' },
  symbolGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Stage 2
  wordmark: {
    fontFamily: FONT_EXTRABOLD,
    fontSize: 42,
    letterSpacing: 8,
    color: WHITE,
    textAlign: 'center',
  },
  brandRule: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: BRAND,
    marginVertical: 18,
  },
  tagline: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    letterSpacing: 2,
    color: DIM,
    textAlign: 'center',
  },

  // Stage 3
  ritualWord: {
    fontFamily: FONT_BOLD,
    fontSize: 26,
    letterSpacing: 4,
    color: WHITE,
    textAlign: 'center',
  },
  ritualArrow: {
    fontFamily: FONT_MEDIUM,
    fontSize: 16,
    color: MUTED,
    marginVertical: 6,
  },
  ritualFootnoteWrap: { marginTop: 26 },
  ritualFootnote: {
    fontFamily: FONT_MEDIUM,
    fontSize: 12,
    letterSpacing: 1.5,
    color: DIM,
    textAlign: 'center',
  },

  // Stage 4
  readinessEyebrow: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    letterSpacing: 3,
    color: BRAND,
    textAlign: 'center',
  },
  readinessNumber: {
    fontFamily: FONT_EXTRABOLD,
    fontSize: 96,
    letterSpacing: -2,
    color: WHITE,
    textAlign: 'center',
    marginTop: 14,
  },
  readinessStatus: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    letterSpacing: 3,
    color: WHITE,
    textAlign: 'center',
  },

  // Skip hint
  skipHintWrap: {
    position: 'absolute',
    bottom: 54,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  skipHint: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    letterSpacing: 2.5,
    color: MUTED,
  },
});
