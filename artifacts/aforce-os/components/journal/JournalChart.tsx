/**
 * Score Over Time — premium performance telemetry chart.
 *
 * Cinematic visual language inspired by WHOOP / Oura / F1 telemetry:
 *   • smooth catmull-rom → cubic-bezier curve (no jagged polyline)
 *   • soft gradient area fill, color-shifted by score band
 *   • subtle band guides at PEAK / BALANCED thresholds
 *   • glowing per-point dots, color-coded by performance state
 *   • pulsing "now" node on the most recent reading
 *   • sentence-case stat strip below the chart
 *
 * Built on `react-native-svg` + `react-native-reanimated` (already deps).
 * No external chart libs. Pure component — same Props contract as before,
 * so callers are unaffected.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { JournalSnapshot } from '@/types';
import { Colors } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  data: JournalSnapshot[];
  width: number;
  height?: number;
  /** % of recent days the user met their hydration target (0..100). */
  weeklyCompliancePct: number;
  /** Consecutive days the user met their target. */
  complianceStreak: number;
}

const PADDING = { top: 18, right: 18, bottom: 26, left: 30 };
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const TREND_THRESHOLD = 3;

/** Map a score (0..100) to the matching state-band color. */
function scoreBandColor(score: number): string {
  if (score >= 85) return Colors.states.PEAK.primary;
  if (score >= 65) return Colors.states.BALANCED.primary;
  if (score >= 40) return Colors.states.RECOVERING.primary;
  return Colors.states.DEPLETED.primary;
}

