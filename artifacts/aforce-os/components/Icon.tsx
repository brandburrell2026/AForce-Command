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
  MIN_ICON_OPACITY,
  lookupIcon,
  resolveIconSize,
  type IconSizeToken,
} from '../theme/icons';

/**
 * Dev-only alpha guard.
 *
 * The spec mandates that any icon rendered on a true-black surface
 * carries at least `rgba(255,255,255,0.92)` worth of legibility.
 * Existing call sites occasionally pass low-alpha tokens (e.g.
 * `Colors.text.muted` at 0.30) which disappear on Android OLED.
 *
 * Rather than silently rewriting colour at runtime (which would
 * change the visual intent of every callsite at once) we warn loudly
 * in __DEV__ so the migration sweep is observable, and pass the
 * colour through untouched in production. A future polish pass can
 * flip this to a hard clamp.
 */
function warnIfTooFaint(name: string, color: string): void {
  if (!__DEV__) return;
  // Parse rgba(...) / rgb(...) / #rgba / #rrggbbaa for an alpha hint.
  let alpha: number | null = null;
  const rgba = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(color);
  if (rgba) {
    alpha = rgba[1] != null ? parseFloat(rgba[1]) : 1;
  } else if (/^#[0-9a-f]{8}$/i.test(color)) {
    alpha = parseInt(color.slice(7, 9), 16) / 255;
  } else if (/^#[0-9a-f]{4}$/i.test(color)) {
    const a = color.slice(4, 5);
    alpha = parseInt(a + a, 16) / 255;
  }
  if (alpha != null && alpha < MIN_ICON_OPACITY) {
    // eslint-disable-next-line no-console
    console.warn(
      `[AForce/Icon] "${name}" rendered with color ${color} (alpha=${alpha.toFixed(2)}). ` +
        `Below the ${MIN_ICON_OPACITY} minimum for dark UI — Android OLED will swallow it. ` +
        `Use a brighter token or pass MIN_ICON_COLOR_DARK.`,
    );
  }
}

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
  warnIfTooFaint(name, tint);
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
