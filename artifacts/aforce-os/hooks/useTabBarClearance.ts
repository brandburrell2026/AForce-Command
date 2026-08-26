/**
 * useTabBarClearance — S2-5: the ONE way a tab screen clears the absolute
 * tab bar.
 *
 * The Stage-2 audit found four private answers to the same question: Home
 * derived the real published height (correct), Hydration hard-coded a 40pt
 * spacer (content UNDER the bar on notched devices), Scan added
 * `insets.bottom + 32` (omitting the 49pt bar entirely), and Protocol/
 * Circle guessed `Spacing[24]+Spacing[8]` (device-blind over-padding).
 *
 * This hook is the promotion of Home's proven, founder-ratified rule
 * (`components/home/homeSafeArea.ts` — see its header for the derivation
 * and the invariant its test asserts): padding = the height the navigator
 * PUBLISHED via `BottomTabBarHeightContext` + one spacing token of
 * breathing room. Nothing measures or names a device; outside a tab
 * navigator the published height is absent and the padding degrades to
 * exactly the breathing token.
 */
import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { resolveHomeScrollBottomPadding } from '@/components/home/homeSafeArea';

/** Scroll-content bottom padding that clears the tab bar on every device. */
export function useTabBarClearance(): number {
  const published = React.useContext(BottomTabBarHeightContext);
  return resolveHomeScrollBottomPadding(published ?? 0);
}
