/**
 * Performance Trend — ambient signal visualization.
 *
 * Refined per the "less chart, more atmosphere" brief:
 *   • atmospheric vignette + soft fog backdrop inside the card
 *   • aggressive bucketing → at most ~5 trend anchors (luxury = less)
 *   • softened trend line — stacked-stroke glow, not a single hard line
 *   • multi-layered static halos around every anchor
 *
 * Wave-5: the halos no longer breathe, the constellation no longer drifts and
 * the trend line no longer shimmers — see the removal note in the component.
 *
 * The component is layout-stable: props are unchanged, the JournalScreen
 * call site does not need updates.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { hapticSelection } from '@/services/haptics';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { JournalSnapshot } from '@/types';
import { Colors } from '@/theme/colors';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Resting opacities left behind by the three removed ambient loops (see the
// component body). Each is the midpoint of the range its oscillator travelled,
// so the still frame is the one the loop spent most of its cycle on.
const HALO_OUTER_OPACITY = 0.09; //  was 0.06 + breath * 0.06
const HALO_MID_OPACITY = 0.17; //    was 0.12 + breath * 0.10
const LINE_OPACITY = 0.93; //        was 0.86 + shimmer * 0.14

interface Props {
  data: JournalSnapshot[];
  width: number;
  height?: number;
  weeklyCompliancePct: number;
  complianceStreak: number;
}

const PADDING = { top: 36, right: 26, bottom: 26, left: 26 };
const TARGET_ANCHORS = 5;
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const TREND_THRESHOLD = 3;

const DOT = {
  completed: Colors.states.PEAK.primary,        // lime
  ontrack:   Colors.states.BALANCED.primary,    // cyan
  missed:    Colors.states.RECOVERING.primary,  // amber
} as const;
type DotKind = keyof typeof DOT;

function classify(score: number): DotKind {
  if (score >= 85) return 'completed';
  if (score >= 65) return 'ontrack';
  return 'missed';
}

function bucketize(
  data: JournalSnapshot[],
  targetBuckets: number,
): { t: number; score: number; at: string }[] {
  if (data.length === 0) return [];
  if (data.length <= targetBuckets) {
    return data.map((d) => ({ t: new Date(d.at).getTime(), score: d.score, at: d.at }));
  }
  const buckets: { t: number; score: number; at: string }[] = [];
  const size = data.length / targetBuckets;
  for (let i = 0; i < targetBuckets; i++) {
    const start = Math.floor(i * size);
    const end = Math.floor((i + 1) * size);
    const slice = data.slice(start, end);
    if (slice.length === 0) continue;
    const sum = slice.reduce((a, d) => a + d.score, 0);
    const midIdx = Math.floor((start + end) / 2);
    buckets.push({
      t: new Date(data[midIdx].at).getTime(),
      score: sum / slice.length,
      at: data[midIdx].at,
    });
  }
  return buckets;
}

/** Short, friendly label for the tap-to-reveal bubble. */
function formatBubbleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Smooth Catmull-Rom curve, intentionally soft. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function scoreBandColor(score: number): string {
  if (score >= 85) return Colors.states.PEAK.primary;
  if (score >= 65) return Colors.states.BALANCED.primary;
  if (score >= 40) return Colors.states.RECOVERING.primary;
  return Colors.states.DEPLETED.primary;
}

