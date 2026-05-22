/**
 * EntryActions — bottom-zone "quick action" tile grid.
 *
 * Compete / Circles / Territory tiles were promoted to a dedicated
 * Competition bottom tab (see app/(tabs)/competition.tsx), so the home
 * surface keeps only the biometric quick-check (Urine). Layout is a
 * single fixed-size tile, left-aligned, so the row reads as an
 * intentional element rather than a stretched single cell.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Icon } from '../Icon';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { Colors } from '../../theme/colors';

const TILES = [
  { key: 'urine', icon: 'droplet', label: 'Urine', route: '/urine-check' },
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
        >
          <Icon name={item.icon} size={20} color={Colors.text.primary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export const EntryActions = React.memo(EntryActionsImpl);

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  actionTile: {
    width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
});
