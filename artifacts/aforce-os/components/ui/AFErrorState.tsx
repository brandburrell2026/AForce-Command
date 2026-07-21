/**
 * AFErrorState — plain-language cause + a retry/recovery action (spec §5, §7).
 * Only a genuine failure uses the critical (red) tone; offline / permission /
 * expired / unavailable are neutral, not alarming (spec §7: "Do not use a red
 * error state for ordinary empty, offline, or permission states").
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType } from '@/theme';
import { AFPrimaryButton, AFSecondaryButton } from './AFButton';

export type AFErrorVariant = 'retry' | 'offline' | 'permission' | 'expired' | 'unavailable';

const VARIANT: Record<AFErrorVariant, { icon: IconName; critical: boolean }> = {
  retry: { icon: 'alert-circle', critical: true },
  offline: { icon: 'wifi-off', critical: false },
  permission: { icon: 'lock', critical: false },
  expired: { icon: 'clock', critical: false },
  unavailable: { icon: 'minus-circle', critical: false },
};

export interface AFErrorStateProps {
  variant?: AFErrorVariant;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}

export function AFErrorState({ variant = 'retry', title, message, action, testID }: AFErrorStateProps) {
  const v = VARIANT[variant];
  const tint = v.critical ? af.red : af.textSecondary;
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.iconWrap, { borderColor: v.critical ? af.red : af.border }]}>
        <Icon name={v.icon} size={22} color={tint} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {action && (
        <View style={styles.action}>
          {v.critical ? (
            <AFPrimaryButton label={action.label} onPress={action.onPress} />
          ) : (
            <AFSecondaryButton label={action.label} onPress={action.onPress} />
          )}
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
    marginBottom: 8,
  },
  title: { ...afType.title3, color: af.textPrimary, textAlign: 'center' },
  message: { ...afType.secondary, color: af.textTertiary, textAlign: 'center', maxWidth: 300 },
  action: { marginTop: 16, alignSelf: 'stretch' },
});
