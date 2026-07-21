/**
 * AFEmptyState — title, explanation, and ONE useful action (spec §5, §7).
 * Never styled as an error (no red) — an empty list is not a failure (spec §7).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType } from '@/theme';
import { AFSecondaryButton } from './AFButton';

export interface AFEmptyStateProps {
  title: string;
  message: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  testID?: string;
}

export function AFEmptyState({ title, message, icon, action, testID }: AFEmptyStateProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      {icon && (
        <View style={styles.iconWrap}>
          <Icon name={icon} size={22} color={af.textTertiary} />
        </View>
      )}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {action && (
        <View style={styles.action}>
          <AFSecondaryButton label={action.label} onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.border,
    marginBottom: 8,
  },
  title: { ...afType.title3, color: af.textPrimary, textAlign: 'center' },
  message: { ...afType.secondary, color: af.textTertiary, textAlign: 'center', maxWidth: 300 },
  action: { marginTop: 16, alignSelf: 'stretch' },
});
