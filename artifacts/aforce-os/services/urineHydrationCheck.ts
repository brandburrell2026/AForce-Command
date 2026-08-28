/**
 * Urine Hydration Check — pure assessment helper.
 *
 * Maps a urine color signal to a hydration verdict and recommendation.
 * Not a medical test — see DISCLAIMER. Tone: natural observation
 * framing, never an aggressive sell.
 *
 * COMMAND-AUTHORITY CONTAINMENT (wave 1, founder-authorized): this
 * module OBSERVES; it does not command. Its recommendations previously
 * issued their own doses ("12 oz water + AForce") and their own recheck
 * clock ("Recheck in 30 minutes") — a second command authority rendered
 * on the same screen as the canonical engine command, able to contradict
 * it. RecoveryCommand is the ONE authoritative action; the canonical
 * riskTimer owns recheck cadence. Recording the reading here feeds
 * `urineSignal` into the scoring engine, so the canonical command
 * already reflects this observation — the recommendation's job is to
 * point at that command, never to compete with it. No dose numbers, no
 * product pushes, no recheck clocks may return to these strings
 * (pinned by services/__tests__/urineHydrationCheck.test.ts).
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
 * Founder re-ratification 2026-08-14 (governance/URINE-COLOR-MAPPING-MEMO.md).
 * No approved AForce science specification defines a numeric mapping. These are
 * a deliberately conservative Phase-1 beta choice and must never be described as
 * validated because tests pass.
 *
 * TWO CONSUMERS, TWO THRESHOLDS. The first ratification (1/2/4/7) was made on
 * the incorrect belief that urine affected heat risk only. It affects BOTH:
 *
 *   HydroState score  utils/scoring/breakdown.ts
 *                     `-max(0, urineSignal - 3) * 4`   penalises ABOVE 3
 *   Heat risk         services/heatRiskEngine.ts
 *                     `urineSignal >= 5 ? (s - 4) * 2 : 0`   penalises AT 5+
 *
 * Because the score's threshold is 3 and not 5, `yellow: 4` silently cost 4
 * HydroState points — observed on device as an exact -4 drop. Both formulas are
 * approved and UNCHANGED; only this mapping moved.
 *
 * Founder intent: clear, light_yellow and yellow must not directly penalise
 * HydroState during Phase-1 beta; only dark_yellow crosses either threshold.
 *
 *   clear        1 -> score  0   heat 0
 *   light_yellow 2 -> score  0   heat 0
 *   yellow       3 -> score  0   heat 0     (exactly at the score threshold)
 *   dark_yellow  5 -> score -8   heat 2
 *
 * `services/__tests__/urineMappingPenalties.test.ts` pins that table against BOTH
 * formulas and fails if any future mapping makes yellow cross either threshold.
 *
 * The numeric value is internal: never shown to members, and no copy may imply
 * the app measured urine concentration or hydration physiologically.
 *
 * Isolated here on purpose — replacing the mapping after science validation is a
 * single-constant edit. Do not change these numbers without founder approval.
 */
export const URINE_COLOR_SIGNAL: Readonly<Record<UrineColor, number>> = {
  clear: 1,
  light_yellow: 2,
  yellow: 3,
  dark_yellow: 5,
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
        recommendation: 'No extra fluids indicated by this signal. Your current command stays the guide.',
      };
    case 'light_yellow':
      return {
        color,
        colorLabel,
        hex,
        severity: 'good',
        verdict: 'Good Hydration Range',
        detail: 'Healthy hydration window. The system is in balance.',
        recommendation: 'In range. Follow your current command to hold it.',
      };
    case 'yellow':
      return {
        color,
        colorLabel,
        hex,
        severity: 'support',
        verdict: 'Hydration Support Suggested',
        detail: 'Fluids are trending behind demand. A good moment to top up.',
        recommendation: 'A good moment to act on your current command.',
      };
    case 'dark_yellow':
      return {
        color,
        colorLabel,
        hex,
        severity: 'correction',
        verdict: 'Deeper Color — A Good Time for Fluids',
        detail: 'Deeper urine color often tracks with lower recent fluid intake.',
        recommendation: 'Act on your current command now. Saving this reading updates it.',
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
