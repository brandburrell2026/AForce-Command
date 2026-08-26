/**
 * SignalSkeleton (Wave 5) — PerformanceSignalV3's loading shape.
 *
 * The screen used to spend its whole fetch (plus, on a cold-launch auth race,
 * two retry backoffs) showing a bare centered `ActivityIndicator` on an
 * otherwise empty canvas: no indication of WHAT was arriving, and the moment it
 * landed the summary card and seven day rows appeared out of nothing. This
 * holds the real layout's shape — one raised summary card, seven day rows, the
 * week-detail control — so the history fills in rather than jumping in.
 *
 * Deliberately its own file, importing ONLY af.* tokens + `AFSkeleton` — no
 * store, router or `realApi` — so it can be render-tested in isolation without
 * pulling in `PerformanceSignalV3.tsx`'s connected import graph, exactly like
 * `HomeSkeleton` / `ReadinessInsightsSkeleton` / `ProviderSectionSkeleton`
 * before it (this repo never mounts connected screen containers in tests).
 *
 * Presentation-only and claim-free: a skeleton block asserts that something is
 * coming, never what its value will be.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AFSkeleton } from '@/components/ui/AFSkeleton';
import { afLayout, Spacing } from '@/theme';

/** Heights match the loaded elements they stand in for (see the styles). */
const SUMMARY_HEIGHT = 188;
const DAY_ROW_HEIGHT = 78;

export interface SignalSkeletonProps {
  /** Day rows to shape — the screen's own window length. */
  dayCount?: number;
}

export function SignalSkeleton({ dayCount = 7 }: SignalSkeletonProps) {
  return (
    <View testID="signal-v3-skeleton">
      <AFSkeleton
        height={SUMMARY_HEIGHT}
        radius={afLayout.radiusCard}
        style={styles.summary}
        testID="signal-skeleton-summary"
      />
      <View style={styles.dayList}>
        {Array.from({ length: dayCount }).map((_, i) => (
          <AFSkeleton
            key={i}
            height={DAY_ROW_HEIGHT}
            radius={afLayout.radiusCard}
            testID={`signal-skeleton-day-${i}`}
          />
        ))}
      </View>
      <AFSkeleton
        width={120}
        height={20}
        radius={6}
        style={styles.weekDetail}
        testID="signal-skeleton-week-detail"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors PerformanceSignalV3's summaryCard / dayList / weekDetailRow spacing
  // so nothing shifts vertically when the real content replaces this.
  summary: { marginTop: 20 },
  dayList: { marginTop: 24, gap: 14 },
  weekDetail: { marginTop: Spacing[5] },
});
