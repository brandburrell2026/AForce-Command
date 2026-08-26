/**
 * MapLayerToggle — Territory / Heat / Momentum / Battle layer selector.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { hapticSelection } from '@/services/haptics';
import { Colors } from '@/theme/colors';
import type { TerritoryLayer } from '@/types/territory';

interface Props {
  layer: TerritoryLayer;
  onChange: (layer: TerritoryLayer) => void;
}

const LAYERS: { id: TerritoryLayer; label: string }[] = [
  { id: 'territory', label: 'TERRITORY' },
  { id: 'heat',      label: 'HEAT' },
  { id: 'momentum',  label: 'MOMENTUM' },
  { id: 'battle',    label: 'BATTLE' },
];

export const MapLayerToggle: React.FC<Props> = ({ layer, onChange }) => {
  return (
    <View style={styles.wrap}>
      {LAYERS.map(l => {
        const active = layer === l.id;
        return (
          <Pressable
            key={l.id}
            onPress={() => {
              if (Platform.OS !== 'web') hapticSelection();
              onChange(l.id);
            }}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${l.label} layer`}
          >
            <Text style={[styles.text, active && styles.textActive]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: 6,
    padding: 4, borderRadius: 100,
    backgroundColor: Colors.fill.medium,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  chip: {
    flex: 1, paddingVertical: 8,
    borderRadius: 100, alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: Colors.text.primary },
  text:       { color: Colors.text.primary, fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  textActive: { color: Colors.text.inverse },
});

export default MapLayerToggle;
