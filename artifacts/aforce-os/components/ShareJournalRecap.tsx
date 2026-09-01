/**
 * Share format: Performance Timeline Recap.
 *
 * Square (Instagram-grid) card that exports the user's actual journal
 * window — chart + summary stats — instead of the identity-headline
 * Card. Data comes from `journalShareCache`; if no payload is present
 * the component renders an empty placeholder (the format picker hides
 * the option in that case so this fallback is defensive).
 *
 * The chart uses the same SVG approach as `JournalChart` (bands +
 * polyline) but is sized for a fixed 1:1 export canvas so ViewShot
 * gets a deterministic snapshot regardless of device width.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors } from '@/theme/colors';
import type { JournalRollup } from '@/types';
import { computeRecapStats } from '@/utils/journalRecapStats';
import { spansModelBoundary } from '@/utils/scoring/modelBoundary';
import { segmentByModelVersion } from '@/utils/scoring/modelBoundary';
import { buildRecapSegmentPaths, dayVersion } from '@/utils/scoring/boundarySeries';


interface Props {
  rollups: readonly JournalRollup[];
  rangeDays: number;
}

const CARD_W = 360;
const CHART_W = CARD_W - 60;
const CHART_H = 110;
const PADDING = { top: 8, right: 4, bottom: 8, left: 4 };

const BANDS = [
  { from: 85, to: 100, color: 'rgba(180, 255, 80, 0.10)' },
  { from: 65, to: 85, color: 'rgba(0, 229, 200, 0.08)' },
  { from: 40, to: 65, color: 'rgba(255, 160, 30, 0.08)' },
  { from: 0, to: 40, color: 'rgba(255, 45, 85, 0.10)' },
];

export const ShareJournalRecap: React.FC<Props> = ({ rollups, rangeDays }) => {
  // An exported recap is the most durable artifact a member produces — it
  // outlives the app session and gets shared. It therefore carries the same
  // boundary guarantees as the in-app chart: no stroke across a recalibration,
  // and no headline average blended from two different measurements.
  const segments = useMemo(
    () => segmentByModelVersion(rollups, dayVersion),
    [rollups],
  );
  const crossesModelBoundary = useMemo(
    () => spansModelBoundary(rollups.map(dayVersion)),
    [rollups],
  );
  const statsScope = crossesModelBoundary
    ? (segments.at(-1)?.points ?? rollups)
    : rollups;
  const stats = useMemo(() => computeRecapStats(statsScope), [statsScope]);
  const innerW = CHART_W - PADDING.left - PADDING.right;
  const innerH = CHART_H - PADDING.top - PADDING.bottom;

  const pathDs = useMemo(
    () => buildRecapSegmentPaths(rollups, innerW, innerH, PADDING),
    [rollups, innerW, innerH],
  );

  const yFor = (score: number) => PADDING.top + (1 - score / 100) * innerH;

  return (
    <View style={styles.card} testID="share-journal-recap">
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.dot} />
          <Text style={styles.eyebrow}>AFORCE · {rangeDays}-DAY TIMELINE</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>{stats.avgScore}</Text>
        </View>
      </View>

      <View style={styles.chartWrap}>
        {rollups.length === 0 ? (
          <View style={[styles.emptyChart, { width: CHART_W, height: CHART_H }]}>
            <Text style={styles.emptyText}>No data yet</Text>
          </View>
        ) : (
          <Svg width={CHART_W} height={CHART_H}>
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
            {pathDs.map((d, i) => (
              <Path key={`seg-${i}`} d={d} stroke="#C1281B" strokeWidth={2} fill="none" />
            ))}
          </Svg>
        )}
      </View>

      <View style={styles.statsGrid}>
        <Stat k="AVG" v={String(stats.avgScore)} />
        <Stat k="PEAK AVG" v={String(stats.peakScore)} />
        <Stat k="DAYS" v={String(stats.daysTracked)} />
        <Stat k="STREAK" v={String(stats.bestStreak)} />
      </View>

      <View style={styles.statsRow}>
        <Stat k="OUNCES" v={String(stats.totalOunces)} wide />
        <Stat k="STICKS" v={String(stats.totalSticks)} wide />
      </View>

      <View style={styles.footer}>
        <Text style={styles.brand}>aforce.os</Text>
      </View>
    </View>
  );
};

const Stat: React.FC<{ k: string; v: string; wide?: boolean }> = ({ k, v, wide }) => (
  <View style={[styles.stat, wide && styles.statWide]}>
    <Text style={styles.statK}>{k}</Text>
    <Text style={styles.statV}>{v}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    aspectRatio: 1,
    backgroundColor: '#06070A',
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C1281B' },
  eyebrow: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(180,255,80,0.4)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scoreBadgeText: {
    color: '#C1281B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  chartWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    paddingVertical: 6,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#5C6275',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  statWide: {
    paddingVertical: 10,
  },
  statK: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  statV: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  footer: { alignItems: 'center' },
  brand: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
});

export default ShareJournalRecap;
