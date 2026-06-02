/**
 * RingStatusCard — compact entry tile for the home screen's SignalsZone.
 *
 * Always-visible reminder that the AForce Ring is paired and streaming.
 * Tap to open /ring (the Calm Coach companion screen). When a session is
 * active it gets a subtle lime accent so the user can see at a glance
 * that the ring has detected movement.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Icon } from './Icon';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { Colors } from '../theme/colors';
import { useRingStream } from '../services/ringService';

export function RingStatusCard() {
  const ring = useRingStream();
  const accent = ring.sessionActive
    ? Colors.states.PEAK.primary
    : Colors.states.BALANCED.primary;
  const accentDim = ring.sessionActive
    ? Colors.states.PEAK.dim
    : Colors.states.BALANCED.dim;

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
        { borderColor: accent + '40' },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="AForce Ring · open companion"
      testID="ring-status-card"
    >
      <View style={[styles.iconWrap, { backgroundColor: accentDim, borderColor: accent + '40' }]}>
        <View style={styles.ringGlyphOuter}>
          <View style={styles.ringGlyphInner}>
            <View style={[styles.ringGlyphDot, { backgroundColor: accent }]} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title}>AForce Ring</Text>
          <View style={[styles.connDot, { backgroundColor: ring.connected ? accent : Colors.text.muted }]} />
          <Text style={styles.subtle}>{ring.connected ? 'Connected' : 'Searching'}</Text>
        </View>
        <Text style={styles.metrics}>
          {ring.biometrics.heartRateBpm} bpm · {ring.biometrics.skinTempC.toFixed(1)}°C ·{' '}
          {ring.biometrics.gsrActive ? 'GSR active' : 'GSR idle'}
        </Text>
      </View>

      <View style={styles.tail}>
        <Icon name="battery" size={12} color={Colors.text.muted} />
        <Text style={styles.battery}>{ring.batteryPct}%</Text>
        <Icon name="chevron-right" size={16} color={Colors.text.muted} style={{ marginLeft: 4 }} />
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
    backgroundColor: Colors.background.card,
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
    borderWidth: 2, borderColor: '#C8C8D0',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  ringGlyphDot: {
    width: 4, height: 4, borderRadius: 2,
    position: 'absolute', top: -1, right: -1,
  },
  body: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: Colors.text.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  connDot: { width: 5, height: 5, borderRadius: 2.5, marginLeft: 4 },
  subtle: { color: Colors.text.secondary, fontSize: 11, fontWeight: '500' },
  metrics: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' },
  tail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  battery: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' },
});
