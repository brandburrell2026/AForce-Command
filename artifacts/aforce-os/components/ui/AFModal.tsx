/**
 * AFModal — thin accessibility wrapper over RN's `<Modal>` (RC-1 Wave-5,
 * a11y-breadth item 2).
 *
 * The RC-1 audit found 16 ungated `<Modal>` call sites (AddDrinkModal,
 * FlavorPickerModal, EditProfileModal, WaterAmountModal, SmartCaptureModal,
 * UpgradePrompt, ErrorFallback, ZoomableProductImage,
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
 * (`BiometricDetailSheet` — since retired with the legacy-Home orphan tree —
 * intentionally kept a plain RN `<Modal>` for its own #513 accessibility
 * semantics; the audit list above is a historical record.)
 */
import React from 'react';
import { Modal, View, StyleSheet, type ModalProps } from 'react-native';
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
  ...rest
}: AFModalProps) {
  const reduceMotion = useReducedMotion();
  const effectiveAnimationType =
    reduceMotion && animationType === 'fade' ? 'none' : animationType;

  return (
    <Modal animationType={effectiveAnimationType} {...rest}>
      <View style={styles.fill} accessibilityViewIsModal={accessibilityViewIsModal}>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
