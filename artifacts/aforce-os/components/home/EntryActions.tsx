/**
 * EntryActions — bottom-zone "quick action" tile grid (Scan, Compete,
 * Circles, Territory). Stateless / store-free; purely presentational.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Icon } from '../Icon';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { Colors } from '../../theme/colors';

const TILES = [
  { key: 'urine',     icon: 'droplet',     label: 'Urine',     route: '/urine-check' },
  { key: 'compete',   icon: 'award',       label: 'Compete',   route: '/competition' },
  { key: 'circles',   icon: 'users',       label: 'Circles',   route: '/circles',   testID: 'home-circles-button' },
  { key: 'territory', icon: 'map',         label: 'Territory', route: '/territory', testID: 'home-territory-button' },
] as const;

function EntryActionsImpl() {
  const router = useRouter();
  return (
    <View style={styles.actionRow}>
      {TILES.map((item) => (
        <TouchableOpacity
          key={item.key}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            router.push(item.route);
          }}
          activeOpacity={0.85}
          style={styles.actionTile}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          testID={'testID' in item ? item.testID : undefined}
        >
          <Icon name={item.icon} size={18} color={Colors.text.primary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export const EntryActions = React.memo(EntryActionsImpl);

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  actionTile: {
    flex: 1, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
});
