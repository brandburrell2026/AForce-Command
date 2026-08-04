/**
 * ProviderSectionSkeleton (RC-1 Wave-2B, item 2b) — shown while
 * `ProfileScreenV2`'s mount-time WHOOP + Garmin connection-status checks are
 * both still in flight (`!whoopStatusChecked || !garminStatusChecked`).
 * Shapes N rows to roughly match the real provider-row layout (icon + two
 * text lines + status pill) so the list doesn't visually jump once the real
 * rows land.
 *
 * Deliberately its own file, importing ONLY af.* tokens + `AFSkeleton` — no
 * store, router, or the WHOOP/Garmin/Apple Health service modules — so it
 * can be render-tested in isolation without pulling in
 * `ProfileScreenV2.tsx`'s much heavier import graph, per this repo's
 * established convention of never mounting connected screen containers
 * directly in tests.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AFSkeleton } from '@/components/ui/AFSkeleton';
import { af } from '@/theme';

export interface ProviderSectionSkeletonProps {
  count: number;
}

export function ProviderSectionSkeleton({ count }: ProviderSectionSkeletonProps) {
  return (
    <View testID="profile-provider-skeleton" accessible accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          <View style={styles.row}>
            <AFSkeleton width={34} height={34} radius={10} testID={`profile-provider-skeleton-icon-${i}`} />
            <View style={styles.body}>
              <AFSkeleton width="55%" height={13} radius={4} />
              <AFSkeleton width="35%" height={11} radius={4} style={styles.secondLine} />
            </View>
            <AFSkeleton width={64} height={20} radius={10} />
          </View>
          {i < count - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  body: { flex: 1, gap: 2 },
  secondLine: { marginTop: 6 },
  divider: { height: 1, backgroundColor: af.divider, marginHorizontal: 16 },
});
