/**
 * Comparison Engine.
 *
 * Pure function: takes user state + product catalog → ranked results + a
 * decisive AI command. No bias to AForce — products win on physiology.
 *
 * Weighting strategy: each protocol has its own weight profile so the
 * engine adapts when the user's physiological state changes (this is what
 * makes "Compare" feel real-time and unbiased).
 */

import type {
  CompareEngineOutput,
  CompareInputs,
  CompareProduct,
  CompareResult,
  CompareCommand,
  ProtocolKind,
} from '../types/comparison';
import type { ScoreEngineOutput, UserState } from '../types';
import { COMPARE_PRODUCTS } from '../data/productDatabase';

// ─── Weighting profiles ──────────────────────────────────────────────────────
type Weights = {
  speed: number;
  electrolyteBalance: number;
  sugarImpact: number;     // weight on (100 - sugar)
  absorption: number;
  recovery: number;
  protocolBoost: number;   // bonus if product is compatible with protocol
};

const WEIGHTS: Record<ProtocolKind, Weights> = {
  // Steady daily — moderate weight on everything, low sugar penalty
  maintenance:           { speed: 0.20, electrolyteBalance: 0.25, sugarImpact: 0.15, absorption: 0.20, recovery: 0.15, protocolBoost: 5 },
  // Need to close the gap — speed + recovery dominate
  recovery:              { speed: 0.30, electrolyteBalance: 0.20, sugarImpact: 0.10, absorption: 0.20, recovery: 0.20, protocolBoost: 7 },
  // Emergency — speed/absorption rule, sugar hurts
  depletion_correction:  { speed: 0.30, electrolyteBalance: 0.20, sugarImpact: 0.15, absorption: 0.25, recovery: 0.10, protocolBoost: 9 },
  // Heat — electrolytes critical, sugar very bad
  heat_stress:           { speed: 0.20, electrolyteBalance: 0.35, sugarImpact: 0.20, absorption: 0.15, recovery: 0.10, protocolBoost: 7 },
  // Morning reset — recovery + balance
  morning_reset:         { speed: 0.20, electrolyteBalance: 0.25, sugarImpact: 0.15, absorption: 0.15, recovery: 0.25, protocolBoost: 5 },
};

// ─── Verdict mapping ─────────────────────────────────────────────────────────
function verdictFor(score: number): CompareResult['verdict'] {
  if (score >= 90) return 'optimal';
  if (score >= 78) return 'strong';
  if (score >= 65) return 'acceptable';
  if (score >= 45) return 'suboptimal';
  return 'avoid';
}

// ─── Per-product scoring ─────────────────────────────────────────────────────
function scoreProduct(p: CompareProduct, inputs: CompareInputs): { fit: number; axes: CompareResult['axes'] } {
  const w = WEIGHTS[inputs.protocol];
  const sugarImpact = 100 - p.sugar; // higher is better
  const axes = {
    speed: p.hydrationSpeed,
    electrolyteBalance: p.electrolytes,
    sugarImpact,
    absorption: p.absorptionRate,
    recovery: p.recoveryEfficiency,
  };

  let fit =
    axes.speed * w.speed +
    axes.electrolyteBalance * w.electrolyteBalance +
    sugarImpact * w.sugarImpact +
    axes.absorption * w.absorption +
    axes.recovery * w.recovery;

  if (p.compatibleProtocols.includes(inputs.protocol)) {
    fit += w.protocolBoost;
  }

  // Heat stress hurts sugar-heavy products further
  if (inputs.protocol === 'heat_stress' && p.sugar >= 60) {
    fit -= 6;
  }
  // Plain water is never enough during depletion correction
  if (inputs.protocol === 'depletion_correction' && p.category === 'plain_water') {
    fit -= 10;
  }
  // Score severity floor — extreme depletion penalizes weak electrolyte products
  if (inputs.score < 40 && p.electrolytes < 60) {
    fit -= 4;
  }

  return { fit: Math.max(0, Math.min(100, Math.round(fit))), axes };
}

