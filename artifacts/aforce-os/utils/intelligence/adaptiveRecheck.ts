/**
 * Command Confidence™ — adaptive recheck TIMING (STEP 2, Slice 3 · "timing only").
 *
 * Turns the per-category completion learning (`commandAdaptiveLearning`) into a
 * single, conservative effect: for command CATEGORIES the user reliably
 * completes, gently LENGTHEN the follow-up "did you follow it?" recheck cadence
 * so we nag them less. That is the entire behavior. It is pure + RN-free and
 * fully unit-tested.
 *
 * HARD LOCKS (every one enforced here, not by the caller):
 *  - Water-First: hydration-flavored categories are NEVER lengthened
 *    (`HYDRATION_PROTECTED_CATEGORIES`).
 *  - Hydration urgency never slowed/skipped: any non-`moderate` recheck urgency
 *    (i.e. heat / sweat strain is driving a shorter, safer cadence) disables the
 *    stretch entirely.
 *  - Monotonic non-decreasing: the returned interval is `>= baseIntervalMin`
 *    ALWAYS — this layer can only space prompts OUT, never speed them up or skip
 *    them, so it can never accelerate past or suppress a hydration prompt.
 *  - Score-Protection: timing only — never reads into, awards, mutates, or
 *    fabricates any score, and does not touch the deterministic command itself.
 *  - Flag-gated: `flagEnabled === false` is a hard no-op (factor 1).
 *
 * Extensible later (Slice 4 "optional add-on ordering") WITHOUT touching this
 * file: that is a separate concern over product/support ordering and must never
 * reorder water behind products.
 */
import { HYDRATION_PROTECTED_CATEGORIES, type CommandCategory } from './commandCategory';
import type { CategoryLearning } from './commandAdaptiveLearning';

/** Minimum learned completion rate before a category earns any spacing. */
export const RECHECK_RELIABLE_FOLLOW_RATE = 0.7;

/** Hard cap on how much the recheck interval may be stretched (1.5×). */
export const MAX_RECHECK_STRETCH = 1.5;

/** Recheck urgency tier (mirrors `AutopilotUrgency`). */
export type RecheckUrgency = 'moderate' | 'high' | 'critical';

export interface AdaptiveRecheckInput {
  /** The base cadence the engine/heat-guard already chose (minutes). */
  baseIntervalMin: number;
  /** Category of the command currently being rechecked. */
  category: CommandCategory;
  /** That category's learning, or null when none/insufficient. */
  learning: CategoryLearning | null;
  /** Why the base cadence was chosen — any non-moderate tier means strain. */
  urgency: RecheckUrgency;
  /** Adaptive learning master flag. */
  flagEnabled: boolean;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Multiplier applied to the base recheck interval, in `[1, MAX_RECHECK_STRETCH]`.
 * Returns exactly `1` (no-op) unless EVERY safety condition is met, then scales
 * linearly from 1.0 → MAX as the learned follow rate goes threshold → 1.0.
 */
export function recheckStretchFactor(input: AdaptiveRecheckInput): number {
  const { category, learning, urgency, flagEnabled } = input;
  if (!flagEnabled) return 1;
  // Strain is driving a safer (shorter) cadence — never override it.
  if (urgency !== 'moderate') return 1;
  // Water-First: hydration-flavored commands are never spaced out.
  if (HYDRATION_PROTECTED_CATEGORIES.has(category)) return 1;
  // Need a sample-gated, reliably-followed category.
  if (!learning || learning.status !== 'ready' || !isFiniteNumber(learning.followedRate)) {
    return 1;
  }
  if (learning.followedRate < RECHECK_RELIABLE_FOLLOW_RATE) return 1;

  const span = 1 - RECHECK_RELIABLE_FOLLOW_RATE; // 0.3
  const t = Math.min(1, Math.max(0, (learning.followedRate - RECHECK_RELIABLE_FOLLOW_RATE) / span));
  const factor = 1 + t * (MAX_RECHECK_STRETCH - 1);
  // Clamp defensively.
  return Math.min(MAX_RECHECK_STRETCH, Math.max(1, factor));
}

/**
 * The adaptive recheck interval (minutes). Guaranteed `>= baseIntervalMin`.
 * When any safety gate fails (flag off, strain, hydration category, insufficient
 * or unreliable learning) this returns `baseIntervalMin` unchanged.
 */
export function adaptiveRecheckIntervalMin(input: AdaptiveRecheckInput): number {
  const { baseIntervalMin } = input;
  // Fail-safe: never transform a non-positive / invalid base.
  if (!isFiniteNumber(baseIntervalMin) || baseIntervalMin <= 0) return baseIntervalMin;
  const factor = recheckStretchFactor(input);
  const stretched = Math.round(baseIntervalMin * factor);
  // Monotonic non-decreasing — can only space OUT, never speed up.
  return Math.max(baseIntervalMin, stretched);
}
