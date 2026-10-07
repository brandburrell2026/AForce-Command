/**
 * AForce Concierge — the Black Issue kit (2026-10-07, restyle PR 4).
 *
 * Two small pieces the concierge surfaces share and nothing outside this
 * folder needs: the outlined mono PILL (chips, action pills, "Why this?") and
 * the red "A" AVATAR that heads an AForce reply. Presentation only — both are
 * built on af.* tokens and carry no behaviour of their own.
 *
 * PILL: a 1pt outline, mono caps, tracked by useAFEyebrowType (tracking is
 * the only thing that yields to Dynamic Type — the label always reflows to a
 * second line, never clips). The visible pill is 36pt; hitSlop lifts the
 * target to the 44pt floor. `tone="filled"` is the one red emphasis (fills
 * use af.red; label on-red). Caps come from textTransform so the DOM/reader
 * text stays the translated string.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { af, afLayout, afType } from '@/theme';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { AF_WORDMARK } from '@/components/ui/AFMasthead';

export interface ConciergePillProps {
  /** Visible, already-translated label. Omit for an icon-only pill (then `accessibilityLabel` is required). */
  label?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  /** outline (default) = hairline; filled = the red primary; quiet = grey meta pill. */
  tone?: 'outline' | 'filled' | 'quiet';
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Disclosure state for a pill that expands something. */
  expanded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Vertical hitSlop that lifts the 36pt pill to the 44pt floor. */
const PILL_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 } as const;

export function ConciergePill({
  label,
  accessibilityLabel,
  onPress,
  tone = 'outline',
  icon,
  trailingIcon,
  loading,
  disabled,
  expanded,
  style,
  testID,
}: ConciergePillProps) {
  const eyebrowType = useAFEyebrowType();
  const inert = Boolean(disabled || loading);
  const filled = tone === 'filled';
  const ink = filled ? af.onRed : tone === 'quiet' ? af.textSecondary : af.textPrimary;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: Boolean(loading), ...(expanded === undefined ? {} : { expanded }) }}
      hitSlop={PILL_HIT_SLOP}
      testID={testID}
      style={({ pressed }) => [
        styles.pill,
        filled ? styles.filled : styles.outline,
        pressed && (filled ? styles.filledPressed : styles.outlinePressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={14} color={ink} /> : null}
          {label ? <Text style={[[styles.label, eyebrowType], { color: ink }]}>{label}</Text> : null}
          {trailingIcon ? <Icon name={trailingIcon} size={12} color={ink} /> : null}
        </>
      )}
    </Pressable>
  );
}

export interface ConciergeAvatarProps {
  testID?: string;
}

/** The red circular "A" that heads an AForce reply. Decorative: hidden from the reader. */
export function ConciergeAvatar({ testID }: ConciergeAvatarProps) {
  return (
    <View
      style={styles.avatar}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Text style={styles.avatarLetter}>{AF_WORDMARK.charAt(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: afLayout.radiusPill,
    borderWidth: afLayout.hairline,
  },
  outline: { backgroundColor: 'transparent', borderColor: af.borderStrong },
  outlinePressed: { backgroundColor: af.surfacePressed },
  filled: { backgroundColor: af.red, borderColor: af.red },
  filledPressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  label: { ...afType.eyebrow, flexShrink: 1, textTransform: 'uppercase' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: af.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { ...afType.micro, color: af.onRed, textAlign: 'center' },
});
