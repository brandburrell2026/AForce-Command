/**
 * AFTopBar — left-aligned screen title with an optional back/close control and
 * up to two trailing actions (spec §4.2). A back control is used only when the
 * destination is not a root tab.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType } from '@/theme';

export interface AFTopBarAction {
  icon: IconName;
  onPress: () => void;
  label: string;
}

export interface AFTopBarProps {
  title?: string;
  eyebrow?: string;
  onBack?: () => void;
  onClose?: () => void;
  actions?: AFTopBarAction[]; // max 2 (spec §4.2)
  testID?: string;
}

function IconButton({ icon, onPress, label }: AFTopBarAction) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
    >
      <Icon name={icon} size={18} color={af.textSecondary} />
    </Pressable>
  );
}

export function AFTopBar({ title, eyebrow, onBack, onClose, actions = [], testID }: AFTopBarProps) {
  const trailing = actions.slice(0, 2);
  return (
    <View style={styles.bar} testID={testID}>
      <View style={styles.leading}>
        {onBack && (
          <IconButton icon="chevron-left" onPress={onBack} label="Back" />
        )}
        <View>
          {eyebrow && <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>}
          {title && (
            <Text
              style={styles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              accessibilityRole="header"
            >
              {title}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.trailing}>
        {trailing.map((a) => (
          <IconButton key={a.label} {...a} />
        ))}
        {onClose && <IconButton icon="x" onPress={onClose} label="Close" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: 12,
  },
  leading: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },
  title: { ...afType.title2, color: af.textPrimary },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: { backgroundColor: af.surfacePressed },
});
