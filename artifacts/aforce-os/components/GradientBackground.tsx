/**
 * GradientBackground — the AForce canvas. Black Issue (2026-10-06): a flat
 * Cinematic Black field; the former red/blue ambient glow bleeds are gone so
 * every screen sits on the same #0D0D0D the cards and hairlines were tuned
 * against. The name is kept so the 40+ call sites do not churn.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  children: React.ReactNode;
}

export function GradientBackground({ children }: Props) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
  },
});
