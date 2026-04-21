/**
 * AdaptiveScreenWrapper — Centers screen content inside a max-width
 * column on wide devices (Galaxy Fold open, tablets, web) so the
 * AForce design language never looks stretched edge-to-edge.
 *
 * On phone-class widths the wrapper is a no-op (full width). On wider
 * displays it caps the content column at `contentMaxWidth` from the
 * responsive layout tokens and centers it horizontally.
 *
 * This is a pure layout primitive — it does not own padding, gutters,
 * or safe-area handling. Drop it just inside your screen's outermost
 * View and let existing children render normally.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface Props {
  children: React.ReactNode;
  /** Override the max width derived from the device class if needed. */
  maxWidth?: number;
  style?: ViewStyle;
}

export function AdaptiveScreenWrapper({ children, maxWidth, style }: Props) {
  const { contentMaxWidth, isWide } = useResponsiveLayout();
  const cap = maxWidth ?? contentMaxWidth;

  // On phones we render a transparent passthrough so existing layouts
  // (which already assume full screen width) stay pixel-identical.
  if (!isWide) {
    return <View style={[styles.full, style]}>{children}</View>;
  }

  return (
    <View style={[styles.wideOuter, style]}>
      <View style={[styles.wideInner, { maxWidth: cap }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  wideOuter: { flex: 1, alignItems: 'center' },
  wideInner: { flex: 1, width: '100%' },
});
