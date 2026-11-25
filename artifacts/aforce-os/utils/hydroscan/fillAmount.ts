/**
 * HydroScan fill line (pure).
 *
 * "How much did you drink?" as a container that empties: the member drags the
 * line to where the drink is now, or taps Sip, a quarter, half, three quarters
 * or All. The fill, the slider and the amount all come from one number, the
 * share of the container that was drunk, so they can never disagree.
 *
 * Nothing is preselected and nothing here is measured by the camera. The
 * amount is what was drunk out of the STARTING amount, which the member has
 * already confirmed as the container size.
 */
import { MAX_SINGLE_LOG_OZ, MIN_SINGLE_LOG_OZ } from './amountOptions';

export const ML_PER_FL_OZ = 29.5735;
/** A sip is one fluid ounce, or the whole container if it holds less. */
export const SIP_OZ = 1;

export type FillChipId = 'sip' | 'quarter' | 'half' | 'three-quarters' | 'all';

export interface FillChip {
  readonly id: FillChipId;
  readonly label: string;
  readonly accessibilityLabel: string;
  /** Share of the container drunk, 0..1. */
  readonly share: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function fillChips(containerOz: number): readonly FillChip[] {
  const sip = containerOz > 0 ? clamp01(Math.min(SIP_OZ, containerOz) / containerOz) : 0;
  return [
    { id: 'sip', label: 'Sip', accessibilityLabel: 'A sip', share: sip },
    { id: 'quarter', label: '¼', accessibilityLabel: 'A quarter', share: 0.25 },
    { id: 'half', label: '½', accessibilityLabel: 'Half', share: 0.5 },
    { id: 'three-quarters', label: '¾', accessibilityLabel: 'Three quarters', share: 0.75 },
    { id: 'all', label: 'All', accessibilityLabel: 'All of it', share: 1 },
  ];
}

/** Ounces drunk for a share of the container, to a tenth of an ounce. */
export function drunkOz(containerOz: number, share: number): number {
  if (!(containerOz > 0)) return 0;
  return round1(containerOz * clamp01(share));
}

export const ozToMl = (oz: number): number => Math.round(oz * ML_PER_FL_OZ);

/** What is left in the container, for the fill: 1 is full, 0 is empty. */
export const remainingShare = (share: number): number => 1 - clamp01(share);

/** The chip whose share the current share sits on, if any. */
export function activeChip(containerOz: number, share: number): FillChipId | null {
  const hit = fillChips(containerOz).find((c) => Math.abs(c.share - clamp01(share)) < 0.005);
  return hit ? hit.id : null;
}

/** "About half", "About a quarter"… in plain words. Empty until something is chosen. */
export function shareWords(share: number): string {
  const s = clamp01(share);
  if (s <= 0) return '';
  if (s >= 0.97) return 'All of it';
  if (s >= 0.7) return 'About three quarters';
  if (s >= 0.42) return 'About half';
  if (s >= 0.2) return 'About a quarter';
  return 'A sip or two';
}

/** An amount the app can log: within the single-log limits. */
export function loggableOz(containerOz: number, share: number): number | null {
  const oz = drunkOz(containerOz, share);
  return oz >= MIN_SINGLE_LOG_OZ && oz <= MAX_SINGLE_LOG_OZ ? oz : null;
}

/** A drag position (0 at the left of the track, 1 at the right) to a share, snapped to 1%. */
export function shareFromTrack(position: number): number {
  return Math.round(clamp01(position) * 100) / 100;
}
