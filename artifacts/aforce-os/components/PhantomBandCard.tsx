/**
 * PhantomBandCard — compact card linking into the Phantom Band screen.
 * Mirrors connection state + LED color so the user can glance and tell.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/colors';
import { phantomBandService } from '../services/phantomBandService';
import { ledForLevel } from '../services/ledSignalService';
import type { PhantomBandState } from '../types/hardware';
import { useEngineSlice } from '../store/slices';

function PhantomBandCardImpl() {
  const router = useRouter();
  const { t } = useTranslation();
  // Subscribe to ONLY the engine slice — re-renders when the score band /
  // pulse changes, but not when (e.g.) social mode flips or onboarding
  // completes. This is what makes the React.memo wrapper materially
  // gate re-renders.
  const engine = useEngineSlice();
  const [bandState, setBandState] = useState<PhantomBandState>(phantomBandService.getState());

  useEffect(() => phantomBandService.on('state', setBandState), []);

  const level = engine.performanceState.level;
  const ledHex = bandState.connection === 'connected'
    ? bandState.ledPattern.hex
    : ledForLevel(level).hex; // preview color even when unpaired

  const statusLine = (() => {
    switch (bandState.connection) {
      case 'connected':    return t('home.phantom_band.status_connected');
      case 'syncing':      return t('home.phantom_band.status_syncing');
      case 'pairing':      return t('home.phantom_band.status_pairing');
      case 'disconnected': return t('home.phantom_band.status_disconnected');
      case 'unpaired':
      default:             return t('home.phantom_band.status_unpaired');
    }
  })();

  return (
    <Pressable
      onPress={() => router.push('/phantom')}
      style={styles.card}
      testID="phantom-band-card"
      accessibilityRole="button"
      accessibilityLabel={t('home.phantom_band.a11y')}
    >
      <View style={[styles.led, { backgroundColor: ledHex, shadowColor: ledHex }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('home.phantom_band.title')}</Text>
          {bandState.connection === 'connected' && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t('home.phantom_band.live')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.status}>{statusLine}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.text.muted} />
    </Pressable>
  );
}

export const PhantomBandCard = React.memo(PhantomBandCardImpl);

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
