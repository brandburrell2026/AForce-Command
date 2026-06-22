/**
 * GradientBackground — WHOOP-cinematic pure black canvas.
 * Subtle ambient glow bleeds keep the void from feeling dead.
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';

const { height } = Dimensions.get('window');

interface Props {
  children: React.ReactNode;
}

export function GradientBackground({ children }: Props) {
  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.background.primary }]} />

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
    backgroundColor: 'rgba(193,40,27,0.03)',
  },
  midGlow: {
    position: 'absolute',
    top: height * 0.3,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(30,91,255,0.02)',
  },
});
