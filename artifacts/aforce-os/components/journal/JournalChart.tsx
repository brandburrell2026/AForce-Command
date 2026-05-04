/**
 * Lightweight line chart for the Hydration Journal — score over time
 * with PEAK / BALANCED / RECOVERING / DEPLETED band color zones.
 *
 * Built on `react-native-svg` (already a dep). No external chart lib.
 *
 * Renders:
 *   - 4 horizontal band fills (PEAK >=85, BALANCED 65-85, RECOVERING 40-65, DEPLETED <40)
 *   - A polyline through every snapshot point
 *   - Y-axis tick marks (0 / 50 / 100)
 *   - "no data" placeholder when the series is empty
 *   - A 4-cell stat strip below the chart:
 *       AVG SCORE   — colored to match the band the avg falls in
 *       TREND       — ↑ / ↓ / —, derived from first-half vs second-half avg
 *       COMPLIANCE  — `weeklyCompliancePct` + %, lime
 *       STREAK      — `complianceStreak` + d, lime
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
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

const PADDING = { top: 12, right: 16, bottom: 22, left: 32 };
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const TREND_THRESHOLD = 3; // points of avg-delta to count as ↑ / ↓

// Band thresholds aligned with the PerformanceState bands used by the
// scoring engine.
const BANDS = [
  { from: 85, to: 100, color: 'rgba(180, 255, 80, 0.10)' },
  { from: 65, to: 85, color: 'rgba(0, 229, 200, 0.08)' },
  { from: 40, to: 65, color: 'rgba(255, 160, 30, 0.08)' },
  { from: 0, to: 40, color: 'rgba(255, 45, 85, 0.10)' },
];

/** Map a score (0..100) to the matching state-band color. */
function scoreBandColor(score: number): string {
  if (score >= 85) return Colors.states.PEAK.primary;
  if (score >= 65) return Colors.states.BALANCED.primary;
  if (score >= 40) return Colors.states.RECOVERING.primary;
  return Colors.states.DEPLETED.primary;
}

export default function JournalChart({
  data,
  width,
  height = 200,
  weeklyCompliancePct,
  complianceStreak,
}: Props) {
  const innerW = Math.max(40, width - PADDING.left - PADDING.right);
  const innerH = Math.max(40, height - PADDING.top - PADDING.bottom);

  const { pathD, avg, trendDiff } = useMemo(() => {
    if (data.length === 0) {
      return { pathD: '', avg: 0, trendDiff: 0 };
    }
    const ts = data.map((d) => new Date(d.at).getTime());
    const tMin = ts[0];
    const tMax = ts[ts.length - 1];
    const tSpan = Math.max(1, tMax - tMin);

    const xy = data.map((d, i) => {
      const x = PADDING.left + ((ts[i] - tMin) / tSpan) * innerW;
      const y = PADDING.top + (1 - (d.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * innerH;
      return { x, y };
    });
    const dStr = xy
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const sumScore = data.reduce((acc, d) => acc + d.score, 0);
    const avgScore = Math.round(sumScore / data.length);

    // Trend: first-half avg vs second-half avg.
    const mid = Math.floor(data.length / 2);
    let trend = 0;
    if (data.length >= 2 && mid > 0) {
      const firstHalf = data.slice(0, mid);
      const secondHalf = data.slice(mid);
      const firstAvg =
        firstHalf.reduce((a, d) => a + d.score, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((a, d) => a + d.score, 0) / secondHalf.length;
      trend = secondAvg - firstAvg;
    }
    return { pathD: dStr, avg: avgScore, trendDiff: trend };
  }, [data, innerH, innerW]);

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>—</Text>
      </View>
    );
  }

  // Map a score (0..100) to its y coordinate.
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
        {/* Band fills */}
        {BANDS.map((b, i) => {
          const yTop = yFor(b.to);
          const yBot = yFor(b.from);
          return (
            <Rect
              key={`band-${i}`}
              x={PADDING.left}
              y={yTop}
              width={innerW}
              height={Math.max(0, yBot - yTop)}
              fill={b.color}
            />
          );
        })}

        {/* Y-axis ticks (0 / 50 / 100) */}
        {[0, 50, 100].map((v) => (
          <React.Fragment key={`tick-${v}`}>
            <Line
              x1={PADDING.left}
              x2={PADDING.left + innerW}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <SvgText
              x={PADDING.left - 6}
              y={yFor(v) + 3}
              fontSize={9}
              fill="#5C6275"
              textAnchor="end"
            >
              {v}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Score polyline — soft white with a subtle outer glow */}
        <Path d={pathD} stroke="rgba(255,255,255,0.15)" strokeWidth={6} fill="none" />
        <Path d={pathD} stroke="rgba(255,255,255,0.9)" strokeWidth={2} fill="none" />
      </Svg>
      <View style={styles.legend}>
        <Text style={styles.legendCell}>
          <Text style={styles.legendK}>AVG SCORE </Text>
          <Text style={[styles.legendV, { color: avgColor }]}>{avg}</Text>
        </Text>
        <Text style={styles.legendCell}>
          <Text style={styles.legendK}>TREND </Text>
          <Text style={[styles.legendV, { color: trendColor }]}>{trendSymbol}</Text>
        </Text>
        <Text style={styles.legendCell}>
          <Text style={styles.legendK}>COMPLIANCE </Text>
          <Text style={[styles.legendV, { color: Colors.states.PEAK.primary }]}>{compliancePctClamped}%</Text>
        </Text>
        <Text style={styles.legendCell}>
          <Text style={styles.legendK}>STREAK </Text>
          <Text style={[styles.legendV, { color: Colors.states.PEAK.primary }]}>{streakClamped}d</Text>
        </Text>
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
    color: '#5C6275',
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  legendCell: {
    fontSize: 11,
  },
  legendK: {
    color: '#5C6275',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  legendV: {
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
});
