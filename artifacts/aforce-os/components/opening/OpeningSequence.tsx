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
 *   2. Brand       — eyebrow "PERFORMANCE IS" → AFORCE wordmark → hairline →
 *                    N–И monogram (second N mirrored, bone/silver) → "NON —
 *                    ИEGOTIABLE" (leading N of NEGOTIABLE mirrored). The
 *                    monogram is the emotional peak.
 *   3. Ritual      — PAUSE ↓ HYDRATE ↓ LOCK IN ↓ PERFORM, one at a time.
 *   4. Readiness   — TODAY'S READINESS + count-up score + READY TO PERFORM.
 *
 * Design lock compliance:
 *   - Near-black #0D0D0D canvas; white/bone (#F5F0E8) type; brand red (#C1281B)
 *     used only as thin hairlines / eyebrows (sparse), never as fills.
 *   - Score-Protection: the readiness number is a *display* of the live
 *     engine score, and ONLY of the live engine score. When the score has
 *     not loaded, Stage 4 shows the em-dash "nothing observed" glyph — it
 *     never substitutes a number. Nothing here awards, mutates, or
 *     fabricates score.
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
import Svg, { Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';

const BG = '#0D0D0D';
const WHITE = Colors.text.primary;
const DIM = Colors.text.secondary;
const MUTED = Colors.text.muted;
const BRAND = Colors.accent.brand;
// Brand tokens for the opening cinematic. Stage 2 is a bone (#F5F0E8) silver-white
// hero on the cinematic black canvas — the N|N monogram, the AFORCE wordmark and
// the caption all render in bone; signal red (Colors.accent.brand) is reserved for
// the thin caption hairlines only. No Soursop green appears on this screen.
const BONE = Colors.bone;
const GLOW_SIZE = 320; // px box for the soft bone radial glow behind the monogram

const FONT_EXTRABOLD = 'Inter_800ExtraBold';
const FONT_BOLD = 'Inter_700Bold';
const FONT_MEDIUM = 'Inter_500Medium';
const FONT_DISPLAY = Typography.roles.display; // Archivo Black — monogram hero
const FONT_MONO = Typography.roles.eyebrow; // IBM Plex Mono — eyebrow / caption

const EASE = Easing.inOut(Easing.ease);

type Stage = 1 | 2 | 3 | 4;

/**
 * The "nothing observed" glyph — the same treatment Home uses for a value it
 * has not measured (`components/home/homeV3Presentation.ts`'s honest-data
 * contract; `components/protocol/protocolV3Presentation.ts` keeps its own copy
 * for the same reason, so no surface imports another feature's presentation
 * module). Stage 4 renders this in the score slot when the engine score has
 * not loaded, holding the composition's shape without asserting a value.
 *
 * It replaces a hardcoded `DEFAULT_SCORE = 92` that the cinematic displayed
 * whenever the score was absent — a confident number for a state the app had
 * not measured, which is the exact class of fabrication Waves 4–5 removed.
 */
const EM_DASH = '—';

interface Props {
  /** Live readiness score to display. A real 0 is a real score and renders as
   *  0; only a genuinely absent (non-finite) value withholds the number, and
   *  then the sequence shows EM_DASH rather than any substitute figure. */
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
// The N|N monogram matches the physical can: a normal "N", an en-dash, then
// the SAME "N" mirrored. The mirror is a pure horizontal flip —
// `transform: [{ scaleX: -1 }]` on that one glyph (styles.monogramMirror) — so
// it renders as a true reflection (reads "N–И"), never a different letter. The
// bone glyphs scale up from 0.92 → 1.0 over a soft bone/silver radial glow (an
// SVG RadialGradient fading to fully transparent — no hard edge, no visible
// disc, reads as ambient light off metal) so it lands as the hero of the stage.
// Reduced motion skips the scale + glow ramp and just fades.
function MonogramHero({
  active,
  reduce,
  delay,
}: {
  active: boolean;
  reduce: boolean;
  delay: number;
}) {
  const o = useSharedValue(0);
  const scale = useSharedValue(reduce ? 1 : 0.92);
  const glow = useSharedValue(0);
  React.useEffect(() => {
    if (active) {
      if (reduce) {
        // Reduced motion: skip the scale-up and the glow ramp entirely. The
        // whole monogram (glyphs + halo) just fades in together, in lockstep
        // with no delay, so there is no ordering skew and the only motion is a
        // single synchronized opacity fade.
        scale.value = 1;
        o.value = withTiming(1, { duration: 220, easing: EASE });
        glow.value = withTiming(0.9, { duration: 220, easing: EASE });
      } else {
        o.value = withDelay(delay, withTiming(1, { duration: 900, easing: EASE }));
        scale.value = withDelay(
          delay,
          withTiming(1, { duration: 1100, easing: EASE }),
        );
        glow.value = withDelay(
          delay + 150,
          withTiming(1, { duration: 1300, easing: EASE }),
        );
      }
    } else {
      o.value = 0;
      scale.value = reduce ? 1 : 0.92;
      glow.value = 0;
    }
  }, [active, reduce, delay, o, scale, glow]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={styles.monogramWrap}>
      <Animated.View pointerEvents="none" style={[styles.monoGlow, glowStyle]}>
        <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
          <Defs>
            <RadialGradient
              id="monoGlow"
              cx={GLOW_SIZE / 2}
              cy={GLOW_SIZE / 2}
              r={GLOW_SIZE / 2}
              fx={GLOW_SIZE / 2}
              fy={GLOW_SIZE / 2}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={BONE} stopOpacity={0.09} />
              <Stop offset="0.55" stopColor={BONE} stopOpacity={0.035} />
              <Stop offset="1" stopColor={BONE} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={GLOW_SIZE} height={GLOW_SIZE} fill="url(#monoGlow)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.monogramRow, rowStyle]}>
        <Text style={styles.monogramGlyph}>N</Text>
        <Text style={styles.monogramDash}>–</Text>
        {/* Mirror lives on the wrapping View, not the Text: React Native native
            (Expo Go) ignores `transform` on a <Text>, so the flip must be on a
            <View> for the reflected "И" to render on device as well as on web. */}
        <View style={styles.monogramMirror}>
          <Text style={styles.monogramGlyph}>N</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function StageBrand({ active, reduce }: { active: boolean; reduce: boolean }) {
  const { t } = useTranslation();
  return (
    <StageLayer active={active} reduce={reduce}>
      <View style={styles.center}>
        <Reveal active={active} reduce={reduce} dy={6} duration={700}>
          <Text style={styles.brandEyebrow}>{t('opening.brand_eyebrow')}</Text>
        </Reveal>
        <Reveal
          active={active}
          reduce={reduce}
          delay={reduce ? 80 : 250}
          dy={10}
          duration={900}
        >
          {/* Brand wordmark — not run through t(), matches every other
              "AFORCE" wordmark site in the app (see e.g.
              screens/TerritoryScreen.tsx, components/home/HomeScreenLegacy.tsx). */}
          <Text style={styles.wordmark}>AFORCE</Text>
        </Reveal>
        <Reveal active={active} reduce={reduce} delay={reduce ? 120 : 500} dy={8}>
          <View style={styles.brandRule} />
        </Reveal>
        <MonogramHero active={active} reduce={reduce} delay={reduce ? 140 : 750} />
        <Reveal active={active} reduce={reduce} delay={reduce ? 180 : 1300} dy={8}>
          <View style={styles.captionBlock}>
            <View style={styles.captionRule} />
            {/* Plain forward-facing text. The scaleX(-1) mirror is isolated to
                the monogram's right N only (see MonogramHero) — it must NOT leak
                onto any caption N. */}
            <Text style={styles.brandCaption}>{t('opening.brand_caption')}</Text>
            <View style={styles.captionRule} />
          </View>
        </Reveal>
      </View>
    </StageLayer>
  );
}

// ─── Stage 3 — The ritual ────────────────────────────────────────────
// Ordered i18n keys — RITUAL_KEYS.length and the visual sequence (PAUSE →
// HYDRATE → LOCK IN → PERFORM) must stay in lockstep with opening.ritual_*
// in locales/*.json.
const RITUAL_KEYS = ['ritual_pause', 'ritual_hydrate', 'ritual_lock_in', 'ritual_perform'] as const;

function StageRitual({ active, reduce }: { active: boolean; reduce: boolean }) {
  const { t } = useTranslation();
  const step = reduce ? 90 : 500;
  return (
    <StageLayer active={active} reduce={reduce}>
      <View style={styles.center}>
        {RITUAL_KEYS.map((key, i) => (
          <React.Fragment key={key}>
            <Reveal active={active} reduce={reduce} delay={i * step} dy={10}>
              <Text style={styles.ritualWord}>{t(`opening.${key}`)}</Text>
            </Reveal>
            {i < RITUAL_KEYS.length - 1 && (
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
          delay={RITUAL_KEYS.length * step + 200}
          dy={8}
          style={styles.ritualFootnoteWrap}
        >
          <Text style={styles.ritualFootnote}>
            {t('opening.ritual_footnote')}
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
  /** `null` = the engine score has not loaded. Renders EM_DASH, never a
   *  number — "not measured yet" and "measured as low" are different facts. */
  target: number | null;
  statusLabel: string;
}) {
  const { t } = useTranslation();
  const [count, setCount] = React.useState(0);
  const targetRef = React.useRef(target);
  targetRef.current = target;
  // Dep on PRESENCE, not value: the score can land while stage 4 is on screen,
  // and the count-up has to start when it does. A score that merely refreshes
  // (~30s) must not restart the count mid-animation — hence reading the value
  // itself through the ref, as this component already did.
  const hasTarget = target != null;

  React.useEffect(() => {
    if (!active) {
      setCount(0);
      return undefined;
    }
    const raw = targetRef.current;
    if (raw == null) {
      // Nothing measured: no count-up, and no interval left running.
      setCount(0);
      return undefined;
    }
    const to = Math.max(0, Math.round(raw));
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
  }, [active, reduce, hasTarget]);

  return (
    <StageLayer active={active} reduce={reduce}>
      <View style={styles.center}>
        <Reveal active={active} reduce={reduce} dy={8}>
          <Text style={styles.readinessEyebrow}>{t('opening.readiness_eyebrow')}</Text>
        </Reveal>
        <Reveal active={active} reduce={reduce} delay={120} dy={10}>
          {/* `target == null` is the ONLY case that withholds a number; a real
              0 counts up to 0 and is shown as 0. */}
          <Text style={styles.readinessNumber} testID="opening-readiness-value">
            {target == null ? EM_DASH : count}
          </Text>
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
  const { t } = useTranslation();
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

  // A HydroState of 0 is a MEASURED state, not a missing one. The previous
  // `> 0` guard collapsed those two facts, so a member whose real score was 0
  // met the app with a fabricated 92 on cold launch (Build 60 device QA) —
  // seconds before Home correctly showed them 0. Finiteness is the only honest
  // question: everything finite (0 included) is the member's real score, and
  // anything else is "not loaded", which Stage 4 answers with EM_DASH.
  const target =
    typeof readinessScore === 'number' && Number.isFinite(readinessScore)
      ? readinessScore
      : null;

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
    // [symbol, brand, ritual, readiness] hold durations (ms). Stage 2 (brand)
    // holds a beat longer than the symbol/readiness stages so the N|N monogram
    // + "NON — NEGOTIABLE" composition lands as the emotional peak.
    const hold = reduce ? [700, 1300, 1300, 1200] : [1900, 3400, 3400, 2800];
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
        accessibilityLabel={t('opening.skip_a11y')}
        testID="opening-skip"
      >
        <StageSymbol active={stage === 1} reduce={reduce} />
        <StageBrand active={stage === 2} reduce={reduce} />
        <StageRitual active={stage === 3} reduce={reduce} />
        <StageReadiness
          active={stage === 4}
          reduce={reduce}
          target={target}
          statusLabel={statusLabel ?? t('opening.readiness_default_status')}
        />

        <Reveal
          active
          reduce={reduce}
          delay={reduce ? 200 : 1200}
          dy={0}
          style={styles.skipHintWrap}
        >
          <Text style={styles.skipHint}>{t('opening.tap_to_skip')}</Text>
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
  brandEyebrow: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    letterSpacing: 3,
    color: BONE,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  wordmark: {
    fontFamily: FONT_DISPLAY,
    fontSize: 40,
    letterSpacing: 6,
    color: BONE,
    textAlign: 'center',
  },
  brandRule: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: BRAND,
    marginVertical: 18,
  },
  monogramWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  monoGlow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramGlyph: {
    fontFamily: FONT_DISPLAY,
    fontSize: 76,
    lineHeight: 84,
    color: BONE,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  monogramMirror: {
    transform: [{ scaleX: -1 }],
  },
  monogramDash: {
    fontFamily: FONT_DISPLAY,
    fontSize: 52,
    lineHeight: 84,
    color: BRAND,
    marginHorizontal: 8,
  },
  captionBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  captionRule: {
    width: 26,
    height: 1,
    backgroundColor: BRAND,
    marginVertical: 9,
  },
  brandCaption: {
    fontFamily: FONT_MONO,
    fontSize: 14,
    letterSpacing: 4,
    color: BONE,
    textAlign: 'center',
    textTransform: 'uppercase',
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
