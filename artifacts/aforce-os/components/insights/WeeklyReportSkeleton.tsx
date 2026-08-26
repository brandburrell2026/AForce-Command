/**
 * WeeklyReportSkeleton (Wave 5) — WeeklyReportV3's loading shape.
 *
 * Week in Review waits on three sources at once (the analytics snapshot, the
 * journal rollups and the command ledger) and showed a bare centered
 * `ActivityIndicator` under the top bar for the whole wait — a near-empty
 * screen that gave no sense of what was being assembled, then replaced itself
 * wholesale. This shapes the sections the report ALWAYS renders: the completed-
 * week chip, the six-tile grid, and the two guidance banners.
 *
 * It deliberately does NOT shape the Performance Age card. That card renders
 * only when there is a real current age (`paView.currentAge != null`), so
 * outlining one here would promise a section a member without a Performance Age
 * baseline never receives — the same fabrication this screen's honest postures
 * exist to avoid. A skeleton may hold a shape; it may not invent one.
 *
 * Deliberately its own file, importing ONLY af.* tokens + `AFSkeleton` — no
 * store, router, analytics or ledger — so it can be render-tested in isolation
 * without pulling in `WeeklyReportV3.tsx`'s connected import graph, exactly like
 * `ReadinessInsightsSkeleton` / `HomeSkeleton` before it.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AFSkeleton } from '@/components/ui/AFSkeleton';
import { afLayout } from '@/theme';

/** Heights match the loaded elements they stand in for (see WeeklyReportV3). */
const CHIP_HEIGHT = 30;
const TILE_HEIGHT = 96;
const BANNER_HEIGHT = 66;

export function WeeklyReportSkeleton() {
  return (
    <View testID="weekly-v3-skeleton">
      <AFSkeleton
        width={190}
        height={CHIP_HEIGHT}
        radius={afLayout.radiusPill}
        style={styles.chip}
        testID="weekly-skeleton-chip"
      />
      <View style={styles.grid}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.gridRow}>
            <AFSkeleton height={TILE_HEIGHT} radius={14} style={styles.tile} testID={`weekly-skeleton-tile-${row * 2}`} />
            <AFSkeleton height={TILE_HEIGHT} radius={14} style={styles.tile} testID={`weekly-skeleton-tile-${row * 2 + 1}`} />
          </View>
        ))}
      </View>
      <AFSkeleton height={BANNER_HEIGHT} radius={14} style={styles.banner} testID="weekly-skeleton-banner-0" />
      <AFSkeleton height={BANNER_HEIGHT} radius={14} style={styles.banner} testID="weekly-skeleton-banner-1" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors WeeklyReportV3's chip / grid / banner spacing so the report fills
  // in where the blocks stood instead of shifting under the reader.
  chip: { marginTop: 14 },
  grid: { marginTop: 16, gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  banner: { marginTop: 16 },
});
