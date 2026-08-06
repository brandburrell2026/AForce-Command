/**
 * AFModal — thin accessibility wrapper over RN's `<Modal>` (RC-1 Wave-5,
 * a11y-breadth item 2).
 *
 * The RC-1 audit found 16 ungated `<Modal>` call sites (AddDrinkModal,
 * FlavorPickerModal, EditProfileModal, WaterAmountModal, SmartCaptureModal,
 * VoiceOverlay, UpgradePrompt, ErrorFallback, ZoomableProductImage,
 * InvestorDemoOverlay, AIVideoPlayer, HydrationScanScreen(V2)'s inline
 * picker, AFDisclosureSheet, RecoveryCircleMembersModal, CameraScanModal)
 * each hand-rolling `animationType` with no reduced-motion gate and no
 * explicit modal-region marker for VoiceOver/TalkBack. AFModal is a drop-in
 * replacement — same prop surface as RN's `Modal` — that adds exactly two
 * things:
 *
 *  1. `animationType="fade"` collapses to `"none"` when the OS reduce-motion
 *     setting is on (via the shared `useReducedMotion` hook — see its own
 *     doc-comment for why that's the one signal every motion surface should
 *     read). Scoped to `fade` only: a `slide` sheet's motion also carries
 *     positional meaning (where the sheet came from), so it is left as
 *     authored rather than collapsed to an abrupt appear/disappear.
 *  2. The modal content is wrapped in a `View` carrying
 *     `accessibilityViewIsModal` (default true), so a screen reader traps
 *     focus inside the overlay instead of letting a swipe gesture escape to
 *     the screen underneath.
 *
 * `BiometricDetailSheet` intentionally keeps rendering a plain RN `<Modal>`
 * — it already carries its own, more specific accessibility semantics from
 * #513 and re-wrapping it here would be a regression risk for no gain.
 */
import React, { useCallback, useRef } from 'react';
import { AccessibilityInfo, Modal, Platform, View, StyleSheet, findNodeHandle, type ModalProps } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface AFModalProps extends ModalProps {
  /** Marks the modal content as an accessibility-modal region. Default true. */
  accessibilityViewIsModal?: boolean;
  children?: React.ReactNode;
}

export function AFModal({
  animationType = 'none',
  accessibilityViewIsModal = true,
  children,
  onShow,
  ...rest
}: AFModalProps) {
  const reduceMotion = useReducedMotion();
  const effectiveAnimationType =
    reduceMotion && animationType === 'fade' ? 'none' : animationType;

  // VS 3.0 P1a — VoiceOver focus management. On show, move screen-reader focus
  // INTO the modal content. The audit found `setAccessibilityFocus` used zero
  // times app-wide: modals marked themselves modal but never pulled focus in,
  // so VoiceOver stayed on the now-inert screen behind them. Composes (never
  // drops) any caller-provided `onShow`. Native-guarded — `findNodeHandle`
  // returns null on web / before mount, in which case focus is left untouched.
  const fillRef = useRef<React.ElementRef<typeof View>>(null);
  const handleShow = useCallback(
    (event: Parameters<NonNullable<ModalProps['onShow']>>[0]) => {
      // Native only: `findNodeHandle` throws on web ("not supported"), and web
      // screen readers use DOM focus, not the RN accessibility-focus API. On
      // iOS/Android, pull VoiceOver/TalkBack focus into the modal content.
      if (Platform.OS !== 'web') {
        const node = findNodeHandle(fillRef.current);
        if (node != null) {
          AccessibilityInfo.setAccessibilityFocus(node);
        }
      }
      onShow?.(event);
    },
    [onShow],
  );

  return (
    <Modal animationType={effectiveAnimationType} {...rest} onShow={handleShow}>
      <View ref={fillRef} style={styles.fill} accessibilityViewIsModal={accessibilityViewIsModal}>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
