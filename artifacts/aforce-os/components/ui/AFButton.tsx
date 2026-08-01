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
import { AFMotionPressable } from './AFMotionPressable';
import { useFeatureFlags } from '@/store/useAppStore';

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

/**
 * Elite motion adoption (E3): when `elite_motion_enabled` is on, the button
 * compresses slightly on press (AFMotionPressable) and fires a `selection`
 * haptic. When OFF — or under reduced-motion — the press is the exact prior
 * behavior: only the `pressedStyle` opacity/tone changes, no scale, no haptic.
 */
export function AFPrimaryButton({ label, onPress, disabled, loading, icon, style, testID }: AFButtonProps) {
  const elite = useFeatureFlags().elite_motion_enabled;
  const { inert, a11y } = useInert(disabled, loading);
  return (
    <AFMotionPressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      motionEnabled={elite}
      haptic={elite ? 'selection' : false}
      accessibilityLabel={label}
      accessibilityState={a11y.accessibilityState}
      testID={testID}
      style={[styles.base, styles.primary, disabled && styles.disabled, style]}
      pressedStyle={styles.primaryPressed}
    >
      {loading ? (
        <ActivityIndicator color={af.onRed} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={16} color={af.onRed} />}
          <Text style={[styles.label, { color: af.onRed }]}>{label}</Text>
        </View>
      )}
    </AFMotionPressable>
  );
}

export function AFSecondaryButton({ label, onPress, disabled, loading, icon, style, testID }: AFButtonProps) {
  const elite = useFeatureFlags().elite_motion_enabled;
  const { inert, a11y } = useInert(disabled, loading);
  return (
    <AFMotionPressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      motionEnabled={elite}
      haptic={elite ? 'selection' : false}
      accessibilityLabel={label}
      accessibilityState={a11y.accessibilityState}
      testID={testID}
      style={[styles.base, styles.secondary, disabled && styles.disabled, style]}
      pressedStyle={styles.secondaryPressed}
    >
      {loading ? (
        <ActivityIndicator color={af.textPrimary} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={16} color={af.textPrimary} />}
          <Text style={[styles.label, { color: af.textPrimary }]}>{label}</Text>
        </View>
      )}
    </AFMotionPressable>
  );
}

export function AFTextButton({ label, onPress, disabled, icon, style, testID }: AFButtonProps) {
  const elite = useFeatureFlags().elite_motion_enabled;
  const { inert, a11y } = useInert(disabled, false);
  return (
    <AFMotionPressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      motionEnabled={elite}
      accessibilityLabel={label}
      accessibilityState={a11y.accessibilityState}
      testID={testID}
      hitSlop={8}
      style={[styles.textBtn, style]}
      pressedStyle={styles.textPressed}
    >
      <View style={styles.content}>
        {icon && <Icon name={icon} size={14} color={disabled ? af.textDisabled : af.redText} />}
        <Text style={[afType.bodyStrong, { color: disabled ? af.textDisabled : af.redText }]}>{label}</Text>
      </View>
    </AFMotionPressable>
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
