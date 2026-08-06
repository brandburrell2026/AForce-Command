/**
 * AppleHealthRefreshControl (RC-2 Apple Health refresh feedback fix).
 *
 * TestFlight build 45 defect: the refresh icon on the "Live from Apple
 * Health" panel was wired correctly (44pt hit target via `hitSlop`, the
 * RC-1 fix) but gave NO visible feedback. A HealthKit re-read completes in
 * well under a second and usually returns byte-identical values, so a tap
 * looked like nothing happened — a feedback vacuum, not a dead button.
 *
 * Pure presentation, driven entirely by props — no store, router, or the
 * Apple Health service module — so it can be render-tested in isolation,
 * per this repo's established convention of never mounting connected
 * screen containers directly in tests (see `ProviderSectionSkeleton.tsx`'s
 * header, `WhoopSnapshotCard.tsx`'s header).
 *
 * Four things this renders:
 *  1. Visible in-flight state — swaps the icon for an `ActivityIndicator`
 *     while `isRefreshing` (the same primitive `AFButton` already uses for
 *     its own loading state; no new spin animation invented).
 *  2. Duplicate-tap guard, reflected in the UI — `disabled` while
 *     `isRefreshing`, dimmed via `AFMotionPressable`'s `pressedStyle`. The
 *     guard itself is `appleRefreshGuard.ts`, owned by the caller
 *     (`ProfileScreenV2.tsx`); this component only reflects `isRefreshing`.
 *  3. Completion feedback that fires even on byte-identical data — a
 *     fixed-height "Updated just now" row that fades via opacity. It is
 *     NEVER added to or removed from layout, so it can never shift the
 *     card (zero layout shift on data arrival).
 *  4. Pressed-state feedback via the house `AFMotionPressable` primitive
 *     (`afMotion.scale`), reduced-motion-safe by construction.
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '@/components/Icon';
import { af, afType } from '@/theme';
import { AFMotionPressable } from '@/components/ui/AFMotionPressable';

export interface AppleHealthRefreshControlProps {
  isRefreshing: boolean;
  showUpdatedConfirmation: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  updatedLabel: string;
  testID?: string;
}

export function AppleHealthRefreshControl({
  isRefreshing,
  showUpdatedConfirmation,
  onPress,
  accessibilityLabel,
  updatedLabel,
  testID = 'profile-apple-refresh',
}: AppleHealthRefreshControlProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.confirmationSlot} pointerEvents="none">
        <Text
          style={[styles.confirmationText, { opacity: showUpdatedConfirmation ? 1 : 0 }]}
          accessibilityLiveRegion="polite"
          importantForAccessibility={showUpdatedConfirmation ? 'yes' : 'no-hide-descendants'}
          testID={`${testID}-confirmation`}
        >
          {updatedLabel}
        </Text>
      </View>
      <AFMotionPressable
        onPress={onPress}
        disabled={isRefreshing}
        motionEnabled
        style={styles.hit}
        pressedStyle={styles.pressed}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isRefreshing, busy: isRefreshing }}
        testID={testID}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={af.textSecondary} testID={`${testID}-spinner`} />
        ) : (
          <Icon name="refresh-cw" size={12} color={af.textSecondary} />
        )}
      </AFMotionPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hit: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  // Fixed height so the confirmation fading in/out never shifts the card
  // (zero layout shift) — always mounted, only its opacity/a11y visibility
  // toggle.
  confirmationSlot: { height: 14, justifyContent: 'center' },
  confirmationText: { ...afType.caption, fontSize: 10, lineHeight: 14, color: af.textTertiary },
});
