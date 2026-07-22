/**
 * AFButton family (spec §5):
 *   AFPrimaryButton   — red fill, on-red label; loading + disabled states
 *   AFSecondaryButton — transparent, bordered
 *   AFTextButton      — tertiary / disclosure action
 *
 * Interaction phase (disabled > loading > pressed > default) is resolved by the
 * pure `buttonPhase` helper so the precedence is tested, not implicit.
 */
import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType, afLayout } from '@/theme';
import { buttonIsInert } from './afPrimitives.logic';

export interface AFButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function useInert(disabled?: boolean, loading?: boolean) {
  const inert = buttonIsInert({ disabled, loading });
  return {
    inert,
    a11y: {
      accessibilityRole: 'button' as const,
      accessibilityState: { disabled: inert, busy: Boolean(loading) },
    },
  };
}

export function AFPrimaryButton({ label, onPress, disabled, loading, icon, style, testID }: AFButtonProps) {
  const { inert, a11y } = useInert(disabled, loading);
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityLabel={label}
      testID={testID}
      {...a11y}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        pressed && !inert && styles.primaryPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={af.onRed} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={16} color={af.onRed} />}
          <Text style={[styles.label, { color: af.onRed }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function AFSecondaryButton({ label, onPress, disabled, loading, icon, style, testID }: AFButtonProps) {
  const { inert, a11y } = useInert(disabled, loading);
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityLabel={label}
      testID={testID}
      {...a11y}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        pressed && !inert && styles.secondaryPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={af.textPrimary} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={16} color={af.textPrimary} />}
          <Text style={[styles.label, { color: af.textPrimary }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function AFTextButton({ label, onPress, disabled, icon, style, testID }: AFButtonProps) {
  const { inert, a11y } = useInert(disabled, false);
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      {...a11y}
      style={({ pressed }) => [styles.textBtn, pressed && !inert && styles.textPressed, style]}
    >
      <View style={styles.content}>
        {icon && <Icon name={icon} size={14} color={disabled ? af.textDisabled : af.redText} />}
        <Text style={[afType.bodyStrong, { color: disabled ? af.textDisabled : af.redText }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: afLayout.buttonHeight,
    borderRadius: afLayout.radiusButton,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...afType.bodyStrong },
  primary: { backgroundColor: af.red },
  primaryPressed: { opacity: 0.85 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: af.border },
  secondaryPressed: { backgroundColor: af.surfacePressed },
  disabled: { opacity: 0.4 },
  textBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  textPressed: { opacity: 0.6 },
});
