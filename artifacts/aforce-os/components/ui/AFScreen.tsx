/**
 * AFScreen — the redesign screen shell (spec §5). Owns the canvas background
 * and safe areas so no screen re-implements them. On wide devices the content
 * is centered in a bounded column (spec §3.3 / §4.3), not stretched.
 *
 * Variants via props rather than named exports:
 *   scroll   — wrap content in a ScrollView (operational screens with overflow)
 *   padded   — apply the standard horizontal screen padding
 *   center   — bound + center the column to afLayout.maxContentWidth (tablet)
 *   canvas   — 'default' (#0D0D0D) or 'focused' (#050506, Recovery-Coach field)
 */
import React from 'react';
import { View, ScrollView, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { af, afLayout } from '@/theme';

type Edge = 'top' | 'bottom';

export interface AFScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  center?: boolean;
  canvas?: 'default' | 'focused';
  edges?: Edge[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AFScreen({
  children,
  scroll = false,
  padded = true,
  center = true,
  canvas = 'default',
  edges = ['top'],
  contentContainerStyle,
  style,
  testID,
}: AFScreenProps) {
  const insets = useSafeAreaInsets();
  const background = canvas === 'focused' ? af.canvasFocused : af.canvas;

  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingHorizontal: padded ? afLayout.screenPaddingX : 0,
  };

  const column: StyleProp<ViewStyle> = center
    ? [styles.column, { maxWidth: afLayout.maxContentWidth }]
    : styles.fill;

  if (scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: background }, style]} testID={testID}>
        <ScrollView
          contentContainerStyle={[padding, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          <View style={column}>{children}</View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[styles.fill, { backgroundColor: background }, padding, style]}
      testID={testID}
    >
      <View style={[column, contentContainerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { flex: 1, width: '100%', alignSelf: 'center' },
});