// ─── Why-it-fits text ────────────────────────────────────────────────────────
// Symmetric, brand-agnostic phrasing. Text is generated strictly from
// axis values vs the protocol's needs — never from `isAForce`.
function whyItFits(p: CompareProduct, inputs: CompareInputs, axes: CompareResult['axes']): string {
  if (p.category === 'plain_water') {
    return inputs.protocol === 'depletion_correction'
      ? 'Hydrates volume but lacks electrolyte replacement. Insufficient for current state.'
      : 'Baseline hydration only. No electrolyte support.';
  }
  if (axes.sugarImpact <= 40) {
    return 'High sugar load slows uptake. Misaligned with current protocol.';
  }
  const compatible = p.compatibleProtocols.includes(inputs.protocol);
  const fastUptake = axes.speed >= 85 && axes.absorption >= 85;
  const strongElectrolytes = axes.electrolyteBalance >= 85;

  if (inputs.protocol === 'depletion_correction' || inputs.score < 50) {
    if (compatible && fastUptake && strongElectrolytes) return 'Fast electrolyte absorption matches current depletion state. Closes the deficit rapidly.';
    if (fastUptake) return 'Fast uptake but lower electrolyte density for the current depletion load.';
    return 'Slower uptake than the depletion state requires.';
  }
  if (inputs.protocol === 'heat_stress') {
    if (strongElectrolytes && axes.sugarImpact >= 80) return 'Electrolyte density and low sugar load are tuned for heat stress.';
    if (strongElectrolytes) return 'Strong electrolyte density. Sugar load reduces fit for heat stress.';
    return 'Electrolyte density below the heat-stress threshold.';
  }
  if (inputs.protocol === 'recovery') {
    if (compatible && axes.recovery >= 85) return 'Recovery-grade balance. Closes the deficit fast.';
    return 'Acceptable hydration but recovery efficiency below target.';
  }
  if (p.category === 'medical_oral_rehydration') {
    return 'Strong oral rehydration formula. Effective but not state-adaptive.';
  }
  if (fastUptake && strongElectrolytes) return 'Strong electrolyte and absorption profile. Compatible with current protocol.';
  return 'Acceptable for general use. Not optimized for current protocol.';
}

// ─── Command builder ─────────────────────────────────────────────────────────
function buildCommand(winner: CompareResult, inputs: CompareInputs): CompareCommand {
  const p = winner.product;
  const urgent = inputs.protocol === 'depletion_correction' || inputs.score < 40;
  // Symmetric phrasing — same template regardless of brand. Verdict drives tone.
  const verb = winner.verdict === 'optimal' ? 'is optimal' : 'is the best fit';
  const action = `${p.name} ${verb}. Take 1 serving now with 16 oz water. Recheck in 20 minutes.`;
  return {
    action,
    explanation: winner.whyItFits,
    productId: p.id,
    urgencyLevel: urgent ? 'critical' : (winner.fitScore < 78 ? 'high' : 'medium'),
  };
}

// Safe fallback for empty / fully-invalid catalog.
function emptyCommand(): CompareCommand {
  return {
    action: 'No suitable products available. Take 16 oz water now and recheck in 20 minutes.',
    explanation: 'Catalog is empty or unavailable. Defaulting to baseline hydration.',
    productId: '',
    urgencyLevel: 'medium',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────
export interface ComputeArgs {
  inputs: CompareInputs;
  catalog?: CompareProduct[];
}

// Defensive normalization — clamp inputs so downstream math never NaNs.
function normalizeInputs(i: CompareInputs): CompareInputs {
  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
  return {
    ...i,
    score: clamp(i.score, 0, 100),
    heatLoad: clamp(i.heatLoad, 0, 1),
    sweatRate: clamp(i.sweatRate, 0, 1),
  };
}

export function computeComparison({ inputs, catalog = COMPARE_PRODUCTS }: ComputeArgs): CompareEngineOutput {
  const safeInputs = normalizeInputs(inputs);

  // Empty / invalid catalog guard — never throw, never deref undefined.
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      inputs: safeInputs,
      results: [],
      winner: undefined,
      command: emptyCommand(),
    };
  }

  const scored = catalog.map((product) => {
    const { fit, axes } = scoreProduct(product, safeInputs);
    const result: CompareResult = {
      product,
      fitScore: fit,
      rank: 0,
      whyItFits: whyItFits(product, safeInputs, axes),
      axes,
      verdict: verdictFor(fit),
    };
    return result;
  });

  scored.sort((a, b) => b.fitScore - a.fitScore);
  scored.forEach((r, i) => { r.rank = i + 1; });

  const winner = scored[0];
  return {
    generatedAt: new Date().toISOString(),
    inputs: safeInputs,
    results: scored,
    winner,
    command: buildCommand(winner, safeInputs),
  };
}

// ─── Adapter: derive CompareInputs from app state ────────────────────────────
export function inferInputs(engineOutput: ScoreEngineOutput, userState: UserState, goal: CompareInputs['goal'] = 'performance'): CompareInputs {
  const { performanceState, score } = engineOutput;
  let protocol: ProtocolKind = 'maintenance';
  if (userState.heatLoad >= 0.7) protocol = 'heat_stress';
  else if (performanceState.level === 'DEPLETED' || score < 40) protocol = 'depletion_correction';
  else if (performanceState.level === 'RECOVERING' || score < 65) protocol = 'recovery';
  else if (userState.isAwake && !userState.hasSeenMorningCommand && userState.unitsConsumedToday === 0) protocol = 'morning_reset';

  const hoursSinceLastIntake = (Date.now() - new Date(userState.lastIntakeTime).getTime()) / (1000 * 60 * 60);

  return {
    state: performanceState.level,
    score,
    protocol,
    goal,
    heatLoad: userState.heatLoad,
    sweatRate: userState.sweatRate,
    symptomCount: userState.symptoms.length,
    hoursSinceLastIntake,
  };
}
