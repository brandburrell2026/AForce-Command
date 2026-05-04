/**
 * AForce OS — Centralized Score-Driven Status Color System
 *
 * Single source of truth for the AI Coach status palette. Every coach
 * surface (status dot, voice bars, headline accent, command card border /
 * glow, CTA button, progress line, Pressure Mode effects) reads its color
 * from `getStatusColor(score)` so the entire layer reacts to the same
 * 0-100 score in lock-step.
 *
 * Five score bands — exactly matching the brand spec:
 *
 *   OPTIMAL    85-100   Neon green     — soft, wide glow
 *   STABLE     70-84    Brand lime     — subtle glow
 *   DECLINING  50-69    Amber/yellow   — minimal glow
 *   RISK       30-49    Orange         — medium intensity
 *   CRITICAL   0-29     Red            — tight, intense glow
 *
 * Design rules baked in:
 *   - Backgrounds stay dark (this module never returns a fill background).
 *   - Text colors stay white/off-white (consumed from `theme/colors.ts`).
 *   - Color is a SIGNAL — borders, dots, glows, accents, CTA tint.
 *   - No gradients across bands; transitions are tweened by the
 *     companion hook `useAnimatedStatusColor`.
 *
 * Pressure Mode amplifies the same band:
 *   - Slightly higher saturation (deeper hex variant per band).
 *   - Stronger glow (higher alpha).
 *   - Faster pulse animation (animationSpeed multiplier ≥ 1).
 */

export type StatusBand =
  | 'OPTIMAL'
  | 'STABLE'
  | 'DECLINING'
  | 'RISK'
  | 'CRITICAL';

export interface StatusBandThreshold {
  band: StatusBand;
  /** Inclusive lower bound (0-100). */
  min: number;
  /** Inclusive upper bound (0-100). */
  max: number;
  /** 0 = CRITICAL … 4 = OPTIMAL — used by Reanimated interpolation. */
  index: number;
}

/**
 * Ordered worst → best so `interpolateColor(bandIndex, [0..4], stops)`
 * lines up: index 0 = CRITICAL red, index 4 = OPTIMAL neon.
 */
export const STATUS_BANDS: readonly StatusBandThreshold[] = [
  { band: 'CRITICAL',  min:  0, max: 29,  index: 0 },
  { band: 'RISK',      min: 30, max: 49,  index: 1 },
  { band: 'DECLINING', min: 50, max: 69,  index: 2 },
  { band: 'STABLE',    min: 70, max: 84,  index: 3 },
  { band: 'OPTIMAL',   min: 85, max: 100, index: 4 },
] as const;

/** Hex primaries — calm baseline (WHOOP-cinematic tuned). */
const PRIMARY: Record<StatusBand, string> = {
  CRITICAL:  '#FF0026', // WHOOP recovery red
  RISK:      '#FF8C1A', // orange
  DECLINING: '#FFDE00', // WHOOP recovery yellow
  STABLE:    '#B6FF00', // WHOOP lime (hero accent)
  OPTIMAL:   '#16EC06', // WHOOP recovery green
};

/** Hex primaries — Pressure Mode (slightly deeper saturation). */
const PRIMARY_PRESSURE: Record<StatusBand, string> = {
  CRITICAL:  '#FF0040',
  RISK:      '#FF7A00',
  DECLINING: '#FFC000',
  STABLE:    '#A0FF20',
  OPTIMAL:   '#00FF00',
};

/** Glow alpha per band — extreme bands are tighter & more intense. */
const GLOW_ALPHA: Record<StatusBand, number> = {
  CRITICAL:  0.70, // tight + intense
  RISK:      0.45, // medium
  DECLINING: 0.20, // minimal
  STABLE:    0.24, // subtle
  OPTIMAL:   0.32, // soft + wide
};

const GLOW_ALPHA_PRESSURE: Record<StatusBand, number> = {
  CRITICAL:  0.92,
  RISK:      0.65,
  DECLINING: 0.32,
  STABLE:    0.36,
  OPTIMAL:   0.45,
};

/**
 * Glow shadowRadius (RN style units). Lower = tighter focused glow,
 * higher = soft wide halo. Matches the brand spec mapping.
 */
const GLOW_RADIUS: Record<StatusBand, number> = {
  CRITICAL:   8, // tight
  RISK:      14, // medium
  DECLINING: 10, // minimal
  STABLE:    14, // subtle
  OPTIMAL:   22, // soft + wide
};

/**
 * Animation speed multiplier — baseline 1.0. Worse bands beat faster
 * (urgency); Pressure Mode multiplies on top.
 */