/**
 * Catmull–Rom → cubic-Bezier path. Produces a smooth curve through every
 * point without overshoot, which is exactly the calm, fluid line the
 * spec asks for (no jagged polyline, no spreadsheet-app vibe).
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  const tension = 0.5;
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function JournalChart({
  data,
  width,
  height = 220,
  weeklyCompliancePct,
  complianceStreak,
}: Props) {
  const innerW = Math.max(40, width - PADDING.left - PADDING.right);
  const innerH = Math.max(40, height - PADDING.top - PADDING.bottom);

  // Slow, calm pulse for the most-recent "now" node — telemetry breath.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const pulseProps = useAnimatedProps(() => ({
    r: 9 + pulse.value * 6,
    opacity: 0.35 - pulse.value * 0.3,
  }));

  const {
    points,
    pathD,
    areaD,
    avg,
    trendDiff,
    lastPoint,
    lastColor,
    areaTopColor,
  } = useMemo(() => {
    if (data.length === 0) {
      return {
        points: [] as { x: number; y: number; score: number }[],
        pathD: '',
        areaD: '',
        avg: 0,
        trendDiff: 0,
        lastPoint: null as null | { x: number; y: number; score: number },
        lastColor: Colors.text.muted,
        areaTopColor: 'rgba(255,255,255,0.18)',
      };
    }
    const ts = data.map((d) => new Date(d.at).getTime());
    const tMin = ts[0];
    const tMax = ts[ts.length - 1];
    const tSpan = Math.max(1, tMax - tMin);

    const pts = data.map((d, i) => {
      // Single-point series: center horizontally so it doesn't slam the
      // left edge — feels like an intentional reading, not a layout bug.
      const x =
        data.length === 1
          ? PADDING.left + innerW / 2
          : PADDING.left + ((ts[i] - tMin) / tSpan) * innerW;
      const y =
        PADDING.top +
        (1 - (d.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * innerH;
      return { x, y, score: d.score };
    });

    const lineD = smoothPath(pts);
    // Close the smoothed line into a soft area for the gradient fill.
    const bottomY = PADDING.top + innerH;
    const fillD = pts.length
      ? `${lineD} L${pts[pts.length - 1].x.toFixed(2)},${bottomY.toFixed(2)} L${pts[0].x.toFixed(2)},${bottomY.toFixed(2)} Z`
      : '';

    const sumScore = data.reduce((acc, d) => acc + d.score, 0);
    const avgScore = Math.round(sumScore / data.length);

    const mid = Math.floor(data.length / 2);
    let trend = 0;
    if (data.length >= 2 && mid > 0) {
      const firstHalf = data.slice(0, mid);
      const secondHalf = data.slice(mid);
      const firstAvg = firstHalf.reduce((a, d) => a + d.score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, d) => a + d.score, 0) / secondHalf.length;
      trend = secondAvg - firstAvg;
    }

    const last = pts[pts.length - 1];
    return {
      points: pts,
      pathD: lineD,
      areaD: fillD,
      avg: avgScore,
      trendDiff: trend,
      lastPoint: last,
      lastColor: scoreBandColor(last.score),
      areaTopColor: scoreBandColor(avgScore),
    };
  }, [data, innerH, innerW]);

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Awaiting signal</Text>
      </View>
    );
  }

  const yFor = (score: number) =>
    PADDING.top + (1 - (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * innerH;

  const trendSymbol = trendDiff > TREND_THRESHOLD ? '↑'
    : trendDiff < -TREND_THRESHOLD ? '↓'
    : '—';
  const trendColor = trendDiff > TREND_THRESHOLD
    ? Colors.states.PEAK.primary
    : trendDiff < -TREND_THRESHOLD
      ? Colors.states.DEPLETED.primary
      : Colors.text.secondary;

  const avgColor = scoreBandColor(avg);
  const compliancePctClamped = Math.max(0, Math.min(100, Math.round(weeklyCompliancePct)));
  const streakClamped = Math.max(0, Math.round(complianceStreak));

  return (
    <View style={{ width }}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Area gradient — band-tinted at the top, fully transparent
              at the baseline. Restraint over saturation. */}
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={areaTopColor} stopOpacity="0.32" />
            <Stop offset="0.55" stopColor={areaTopColor} stopOpacity="0.10" />
            <Stop offset="1" stopColor={areaTopColor} stopOpacity="0" />
          </LinearGradient>
          {/* Line gradient — fades subtly from the band color into white
              so the leading edge feels alive without esports glare. */}
          <LinearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <Stop offset="1" stopColor={lastColor} />
          </LinearGradient>
          {/* Soft halo behind the live node. */}
          <RadialGradient id="liveHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={lastColor} stopOpacity="0.55" />
            <Stop offset="1" stopColor={lastColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Quiet horizontal guides at the meaningful thresholds only —
            85 (peak) and 65 (balanced). No tick clutter at 0/50/100. */}
        {[85, 65].map((v) => (
          <React.Fragment key={`guide-${v}`}>
            <Line
              x1={PADDING.left}
              x2={PADDING.left + innerW}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
              strokeDasharray="3 6"
            />
            <SvgText
              x={PADDING.left - 6}
              y={yFor(v) + 3}
              fontSize={9}
              fill="rgba(255,255,255,0.28)"
              textAnchor="end"
            >
              {v}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Gradient area under the curve */}
        {areaD && <Path d={areaD} fill="url(#areaFill)" />}

        {/* Smooth line — a soft underlayer for ambient glow, then the
            crisp gradient stroke on top. */}
        {pathD && (
          <>
            <Path
              d={pathD}
              stroke={lastColor}
              strokeOpacity={0.18}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={pathD}
              stroke="url(#lineStroke)"
              strokeWidth={1.75}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Per-point glowing dots — color-coded by performance band.
            Higher scores get a brighter dot; depleted reads stay muted
            so the eye lands on recovery, not the crash. */}
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const dotColor = scoreBandColor(p.score);
          const intensity = Math.max(0.35, Math.min(1, p.score / 100));
          if (isLast) return null; // rendered separately with pulse below
          return (
            <React.Fragment key={`dot-${i}`}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={5}
                fill={dotColor}
                opacity={0.12 * intensity}
              />
              <Circle cx={p.x} cy={p.y} r={2.2} fill={dotColor} opacity={0.85 * intensity} />
            </React.Fragment>
          );
        })}

        {/* "Now" node — soft pulsing halo + a steady core. The pulse is
            slow (1.6s) so it reads as telemetry, not a notification. */}
        {lastPoint && (
          <>
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={18} fill="url(#liveHalo)" />
            <AnimatedCircle
              cx={lastPoint.x}
              cy={lastPoint.y}
              fill={lastColor}
              animatedProps={pulseProps}
            />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={4.5} fill={lastColor} />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={1.6} fill="#FFFFFF" />
          </>
        )}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendCell}>
          <Text style={styles.legendK}>Avg score</Text>
          <Text style={[styles.legendV, { color: avgColor }]}>{avg}</Text>
        </View>
        <View style={styles.legendCell}>
          <Text style={styles.legendK}>Trend</Text>
          <Text style={[styles.legendV, { color: trendColor }]}>{trendSymbol}</Text>
        </View>
        <View style={styles.legendCell}>
          <Text style={styles.legendK}>Consistency</Text>
          <Text style={[styles.legendV, { color: Colors.states.PEAK.primary }]}>{compliancePctClamped}%</Text>
        </View>
        <View style={styles.legendCell}>
          <Text style={styles.legendK}>Streak</Text>
          <Text style={[styles.legendV, { color: Colors.states.PEAK.primary }]}>{streakClamped}d</Text>
        </View>
      </View>
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 14,
    gap: 8,
  },
  legendCell: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  legendK: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.42)',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
  },
  legendV: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
  },
});
