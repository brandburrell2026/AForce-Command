/**
 * layoutBreakpoints — Single source of truth for device-class width
 * thresholds + per-class layout tokens.
 *
 * Classes (logical pixels, shortest screen edge):
 *   compact      < 360   small Android / older Galaxies
 *   standard     360-413 baseline phone (Pixel 7, iPhone 13/14/15)
 *   large        414-599 Pro Max, Galaxy Ultra
 *   foldOpen     600-839 Galaxy Z Fold unfolded, small tablets
 *   tablet       >= 840  iPad / large Android tablets
 *
 * Tokens are intentionally additive — they scale up generously on
 * larger screens (orb / max content width / padding) so the AForce
 * design language doesn't look stretched on a Fold or tablet.
 */

export type DeviceClass =
  | 'narrow'
  | 'compact'
  | 'standard'
  | 'large'
  | 'foldOpen'
  | 'tablet'
  | 'desktop';

export const BREAKPOINTS = {
  /** Galaxy Z Fold outer cover screen sits around 280px wide. */
  narrowMax: 319,
  compactMax: 359,
  standardMax: 413,
  largeMax: 599,
  foldOpenMax: 839,
  /** Anything wider than a tablet portrait is treated as desktop / web. */
  tabletMax: 1279,
} as const;

export function deviceClassForWidth(width: number): DeviceClass {
  if (width <= BREAKPOINTS.narrowMax) return 'narrow';
  if (width <= BREAKPOINTS.compactMax) return 'compact';
  if (width <= BREAKPOINTS.standardMax) return 'standard';
  if (width <= BREAKPOINTS.largeMax) return 'large';
  if (width <= BREAKPOINTS.foldOpenMax) return 'foldOpen';
  if (width <= BREAKPOINTS.tabletMax) return 'tablet';
  return 'desktop';
}

export interface LayoutTokens {
  /** Diameter of the StatusPulseOrb in px. */
  orbSize: number;
  /** Max width the primary content column may grow to. */
  contentMaxWidth: number;
  /** Horizontal screen gutter (matches existing styles' paddingHorizontal). */
  gutter: number;
  /** Vertical padding inside the primary CTA. */
  ctaPaddingV: number;
  /** Title size for the screen header. */
  titleSize: number;
  /** Whether the layout is wide enough to consider 2-column arrangements. */
  isWide: boolean;
}

export function tokensForDeviceClass(cls: DeviceClass): LayoutTokens {
  switch (cls) {
    case 'narrow':
      // Galaxy Fold cover screen / sub-320 width. Everything tightens up
      // so the orb, gutter, and CTA don't clip horizontally.
      // Orb sizes shrunk ~15% across all classes to improve information
      // density and let more actionable modules sit above the fold.
      return {
        orbSize: 133,
        contentMaxWidth: 320,
        gutter: 12,
        ctaPaddingV: 14,
        titleSize: 18,
        isWide: false,
      };
    case 'compact':
      return {
        orbSize: 155,
        contentMaxWidth: 480,
        gutter: 16,
        ctaPaddingV: 16,
        titleSize: 20,
        isWide: false,
      };
    case 'standard':
      return {
        orbSize: 177,
        contentMaxWidth: 480,
        gutter: 20,
        ctaPaddingV: 18,
        titleSize: 22,
        isWide: false,
      };
    case 'large':
      return {
        orbSize: 199,
        contentMaxWidth: 520,
        gutter: 22,
        ctaPaddingV: 20,
        titleSize: 24,
        isWide: false,
      };
    case 'foldOpen':
      return {
        orbSize: 232,
        contentMaxWidth: 620,
        gutter: 28,
        ctaPaddingV: 22,
        titleSize: 26,
        isWide: true,
      };
    case 'tablet':
      return {
        orbSize: 265,
        contentMaxWidth: 700,
        gutter: 32,
        ctaPaddingV: 24,
        titleSize: 28,
        isWide: true,
      };
    case 'desktop':
      // Web / external monitors. Don't let the column stretch across
      // the full 1280+ viewport — cap it so the dark luxury card stays
      // composed and centered.
      return {
        orbSize: 272,
        contentMaxWidth: 760,
        gutter: 40,
        ctaPaddingV: 24,
        titleSize: 30,
        isWide: true,
      };
  }
}
