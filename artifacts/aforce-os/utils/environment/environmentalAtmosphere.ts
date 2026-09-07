/**
 * THE ATMOSPHERE RECIPES — the field's appearance, as data.
 *
 * Kept OUT of the component deliberately. These values encode a truth
 * guarantee — that every state is visually distinguishable without relying on
 * colour, and that INSUFFICIENT can never look like CLEAR — and a guarantee
 * that lives inside a React component cannot be asserted in a node test.
 * Rendering imports this; laws import this; there is one copy.
 */
import { af, withAlpha } from '@/theme';
import type { EnvironmentalState } from './environmentalInterpretation';

/**
 * Field-only base planes. These are DEEPER than `af.canvas` on purpose — the
 * field sits behind everything and must read as depth rather than as a card
 * surface — so they are derived from the canonical canvas by alpha rather than
 * introduced as new brand colours.
 */
const DEEP = withAlpha(af.canvas, 1);

/**
 * The atmosphere of each state, as a small declarative recipe.
 *
 * `seam` is the AForce signature's intensity; `horizon` is where the field's
 * light gathers (0 = top, 1 = bottom); `vignette` compresses the frame as
 * concern rises.
 */
export interface Atmosphere {
  /** Base plane, top → bottom. */
  readonly base: readonly [string, string, string];
  /** The luminance that gathers at the horizon — the state's colour. */
  readonly glow: string;
  /** 0–1 down the frame. Lower value = higher horizon = more open. */
  readonly horizon: number;
  /** Edge compression. CAUTION closes in; CLEAR does not. */
  readonly vignette: number;
  /** AForce seam opacity. */
  readonly seam: number;
  /** INSUFFICIENT alone reduces definition rather than adding colour. */
  readonly unresolved: boolean;
}

export const ATMOSPHERE: Record<EnvironmentalState, Atmosphere> = {
  // Vast and open. The seam is at its most legible here — with nothing else
  // competing, the signature is what the eye keeps.
  clear: {
    base: [DEEP, af.canvas, af.canvasElevated],
    glow: withAlpha(af.textSecondary, 0.20), horizon: 1.08, vignette: 0, seam: 0.30, unresolved: false,
  },
  // Something arrives. The horizon lifts and cools.
  aware: {
    base: [DEEP, af.canvas, af.canvasElevated],
    glow: withAlpha(af.cyan, 0.16), horizon: 0.86, vignette: 0.10, seam: 0.24, unresolved: false,
  },
  // Directional warmth gathers below — energy with a direction to it.
  prepare: {
    base: [DEEP, af.canvas, withAlpha(af.amber, 0.10)],
    glow: withAlpha(af.amber, 0.30), horizon: 0.90, vignette: 0.18, seam: 0.20, unresolved: false,
  },
  // Compressed and dense. Serious, deliberately NOT consumer alarm-red: the
  // brand's Signal Red at depth, with the frame closing in.
  caution: {
    base: [DEEP, af.canvas, withAlpha(af.red, 0.16)],
    glow: withAlpha(af.red, 0.62), horizon: 0.92, vignette: 0.42, seam: 0.16, unresolved: false,
  },
  // Beautifully unresolved: no horizon to find, definition reduced. The field
  // does not fail — it declines to resolve, which is the honest picture of
  // "AForce cannot confidently read the environment yet".
  insufficient: {
    base: [DEEP, af.canvas, af.canvas],
    glow: withAlpha(af.textTertiary, 0.14), horizon: 0.56, vignette: 0.22, seam: 0.14, unresolved: true,
  },
};


/** Alias kept for the component's existing import name. */
export const ENVIRONMENTAL_ATMOSPHERE = ATMOSPHERE;
