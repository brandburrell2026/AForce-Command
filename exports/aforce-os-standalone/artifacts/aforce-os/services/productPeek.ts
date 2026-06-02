/**
 * Product Peek — cinematic product viewer (no store, no buy).
 *
 * Spec Rule #8:
 *   Keep products. No store.
 *   Tap product: Product Peek
 *     Grow 150%
 *     Blur
 *     Soft glow
 *     Slow float
 *     No buy button.
 *   Keep: drinkaforce.com / Share / Story / Export
 *   Inventory hidden.
 *
 * Hidden architecture only this turn — no UI changes, no edits to
 * the existing StoreScreen / CartScreen / product tap handlers /
 * ZoomableProductImage. The visual constants, allowed-action table,
 * and float-animation math land here so a follow-up rule pass can
 * wire the peek into product taps without inventing numbers.
 *
 * Gate: Peek mode is ENABLED whenever `spec_inventory` is false
 * (the Rule #17 default). When inventory becomes visible (flag on),
 * the store flow takes over and peek mode disables.
 */
import { useFeatureFlags } from '@/store/useAppStore';

/**
 * Visual constants for the Peek overlay. Spec text → numeric:
 *   "Grow 150%"   → scale 1.5
 *   "Blur"        → 24 px backdrop blur (matches existing modal blur)
 *   "Soft glow"   → 0.45 opacity radial glow
 *   "Slow float"  → 6 s period, 8 px vertical amplitude
 */
export const PEEK_VISUAL = {
  scale: 1.5,
  blurRadius: 24,
  glowOpacity: 0.45,
  floatDurationMs: 6000,
  floatAmplitudePx: 8,
} as const;

/** The four allowed outbound paths from a Peek. No buy / cart / checkout. */
export const PEEK_LINKS = {
  website: 'https://drinkaforce.com',
  share: 'share',
  story: 'story',
  export: 'export',
} as const;

export type PeekLink = keyof typeof PEEK_LINKS;

/** Human labels for the four outbound paths. Brand words unchanged. */
export const PEEK_LINK_LABELS: Readonly<Record<PeekLink, string>> = {
  website: 'drinkaforce.com',
  share: 'Share',
  story: 'Story',
  export: 'Export',
};

/**
 * Actions explicitly blocked in Peek mode. Spec: "No buy button."
 * Any commerce verb routes through here and is denied.
 */
export const PEEK_BLOCKED_ACTIONS = ['buy', 'cart', 'checkout', 'purchase'] as const;
export type PeekBlockedAction = (typeof PEEK_BLOCKED_ACTIONS)[number];

/**
 * Pure: returns true when `action` is an allowed Peek action
 * (one of the four KEEP links). False for buy / cart / checkout /
 * purchase and anything else.
 */
export function isPeekActionAllowed(action: string): boolean {
  return (Object.keys(PEEK_LINKS) as string[]).includes(action);
}

/**
 * Pure: derive the slow-float transform for a given elapsed time.
 * Sine wave on Y axis with the spec amplitude/period. Scale is
 * constant — the "grow 150%" is a one-shot mount transition, not
 * animated by this helper. Deterministic and dependency-free so it
 * can be driven by Reanimated, a JS RAF loop, or a test clock.
 */
export function derivePeekTransform(elapsedMs: number): {
  scale: number;
  translateY: number;
} {
  const phase = (2 * Math.PI * elapsedMs) / PEEK_VISUAL.floatDurationMs;
  return {
    scale: PEEK_VISUAL.scale,
    translateY: Math.sin(phase) * PEEK_VISUAL.floatAmplitudePx,
  };
}

export interface PeekState {
  enabled: boolean;
  visual: typeof PEEK_VISUAL;
  links: typeof PEEK_LINKS;
  linkLabels: typeof PEEK_LINK_LABELS;
}

/**
 * Hidden hook. Returns the Peek configuration plus an `enabled`
 * boolean that's true whenever `spec_inventory` is false (i.e.
 * "Inventory hidden" — the spec default).
 *
 * Not consumed by any UI yet. Wiring lands in a follow-up rule.
 */
export function useHiddenProductPeek(): PeekState {
  const flags = useFeatureFlags();
  return {
    enabled: !flags.spec_inventory,
    visual: PEEK_VISUAL,
    links: PEEK_LINKS,
    linkLabels: PEEK_LINK_LABELS,
  };
}
