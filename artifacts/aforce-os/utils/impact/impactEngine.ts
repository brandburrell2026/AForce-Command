/**
 * Impact Engine — closes the loop for AForce OS.
 *
 *   Before:  Signal → Command → Action → (stop)
 *   After:   Signal → Command → Action → IMPACT → learn → improve
 *
 * After a command is acted on, this pure engine asks: did the command
 * actually improve the outcome? It reads the before/after of whatever
 * signals are available (hydration, recovery, environmental heat pressure)
 * and produces a plain Impact read plus a Command Confidence that the
 * system can accumulate over time to learn which actions work best.
 *
 * Hard rules (locked):
 *   - Impact only MEASURES. It never modifies score. (Score Protection
 *     Rule: only completed behavior changes score; measurement does not.)
 *   - Reinforcement copy is positive-only and never a downer.
 *   - Confidence rises with signal quality: pass the Verification Layer's
 *     confidence in and it scales the result. Best-available signal source
 *     — the loop works at every tier.
 *
 * Pure module — no React Native, no clock, no I/O. Easy to unit-test.
 */

export type ImpactTrend = 'rising' | 'falling' | 'flat';

export interface ImpactContext {
  /** Was the command / behavior actually completed? */
  behaviorCompleted: boolean;
  /** Hydration score before the command window (0..100). */
  hydrationBefore: number;
  /** Hydration score after the command window (0..100). */
  hydrationAfter: number;
  /** Recovery delta before (-10..+10), or null when no signal. */
  recoveryBefore?: number | null;
  /** Recovery delta after (-10..+10), or null when no signal. */
  recoveryAfter?: number | null;
  /** Environmental heat pressure before (0..1, higher = more pressure). */
  heatPressureBefore?: number | null;
  /** Environmental heat pressure after (0..1, higher = more pressure). */
  heatPressureAfter?: number | null;
  /**
   * Signal quality from the Verification Layer (0..1). Scales the final
   * Command Confidence so high-quality sources move the needle more.
   */
  signalConfidence: number;
}

export interface ImpactResult {
  /** One-line plain summary of the measured impact. */
  summary: string;
  /** Direction of the combined outcome trend. */
  trend: ImpactTrend;
  /** Positive reinforcement copy (never a downer). */
  reinforcement: string;
  /** 0..1 confidence the command drove the outcome, scaled by signal quality. */
  commandConfidence: number;
  /** True when the behavior was completed AND the outcome improved. */
  outcomeAligned: boolean;
}

/** Improvement below this (normalized) counts as "no real change". */
const IMPROVEMENT_EPSILON = 0.02;

/** Normalization denominators that map each raw delta onto a ~-1..1 axis. */
const HYDRATION_RANGE = 100; // score is 0..100
const RECOVERY_RANGE = 20; // delta is -10..+10
const HEAT_RANGE = 1; // pressure is 0..1

type ImpactKey = 'hydration' | 'recovery' | 'heat';

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Derive the Impact of a command from the before/after signals. Only the
 * signals actually provided contribute; missing recovery/heat readings are
 * simply skipped (best-available source).
 */
export function deriveImpact(ctx: ImpactContext): ImpactResult {
  // Normalized, signed improvements (positive = better outcome). Hydration
  // is always available; recovery and heat only when both sides are given.
  const components: { key: ImpactKey; improve: number }[] = [
    {
      key: 'hydration',
      improve: (ctx.hydrationAfter - ctx.hydrationBefore) / HYDRATION_RANGE,
    },
  ];
  if (ctx.recoveryBefore != null && ctx.recoveryAfter != null) {
    components.push({
      key: 'recovery',
      improve: (ctx.recoveryAfter - ctx.recoveryBefore) / RECOVERY_RANGE,
    });
  }
  if (ctx.heatPressureBefore != null && ctx.heatPressureAfter != null) {
    // Heat is good when pressure goes DOWN, so improvement = before - after.
    components.push({
      key: 'heat',
      improve: (ctx.heatPressureBefore - ctx.heatPressureAfter) / HEAT_RANGE,
    });
  }

  const combined = components.reduce((sum, c) => sum + c.improve, 0);

  const trend: ImpactTrend =
    combined > IMPROVEMENT_EPSILON
      ? 'rising'
      : combined < -IMPROVEMENT_EPSILON
        ? 'falling'
        : 'flat';

  const outcomeAligned =
    ctx.behaviorCompleted && combined > IMPROVEMENT_EPSILON;

  // Strongest positive component drives the headline summary.
  const top = components.reduce((best, c) =>
    c.improve > best.improve ? c : best,
  );

  let summary: string;
  if (!ctx.behaviorCompleted) {
    summary = 'Command not yet executed';
  } else if (top.improve <= IMPROVEMENT_EPSILON) {
    summary = 'Holding steady';
  } else if (top.key === 'recovery') {
    summary = 'Recovery improved';
  } else if (top.key === 'heat') {
    summary = 'Heat pressure reduced';
  } else {
    summary = 'Stabilized faster';
  }

  let reinforcement: string;
  if (!ctx.behaviorCompleted) {
    reinforcement = 'Run the command when you can — start with water.';
  } else if (outcomeAligned) {
    reinforcement = 'Nice — that water moved the needle. Keep it flowing.';
  } else if (trend === 'falling') {
    reinforcement = 'Reset with water — the next command can turn it around.';
  } else {
    reinforcement = 'Holding steady — keep water in the loop.';
  }

  // Command Confidence: how strongly we believe the command drove the
  // outcome, scaled by signal quality (better signal → more confidence).
  const magnitude = clamp01(Math.abs(combined));
  let base: number;
  if (!ctx.behaviorCompleted) {
    base = 0.3;
  } else if (outcomeAligned) {
    base = 0.5 + 0.5 * magnitude;
  } else if (trend === 'falling') {
    base = 0.2;
  } else {
    base = 0.4;
  }
  const commandConfidence = round2(clamp01(base * clamp01(ctx.signalConfidence)));

  return { summary, trend, reinforcement, commandConfidence, outcomeAligned };
}

export interface ConfidenceObservation {
  /** Command Confidence measured for this single observation (0..1). */
  commandConfidence: number;
  /** Verification-layer signal quality for this observation (0..1). */
  signalConfidence: number;
}

/** Default learning rate before signal-quality weighting. */
const DEFAULT_LEARNING_RATE = 0.3;

/**
 * Fold a new observation into a running Command Confidence so the system
 * learns which actions work best over time. Higher-quality signals move
 * the prior more (the step is scaled by the observation's signalConfidence),
 * so noisy low-confidence reads barely nudge an established belief.
 *
 * Pure EMA — caller owns persistence (no storage wired here).
 */
export function foldCommandConfidence(
  prior: number,
  observation: ConfidenceObservation,
  baseLearningRate = DEFAULT_LEARNING_RATE,
): number {
  const alpha = clamp01(baseLearningRate * clamp01(observation.signalConfidence));
  const next =
    clamp01(prior) * (1 - alpha) + clamp01(observation.commandConfidence) * alpha;
  return round2(clamp01(next));
}
