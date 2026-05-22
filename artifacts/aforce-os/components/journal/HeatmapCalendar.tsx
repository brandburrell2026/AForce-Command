/**
 * HeatmapCalendar — GitHub-contribution-style daily heatmap.
 *
 * Each cell is one day from the rollup window. Color encodes the day's
 * primary state:
 *   • completed (lime)   — avgScore ≥ 85
 *   • intake    (cyan)   — 65 ≤ avgScore < 85
 *   • missed    (amber)  — 0 < avgScore < 65
 *   • inactive  (gray)   — no snapshots that day
 *
 * Cells are arranged in week columns (oldest left → newest right) with
 * day-of-week rows so the grid reads like a calendar. Touch reveals the
 * tap-highlight via Pressable's built-in fade.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JournalRollup } from '@/types';
import { Colors } from '@/theme/colors';

const PALETTE = {
  completed: Colors.states.PEAK.primary,
  intake:    Colors.states.BALANCED.primary,
  missed:    Colors.states.RECOVERING.primary,
  inactive:  'rgba(255,255,255,0.06)',
} as const;

type DayState = keyof typeof PALETTE;

interface Props {
  rollups: JournalRollup[];
}

function classify(r: JournalRollup): DayState {
  if (r.snapshotsCount === 0) return 'inactive';
  if (r.avgScore >= 85) return 'completed';
  if (r.avgScore >= 65) return 'intake';
  return 'missed';
}

// Parse a YYYY-MM-DD into a Date in local time without timezone drift.
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export default function HeatmapCalendar({ rollups }: Props) {
  const { weeks, totals } = useMemo(() => {
    if (rollups.length === 0) {
      return { weeks: [] as ({ date: string; state: DayState } | null)[][], totals: { completed: 0, intake: 0, missed: 0, inactive: 0 } };
    }
    const sorted = [...rollups].sort((a, b) => a.date.localeCompare(b.date));
    const first = parseDate(sorted[0].date);
    // Align the first column to the start of its calendar week (Sunday).
    const padStart = first.getDay();
    const cells: ({ date: string; state: DayState } | null)[] = [];
    for (let i = 0; i < padStart; i++) cells.push(null);
    const counts = { completed: 0, intake: 0, missed: 0, inactive: 0 };
    sorted.forEach((r) => {
      const state = classify(r);
      counts[state]++;
      cells.push({ date: r.date, state });
    });
    // Chunk cells into week columns of 7.
    const cols: ({ date: string; state: DayState } | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
    // Pad the last column to 7 rows so the grid stays rectangular.
    const last = cols[cols.length - 1];
    while (last && last.length < 7) last.push(null);
    return { weeks: cols, totals: counts };
  }, [rollups]);

  if (weeks.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Consistency map</Text>
        <Text style={styles.sub}>{totals.completed + totals.intake} active · {totals.missed} missed</Text>
      </View>

      <View style={styles.grid}>
        {weeks.map((col, ci) => (
          <View key={`col-${ci}`} style={styles.col}>
            {col.map((cell, ri) => (
              <Pressable
                key={`cell-${ci}-${ri}`}
                accessibilityLabel={cell ? `${cell.date} ${cell.state}` : 'inactive'}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    backgroundColor: cell ? PALETTE[cell.state] : 'transparent',
                    opacity: pressed ? 0.7 : cell?.state === 'inactive' ? 0.5 : 1,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendDot color={PALETTE.completed} label="Completed" />
        <LegendDot color={PALETTE.intake}    label="Intake" />
        <LegendDot color={PALETTE.missed}    label="Missed" />
        <LegendDot color="rgba(255,255,255,0.15)" label="Inactive" />
      </View>
    </View>
  );
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
    marginBottom: 14,
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
  grid: {
    flexDirection: 'row',
    gap: 5,
  },
  col: {
    gap: 5,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 14,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.1,
  },
});
