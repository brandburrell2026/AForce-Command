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
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AFSkeleton } from '@/components/ui/AFSkeleton';
import { afLayout } from '@/theme';

export function HomeSkeleton() {
  return (
    <View testID="home-v2-skeleton" accessible accessibilityLabel="Loading">
      <View style={styles.arcWrap}>
        <AFSkeleton width={240} height={240} radius={120} testID="home-skeleton-arc" />
      </View>
      <AFSkeleton height={140} radius={afLayout.radiusCard} style={styles.command} testID="home-skeleton-command" />
      <View style={styles.signalsSection}>
        <View style={styles.signals}>
          <AFSkeleton height={74} radius={14} style={styles.tile} testID="home-skeleton-tile-0" />
          <AFSkeleton height={74} radius={14} style={styles.tile} testID="home-skeleton-tile-1" />
          <AFSkeleton height={74} radius={14} style={styles.tile} testID="home-skeleton-tile-2" />
        </View>
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
