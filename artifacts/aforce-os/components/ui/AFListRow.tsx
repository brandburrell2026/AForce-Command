/**
 * AFListRow — icon · title · subtitle · trailing value / disclosure / toggle
 * (spec §5). The trailing slot is one of: a value string, a disclosure chevron,
 * or a switch. Every icon-only affordance still has an accessible label.
 */
import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType } from '@/theme';

export interface AFListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  value?: string;
  disclosure?: boolean;
  toggle?: { value: boolean; onValueChange: (v: boolean) => void };
  onPress?: () => void;
  testID?: string;
}

export function AFListRow({
  title,
  subtitle,
  icon,
  value,
  disclosure,
  toggle,
  onPress,
  testID,
}: AFListRowProps) {
  const composedLabel = [title, subtitle, value].filter(Boolean).join(', ');
  const body = (
    <View style={styles.row}>
      {icon && (
        <View
          style={styles.iconWrap}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name={icon} size={16} color={af.textSecondary} />
        </View>
      )}
      <View style={styles.text}>
        {/*
         * A11y fix (Squad-F HIGH #5a): `numberOfLines={1} adjustsFontSizeToFit`
         * shrank the title to fit one line, which at large Dynamic Type sizes
         * silently truncates/illegibly compresses it. `AF_MAX_DISPLAY_FONT_SCALE`
         * is documented (theme/afTokens.ts) for oversized DISPLAY numerals only
         * — never body copy — so the correct fix here is to let the title wrap
         * and keep the OS's full Dynamic-Type scaling, matching the subtitle.
         */}
        <Text style={styles.title}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {value && <Text style={styles.value}>{value}</Text>}
      {toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: 'rgba(255,255,255,0.12)', true: af.red }}
          accessibilityLabel={composedLabel}
        />
      )}
      {disclosure && <Icon name="chevron-right" size={16} color={af.textTertiary} />}
    </View>
  );

  if (onPress && !toggle) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={composedLabel}
        testID={testID}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={styles.pressable} testID={testID}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: 12 },
  pressed: { backgroundColor: af.surfacePressed },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  iconWrap: { width: 24, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  title: { ...afType.body, color: af.textPrimary },
  subtitle: { ...afType.caption, color: af.textTertiary },
  value: { ...afType.secondary, color: af.textSecondary },
});
