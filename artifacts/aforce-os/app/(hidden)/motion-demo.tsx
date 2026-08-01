/**
 * motion-demo — dev/demo-only preview of the E3 motion primitives.
 *
 * Mirrors the gallery's guard: reachable only under `__DEV__` /
 * `EXPO_PUBLIC_DEMO_MODE`, redirects home otherwise. It renders the shipped
 * primitives (AFSkeleton, AFMotionPressable, the AFButton family) so the motion
 * system can be seen/captured. Not a product surface; imports nothing
 * production-guarded.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';

import {
  AFScreen,
  AFCard,
  AFSectionLabel,
  AFSkeleton,
  AFMotionPressable,
  AFPrimaryButton,
  AFSecondaryButton,
  AFTextButton,
} from '@/components/ui';
import { af, afType, afMotion } from '@/theme';
import { DEMO_MODE } from '@/services/demoMode';

declare const __DEV__: boolean | undefined;

export default function MotionDemo() {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__ === true;
  if (!isDev && !DEMO_MODE) return <Redirect href="/" />;

  return (
    <AFScreen scroll>
      <Text style={styles.h1}>Motion System (E3)</Text>
      <Text style={styles.sub}>
        Dev/demo-only preview of the elite motion primitives. Press animations +
        haptics are behavioral (see motionLogic tests); reduced-motion collapses
        every one to its static alternative.
      </Text>

      <AFSectionLabel label="AFSkeleton — branded loading" />
      <AFCard>
        <AFSkeleton width="66%" height={22} />
        <View style={{ height: 12 }} />
        <AFSkeleton width="100%" height={14} />
        <View style={{ height: 8 }} />
        <AFSkeleton width="92%" height={14} />
        <View style={{ height: 8 }} />
        <AFSkeleton width="44%" height={14} />
      </AFCard>

      <View style={styles.gap} />
      <AFSectionLabel label="Buttons — scale + selection haptic on press" />
      <View style={{ gap: 12 }}>
        <AFPrimaryButton label="Primary action" onPress={() => {}} testID="demo-primary" />
        <AFSecondaryButton label="Secondary action" onPress={() => {}} testID="demo-secondary" />
        <AFTextButton label="Text action" onPress={() => {}} testID="demo-text" />
      </View>

      <View style={styles.gap} />
      <AFSectionLabel label="AFMotionPressable — any surface" />
      <AFMotionPressable
        motionEnabled
        haptic="selection"
        onPress={() => {}}
        style={styles.demoCard}
        pressedStyle={styles.demoCardPressed}
        testID="demo-motion-card"
      >
        <Text style={styles.demoTitle}>Press me</Text>
        <Text style={styles.demoMeta}>compresses to {afMotion.scale.pressed}× over {afMotion.durations.fast}ms</Text>
      </AFMotionPressable>

      <View style={{ height: 48 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  h1: { ...afType.title1, color: af.textPrimary, marginTop: 8 },
  sub: { ...afType.secondary, color: af.textTertiary, marginBottom: 24, lineHeight: 21 },
  gap: { height: 28 },
  demoCard: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
    gap: 4,
  },
  demoCardPressed: { backgroundColor: af.surfacePressed },
  demoTitle: { ...afType.bodyStrong, color: af.textPrimary },
  demoMeta: { ...afType.caption, color: af.textTertiary },
});
