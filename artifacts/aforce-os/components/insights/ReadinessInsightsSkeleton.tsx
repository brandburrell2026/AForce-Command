/**
 * ReadinessInsightsSkeleton (RC-1 Wave-2B, item 2c) — shown ONLY while
 * `ReadinessInsightsV2` has both (a) fewer than 2 days of score history AND
 * (b) its analytics snapshot fetch (`getAnalyticsSnapshot()`, landed in #531)
 * is still in flight. Distinct from the screen's designed, honest empty
 * state (`AFEmptyState` — "not enough data yet") which renders once the
 * fetch has settled and history is STILL short: this skeleton only covers
 * the brief real loading window, never permanently substitutes for the
 * honest-empty copy.
 *
 * Shapes the score hero + chart + drivers list. Deliberately its own file,
 * importing ONLY af.* tokens + `AFSkeleton` — no store/router — so it can be
 * render-tested in isolation without pulling in `ReadinessInsightsV2.tsx`'s
 * heavier import graph (store, router, weekly-report share pipeline), per
 * this repo's established convention of never mounting connected screen
 * containers directly in tests.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AFSkeleton } from '@/components/ui/AFSkeleton';
import { af, afLayout } from '@/theme';

export function ReadinessInsightsSkeleton() {
  return (
    <View testID="readiness-insights-skeleton" accessible accessibilityLabel="Loading">
      <View style={styles.hero}>
        <AFSkeleton width={140} height={64} radius={12} testID="ri-skeleton-score" />
      </View>
      <AFSkeleton height={140} radius={afLayout.radiusCard} style={styles.chart} testID="ri-skeleton-chart" />
      <View style={styles.drivers}>
        <AFSkeleton height={18} width={120} radius={6} style={styles.label} testID="ri-skeleton-label" />
        <View style={styles.driversCard}>
          <AFSkeleton height={44} radius={0} testID="ri-skeleton-driver-0" />
          <AFSkeleton height={44} radius={0} testID="ri-skeleton-driver-1" />
          <AFSkeleton height={44} radius={0} testID="ri-skeleton-driver-2" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 24 },
  chart: { marginTop: 28 },
  drivers: { marginTop: 28, gap: 12 },
  label: { marginBottom: 2 },
  driversCard: {
    borderRadius: afLayout.radiusCard,
    borderWidth: 1,
    borderColor: af.divider,
    overflow: 'hidden',
  },
});
