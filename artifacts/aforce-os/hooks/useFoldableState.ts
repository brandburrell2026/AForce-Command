/**
 * useFoldableState — Reports whether the device is currently in an
 * "expanded" foldable / tablet state where the UI has enough room for
 * a two-column layout.
 *
 * React Native does not expose a first-class foldable API, so we
 * approximate via the width-based device class:
 *   - foldOpen   : Galaxy Z Fold unfolded, small tablets, web preview
 *   - tablet     : iPad / large Android tablets
 *
 * Either of those classes flips `isExpanded` to true. Components can
 * pivot their layout off `isExpanded` without having to know whether
 * the extra room came from a fold, a tablet, or split-screen mode.
 */

import { useDeviceClass } from './useDeviceClass';

export interface FoldableState {
  /** True when the screen is wide enough for two-column layouts. */
  isExpanded: boolean;
  /** True specifically when the device class matches an unfolded fold. */
  isFoldOpen: boolean;
  /** True when device class matches a tablet form factor. */
  isTablet: boolean;
  /** True when height >= width. */
  isPortrait: boolean;
}

export function useFoldableState(): FoldableState {
  const { deviceClass, isPortrait } = useDeviceClass();
  const isFoldOpen = deviceClass === 'foldOpen';
  const isTablet = deviceClass === 'tablet';
  const isDesktop = deviceClass === 'desktop';
  return {
    // Desktop (≥1280) also gets the two-column treatment so the wide
    // layout doesn't degrade back to a single phone column on web.
    isExpanded: isFoldOpen || isTablet || isDesktop,
    isFoldOpen,
    isTablet,
    isPortrait,
  };
}
