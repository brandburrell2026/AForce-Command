// ─── Phase 2 Clutch Hydration Engine (mocked, weight-based) ───────────────────
/**
 * Per spec:
 *   daily_baseline_oz = 0.5 × body_weight_lbs
 *   game_target_oz    = 0.25 × body_weight_lbs + (12 × active_30_min_windows)
 *   sticks_needed     = ceil(game_target_oz / 20)
 */
export function clutchHydrationPlan(bodyWeightLbs: number, active30MinWindows: number) {
  const dailyBaselineOz = Math.round(0.5 * bodyWeightLbs);
  const gameTargetOz = Math.round(0.25 * bodyWeightLbs + 12 * active30MinWindows);
  const sticksNeeded = Math.ceil(gameTargetOz / 20);
  return { dailyBaselineOz, gameTargetOz, sticksNeeded };
}

export type ClutchTier = 'PLATINUM' | 'STABLE' | 'RECOVERY' | 'DEPLETED';
export function clutchTier(percent: number): ClutchTier {
  if (percent >= 90) return 'PLATINUM';
  if (percent >= 70) return 'STABLE';
  if (percent >= 50) return 'RECOVERY';
  return 'DEPLETED';
}

// ─── Phase 3 Guardian Risk Engine (mocked) ────────────────────────────────────
/**
 * Guardian thresholds:
 *   0–24 OPTIMAL / 25–49 WATCH / 50–74 MODERATE / 75–100 CRITICAL
 */
export function guardianRiskScore(input: {
  hydrationPercent: number;
  bodyWeightLbs: number;
  activeMinutes: number;
  heatIndex: number;
  sweatRate: number;
  coreTempEstimate: number;
  quarter: number;
  pH: number;
}): number {
  const dehydrationContribution = (100 - input.hydrationPercent) * 0.45;
  const heatContribution = Math.min(30, Math.max(0, (input.heatIndex - 75) * 0.8));
  const exertionContribution = Math.min(20, input.activeMinutes * 0.18);
  const coreTempContribution = Math.min(20, Math.max(0, (input.coreTempEstimate - 99) * 12));
  const phContribution = Math.min(10, Math.max(0, (7.0 - input.pH) * 6));
  const quarterContribution = input.quarter > 2 ? 4 : 0;
  return Math.max(0, Math.min(100, Math.round(
    dehydrationContribution + heatContribution + exertionContribution +
    coreTempContribution + phContribution + quarterContribution
  )));
}

export function guardianTier(score: number): 'OPTIMAL' | 'WATCH' | 'MODERATE' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'MODERATE';
  if (score >= 25) return 'WATCH';
  return 'OPTIMAL';
}

// ─── Coach Recommendation Engine (Phase 2 + 3) ────────────────────────────────
/**
 * Per-athlete recommendation a coach can act on at the next dead ball.
 * Tone follows the AI command spec: WHAT + WHEN/HOW MUCH + OUTCOME, command
 * authority, no soft language ("consider / try / suggest").
 */
export type CoachAction = 'maintain' | 'top_off' | 'restore' | 'reduce_reps' | 'pull';

export interface ClutchRecommendation {
  tier: ClutchTier;
  action: CoachAction;
  fluidOz: number;
  sticks: number;
  recheckMinutes: number;
  command: string;
  detail: string;
}

export interface GuardianRecommendation {
  tier: 'OPTIMAL' | 'WATCH' | 'MODERATE' | 'CRITICAL';
  action: CoachAction;
  fluidOz: number;
  sticks: number;
  recheckMinutes: number;
  command: string;
  detail: string;
}

/**
 * Coach recommendation for a single player on the Clutch dashboard. Driven
 * purely by the player's hydration score (0–100), tier-banded so coaches can
 * scan the roster in a glance and execute at the next dead ball.
 */
export function clutchRecommendation(input: {
  hydrationScore: number;
  position?: string;
}): ClutchRecommendation {
  const tier = clutchTier(input.hydrationScore);
  switch (tier) {
    case 'PLATINUM':
      return {
        tier,
        action: 'maintain',
        fluidOz: 8,
        sticks: 0,
        recheckMinutes: 30,
        command: 'Maintain. 8 ounces water at next break.',
        detail: 'Keep rotation. Recheck end of quarter.',
      };
    case 'STABLE':
      return {
        tier,
        action: 'top_off',
        fluidOz: 12,
        sticks: 1,
        recheckMinutes: 20,
        command: '12 ounces + 1 stick at next dead ball.',
        detail: 'Hold rotation. Recheck in 20 min.',
      };
    case 'RECOVERY':
      return {
        tier,
        action: 'restore',
        fluidOz: 16,
        sticks: 2,
        recheckMinutes: 10,
        command: '16 ounces + 2 sticks now.',
        detail: 'Move to shaded area. Recheck in 10 min.',
      };
    case 'DEPLETED':
    default:
      return {
        tier,
        action: 'pull',
        fluidOz: 24,
        sticks: 3,
        recheckMinutes: 5,
        command: 'PULL FROM ROTATION. 24 ounces + 3 sticks.',
        detail: 'Cooling protocol. Recheck core temp in 5 min.',
      };
  }
}

/**
 * Coach recommendation for a single player on the Guardian dashboard. Driven
 * by the composite Guardian risk (0–100). At MODERATE / CRITICAL we escalate
 * to medical eval and pull the athlete from rotation.
 */
export function guardianRecommendation(input: {
  guardianRisk: number;
  position?: string;
}): GuardianRecommendation {
  const tier = guardianTier(input.guardianRisk);
  switch (tier) {
    case 'OPTIMAL':
      return {
        tier,
        action: 'maintain',
        fluidOz: 8,
        sticks: 0,
        recheckMinutes: 30,
        command: 'Continue play. 8 ounces at next break.',
        detail: 'Standard recheck next series.',
      };
    case 'WATCH':
      return {
        tier,
        action: 'top_off',
        fluidOz: 15,
        sticks: 1,
        recheckMinutes: 15,
        command: '15 ounces + 1 stick at next break.',
        detail: 'Monitor next series. Recheck in 15 min.',
      };
    case 'MODERATE':
      return {
        tier,
        action: 'reduce_reps',
        fluidOz: 20,
        sticks: 2,
        recheckMinutes: 8,
        command: 'Reduce reps 30%. 20 ounces + 2 sticks.',
        detail: 'Cooling towel. Recheck core temp in 8 min.',
      };
    case 'CRITICAL':
    default:
      return {
        tier,
        action: 'pull',
        fluidOz: 24,
        sticks: 2,
        recheckMinutes: 5,
        command: 'PULL FROM ROTATION. Medical eval.',
        detail: 'Cooling protocol now. 24 ounces + 2 sticks. Recheck in 5 min.',
      };
  }
}
