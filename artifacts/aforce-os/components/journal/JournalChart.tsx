/**
 * Performance Trend — ambient signal visualization.
 *
 * Refined per the "less chart, more atmosphere" brief:
 *   • atmospheric vignette + soft fog backdrop inside the card
 *   • aggressive bucketing → at most ~5 trend anchors (luxury = less)
 *   • softened trend line — stacked-stroke glow, not a single hard line
 *   • multi-layered breathing halos around every anchor
 *   • slow vertical drift on the constellation (floating signal feel)
 *
 * The component is layout-stable: props are unchanged, the JournalScreen
 * call site does not need updates.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
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
const AnimatedPath = Animated.createAnimatedComponent(Path);
import type { JournalSnapshot } from '@/types';
import { Colors } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
): { t: number; score: number }[] {
  if (data.length === 0) return [];
  if (data.length <= targetBuckets) {
    return data.map((d) => ({ t: new Date(d.at).getTime(), score: d.score }));
  }
  const buckets: { t: number; score: number }[] = [];
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
    });
  }
  return buckets;
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

  // Three slow oscillators running on the UI thread.
  //   `breath`   — 2.6s, drives halo opacity/scale (the "alive" feeling)
  //   `drift`    — 6.0s, drives a tiny vertical translation of the whole
  //                constellation (the "floating signal" feeling)
  //   `shimmer`  — 4.8s, drives a barely-perceptible opacity shimmer on
  //                the trend line itself (the "signal flow" feeling)
  const breath = useSharedValue(0);
  const drift = useSharedValue(0);
  const shimmer = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    drift.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 4800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(drift);
      cancelAnimation(shimmer);
    };
  }, [breath, drift, shimmer]);

  const haloOuterProps = useAnimatedProps(() => ({
    opacity: 0.06 + breath.value * 0.06,
  }));
  const haloMidProps = useAnimatedProps(() => ({
    opacity: 0.12 + breath.value * 0.10,
  }));
  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 + drift.value * 4 }],
  }));
  // ±~8% line opacity drift around 0.93 — never lower than 0.85.
  const lineShimmerProps = useAnimatedProps(() => ({
    opacity: 0.86 + shimmer.value * 0.14,
  }));

  const { points, pathD, avg, trendDiff } = useMemo(() => {
    if (data.length === 0) {
      return {
        points: [] as { x: number; y: number; score: number; kind: DotKind }[],
        pathD: '',
        avg: 0,
        trendDiff: 0,
      };
    }
    const buckets = bucketize(data, TARGET_ANCHORS);
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
      return { x, y, score: b.score, kind: classify(b.score) };
    });

    const sumScore = data.reduce((acc, d) => acc + d.score, 0);
    const avgScore = Math.round(sumScore / data.length);

    const mid = Math.floor(data.length / 2);
    let trend = 0;
    if (data.length >= 2 && mid > 0) {
      const firstAvg =
        data.slice(0, mid).reduce((a, d) => a + d.score, 0) / mid;
      const secondAvg =
        data.slice(mid).reduce((a, d) => a + d.score, 0) /
        (data.length - mid);
      trend = secondAvg - firstAvg;
    }

    return { points: pts, pathD: smoothPath(pts), avg: avgScore, trendDiff: trend };
  }, [data, innerH, innerW]);

  if (data.length === 0) {
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

  return (
    <View style={{ width }}>
      <Animated.View style={driftStyle}>
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
              <Stop offset="0.25" stopColor="rgba(255,255,255,0.22)" />
              <Stop offset="0.5" stopColor="rgba(255,255,255,0.25)" />
              <Stop offset="0.75" stopColor="rgba(255,255,255,0.22)" />
              <Stop offset="1" stopColor="rgba(255,255,255,0)" />
            </LinearGradient>

            <LinearGradient id="trendGlow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgba(255,255,255,0)" />
              <Stop offset="0.25" stopColor="rgba(255,255,255,0.085)" />
              <Stop offset="0.5" stopColor="rgba(255,255,255,0.095)" />
              <Stop offset="0.75" stopColor="rgba(255,255,255,0.085)" />
              <Stop offset="1" stopColor="rgba(255,255,255,0)" />
            </LinearGradient>

            {/* Continuous "river of light" band — an ultra-wide, ultra-faint
                stroke under the constellation that visually connects every
                anchor into a single luminous current. Feathers in/out at
                both ends so it never has a hard edge. */}
            <LinearGradient id="signalBand" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgba(255,255,255,0)" />
              <Stop offset="0.18" stopColor="rgba(255,255,255,0.055)" />
              <Stop offset="0.5" stopColor="rgba(255,255,255,0.07)" />
              <Stop offset="0.82" stopColor="rgba(255,255,255,0.055)" />
              <Stop offset="1" stopColor="rgba(255,255,255,0)" />
            </LinearGradient>
            <LinearGradient id="signalBandOuter" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgba(255,255,255,0)" />
              <Stop offset="0.2" stopColor="rgba(255,255,255,0.025)" />
              <Stop offset="0.5" stopColor="rgba(255,255,255,0.032)" />
              <Stop offset="0.8" stopColor="rgba(255,255,255,0.025)" />
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

          {/* River of light — two ultra-wide, ultra-faint stacked strokes
              that follow the trend path. Together they form one continuous
              luminous band visually connecting every anchor in the
              constellation. Sits *under* all other line + node layers. */}
          {pathD && (
            <Path
              d={pathD}
              stroke="url(#signalBandOuter)"
              strokeWidth={150}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {pathD && (
            <Path
              d={pathD}
              stroke="url(#signalBand)"
              strokeWidth={80}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Softened trend line — three stacked strokes simulate a
              gaussian-blurred glow without needing SVG filters (which
              are unreliable across react-native-svg backends). */}
          {pathD && (
            <AnimatedPath
              d={pathD}
              stroke="url(#trendGlow)"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              animatedProps={lineShimmerProps}
            />
          )}
          {pathD && (
            <AnimatedPath
              d={pathD}
              stroke="url(#trendGlow)"
              strokeWidth={2.4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              animatedProps={lineShimmerProps}
            />
          )}
          {pathD && (
            <AnimatedPath
              d={pathD}
              stroke="url(#trendStroke)"
              strokeWidth={0.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              animatedProps={lineShimmerProps}
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
                <AnimatedCircle
                  cx={p.x}
                  cy={p.y}
                  r={p.kind === 'missed' ? 22 : 26}
                  fill={c}
                  animatedProps={haloOuterProps}
                  opacity={k}
                />
                {/* Breathing mid halo */}
                <AnimatedCircle
                  cx={p.x}
                  cy={p.y}
                  r={16}
                  fill={c}
                  animatedProps={haloMidProps}
                  opacity={k}
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
});
