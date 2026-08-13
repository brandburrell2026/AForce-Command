/**
 * MomentsSkeleton (Wave 5) — the loading shapes for the two Moments surfaces
 * that used to render a claim, or nothing at all, while the store hydrated.
 *
 * `MomentsOverviewSkeleton` replaces the overview's flash of the "No moments
 * yet" empty state: `useMomentsData` reports `hydrated: false` until AsyncStorage
 * answers, and an unhydrated store's `surfaced` list is empty for the same
 * reason an unasked question has no answer. Telling a member with a full day
 * that their day is empty — then taking it back a frame later — is the
 * loading-state-as-fabrication the Wave-5 pass exists to remove. Empty is a
 * conclusion; it has to be earned.
 *
 * `MomentRitualSkeleton` replaces `app/moment/[id]`'s `return null` — a deep
 * link straight to a moment rendered a genuinely BLANK screen for the length of
 * that same hydration, which reads as a crash rather than a wait.
 *
 * Deliberately its own file, importing ONLY af.* tokens + `AFSkeleton` — no
 * store, router or moments services — so both shapes can be render-tested in
 * isolation, per this repo's convention (HomeSkeleton, ReadinessInsightsSkeleton,
 * ProviderSectionSkeleton).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AFSkeleton } from '@/components/ui/AFSkeleton';
import { afLayout, Spacing } from '@/theme';

/** Heights match the loaded elements these stand in for. */
const SUMMARY_HEIGHT = 150;
const UP_NEXT_HEIGHT = 210;
const LATER_ROW_HEIGHT = 44;
const STAGE_HEIGHT = 72;

export function MomentsOverviewSkeleton() {
  return (
    <View testID="moments-skeleton" accessible accessibilityLabel="Loading">
      <AFSkeleton
        height={SUMMARY_HEIGHT}
        radius={afLayout.radiusCard}
        style={styles.summary}
        testID="moments-skeleton-summary"
      />
      <AFSkeleton height={14} width={90} radius={4} style={styles.sectionLabel} />
      <AFSkeleton
        height={UP_NEXT_HEIGHT}
        radius={afLayout.radiusCard}
        style={styles.upNext}
        testID="moments-skeleton-up-next"
      />
      <View style={styles.laterRows}>
        <AFSkeleton height={LATER_ROW_HEIGHT} radius={8} />
        <AFSkeleton height={LATER_ROW_HEIGHT} radius={8} />
      </View>
    </View>
  );
}

export function MomentRitualSkeleton() {
  return (
    <View testID="moment-ritual-skeleton" accessible accessibilityLabel="Loading">
      <AFSkeleton height={22} width="70%" radius={6} style={styles.summary} />
      <AFSkeleton height={14} width="40%" radius={4} style={styles.sectionLabel} />
      <View style={styles.stages}>
        {[0, 1, 2, 3].map((i) => (
          <AFSkeleton
            key={i}
            height={STAGE_HEIGHT}
            radius={afLayout.radiusCard}
            testID={`moment-ritual-skeleton-stage-${i}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginTop: 16 },
  sectionLabel: { marginTop: Spacing[6] },
  upNext: { marginTop: 12 },
  laterRows: { marginTop: 20, gap: 12 },
  stages: { marginTop: 12, gap: 12 },
});
