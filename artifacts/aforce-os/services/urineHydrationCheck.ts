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
 * STATUS: APPROVED FOR BETA / NOT SCIENTIFICALLY VALIDATED.
 * Founder decision 2026-08-14 (governance/URINE-COLOR-MAPPING-MEMO.md). No
 * approved AForce science specification defines a numeric mapping; these values
 * are a deliberately CONSERVATIVE Phase-1 beta choice, not a validated one, and
 * must never be described as validated because tests pass.
 *
 * Why these numbers: the UI is a coarse 4-category SELF-REPORT, not a
 * physiological measurement. `services/heatRiskEngine.ts` computes
 * `urinePts = urineSignal >= 5 ? (urineSignal - 4) * 2 : 0`, so only a value of
 * 5+ contributes heat-risk points. Placing `yellow` at 4 keeps ordinary yellow
 * BELOW that threshold: during beta only `dark_yellow` (7 → 6 points) crosses
 * it. That deliberately avoids over-interpreting ordinary yellow urine as
 * elevated heat risk.
 *
 * The numeric value is internal. It is never shown to members, and no copy may
 * imply the app measured urine concentration or hydration physiologically — the
 * shipped disclaimer stands: a general hydration signal, not a medical test.
 *
 * Isolated here on purpose: replacing the mapping after science validation is a
 * single-constant edit, and nothing in the write path, the persisted contract or
 * the tests needs to move. Do not change these numbers without founder approval.
 */
export const URINE_COLOR_SIGNAL: Readonly<Record<UrineColor, number>> = {
  clear: 1,
  light_yellow: 2,
  yellow: 4,
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
