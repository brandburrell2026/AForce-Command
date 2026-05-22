/**
 * HeatmapCalendar — constellation-style daily heatmap.
 *
 * Each active day is rendered as a glowing dot positioned on a faint
 * grid (week columns × day-of-week rows). Color encodes the day's
 * primary state:
 *   • cyan  — completed / intake (avgScore ≥ 65)
 *   • amber — missed             (avgScore < 65)
 *
 * Top 2-3 standout days (highest scores) get a thin ring + label so the
 * eye is drawn to peaks without crowding the rest of the chart.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import type { JournalRollup } from '@/types';
import { Colors } from '@/theme/colors';

const PALETTE = {
  good:   Colors.states.BALANCED.primary,   // cyan
  miss:   Colors.states.RECOVERING.primary, // amber
} as const;

interface Props {
  rollups: JournalRollup[];
}

const COLS_TARGET = 10;      // grid columns
const ROWS = 7;              // weekdays
const PADDING = { top: 18, right: 18, bottom: 18, left: 18 };
const HEIGHT = 220;

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

interface DotData {
  date: string;
  state: 'good' | 'miss';
  score: number;
  col: number;
  row: number;
  rank: number; // 0 = highest score, 1 = second, etc.
}

export default function HeatmapCalendar({ rollups }: Props) {
  const [containerW, setContainerW] = React.useState(0);

  const dots = useMemo<DotData[]>(() => {
    if (rollups.length === 0) return [];
    const sorted = [...rollups].sort((a, b) => a.date.localeCompare(b.date));
    const active = sorted.filter((r) => r.snapshotsCount > 0);
    // Sort by score desc for ranking the standouts.
    const ranking = new Map<string, number>();
    [...active]
      .sort((a, b) => b.avgScore - a.avgScore)
      .forEach((r, i) => ranking.set(r.date, i));
    return active.map((r) => {
      const d = parseDate(r.date);
      const dayIdx = Math.floor(
        (d.getTime() - parseDate(sorted[0].date).getTime()) /
          (24 * 3600 * 1000),
      );
      const col = Math.floor(dayIdx / ROWS);
      const row = dayIdx % ROWS;
      return {
        date: r.date,
        state: r.avgScore >= 65 ? 'good' : 'miss',
        score: r.avgScore,
        col,
        row,
        rank: ranking.get(r.date) ?? 999,
      };
    });
  }, [rollups]);

  if (dots.length === 0) return null;

  const maxCol = Math.max(COLS_TARGET - 1, ...dots.map((d) => d.col));
  const cols = maxCol + 1;
  const innerW = Math.max(40, containerW - PADDING.left - PADDING.right);
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;
  const cellW = cols > 1 ? innerW / (cols - 1) : innerW;
  const cellH = ROWS > 1 ? innerH / (ROWS - 1) : innerH;

  const totals = dots.reduce(
    (acc, d) => ({ ...acc, [d.state]: acc[d.state] + 1 }),
    { good: 0, miss: 0 },
  );

  // Show up to 3 standout labels: the top-scoring day(s). Filter to
  // only those with rank < 3 AND score >= 80 so we don't label a
  // mediocre "best of a bad week".
  const labels = dots.filter((d) => d.rank < 3 && d.score >= 80);

  return (
    <View
      style={styles.card}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width - 32)}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Consistency map</Text>
        <Text style={styles.sub}>
          {totals.good} on · {totals.miss} missed
        </Text>
      </View>

      {containerW > 0 && (
        <Svg width={containerW} height={HEIGHT}>
          {/* Faint grid */}
          {Array.from({ length: cols }).map((_, c) => (
            <Line
              key={`v-${c}`}
              x1={PADDING.left + c * cellW}
              x2={PADDING.left + c * cellW}
              y1={PADDING.top}
              y2={PADDING.top + innerH}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: ROWS }).map((_, r) => (
            <Line
              key={`h-${r}`}
              x1={PADDING.left}
              x2={PADDING.left + innerW}
              y1={PADDING.top + r * cellH}
              y2={PADDING.top + r * cellH}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}

          {/* Dots with soft halo */}
          {dots.map((d) => {
            const cx = PADDING.left + d.col * cellW;
            const cy = PADDING.top + d.row * cellH;
            const color = PALETTE[d.state];
            const isStandout = labels.includes(d);
            return (
              <React.Fragment key={d.date}>
                {/* Outer halo */}
                <Circle cx={cx} cy={cy} r={14} fill={color} opacity={0.08} />
                {/* Mid halo */}
                <Circle cx={cx} cy={cy} r={9} fill={color} opacity={0.18} />
                {/* Core */}
                <Circle cx={cx} cy={cy} r={4.5} fill={color} />
                {/* Thin ring around standouts */}
                {isStandout && (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={1}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Labels for standout days */}
          {labels.map((d) => {
            const cx = PADDING.left + d.col * cellW;
            const cy = PADDING.top + d.row * cellH;
            const labelText = `${shortDate(d.date)} · ${d.score}`;
            // Place label above-right of the dot, but flip to above-left
            // when the dot is close to the right edge to avoid clipping.
            const flipLeft = cx > PADDING.left + innerW - 80;
            const tx = flipLeft ? cx - 14 : cx + 14;
            const ty = cy - 12;
            return (
              <SvgText
                key={`label-${d.date}`}
                x={tx}
                y={ty}
                fontSize={11}
                fontWeight="600"
                fill="rgba(255,255,255,0.92)"
                textAnchor={flipLeft ? 'end' : 'start'}
              >
                {labelText}
              </SvgText>
            );
          })}
        </Svg>
      )}

      <View style={styles.legend}>
        <LegendDot color={PALETTE.good} label="On track" />
        <LegendDot color={PALETTE.miss} label="Missed" />
      </View>
    </View>
  );
}

function shortDate(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  sub: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.1,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
  },
});
