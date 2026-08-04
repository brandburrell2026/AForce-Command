/**
 * BiometricDetailSheet — bottom-sheet modal that reveals the full
 * Sweat Loss / Performance Forecast / Recovery Load card when the
 * user taps the matching tile in EntryActions.
 *
 * The cards themselves are unchanged — this sheet just hosts a single
 * BiometricCard payload chosen by the caller.
 */

import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { BiometricCard, type BiometricFooterMetric } from './BiometricCard';
import { Icon, type IconName } from '../Icon';
import { Colors } from '../../theme/colors';

export interface BiometricSheetPayload {
  eyebrow: string;
  accent: string;
  icon: IconName;
  heroValue: string;
  heroLabel: string;
  subline?: string;
  metrics?: BiometricFooterMetric[];
  confidence?: 'high' | 'low';
  /** Optional accent-tinted CTA rendered above the close button. */
  primaryAction?: {
    label: string;
    icon?: IconName;
    onPress: () => void;
  };
}

interface Props {
  visible: boolean;
  payload: BiometricSheetPayload | null;
  onDismiss: () => void;
}

export function BiometricDetailSheet({ visible, payload, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/*
       * A11y fix (Squad-F HIGH #4): the backdrop used to be a single
       * Pressable that WRAPPED the entire sheet subtree — VoiceOver/TalkBack
       * then collapsed the whole modal into one "Dismiss" button and the
       * sheet's own controls (card, primary action, Close) were never
       * individually reachable. The backdrop is now its own sibling element
       * positioned BEHIND the sheet (absolute-fill, painted first), so it
       * still dismisses on an outside tap but no longer owns the sheet's
       * accessibility tree. `accessibilityViewIsModal` on the sheet
       * constrains screen-reader navigation to the sheet's content while open.
       */}
      <View style={styles.backdropContainer}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          {payload ? (
            <BiometricCard
              eyebrow={payload.eyebrow}
              accent={payload.accent}
              icon={payload.icon}
              heroValue={payload.heroValue}
              heroLabel={payload.heroLabel}
              subline={payload.subline}
              metrics={payload.metrics}
              confidence={payload.confidence}
              testID="biometric-detail-card"
            />
          ) : null}
          {payload?.primaryAction ? (
            <Pressable
              onPress={() => {
                payload.primaryAction?.onPress();
                onDismiss();
              }}
              style={[styles.primaryBtn, { borderColor: payload.accent }]}
              accessibilityRole="button"
              accessibilityLabel={payload.primaryAction.label}
              testID="biometric-detail-primary"
            >
              {payload.primaryAction.icon ? (
                <Icon name={payload.primaryAction.icon} size={16} color={payload.accent} />
              ) : null}
              <Text style={[styles.primaryText, { color: payload.accent }]}>
                {payload.primaryAction.label.toUpperCase()}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onDismiss}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="biometric-detail-close"
          >
            <Icon name="x" size={16} color={Colors.text.secondary} />
            <Text style={styles.closeText}>CLOSE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? { cursor: 'default' as any } : null),
  },
  sheet: {
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.medium,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.strong,
    alignSelf: 'center',
    marginBottom: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  primaryText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 2.4,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.medium,
  },
  closeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.2,
    color: Colors.text.secondary,
  },
});
