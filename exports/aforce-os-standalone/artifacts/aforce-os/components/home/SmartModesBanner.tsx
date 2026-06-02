/**
 * SmartModesBanner — Priority #7 (Smart Modes) surface.
 *
 * A quiet, additive home row that surfaces the active context mode and
 * its water-first guidance. Mirrors DailyWinBanner: no new screen, tab,
 * or navigation, no feature flag, and it self-hides when no mode is
 * active. When several modes are active the top-priority one gets the
 * guidance line and the rest show as small chips.
 *
 * "Build 100% · Show 10%": the engine computes reminder/target
 * multipliers underneath; here we only expose the mode + guidance.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useSmartModes } from '@/hooks/useSmartModes';

export function SmartModesBanner() {
  const { active } = useSmartModes();

  if (active.length === 0) return null;

  const [primary, ...rest] = active;

  return (
    <View style={styles.wrap}>
      <View style={styles.card} testID="smart-modes-banner">
        <Icon name={primary.icon} size={16} color={Colors.accent.primary} />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {primary.label}
            </Text>
            {rest.map((mode) => (
              <View key={mode.id} style={styles.chip} testID={`smart-mode-chip-${mode.id}`}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {mode.label.replace(' MODE', '')}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.guidance} numberOfLines={2}>
            {primary.guidance}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.accent.primary}40`,
    backgroundColor: `${Colors.accent.primary}10`,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  chip: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
  },
  chipText: {
    fontSize: 9,
    letterSpacing: 1,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
  },
  guidance: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    letterSpacing: -0.1,
  },
});

export default SmartModesBanner;