const ANIMATION_SPEED: Record<StatusBand, number> = {
  CRITICAL:  1.6,
  RISK:      1.35,
  DECLINING: 1.15,
  STABLE:    1.0,
  OPTIMAL:   0.85,
};

const PRESSURE_SPEED_BOOST = 1.4;

export interface StatusColor {
  band: StatusBand;
  /** 0-4, worst → best. Drives Reanimated `interpolateColor`. */
  bandIndex: number;
  /** Solid accent hex — borders, dots, text accents, CTA tint. */
  primary: string;
  /** Same accent at higher saturation for Pressure Mode. */
  primaryPressure: string;
  /** Glow tint as #RRGGBBAA (alpha baked in for shadow / halo / dim fills). */
  glow: string;
  /** Pressure-mode glow with amplified alpha. */
  glowPressure: string;
  /** 0-1 alpha used for shadowOpacity / halo opacity. */
  glowAlpha: number;
  /** RN shadowRadius. Tighter for CRITICAL, wider for OPTIMAL. */
  glowRadius: number;
  /** Animation tempo multiplier. 1.0 = baseline; >1 = faster. */
  animationSpeed: number;
  /** True when this StatusColor was resolved with pressure mode on. */
  isPressure: boolean;
}

export interface GetStatusColorOptions {
  /** When true, returns the amplified Pressure Mode variant. */
  pressure?: boolean;
}

/**
 * Resolve the band for any score. Scores below 0 clamp to CRITICAL,
 * above 100 clamp to OPTIMAL. NaN / non-finite inputs fall back to
 * CRITICAL so the UI degrades safely (worst-case signal).
 */
export function getStatusBand(score: number): StatusBand {
  if (!Number.isFinite(score)) return 'CRITICAL';
  if (score < 30) return 'CRITICAL';
  if (score < 50) return 'RISK';
  if (score < 70) return 'DECLINING';
  if (score < 85) return 'STABLE';
  return 'OPTIMAL';
}

/** Convenience — returns the integer band index used by Reanimated tweens. */
export function getStatusBandIndex(score: number): number {
  const band = getStatusBand(score);
  return STATUS_BANDS.find((b) => b.band === band)!.index;
}

/** Build the #RRGGBBAA hex string from a base hex + alpha 0-1. */
function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const a = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${hex}${a}`;
}

/**
 * The ONE function every AI Coach surface should call. Returns the full
 * color contract for the current score (and Pressure Mode flag).
 */
export function getStatusColor(
  score: number,
  opts: GetStatusColorOptions = {},
): StatusColor {
  const isPressure = opts.pressure === true;
  const band = getStatusBand(score);
  const bandIndex = STATUS_BANDS.find((b) => b.band === band)!.index;

  const primary = PRIMARY[band];
  const primaryPressure = PRIMARY_PRESSURE[band];

  const baseAlpha = GLOW_ALPHA[band];
  const pressureAlpha = GLOW_ALPHA_PRESSURE[band];
  const glow = withAlpha(primary, baseAlpha);
  const glowPressure = withAlpha(primaryPressure, pressureAlpha);

  const baseSpeed = ANIMATION_SPEED[band];
  const animationSpeed = isPressure ? baseSpeed * PRESSURE_SPEED_BOOST : baseSpeed;

  return {
    band,
    bandIndex,
    primary: isPressure ? primaryPressure : primary,
    primaryPressure,
    glow: isPressure ? glowPressure : glow,
    glowPressure,
    glowAlpha: isPressure ? pressureAlpha : baseAlpha,
    glowRadius: GLOW_RADIUS[band],
    animationSpeed,
    isPressure,
  };
}

/**
 * Ordered hex stops for Reanimated `interpolateColor` — matches
 * STATUS_BANDS index order (0 = CRITICAL → 4 = OPTIMAL).
 */
export const PRIMARY_STOPS: readonly string[] = STATUS_BANDS.map(
  (b) => PRIMARY[b.band],
);
export const PRIMARY_STOPS_PRESSURE: readonly string[] = STATUS_BANDS.map(
  (b) => PRIMARY_PRESSURE[b.band],
);
export const GLOW_STOPS: readonly string[] = STATUS_BANDS.map((b) =>
  withAlpha(PRIMARY[b.band], GLOW_ALPHA[b.band]),
);
export const GLOW_STOPS_PRESSURE: readonly string[] = STATUS_BANDS.map((b) =>
  withAlpha(PRIMARY_PRESSURE[b.band], GLOW_ALPHA_PRESSURE[b.band]),
);

/** Numeric stops 0..4 — used as the `inputRange` to `interpolateColor`. */
export const BAND_INDEX_STOPS: readonly number[] = STATUS_BANDS.map(
  (b) => b.index,
);
