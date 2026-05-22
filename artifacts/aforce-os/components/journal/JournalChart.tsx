/**
 * Score Over Time — calm, readable telemetry chart.
 *
 * Visual language (per latest spec):
 *   • white score line on a soft green area fill
 *   • semantic dots per reading:
 *       🟢 lime    — command completed (stable / improving)
 *       🟠 amber   — missed command   (score dropped meaningfully)
 *       🔵 cyan    — intake logged    (score jumped up)
 *   • restrained guides at 85 / 65, no extra tick clutter
 *
 * Built on `react-native-svg` (already a dep). Same Props as before, so
 * callers don't change.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { JournalSnapshot } from '@/types';
import { Colors } from '@/theme/colors';

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

// Semantic dot palette — kept restrained, not esports RGB.
const DOT = {
  completed: Colors.states.PEAK.primary,        // 🟢 lime
  missed:    Colors.states.RECOVERING.primary,  // 🟠 amber
  intake:    Colors.states.BALANCED.primary,    // 🔵 cyan
} as const;

type DotKind = keyof typeof DOT;

// Soft green for the area fill under the line — single, calm color.
const AREA_GREEN = Colors.states.PEAK.primary;

/**
 * Classify each reading vs the one before it:
 *   - big jump up (≥ +4)   → intake logged
 *   - big drop  (≤ -4)     → missed command
 *   - otherwise            → command completed / holding
 * First reading always reads as `completed` (no prior to compare).
 */
function classify(curr: number, prev: number | undefined): DotKind {
  if (prev == null) return 'completed';
  const delta = curr - prev;
  if (delta >= 4) return 'intake';
  if (delta <= -4) return 'missed';
  return 'completed';
}

/**
 * Straight-segment line path — point-to-point, no curve smoothing.
 * Classic line-chart-with-markers feel.
 */
function linePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
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
  height = 220,
  weeklyCompliancePct,
  complianceStreak,
}: Props) {
  const innerW = Math.max(40, width - PADDING.left - PADDING.right);
  const innerH = Math.max(40, height - PADDING.top - PADDING.bottom);

  const { points, pathD, areaD, avg, trendDiff } = useMemo(() => {
    if (data.length === 0) {
      return {
        points: [] as { x: number; y: number; score: number; kind: DotKind }[],
        pathD: '',
        areaD: '',
        avg: 0,
        trendDiff: 0,
      };
    }
    const ts = data.map((d) => new Date(d.at).getTime());
    const tMin = ts[0];
    const tMax = ts[ts.length - 1];
    const tSpan = Math.max(1, tMax - tMin);

    const pts = data.map((d, i) => {
      const x =
        data.length === 1
          ? PADDING.left + innerW / 2
          : PADDING.left + ((ts[i] - tMin) / tSpan) * innerW;
      const y =
        PADDING.top +
        (1 - (d.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * innerH;
      const kind = classify(d.score, data[i - 1]?.score);
      return { x, y, score: d.score, kind };
    });

    const lineD = linePath(pts);
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

    return { points: pts, pathD: lineD, areaD: fillD, avg: avgScore, trendDiff: trend };
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

  // Tally dot kinds for the legend so the user knows what each color
  // represents at a glance — no separate help screen needed.
  const counts = points.reduce(
    (acc, p) => ({ ...acc, [p.kind]: acc[p.kind] + 1 }),
    { completed: 0, missed: 0, intake: 0 } as Record<DotKind, number>,
  );

  return (
    <View style={{ width }}>
      <Svg width={width} height={height}>
        <Defs>
          {/* Soft green area fill — single hue, low alpha, fades to
              transparent at the baseline. Calm, not saturated. */}
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={AREA_GREEN} stopOpacity="0.22" />
            <Stop offset="0.6" stopColor={AREA_GREEN} stopOpacity="0.07" />
            <Stop offset="1" stopColor={AREA_GREEN} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Quiet horizontal guides at the meaningful thresholds only. */}
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

        {/* Green area fill under the curve */}
        {areaD && <Path d={areaD} fill="url(#areaFill)" />}

        {/* Crisp white score line — single, clean stroke. No halo, no
            gradient, no esports glow. */}
        {pathD && (
          <Path
            d={pathD}
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={1.75}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Semantic dots — one per reading, color-coded by event kind. */}
        {points.map((p, i) => {
          const c = DOT[p.kind];
          return (
            <React.Fragment key={`dot-${i}`}>
              {/* Soft halo */}
              <Circle cx={p.x} cy={p.y} r={5.5} fill={c} opacity={0.18} />
              {/* Solid core with a thin black ring so the dot reads on
                  the line without competing with it. */}
              <Circle
                cx={p.x}
                cy={p.y}
                r={3.2}
                fill={c}
                stroke="#000"
                strokeWidth={1}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Dot legend — sentence case, monoline icons rendered as inline
          colored circles. Keeps the visual vocabulary self-explanatory. */}
      <View style={styles.dotLegend}>
        <LegendDot color={DOT.completed} label="Completed" count={counts.completed} />
        <LegendDot color={DOT.intake}    label="Intake"    count={counts.intake} />
        <LegendDot color={DOT.missed}    label="Missed"    count={counts.missed} />
      </View>

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

function LegendDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <View style={styles.legendDotRow}>
      <View style={[styles.legendDotSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendDotLabel}>{label}</Text>
      <Text style={styles.legendDotCount}>{count}</Text>
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
  dotLegend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 6,
    marginTop: 12,
  },
  legendDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.1,
  },
  legendDotCount: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
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