export default function JournalChart({
  data,
  width,
  height = 350,
  weeklyCompliancePct,
  complianceStreak,
}: Props) {
  const innerW = Math.max(40, width - PADDING.left - PADDING.right);
  const innerH = Math.max(40, height - PADDING.top - PADDING.bottom);

  // ── Wave-5 REMOVAL — the three ambient oscillators are gone ───────────────
  // This chart used to run THREE unbounded `withRepeat(..., -1)` loops on the
  // UI thread the entire time it was on screen: `breath` (2.6s halo pulse, "the
  // alive feeling"), `drift` (6s vertical float, "the floating signal feeling")
  // and `shimmer` (4.8s trend-line opacity wobble, "the signal flow feeling").
  // RC-1 gated them on reduced motion; the founder's motion brief deletes them.
  //
  // They are the clearest instance of what that brief names — decorative loops,
  // constant pulsing, excessive shimmer — and they were competing with the data
  // they drew: a member reading a hydration trend was watching the line breathe.
  // Removal, not tuning: three loops off the UI thread, and a chart that is
  // still while you read it.
  //
  // What survives is the one motion here that carries meaning: the crossfade
  // below, which is a TRANSITION (content swapping in place) rather than an
  // ambient loop. It fires only on a range switch and it settles.
  const reducedMotion = useReducedMotion();

  // Crossfade opacity — fades the whole constellation out when `data`
  // changes (range switch from 7d → 30d → 90d), swaps the underlying
  // dataset at the trough, then fades back in.
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // Deferred dataset: we render `renderedData` (not the incoming prop)
  // so we can hold the previous frame visible while the fade-out plays,
  // then swap to the new data exactly at the opacity trough.
  const [renderedData, setRenderedData] = useState<JournalSnapshot[]>(data);
  // Track the dataset we most recently kicked a fade toward. Comparing
  // against this (not `renderedData`) prevents the effect from re-firing
  // when `runOnJS(setRenderedData)` lands and re-renders the component
  // — that swap is already the result of the in-flight animation, not
  // a new prop change. Also makes rapid range toggles (7d→30d→90d) safe:
  // each new `data` cancels the prior sequence and starts a fresh fade
  // from whatever opacity we're currently at, always targeting the
  // newest data. Reanimated cancels prior `withSequence` calls, so the
  // previous callback fires with `finished=false` and we never apply a
  // stale swap.
  const lastTargetRef = useRef<JournalSnapshot[]>(data);
  useEffect(() => {
    if (data === lastTargetRef.current) return;
    lastTargetRef.current = data;
    if (reducedMotion) {
      // Static alternative (Wave-5): swap the dataset outright at full opacity.
      // With the three ambient loops gone this crossfade is the ONLY motion left
      // in the chart, and it had no reduced-motion branch of its own — it
      // inherited one from loops that no longer exist.
      cancelAnimation(fade);
      fade.value = 1;
      setRenderedData(data);
      return;
    }
    fade.value = withSequence(
      withTiming(0.12, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(setRenderedData)(data);
        }
      }),
      withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
    );
  }, [data, fade, reducedMotion]);

  // A crossfade in flight when the screen leaves would otherwise keep running
  // on the UI thread past unmount (Wave-4 rule).
  useEffect(() => () => cancelAnimation(fade), [fade]);

  const { points, pathD, avg, trendDiff } = useMemo(() => {
    if (renderedData.length === 0) {
      return {
        points: [] as { x: number; y: number; score: number; kind: DotKind; at: string }[],
        pathD: '',
        avg: 0,
        trendDiff: 0,
      };
    }
    const buckets = bucketize(renderedData, TARGET_ANCHORS);
    const tMin = buckets[0].t;
    const tMax = buckets[buckets.length - 1].t;
    const tSpan = Math.max(1, tMax - tMin);

    const pts = buckets.map((b) => {
      const x =
        buckets.length === 1
          ? PADDING.left + innerW / 2
          : PADDING.left + ((b.t - tMin) / tSpan) * innerW;
      const y =
        PADDING.top +
        (1 - (b.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * innerH;
      return { x, y, score: b.score, kind: classify(b.score), at: b.at };
    });

    const sumScore = renderedData.reduce((acc, d) => acc + d.score, 0);
    const avgScore = Math.round(sumScore / renderedData.length);

    const mid = Math.floor(renderedData.length / 2);
    let trend = 0;
    if (renderedData.length >= 2 && mid > 0) {
      const firstAvg =
        renderedData.slice(0, mid).reduce((a, d) => a + d.score, 0) / mid;
      const secondAvg =
        renderedData.slice(mid).reduce((a, d) => a + d.score, 0) /
        (renderedData.length - mid);
      trend = secondAvg - firstAvg;
    }

    return { points: pts, pathD: smoothPath(pts), avg: avgScore, trendDiff: trend };
  }, [renderedData, innerH, innerW]);

  if (renderedData.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Awaiting signal</Text>
      </View>
    );
  }

  // Legend stats below the chart were removed per latest spec — the
  // KPI summary cards above the chart already cover Avg / Consistency /
  // Streak. Trend is implied by the chart's slope.
  void avg; void trendDiff; void weeklyCompliancePct; void complianceStreak;

  // Tap-to-reveal: tapping a constellation node shows a small floating
  // bubble with that node's date + score. Tap again (or tap a different
  // node) updates / dismisses. Light selection haptic on every tap;
  // web is a no-op since touch precision is unreliable without a finger.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const handleNodeTap = useCallback((i: number) => {
    if (Platform.OS !== 'web') {
      hapticSelection();
    }
    setSelectedIdx((prev) => (prev === i ? null : i));
  }, []);
  // Reset selection if the underlying data set changes (e.g. range switch).
  // Tied to `renderedData` so the bubble clears at the same instant the
  // new constellation appears, not before the crossfade swap.
  useEffect(() => {
    setSelectedIdx(null);
  }, [renderedData]);

  const HIT = 28; // generous touch target around each node
  const selected = selectedIdx != null ? points[selectedIdx] : null;

  return (
    <View style={{ width, height }}>
      <Animated.View style={fadeStyle}>
        <Svg width={width} height={height}>
          <Defs>
            {/* Atmospheric vignette — radial fog from center, fades to
                near-black at the edges. Gives the chart depth without
                introducing a hard frame. */}
            <RadialGradient
              id="vignette"
              cx="50%"
              cy="50%"
              rx="70%"
              ry="70%"
              fx="50%"
              fy="50%"
            >
              <Stop offset="0" stopColor="rgba(40,55,80,0.18)" />
              <Stop offset="0.55" stopColor="rgba(10,12,20,0.03)" />
              <Stop offset="1" stopColor="rgba(0,0,0,0)" />
            </RadialGradient>

            {/* Edge-feather mask — fades the chart toward the card
                background at every side so the rectangular SVG never
                shows a hard boundary. */}
            <LinearGradient id="featherV" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity="0.55" />
              <Stop offset="0.18" stopColor="#000" stopOpacity="0" />
              <Stop offset="0.82" stopColor="#000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.55" />
            </LinearGradient>
            <LinearGradient id="featherH" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#000" stopOpacity="0.45" />
              <Stop offset="0.12" stopColor="#000" stopOpacity="0" />
              <Stop offset="0.88" stopColor="#000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
            </LinearGradient>

            {/* Stacked-stroke glow gradient for the trend line — fades
                in at the left edge and out at the right so the line
                never has a hard terminus. */}
            <LinearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgba(255,255,255,0)" />
              <Stop offset="0.20" stopColor="rgba(255,255,255,0.15)" />
              <Stop offset="0.35" stopColor="rgba(255,255,255,0.20)" />
              <Stop offset="0.5" stopColor="rgba(255,255,255,0.22)" />
              <Stop offset="0.65" stopColor="rgba(255,255,255,0.20)" />
              <Stop offset="0.80" stopColor="rgba(255,255,255,0.15)" />
              <Stop offset="1" stopColor="rgba(255,255,255,0)" />
            </LinearGradient>

            <LinearGradient id="trendGlow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgba(255,255,255,0)" />
              <Stop offset="0.25" stopColor="rgba(255,255,255,0.07)" />
              <Stop offset="0.5" stopColor="rgba(255,255,255,0.08)" />
              <Stop offset="0.75" stopColor="rgba(255,255,255,0.07)" />
              <Stop offset="1" stopColor="rgba(255,255,255,0)" />
            </LinearGradient>
          </Defs>

          {/* Vignette / fog backdrop */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="url(#vignette)"
          />

          {/* Feathered edges — overlay rects fade to card color at
              every border. Drawn before the trend so dots/glow can
              still bleed into the feathered zone naturally. */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="url(#featherV)"
            pointerEvents="none"
          />
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="url(#featherH)"
            pointerEvents="none"
          />

          {/* Softened trend line — three stacked strokes simulate a
              gaussian-blurred glow without needing SVG filters (which
              are unreliable across react-native-svg backends). */}
          {pathD && (
            <Path
              d={pathD}
              stroke="url(#trendGlow)"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={LINE_OPACITY}
            />
          )}
          {pathD && (
            <Path
              d={pathD}
              stroke="url(#trendGlow)"
              strokeWidth={2.4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={LINE_OPACITY}
            />
          )}
          {pathD && (
            <Path
              d={pathD}
              stroke="url(#trendStroke)"
              strokeWidth={0.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={LINE_OPACITY}
            />
          )}

          {/* Constellation anchors — 5 depth-layered rings simulate
              the holographic falloff: ultra-soft outer atmosphere →
              breathing mid halos → solid inner glow → tiny crisp
              center. Cyan reads "electric"; amber reads "warm/organic"
              — same radii, the perceptual difference is in the hue. */}
          {points.map((p, i) => {
            const c = DOT[p.kind];
            // Amber nodes were visually dominating the left side of the
            // constellation — same radii but a warmer hue reads bigger.
            // Soften them with a per-kind opacity multiplier so the
            // hierarchy stays balanced across the whole signal.
            const k = p.kind === 'missed' ? 0.7 : 1;
            return (
              <React.Fragment key={`dot-${i}`}>
                {/* Ultra-soft outer atmosphere */}
                <Circle cx={p.x} cy={p.y} r={p.kind === 'missed' ? 32 : 38} fill={c} opacity={0.04 * k} />
                {/* Breathing outer halo */}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={p.kind === 'missed' ? 22 : 26}
                  fill={c}
                  opacity={HALO_OUTER_OPACITY}
                />
                {/* Breathing mid halo */}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={16}
                  fill={c}
                  opacity={HALO_MID_OPACITY}
                />
                {/* Solid inner glow */}
                <Circle cx={p.x} cy={p.y} r={8} fill={c} opacity={0.28 * k} />
                {/* Soft core */}
                <Circle cx={p.x} cy={p.y} r={3.5} fill={c} />
                {/* Tiny crisp pinpoint center */}
                <Circle cx={p.x} cy={p.y} r={1.5} fill="#FFFFFF" opacity={0.9} />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Invisible hit targets — one per constellation node. Sit on
            top of the SVG so the user can tap any node to reveal its
            date + score. Hit area is intentionally generous (HIT px)
            so fingertips land easily on what visually are 3.5px cores. */}
        {points.map((p, i) => (
          <Pressable
            key={`hit-${i}`}
            onPress={() => handleNodeTap(i)}
            accessibilityRole="button"
            accessibilityLabel={`${formatBubbleDate(p.at)}, score ${Math.round(p.score)}`}
            style={{
              position: 'absolute',
              left: p.x - HIT,
              top: p.y - HIT,
              width: HIT * 2,
              height: HIT * 2,
              borderRadius: HIT,
            }}
          />
        ))}

        {/* Floating reveal bubble for the currently-selected node.
            Renders above the node, centered horizontally; clamps within
            the chart so it never escapes the card edges. */}
        {selected && (
          <View
            pointerEvents="none"
            style={[
              styles.bubble,
              {
                left: Math.max(8, Math.min(width - 116, selected.x - 54)),
                top: Math.max(4, selected.y - 56),
                borderColor: `${DOT[selected.kind]}55`,
                shadowColor: DOT[selected.kind],
              },
            ]}
          >
            <Text style={styles.bubbleDate}>{formatBubbleDate(selected.at)}</Text>
            <Text style={[styles.bubbleScore, { color: DOT[selected.kind] }]}>
              {Math.round(selected.score)}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.4,
  },
  bubble: {
    position: 'absolute',
    width: 108,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,12,18,0.92)',
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bubbleDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  bubbleScore: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
});
