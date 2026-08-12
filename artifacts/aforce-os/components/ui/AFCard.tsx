/**
 * AFCard — the grouped-content surface (spec §5). Solid graphite with a faint
 * border; hierarchy comes from tone/edge/spacing, not heavy shadows (§3.5).
 *
 * Variants: standard | raised | interactive (pressable) | warning | editorial.
 */
import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { af, afLayout } from '@/theme';

export type AFCardVariant = 'standard' | 'raised' | 'interactive' | 'warning' | 'editorial';

export interface AFCardProps {
  children: React.ReactNode;
  variant?: AFCardVariant;
  onPress?: () => void;
  padded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function AFCard({
  children,
  variant = 'standard',
  onPress,
  padded = true,
  selected,
  disabled,
  style,
  testID,
  accessibilityLabel,
}: AFCardProps) {
  const base: StyleProp<ViewStyle> = [
    styles.card,
    padded && styles.padded,
    VARIANT[variant],
    style,
  ];

  if (onPress || variant === 'interactive') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected, disabled }}
        testID={testID}
        style={({ pressed }) => [base, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  // A View is NOT an accessibility element on iOS unless `accessible` is set,
  // so a label passed here used to be silently discarded — VoiceOver read the
  // children one fragment at a time instead of the composed sentence the
  // caller wrote (PerformanceSignalV3's day cards were the worst case).
  // `accessible` is set only WHEN a label exists: turning every unlabeled card
  // into a single element would flatten its children out of the reading order
  // and lose more than it gained.
  const labelled = accessibilityLabel != null && accessibilityLabel !== '';
  return (
    <View
      style={base}
      testID={testID}
      {...(labelled
        ? { accessible: true, accessibilityLabel, accessibilityRole: 'summary' as const }
        : {})}
    >
      {children}
    </View>
  );
}

const VARIANT: Record<AFCardVariant, ViewStyle> = {
  standard: { backgroundColor: af.surface, borderColor: af.border },
  raised: { backgroundColor: af.surfaceRaised, borderColor: af.borderStrong },
  interactive: { backgroundColor: af.surface, borderColor: af.border },
  warning: { backgroundColor: af.surface, borderColor: af.amber },
  editorial: {
    backgroundColor: af.surface,
    borderColor: af.border,
    borderRadius: afLayout.radiusHero,
  },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: afLayout.radiusCard,
    borderWidth: afLayout.hairline,
  },
  padded: { padding: afLayout.cardPadding },
  pressed: { backgroundColor: af.surfacePressed },
});
