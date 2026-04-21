/**
 * Icon — Centralized icon entry point for the app.
 *
 * Right now this is a thin wrapper around Feather (which the existing
 * codebase uses everywhere) so the abstraction is a no-op visually
 * and bundles no extra weight. Its purpose is to give us a single
 * choke-point for future swaps:
 *
 *   - Material Symbols on Android (per platform)
 *   - SF Symbols-style sets on iOS
 *   - A custom AForce icon set
 *
 * When that day comes, we change this one file (and a name-mapping
 * table) instead of editing every screen.
 *
 * Migration policy: prefer `<Icon />` over `<Feather />` in NEW code.
 * Existing call sites can be migrated incrementally — both styles
 * render identically today.
 *
 * Usage:
 *   import { Icon, type IconName } from '@/components/Icon';
 *   <Icon name="check-circle" size={20} color={Colors.text.primary} />
 */

import React from 'react';
import { Feather } from '@expo/vector-icons';
import type { TextStyle, StyleProp } from 'react-native';

/**
 * Currently reuses Feather's glyph map. When we swap implementations
 * we'll widen this to a union of supported names from the new set
 * (or expose a mapping object) — the type alias gives us the seam.
 */
export type IconName = keyof typeof Feather.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function Icon({ name, size = 16, color, style, testID }: IconProps) {
  return <Feather name={name} size={size} color={color} style={style} testID={testID} />;
}
