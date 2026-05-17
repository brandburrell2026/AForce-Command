/**
 * services/recoveryCapacity.ts
 *
 * Recovery Capacity Score — the AForce replacement for the BAC /
 * impairment math that previously lived in `bacEstimationService.ts`
 * and `legalSafetyService.ts`.
 *
 * Per the master update spec:
 *
 *   RecoveryCapacityScore =
 *     0.60 · AutoPilot performance score (0–100)
 *   + 0.25 · hydration compliance        (0–1, scaled ×100)
 *   + 0.15 · (1 − environmental stress)  (0–1, scaled ×100)
 *
 * The output is a single 0–100 number mapped to four named bands
 * with the WHOOP-Cinematic colour tokens:
 *
 *   Peak       85–100  →  teal      (#19E5C6)
 *   Stable     60–84   →  deep blue (#3D7BFF)
 *   Declining  45–59   →  amber     (#F5A524)
 *   Critical    0–44   →  Ferrari crimson (#FF2800)
 *
 * This module is intentionally a pure helper — no React, no store,
 * no I/O. The store wires real inputs to it; tests can drive it
 * directly. BAC numbers, drink counts, impairment tiers, and any
 * "do not drive" language have been removed from this surface.
 */

/* ──────────────────────────── types ──────────────────────────── */

export type RecoveryBand = 'peak' | 'stable' | 'declining' | 'critical';

export interface RecoveryBandMeta {
  readonly band: RecoveryBand;
  /** Lowercase machine label — useful for telemetry / i18n keys. */
  readonly id: RecoveryBand;
  /** Human-facing label as it appears in the UI. */
  readonly label: 'Peak' | 'Stable' | 'Declining' | 'Critical';
  /** WHOOP-Cinematic hex token. */
  readonly color: string;
  /** Inclusive lower / upper bounds on the 0–100 scale. */
  readonly min: number;
  readonly max: number;
}

export interface RecoveryCapacityInputs {
  /**
   * Latest AutoPilot performance score (0–100). Sourced from
   * `state.engineOutput.performanceState.score` in the live app.
   */
  autoPilotScore: number;
  /**
   * Hydration compliance, normalised 0–1. The store currently
   * derives this from `userState.complianceStreak` via
   * `complianceFromStreak()` below, but any 0–1 signal is accepted.
   */
  hydrationCompliance: number;
  /**
   * Environmental stress, normalised 0–1 (1 = maximum stress).
   * Computed from temperature, humidity, and activity level —
   * see `environmentalStress()` below.
   */
  environmentalStress: number;
}

export interface RecoveryCapacityScore {
  /** Final blended score, integer 0–100. */
  readonly score: number;
  readonly band: RecoveryBand;
  readonly meta: RecoveryBandMeta;
  /**
   * Component contributions in points (post-weight, pre-round)
   * so the UI can show "what drove this".
   */
  readonly contributions: {
    readonly autoPilot: number;          // 0–60
    readonly hydrationCompliance: number; // 0–25
    readonly environmental: number;       // 0–15
  };
}

/* ───────────────────────── band table ─────────────────────────
 *
 * Order matters — `bandFor()` scans top-down, so Peak must come
 * first. The hex colours mirror `theme/colors.ts` so designers can
 * find them in one place if they need to retune.
 */

export const RECOVERY_BANDS: readonly RecoveryBandMeta[] = [
  { band: 'peak',      id: 'peak',      label: 'Peak',      color: '#19E5C6', min: 85, max: 100 },
  { band: 'stable',    id: 'stable',    label: 'Stable',    color: '#3D7BFF', min: 60, max: 84  },
  { band: 'declining', id: 'declining', label: 'Declining', color: '#F5A524', min: 45, max: 59  },
  { band: 'critical',  id: 'critical',  label: 'Critical',  color: '#FF2800', min: 0,  max: 44  },
] as const;

/* ───────────────────────── helpers ───────────────────────────── */

/** Clamp `n` to the inclusive `[lo, hi]` interval. NaN → `lo`. */
export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/** Linear ramp: `0` at/below `from`, `1` at/above `to`, NaN → `0`. */
export function ramp(value: number, from: number, to: number): number {
  if (!Number.isFinite(value) || to === from) return 0;
  const t = (value - from) / (to - from);
  return clamp(t, 0, 1);
}

/**
 * Convert the existing `complianceStreak` integer (days in a row
 * meeting hydration target) into a 0–1 compliance signal.
 *
 * A 7-day streak counts as "fully compliant" (1.0); a 0-day streak
 * is 0.0; everything in between ramps linearly. This is intentionally
 * a simple proxy — a richer rolling-window calculation can replace
 * it later without touching `computeRecoveryCapacity()`.
 */
export function complianceFromStreak(streakDays: number): number {
  return ramp(streakDays, 0, 7);
}

/**
 * Environmental stress 0–1 (higher = worse) derived from the same
 * weather + activity signals the existing depletion engine reads.
 *
 * We take the **max** of the three sub-stressors rather than the
 * average so that a single dangerous condition (e.g. 40 °C heat)
 * dominates the score even if humidity and activity are low.
 *
 * All inputs are optional: missing values contribute zero stress
 * rather than fabricating a placeholder.
 */
export function environmentalStress(input: {
  /** Ambient temperature in Celsius (e.g. `userState.weatherTempC`). */
  tempC?: number | null;
  /** Relative humidity 0–100 (e.g. `userState.weatherHumidity`). */
  humidity?: number | null;
  /** Activity level 0–10 (e.g. `userState.activityLevel`). */
  activityLevel?: number | null;
}): number {
  const heat = input.tempC == null ? 0 : ramp(input.tempC, 22, 38);
  const humidity = input.humidity == null ? 0 : ramp(input.humidity, 40, 90);
  const activity = input.activityLevel == null ? 0 : ramp(input.activityLevel, 0, 10);
  return Math.max(heat, humidity, activity);
}

/** Locate the band metadata for a given 0–100 score. Always returns one. */
export function bandFor(score: number): RecoveryBandMeta {
  const clamped = clamp(Math.round(score), 0, 100);
  for (const meta of RECOVERY_BANDS) {
    if (clamped >= meta.min && clamped <= meta.max) return meta;
  }
  // Unreachable — bands cover 0–100 exhaustively — but keep TS happy
  // and degrade gracefully if someone retunes the table incorrectly.
  return RECOVERY_BANDS[RECOVERY_BANDS.length - 1]!;
}

/* ─────────────────────── main computation ─────────────────────── */

/**
 * Compute the Recovery Capacity Score from its three components.
 *
 * All inputs are clamped defensively so callers don't need to
 * sanitise — feeding `NaN`, negative numbers, or out-of-range values
 * produces a well-defined score rather than throwing.
 */
export function computeRecoveryCapacity(
  inputs: RecoveryCapacityInputs,
): RecoveryCapacityScore {
  const autoPilot = clamp(inputs.autoPilotScore, 0, 100);
  const hydration = clamp(inputs.hydrationCompliance, 0, 1);
  const envStress = clamp(inputs.environmentalStress, 0, 1);

  const autoPilotPts = 0.6 * autoPilot;            // 0–60
  const hydrationPts = 0.25 * hydration * 100;     // 0–25
  const envPts       = 0.15 * (1 - envStress) * 100; // 0–15

  const raw = autoPilotPts + hydrationPts + envPts;
  const score = clamp(Math.round(raw), 0, 100);
  const meta = bandFor(score);

  return {
    score,
    band: meta.band,
    meta,
    contributions: {
      autoPilot: autoPilotPts,
      hydrationCompliance: hydrationPts,
      environmental: envPts,
    },
  };
}
