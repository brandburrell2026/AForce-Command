/**
 * Urine Hydration Check — pure assessment helper.
 *
 * Maps a urine color signal to a hydration verdict and recommendation.
 * Not a medical test — see DISCLAIMER. Tone matches the HydroScan
 * rebrand: natural observation framing, never an aggressive sell,
 * 12 oz water as the standard pour, AForce positioned as system
 * fuel / performance support.
 *
 * Inputs (per spec):
 *   clear | light_yellow | yellow | dark_yellow
 *
 * Outputs (per spec):
 *   Hydration Appears Stable
 *   Good Hydration Range
 *   Hydration Support Suggested
 *   Deeper Color — A Good Time for Fluids
 */

export type UrineColor = 'clear' | 'light_yellow' | 'yellow' | 'dark_yellow';
export type UrineSeverity = 'stable' | 'good' | 'support' | 'correction';

export interface UrineColorOption {
  color: UrineColor;
  label: string;
  hex: string;
}

export interface UrineCheckResult {
  color: UrineColor;
  colorLabel: string;
  verdict: string;
  severity: UrineSeverity;
  detail: string;
  recommendation: string;
  hex: string;
}

export const URINE_DISCLAIMER =
  'Urine color is a general hydration signal and not a medical diagnostic tool.';

/** Color spectrum + swatch hex for the UI tiles. Order matters — clear → dark. */
export const URINE_COLOR_OPTIONS: readonly UrineColorOption[] = [
  { color: 'clear', label: 'Clear', hex: '#E6F2EF' },
  { color: 'light_yellow', label: 'Light Yellow', hex: '#F2E997' },
  { color: 'yellow', label: 'Yellow', hex: '#E8C547' },
  { color: 'dark_yellow', label: 'Dark Yellow', hex: '#B58A0E' },
] as const;

/**
 * Color tile → the persisted `urineSignal` scale (`types/index.ts`: 1 clear …
 * 8 very dark; the server validates `int().min(1).max(8)`).
 *
 * ⚠️ FOUNDER RATIFICATION REQUIRED. These four numbers are the ONLY judgement in
 * this change, and they are not cosmetic: `services/heatRiskEngine.ts` computes
 * `urinePts = urineSignal >= 5 ? (urineSignal - 4) * 2 : 0`, so the value chosen
 * for each tile decides how many penalty points that tile contributes.
 *
 * No prior mapping existed to reuse — the screen never wrote the signal at all,
 * so nothing here is being changed, only supplied for the first time. The four
 * tiles are spread evenly across the documented range, placing `yellow` exactly
 * at the "dark" threshold (5) and `dark_yellow` at 7. That is a defensible
 * reading of a 4-step UI against an 8-step scale, not a derivation from the
 * hydration literature — if the intended severity curve differs, change these
 * four numbers and nothing else in the write path needs to move.
 */
export const URINE_COLOR_SIGNAL: Readonly<Record<UrineColor, number>> = {
  clear: 1,
  light_yellow: 3,
  yellow: 5,
  dark_yellow: 7,
};

/**
 * The inverse, used to seed the screen from PERSISTED state so a reload shows
 * what the member last recorded rather than an empty picker. Signals that fall
 * between tiles (the scale is finer than the UI, and other surfaces may set any
 * 1–8 value) resolve to the nearest tile; anything outside 1–8 resolves to null
 * so a corrupt value renders as "nothing selected" rather than a wrong verdict.
 */
export function urineColorForSignal(signal: number): UrineColor | null {
  if (!Number.isFinite(signal) || signal < 1 || signal > 8) return null;
  let best: UrineColor | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [color, value] of Object.entries(URINE_COLOR_SIGNAL) as [UrineColor, number][]) {
    const distance = Math.abs(value - signal);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }
  return best;
}

export function assessUrineColor(color: UrineColor): UrineCheckResult {
  const option = URINE_COLOR_OPTIONS.find((o) => o.color === color);
  // `color` is type-narrowed, so option is always defined; the
  // fallback exists only to satisfy the type checker.
  const colorLabel = option?.label ?? color;
  const hex = option?.hex ?? '#FFFFFF';

  switch (color) {
    case 'clear':
      return {
        color,
        colorLabel,
        hex,
        severity: 'stable',
        verdict: 'Hydration Appears Stable',
        detail: 'Fluid balance is holding. Excess clear can signal over-dilution — pace your next intake.',
        recommendation: 'Sip as needed. Recheck before your next event.',
      };
    case 'light_yellow':
      return {
        color,
        colorLabel,
        hex,
        severity: 'good',
        verdict: 'Good Hydration Range',
        detail: 'Healthy hydration window. The system is in balance.',
        recommendation: 'Pair your next intake with 12 oz water to hold this range.',
      };
    case 'yellow':
      return {
        color,
        colorLabel,
        hex,
        severity: 'support',
        verdict: 'Hydration Support Suggested',
        detail: 'Fluids are trending behind demand. A good moment to top up.',
        recommendation:
          '12 oz water + AForce.',
      };
    case 'dark_yellow':
      return {
        color,
        colorLabel,
        hex,
        severity: 'correction',
        verdict: 'Deeper Color — A Good Time for Fluids',
        detail: 'Deeper urine color often tracks with lower recent fluid intake.',
        recommendation:
          '16 oz water + AForce. Recheck in 30 minutes.',
      };
    default: {
      // Compile-time exhaustiveness guard. If a new UrineColor value
      // is added without a matching case above, TypeScript will fail
      // here so the mapping never silently drifts from the spec.
      const _exhaustive: never = color;
      throw new Error(`Unhandled urine color: ${String(_exhaustive)}`);
    }
  }
}
