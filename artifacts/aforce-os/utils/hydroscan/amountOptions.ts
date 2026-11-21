/**
 * HydroScan amount step (pure).
 *
 * After the drink is confirmed the member is asked "How much did you drink?".
 * With a CONFIRMED package volume the choices are half the container, the
 * whole container and Custom; nothing is preselected. Without one the choices
 * fall back to the existing tap amounts or a typed amount. Nothing here saves
 * anything: the member's tap on "Log it" is the only write.
 */
import { formatOz, type Field } from './labelEvidence';

/** The single-log ceiling the Scan screen already uses (api-server intakeSchema, 64 oz). */
export const MAX_SINGLE_LOG_OZ = 64;
export const MIN_SINGLE_LOG_OZ = 0.5;

export type AmountKind = 'half' | 'full' | 'preset' | 'custom';

export interface AmountChoice {
  readonly id: string;
  readonly kind: AmountKind;
  readonly label: string;
  readonly accessibilityLabel: string;
  /** Ounces to log, or null for Custom (typed). */
  readonly oz: number | null;
}

export interface AmountPlan {
  readonly mode: 'container' | 'fallback';
  /** The confirmed container size when mode is 'container'. */
  readonly containerOz: number | null;
  readonly choices: readonly AmountChoice[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
export const CUSTOM_CHOICE: AmountChoice = {
  id: 'custom',
  kind: 'custom',
  label: 'Custom',
  accessibilityLabel: 'Type a custom amount',
  oz: null,
};

export function planAmountStep(volume: Field<number>, fallbackOz: readonly number[]): AmountPlan {
  const oz = volume.value;
  if (volume.confidence === 'confirmed' && oz != null && oz > 0 && oz <= MAX_SINGLE_LOG_OZ) {
    const half = round1(oz / 2);
    const choices: AmountChoice[] = [];
    if (half >= MIN_SINGLE_LOG_OZ && half < oz) {
      choices.push({
        id: 'half',
        kind: 'half',
        label: `${formatOz(half)} · half`,
        accessibilityLabel: `Half the container, ${formatOz(half)}`,
        oz: half,
      });
    }
    choices.push({
      id: 'full',
      kind: 'full',
      label: `${formatOz(oz)} · all`,
      accessibilityLabel: `The whole container, ${formatOz(oz)}`,
      oz: round1(oz),
    });
    choices.push(CUSTOM_CHOICE);
    return { mode: 'container', containerOz: round1(oz), choices };
  }
  return {
    mode: 'fallback',
    containerOz: null,
    choices: [
      ...fallbackOz.map(
        (n): AmountChoice => ({ id: `preset-${n}`, kind: 'preset', label: `${n} oz`, accessibilityLabel: `${n} ounces`, oz: n }),
      ),
      CUSTOM_CHOICE,
    ],
  };
}

/** A typed amount in fluid ounces: "12", "12.5", "12,5", "12 oz". Anything else is null. */
export function parseCustomOz(input: string): number | null {
  const m = /^\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:fl\.?\s*)?(?:oz\.?|ounces?)?\s*$/i.exec(input);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!.replace(',', '.'));
  if (!Number.isFinite(n) || n < MIN_SINGLE_LOG_OZ || n > MAX_SINGLE_LOG_OZ) return null;
  return round1(n);
}

export const CUSTOM_OZ_HINT = `Enter ${MIN_SINGLE_LOG_OZ} to ${MAX_SINGLE_LOG_OZ} fl oz.`;
