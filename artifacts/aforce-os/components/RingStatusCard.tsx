/**
 * RingStatusCard — compact entry tile for the home screen's SignalsZone.
 *
 * Always-visible reminder that the AForce Ring is paired and streaming.
 * Tap to open /ring (the Calm Coach companion screen). When a session is
 * active it gets a subtle lime accent so the user can see at a glance
 * that the ring has detected movement.
 *
 * VS 3.0 P2: presentation-only migration onto the af.* system (was legacy
 * Colors.* + `accent + '40'` opacity concat + a raw #C8C8D0 glyph literal +
 * fontWeight). Same tile, same data, same behavior — brand tokens.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Icon } from './Icon';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { af, afType, afAlpha, withAlpha, Typography } from '../theme';
import { useRingStream } from '../services/ringService';

export function RingStatusCard() {
  const ring = useRingStream();
  // Session-active → brand green; resting → informational cyan. Both are af.*
  // state accents; the dim fill is the same accent at afAlpha.a12.
  const accent = ring.sessionActive ? af.green : af.cyan;
  const accentDim = withAlpha(accent, afAlpha.a12);
  const accentBorder = withAlpha(accent, afAlpha.a24);

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        // If a session is already streaming, jump straight to the live HUD
        // instead of stranding the user on the resting Calm Coach screen.
        router.push(ring.sessionActive ? '/ring/session' : '/ring');
      }}
      style={({ pressed }) => [
        styles.card,
        { borderColor: accentBorder },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="AForce Ring · open companion"
      testID="ring-status-card"
    >
      <View style={[styles.iconWrap, { backgroundColor: accentDim, borderColor: accentBorder }]}>
        <View style={styles.ringGlyphOuter}>
          <View style={styles.ringGlyphInner}>
            <View style={[styles.ringGlyphDot, { backgroundColor: accent }]} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title}>AForce Ring</Text>
          <View style={[styles.connDot, { backgroundColor: ring.connected ? accent : af.textTertiary }]} />
          <Text style={styles.subtle}>{ring.connected ? 'Connected' : 'Searching'}</Text>
        </View>
        <Text style={styles.metrics}>
          {ring.biometrics.heartRateBpm} bpm · {ring.biometrics.skinTempC.toFixed(1)}°C ·{' '}
          {ring.biometrics.gsrActive ? 'GSR active' : 'GSR idle'}
        </Text>
      </View>

      <View style={styles.tail}>
        <Icon name="battery" size={12} color={af.textTertiary} />
        <Text style={styles.battery}>{ring.batteryPct}%</Text>
        <Icon name="chevron-right" size={16} color={af.textTertiary} style={{ marginLeft: 4 }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: af.surface,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  ringGlyphOuter: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  ringGlyphInner: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: withAlpha(af.textPrimary, afAlpha.a50),
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  ringGlyphDot: {
    width: 4, height: 4, borderRadius: 2,
    position: 'absolute', top: -1, right: -1,
  },
  body: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...afType.caption, fontFamily: Typography.fonts.bold, letterSpacing: 0.3, color: af.textPrimary },
  connDot: { width: 5, height: 5, borderRadius: 2.5, marginLeft: 4 },
  subtle: { ...afType.tab, color: af.textSecondary },
  metrics: { ...afType.tab, color: af.textTertiary },
  tail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  battery: { ...afType.tab, color: af.textTertiary },
});
