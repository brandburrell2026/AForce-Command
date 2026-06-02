/**
 * HardwareConnectionStatus — compact pill showing the band's BLE state.
 * Used in the Phantom Band screen header and the home card.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Colors } from '../theme/colors';
import type { BandConnectionStatus } from '../types/hardware';

const VARIANT: Record<BandConnectionStatus, {
  label: string;
  color: string;
  icon: IconName;
}> = {
  unpaired:     { label: 'UNPAIRED',     color: Colors.text.muted,             icon: 'bluetooth' },
  pairing:      { label: 'PAIRING…',     color: Colors.states.BALANCED.primary, icon: 'loader' },
  connected:    { label: 'CONNECTED',    color: Colors.states.PEAK.primary,     icon: 'check-circle' },
  syncing:      { label: 'SYNCING…',     color: Colors.states.PEAK.primary,     icon: 'refresh-cw' },
  disconnected: { label: 'DISCONNECTED', color: Colors.states.DEPLETED.primary, icon: 'wifi-off' },
};

export function HardwareConnectionStatus({ status }: { status: BandConnectionStatus }) {
  const v = VARIANT[status];
  return (
    <View
      testID="band-connection-status"
      style={[styles.pill, { borderColor: `${v.color}55`, backgroundColor: `${v.color}14` }]}
    >
      <Icon name={v.icon} size={10} color={v.color} />
      <Text style={[styles.label, { color: v.color }]}>{v.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.4,
  },
});
