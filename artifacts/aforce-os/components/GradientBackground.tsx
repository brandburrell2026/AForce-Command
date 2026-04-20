/**
 * GradientBackground — Premium dark navy to deep purple background.
 * Used as a base layer for all screens.
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface Props {
  children: React.ReactNode;
}

export function GradientBackground({ children }: Props) {
  return (
    <View style={styles.container}>
      {/* Base dark background */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.background.primary }]} />

      {/* Top radial-like glow — simulated with circles */}
      <View style={styles.topGlow} />
      <View style={styles.midGlow} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(70, 30, 120, 0.18)',
  },
  midGlow: {
    position: 'absolute',
    top: height * 0.3,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(20, 20, 80, 0.15)',
  },
});
