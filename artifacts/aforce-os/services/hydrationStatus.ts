/**
 * hydrationStatus — score-driven content map.
 *
 * Single source of truth for the HOME screen's headline / status
 * label / consequence line / primary CTA copy / command preview.
 * Driven entirely by the 0–100 hydration score so the screen never
 * shows conflicting state.
 *
 * Bands (matches theme/statusColor.ts STATUS_BANDS):
 *   85–100  OPTIMIZED
 *   70–84   STABLE
 *   50–69   DECLINING
 *   30–49   RISK
 *    0–29   DEPLETED
 */

import { getStatusColor, type StatusBand } from '../theme/statusColor';

export type HydrationStatusLabel =
  | 'OPTIMIZED'
  | 'STABLE'
  | 'DECLINING'
  | 'RISK'
  | 'DEPLETED';

export interface HydrationStatusContent {
  band: StatusBand;
  /** UI status label under the orb. */
  label: HydrationStatusLabel;
  /** Bold emotional headline above the orb. */
  headline: string;
  /** One-line consequence under the status label. */
  consequence: string;
  /** Primary action button text. */
  ctaText: string;
  /** Short command preview below the button. */
  command: string;
  /** Status color from the centralized palette. */
  color: ReturnType<typeof getStatusColor>;
}

/** Maps the centralized StatusBand → the home-screen label. */
const BAND_TO_LABEL: Record<StatusBand, HydrationStatusLabel> = {
  OPTIMAL: 'OPTIMIZED',
  STABLE: 'STABLE',
  DECLINING: 'DECLINING',
  RISK: 'RISK',
  CRITICAL: 'DEPLETED',
};

const CONTENT: Record<
  HydrationStatusLabel,
  Omit<HydrationStatusContent, 'band' | 'label' | 'color'>
> = {
  OPTIMIZED: {
    headline: 'System optimized.',
    consequence: 'Output is locked in.',
    ctaText: 'HOLD THE LINE',
    command: 'Stay on pace. Next check in 60 minutes.',
  },
  STABLE: {
    headline: 'Performance stable.',
    consequence: 'Maintain rhythm.',
    ctaText: 'MAINTAIN PERFORMANCE',
    command: 'Drink 12 oz within the next 45 minutes.',
  },
  DECLINING: {
    headline: 'Correction needed.',
    consequence: 'Hydration deficit beginning to impact output.',
    ctaText: 'CORRECT NOW',
    command: 'Increase electrolyte intake. Drink 16 oz now.',
  },
  RISK: {
    headline: 'Performance compromised.',
    consequence: 'Performance is compromised.',
    ctaText: 'EXECUTE COMMAND',
    command: 'Drink 20 oz water with electrolytes now.',
  },
  DEPLETED: {
    headline: 'System under stress.',
    consequence: 'Recovery window closing.',
    ctaText: 'STABILIZE SYSTEM',
    command: 'Immediate recovery required. Drink 20 oz now.',
  },
};

/**
 * Derive the full home-screen content set from a hydration score.
 * Pure function — given the same score it always returns the same
 * content, including the same color from the central palette.
 */
export function getHydrationStatus(score: number): HydrationStatusContent {
  const safe = Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 0;
  const color = getStatusColor(safe);
  const label = BAND_TO_LABEL[color.band];
  const copy = CONTENT[label];
  return {
    band: color.band,
    label,
    color,
    ...copy,
  };
}

/**
 * Format a Celsius temperature as Fahrenheit ("72°F"). Returns null
 * when the temperature is missing so the caller can hide the chunk.
 */
export function formatTemperatureF(tempC: number | null | undefined): string | null {
  if (tempC == null || !Number.isFinite(tempC)) return null;
  return `${Math.round(tempC * 9 / 5 + 32)}°F`;
}

/**
 * Minutes elapsed since `from` rounded down. Returns null when the
 * timestamp is missing so the caller can render an empty state.
 */
export function minutesSince(from: Date | string | number | null | undefined, now: number = Date.now()): number | null {
  if (from == null) return null;
  const ms = from instanceof Date ? from.getTime() : new Date(from).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((now - ms) / 60_000));
}
