/**
 * SkinIABackButton — the round back control at the top of every SkinIA
 * screen, so there is always a way to the previous screen. Presentation only.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { af } from '@/theme';

export function SkinIABackButton({ onPress, label = 'Go back' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID="skinia-back"
    >
      <Icon name="chevron-left" size={18} color={af.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderColor: af.divider, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.72 },
});
