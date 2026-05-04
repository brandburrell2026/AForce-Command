/**
 * Lightweight line chart for the Hydration Journal — score over time
 * with PEAK / BALANCED / RECOVERING / DEPLETED band color zones.
 *
 * Built on `react-native-svg` (already a dep). No external chart lib.
 *
 * Renders:
 *   - 4 horizontal band fills (PEAK >=85, BALANCED 65-85, RECOVERING 40-65, DEPLETED <40)
 *   - A polyline through every snapshot point
 *   - Min/Max/Avg axis labels
 *   - "no data" placeholder when the series is empty
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { JournalSnapshot } from '@/types';

interface Props {
  data: JournalSnapshot[];
  width: number;
  height?: number;
}

const PADDING = { top: 12, right: 16, bottom: 22, left: 32 };
const SCORE_MIN = 0;
const SCORE_MAX = 100;

// Band thresholds aligned with the PerformanceState bands used by the
// scoring engine.
const BANDS = [
  { from: 85, to: 100, color: 'rgba(180, 255, 80, 0.10)' },
  { from: 65, to: 85, color: 'rgba(0, 229, 200, 0.08)' },
  { from: 40, to: 65, color: 'rgba(255, 160, 30, 0.08)' },
  { from: 0, to: 40, color: 'rgba(255, 45, 85, 0.10)' },
];

export default function JournalChart({ data, width, height = 200 }: Props) {
  const innerW = Math.max(40, width - PADDING.left - PADDING.right);
  const innerH = Math.max(40, height - PADDING.top - PADDING.bottom);

  const { points, pathD, avg, minScore, maxScore } = useMemo(() => {
    if (data.length === 0) {
      return { points: [] as { x: number; y: number; s: JournalSnapshot }[], pathD: '', avg: 0, minScore: 0, maxScore: 0 };
    }
    const ts = data.map((d) => new Date(d.at).getTime());
    const tMin = ts[0];
    const tMax = ts[ts.length - 1];
    const tSpan = Math.max(1, tMax - tMin);

    const xy = data.map((d, i) => {
      const x = PADDING.left + ((ts[i] - tMin) / tSpan) * innerW;
      const y = PADDING.top + (1 - (d.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * innerH;
      return { x, y, s: d };
    });
    const dStr = xy
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const sumScore = data.reduce((acc, d) => acc + d.score, 0);
    return {
      points: xy,
      pathD: dStr,
      avg: Math.round(sumScore / data.length),
      minScore: Math.min(...data.map((d) => d.score)),
      maxScore: Math.max(...data.map((d) => d.score)),
    };
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
          <Text style={styles.legendK}>AVG </Text>
          <Text style={styles.legendV}>{avg}</Text>
        </Text>
        <Text style={styles.legendCell}>
          <Text style={styles.legendK}>MIN </Text>
          <Text style={styles.legendV}>{minScore}</Text>
        </Text>
        <Text style={styles.legendCell}>
          <Text style={styles.legendK}>MAX </Text>
          <Text style={styles.legendV}>{maxScore}</Text>
        </Text>
        <Text style={styles.legendCell}>
          <Text style={styles.legendK}>N </Text>
          <Text style={styles.legendV}>{points.length}</Text>
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
    color: '#B6FF00',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
});
