/**
 * Icon — Centralized icon entry point for AForce OS.
 *
 * Per the AForce OS Master Update Spec ("Android Icon Fix") the
 * app uses Lucide React Native as the single icon pack. The
 * existing call sites pass Feather-style kebab-case names
 * (`<Icon name="alert-triangle" />`) — this wrapper resolves them
 * against the central name map in `theme/icons.ts` and falls back
 * to Feather only for names we haven't mapped yet, so the migration
 * sweep can land file-by-file without breakage.
 *
 * Token enforcement (from `theme/icons.ts`):
 *   - size defaults to `md` (22 px)
 *   - strokeWidth is locked at 2.2 so iOS + Android render at the
 *     same visual weight
 *   - color falls back to MIN_ICON_COLOR_DARK on true-black so
 *     Android OLED never renders an invisible glyph
 *
 * Usage:
 *   import { Icon } from '@/components/Icon';
 *   <Icon name="check-circle" />            // md, lime tint default
 *   <Icon name="droplet" size="lg" />       // 28 px
 *   <Icon name="thermometer" size={20} />   // raw pixel size
 */

import React from 'react';
import { Feather } from '@expo/vector-icons';
import type { ViewStyle, StyleProp } from 'react-native';
import {
  DEFAULT_STROKE_WIDTH,
  MIN_ICON_COLOR_DARK,
  lookupIcon,
  resolveIconSize,
  type IconSizeToken,
} from '../theme/icons';

/**
 * Names come from the central `ICON_MAP`. The type stays `string`
 * so existing call sites compile during the Feather→Lucide sweep;
 * unmapped names route to the Feather fallback path at runtime and
 * log a dev warning so we can finish the migration safely.
 */
export type IconName = string;

interface IconProps {
  name: IconName;
  /** Size token (`'md'`) or raw pixel value. Defaults to `'md'` (22). */
  size?: IconSizeToken | number;
  /** Stroke color. Defaults to `MIN_ICON_COLOR_DARK` for dark UI. */
  color?: string;
  /** Override stroke width (rarely needed). Defaults to 2.2. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Icon({
  name,
  size,
  color,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  style,
  testID,
}: IconProps) {
  const px = resolveIconSize(size);
  const tint = color ?? MIN_ICON_COLOR_DARK;
  const LucideComponent = lookupIcon(name);

  if (LucideComponent) {
    return (
      <LucideComponent
        size={px}
        color={tint}
        strokeWidth={strokeWidth}
        style={style}
        testID={testID}
      />
    );
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(
      `[AForce/Icon] No Lucide mapping for "${name}" — falling back to Feather. ` +
        `Add it to theme/icons.ts → ICON_MAP.`,
    );
  }
  return (
    <Feather
      name={name as keyof typeof Feather.glyphMap}
      size={px}
      color={tint}
      style={style as never}
      testID={testID}
    />
  );
}
