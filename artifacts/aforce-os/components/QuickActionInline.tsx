/**
 * QuickActionInline — the optional, low-priority quick-log row.
 *
 * Three small icon-led pills (Water · Stick · RTD) that let the user log a
 * shortcut intake without leaving home. Deliberately subdued so it never
 * competes with the PrimaryCommandCard's CTA above it.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Icon, type IconName } from './Icon';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/useAppStore';
import type { FluidType } from '../types';

const ITEMS: ReadonlyArray<{
  id: FluidType;
  label: string;
  icon: IconName;
}> = [
  { id: 'water',         label: 'Water', icon: 'droplet' },
  { id: 'aforce_stick',  label: 'Stick', icon: 'zap' },
  { id: 'aforce_rtd',    label: 'RTD',   icon: 'package' },
];

export function QuickActionInline() {
  const { logIntake, state } = useAppStore();
  const disabled = state.isCompletingCycle;

  const handlePress = (id: FluidType) => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    void logIntake(id, { source: 'home' });
  };

  return (
    <View style={styles.row} testID="quick-action-inline">
      {ITEMS.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => handlePress(item.id)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.pill,
            pressed && !disabled && { opacity: 0.85 },
            disabled && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Quick log ${item.label}`}
          testID={`quick-log-${item.id}`}
        >
          <Icon name={item.icon} size={13} color={Colors.text.secondary} />
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
  },
  label: {
    color: Colors.text.secondary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
});

export default QuickActionInline;
