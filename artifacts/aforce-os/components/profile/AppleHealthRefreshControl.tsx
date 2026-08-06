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
 *     fixed-height "Checked just now" row that fades via opacity. It is
 *     NEVER added to or removed from layout, so it can never shift the
 *     card (zero layout shift on data arrival). `accessibilityLiveRegion`
 *     is Android-only (RN docs mark it `@platform android`), so build 47
 *     added the iOS equivalent below via
 *     `AccessibilityInfo.announceForAccessibility`, mirroring the
 *     established pattern in `RiskTimerDisplay.tsx` (~:44-79): fired only
 *     on the false→true transition, never on first mount (VoiceOver
 *     already reads the row when focus lands there).
 *  4. Pressed-state feedback via the house `AFMotionPressable` primitive
 *     (`afMotion.scale`), reduced-motion-safe by construction. The elite
 *     scale itself is gated behind caller-supplied `motionEnabled` (build
 *     47 — previously hardcoded on, making this the app's only live elite
 *     press-scale outside the `elite_motion_enabled` kill switch); ordinary
 *     `pressedStyle` opacity feedback is NOT gated by this and always
 *     applies (see `AFMotionPressable`'s `pressed ? pressedStyle : null`).
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, AccessibilityInfo, Platform } from 'react-native';
import { Icon } from '@/components/Icon';
import { af, afType } from '@/theme';
import { AFMotionPressable } from '@/components/ui/AFMotionPressable';

export interface AppleHealthRefreshControlProps {
  isRefreshing: boolean;
  showUpdatedConfirmation: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  updatedLabel: string;
  /** Elite motion on/off (usually `flags.elite_motion_enabled`). Default false → static press. */
  motionEnabled?: boolean;
  testID?: string;
}

export function AppleHealthRefreshControl({
  isRefreshing,
  showUpdatedConfirmation,
  onPress,
  accessibilityLabel,
  updatedLabel,
  motionEnabled = false,
  testID = 'profile-apple-refresh',
}: AppleHealthRefreshControlProps) {
  // iOS VoiceOver announcement for the completion confirmation — mirrors
  // `RiskTimerDisplay.tsx`'s ~:44-79 pattern exactly: Android's
  // `accessibilityLiveRegion="polite"` below is untouched (it already
  // works there); this is purely the iOS-only equivalent, fired on the
  // false→true transition only, never on first mount.
  const hasMountedRef = React.useRef(false);
  const wasVisibleRef = React.useRef(showUpdatedConfirmation);
  const updatedLabelRef = React.useRef(updatedLabel);
  updatedLabelRef.current = updatedLabel;

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      wasVisibleRef.current = showUpdatedConfirmation;
      return;
    }
    if (!wasVisibleRef.current && showUpdatedConfirmation) {
      AccessibilityInfo.announceForAccessibility(updatedLabelRef.current);
    }
    wasVisibleRef.current = showUpdatedConfirmation;
  }, [showUpdatedConfirmation]);

  return (
    <View style={styles.wrap}>
      <View style={styles.confirmationSlot} pointerEvents="none">
        <Text
          style={[styles.confirmationText, { opacity: showUpdatedConfirmation ? 1 : 0 }]}
          accessibilityLiveRegion="polite"
          accessibilityElementsHidden={!showUpdatedConfirmation}
          importantForAccessibility={showUpdatedConfirmation ? 'yes' : 'no-hide-descendants'}
          testID={`${testID}-confirmation`}
        >
          {updatedLabel}
        </Text>
      </View>
      <AFMotionPressable
        onPress={onPress}
        disabled={isRefreshing}
        motionEnabled={motionEnabled}
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
