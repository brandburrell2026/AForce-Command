/**
 * PhantomBandCard — compact card linking into the Phantom Band screen.
 * Mirrors connection state + LED color so the user can glance and tell.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '../theme/colors';
import { phantomBandService } from '../services/phantomBandService';
import { ledForLevel } from '../services/ledSignalService';
import type { PhantomBandState } from '../types/hardware';
import { useAppStore } from '../store/useAppStore';

export function PhantomBandCard() {
  const router = useRouter();
  const { state } = useAppStore();
  const [bandState, setBandState] = useState<PhantomBandState>(phantomBandService.getState());

  useEffect(() => phantomBandService.on('state', setBandState), []);

  const level = state.engineOutput.performanceState.level;
  const ledHex = bandState.connection === 'connected'
    ? bandState.ledPattern.hex
    : ledForLevel(level).hex; // preview color even when unpaired

  const statusLine = (() => {
    switch (bandState.connection) {
      case 'connected':    return 'Mirroring · double-tap for voice';
      case 'syncing':      return 'Syncing…';
      case 'pairing':      return 'Pairing…';
      case 'disconnected': return 'Disconnected · tap to reconnect';
      case 'unpaired':
      default:             return 'Tap to pair · trigger voice from your wrist';
    }
  })();

  return (
    <Pressable
      onPress={() => router.push('/phantom')}
      style={styles.card}
      testID="phantom-band-card"
    >
      <View style={[styles.led, { backgroundColor: ledHex, shadowColor: ledHex }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>PHANTOM BAND</Text>
          {bandState.connection === 'connected' && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <Text style={styles.status}>{statusLine}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: Colors.fill.light,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  led: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOpacity: 0.85,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.text.primary, letterSpacing: 1.6 },
  status: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted, marginTop: 4 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: `${Colors.states.PEAK.primary}1A`,
    borderRadius: 6,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.states.PEAK.primary },
  liveText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: Colors.states.PEAK.primary, letterSpacing: 1 },
});
