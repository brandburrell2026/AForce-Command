/**
 * HydrationHistory — the History section of the Hydration tab, as in the
 * approved prototype: a Week / Month switch and one bar per day against the
 * starting target.
 *
 * `HydrationHistoryChart` is presentation only. `HydrationHistory` loads the
 * days through the existing read-only daily-totals request and fails softly:
 * if the totals cannot be read, the section is not drawn. It never writes.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { af } from '@/theme';
import { fetchJournalRollups } from '@/services/realApi';
import { dayKey, historyBars, historyTargetLine, type HistoryBar, type HistoryRange } from './hydrationHistoryLogic';

const CHART_HEIGHT = 112;
const MONO = 'IBMPlexMono_400Regular';

export interface HydrationHistoryChartProps {
  range: HistoryRange;
  onRange: (r: HistoryRange) => void;
  bars: HistoryBar[];
  targetOz: number;
  targetLine: number;
  /** Opens the full history screen. The chart is the control, as nothing else on the reference screen is. */
  onOpen?: () => void;
  openLabel?: string;
  openTestID?: string;
}

export function HydrationHistoryChart({ range, onRange, bars, targetOz, targetLine, onOpen, openLabel, openTestID }: HydrationHistoryChartProps) {
  return (
    <View testID="hydration-history">
      <View style={styles.head}>
        <Text style={styles.eyebrow}>HISTORY</Text>
        <View style={styles.seg} accessibilityRole="tablist">
          {(['Week', 'Month'] as const).map((k) => {
            const on = range === k;
            return (
              <Pressable
                key={k}
                onPress={() => onRange(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.segItem, on && styles.segItemOn]}
                testID={`hydration-history-${k.toLowerCase()}`}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>{k}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        style={styles.card}
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={openLabel}
        testID={openTestID}
      >
        <View style={styles.plot}>
          {targetLine > 0 ? (
            <View style={[styles.targetLine, { bottom: targetLine * CHART_HEIGHT }]} pointerEvents="none">
              <Text style={styles.targetLabel}>{`${Math.round(targetOz)} OZ`}</Text>
            </View>
          ) : null}
          <View style={styles.bars}>
            {bars.map((b) => (
              <View
                key={b.date}
                style={styles.col}
                accessible
                accessibilityLabel={b.oz == null ? `${b.date}, nothing recorded` : `${b.date}, ${b.oz} ounces`}
              >
                <View
                  style={[
                    styles.bar,
                    range === 'Month' && styles.barThin,
                    { height: b.oz == null ? 3 : Math.max(3, b.height * CHART_HEIGHT) },
                    b.oz == null ? styles.barEmpty : b.metTarget ? styles.barMet : styles.barUnder,
                    b.isToday && styles.barToday,
                  ]}
                />
              </View>
            ))}
          </View>
        </View>
        {range === 'Week' ? (
          <View style={styles.labels}>
            {bars.map((b) => (
              <Text key={b.date} style={styles.dayLabel}>{b.label}</Text>
            ))}
          </View>
        ) : null}
      </Pressable>
      <Text style={styles.note}>
        Bars show what you logged against your starting target. Missed days aren't flagged.
      </Text>
    </View>
  );
}

export function HydrationHistory({
  targetOz,
  todayOz,
  onOpen,
  openLabel,
  openTestID,
}: {
  targetOz: number;
  todayOz: number;
  onOpen?: () => void;
  openLabel?: string;
  openTestID?: string;
}) {
  const [range, setRange] = React.useState<HistoryRange>('Week');
  const [days, setDays] = React.useState<{ date: string; oz: number | null }[] | null>(null);

  React.useEffect(() => {
    let live = true;
    fetchJournalRollups(30)
      .then((rows) => {
        if (!live) return;
        setDays(rows.map((r) => ({ date: r.date, oz: r.snapshotsCount > 0 ? r.endOzConsumed : null })));
      })
      .catch(() => {
        // Unavailable is not "no data": the section is simply not drawn.
        if (live) setDays(null);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!days || days.length === 0) return null;
  const bars = historyBars(days, targetOz, dayKey(new Date()), todayOz, range);
  return (
    <HydrationHistoryChart
      range={range}
      onRange={setRange}
      bars={bars}
      targetOz={targetOz}
      targetLine={historyTargetLine(bars, targetOz)}
      onOpen={onOpen}
      openLabel={openLabel}
      openTestID={openTestID}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: af.border, borderRadius: 999, padding: 3, gap: 2 },
  segItem: { minHeight: 30, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: af.primaryFill },
  segText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: af.textSecondary },
  segTextOn: { color: af.onPrimaryFill, fontFamily: 'Inter_600SemiBold' },
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 12 },
  plot: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderTopColor: af.border, borderStyle: 'dashed', alignItems: 'flex-end' },
  targetLabel: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: af.textTertiary, marginTop: -14 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 4 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_HEIGHT },
  bar: { width: 22, borderRadius: 5 },
  barThin: { width: 5, borderRadius: 2.5 },
  barMet: { backgroundColor: af.textPrimary },
  barUnder: { backgroundColor: af.textTertiary },
  barEmpty: { backgroundColor: af.surfacePressed },
  barToday: { backgroundColor: af.textPrimary, borderWidth: 2, borderColor: af.surfacePressed },
  labels: { flexDirection: 'row', gap: 4, marginTop: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 9.5, letterSpacing: 1, color: af.textTertiary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary, marginTop: 10 },
});
