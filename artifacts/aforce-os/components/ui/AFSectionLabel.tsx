/**
 * AFSectionLabel — tracked uppercase eyebrow with an optional trailing action
 * (spec §5). Used to head grouped content on operational screens.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { af, afType } from '@/theme';

export interface AFSectionLabelProps {
  label: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}

export function AFSectionLabel({ label, action, testID }: AFSectionLabelProps) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.label} accessibilityRole="header">
        {label.toUpperCase()}
      </Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
        >
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { ...afType.eyebrow, color: af.textTertiary },
  action: { ...afType.caption, color: af.red },
});
