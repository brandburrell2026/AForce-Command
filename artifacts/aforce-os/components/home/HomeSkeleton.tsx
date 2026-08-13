/**
 * HomeSkeleton (RC-1 Wave-2B, item 2a) — HomeScreenV2's first-paint
 * pre-hydration skeleton. Shapes the arc + command card + three signal tiles
 * so the screen never flashes the store's local, synchronous initial guess
 * (mock data run through the scoring engine once, before the real
 * `/v1/home` round-trip resolves — see `store/useAppStore.tsx`'s
 * `isHydrated`) as if it were live data.
 *
 * Deliberately its own file, importing ONLY af.* tokens + `AFSkeleton` — no
 * store, router, or Clerk — so it can be render-tested in isolation without
 * pulling in the native-module-heavy import graph `HomeScreenV2.tsx` carries
 * (reanimated, expo-router, @clerk/expo), per this repo's established
 * convention of never mounting connected screen containers directly in
 * tests (see `components/home/__tests__/homeScreenV2Wiring.test.ts`'s
 * header).
 *
 * WAVE 5 — `signals` exists because a skeleton that does not match the layout
 * it stands in for is worse than none: it guarantees a jump. Home ships with
 * `home_v3_dashboard_enabled` ON, whose signal block is a 2×2 grid of FOUR
 * tiles (Hydration / Recovery / Sleep / HRV), while this shaped a single row of
 * three — so every cold open dropped one row of content on the reader at the
 * moment of hydration. The caller (which is the one that reads the flag) says
 * which layout is coming; the `row3` default keeps the legacy/V2 shape for
 * `app/(tabs)/index.tsx`'s lazy-legacy Suspense fallback.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AFSkeleton } from '@/components/ui/AFSkeleton';
import { afLayout } from '@/theme';

/** The two signal layouts HomeScreenV2 actually renders. */
export type HomeSkeletonSignals = 'row3' | 'grid4';

export interface HomeSkeletonProps {
  signals?: HomeSkeletonSignals;
}

export function HomeSkeleton({ signals = 'row3' }: HomeSkeletonProps) {
  // Tile testIDs stay 0-indexed and contiguous across both layouts, so the
  // grid is "the row-3 shape plus a fourth tile" rather than a second scheme.
  const rows = signals === 'grid4' ? [[0, 1], [2, 3]] : [[0, 1, 2]];
  return (
    <View testID="home-v2-skeleton" accessible accessibilityLabel="Loading">
      <View style={styles.arcWrap}>
        <AFSkeleton width={240} height={240} radius={120} testID="home-skeleton-arc" />
      </View>
      <AFSkeleton height={140} radius={afLayout.radiusCard} style={styles.command} testID="home-skeleton-command" />
      <View style={styles.signalsSection}>
        {rows.map((row, i) => (
          <View key={i} style={styles.signals}>
            {row.map((tile) => (
              <AFSkeleton
                key={tile}
                height={74}
                radius={14}
                style={styles.tile}
                testID={`home-skeleton-tile-${tile}`}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arcWrap: { alignItems: 'center', marginVertical: 24 },
  command: { marginTop: 4 },
  signalsSection: { marginTop: afLayout.sectionGap - 4, gap: 12 },
  signals: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
});
