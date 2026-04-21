/**
 * PhantomBandLine — minimal hardware-status row.
 *
 * Replaces the full PhantomBandCard on the home screen per the One-Command
 * brief. A pulsing dot + a single line of text. Tappable to open the full
 * band status / pairing flow.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { phantomBandService } from '../services/phantomBandService';

interface Props {
  onPress?: () => void;
}

export function PhantomBandLine({ onPress }: Props) {
  // Service exposes a sync snapshot via getState() and a 'state' event when
  // any field changes (connection / battery / LED). We only care whether
  // the band is currently connected (or actively syncing, which is a
  // sub-state of connected).
  const isLive = (conn: string) => conn === 'connected' || conn === 'syncing';
  const [connected, setConnected] = React.useState<boolean>(() =>
    isLive(phantomBandService.getState().connection),
  );
  React.useEffect(() => {
    return phantomBandService.on('state', (s) => {
      setConnected(isLive(s.connection));
    });
  }, []);

  const tint = connected ? Colors.states.PEAK.primary : Colors.text.muted;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Phantom Band ${connected ? 'connected' : 'not connected'}`}
      testID="phantom-band-line"
    >
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Feather name="watch" size={11} color={Colors.text.muted} />
      <Text style={styles.text}>
        Phantom Band {connected ? 'connected' : 'not connected'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 0.6,
  },
});

export default PhantomBandLine;
