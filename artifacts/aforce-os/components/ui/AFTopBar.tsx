/**
 * AFTopBar — left-aligned screen title with an optional back/close control and
 * up to two trailing actions (spec §4.2). A back control is used only when the
 * destination is not a root tab.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

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
        <View style={styles.titleGroup}>
          {eyebrow && <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>}
          {title && (
            /*
             * A11y fix (Wave-5 Phase-1 pass, Dynamic Type): the title was
             * `numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}`,
             * which SHRINKS the screen's own heading as the member's text size
             * grows — the exact inversion of Dynamic Type, and on the one string
             * that tells them where they are. It is the same defect already
             * fixed in AFListRow (see its §title comment): the answer is to
             * reflow, not compress. `AF_MAX_DISPLAY_FONT_SCALE` caps the 26pt
             * display face so a two-line title can't swallow the screen, and
             * `titleGroup` gives the text a flex basis so wrapping has somewhere
             * to go instead of overflowing the trailing actions.
             */
            <Text
              style={styles.title}
              maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
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
  // Flexible so a wrapped (Dynamic Type) title has width to wrap INTO and
  // cannot push the trailing actions off the bar.
  titleGroup: { flex: 1 },
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
