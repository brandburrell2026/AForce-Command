/**
 * Comparison Engine.
 *
 * Pure function: takes user state + product catalog → ranked results with
 * factual why-it-fits explanations. No bias to AForce — products win on
 * physiology.
 *
 * COMMAND-AUTHORITY CONTAINMENT (re-plumb wave, founder-authorized): this
 * engine used to also compose a "decisive AI command" — bucketed action
 * copy carrying its own doses and recheck clocks. No surface ever
 * rendered it (the scan service, the only caller, consumes `results`
 * alone), so it was a dead second command authority beside the canonical
 * RecoveryCommand and was retired rather than re-copywritten. The engine
 * CALCULATES; the one command decides
 * (services/__tests__/commandAuthorityContainment.test.ts).
 *
 * Weighting strategy: each protocol has its own weight profile so the
 * engine adapts when the user's physiological state changes (this is what
 * makes "Compare" feel real-time and unbiased).
 */

import type {
  AttributeProvenance,
  CompareAttribute,
  CompareEngineOutput,
  CompareInputs,
  CompareProduct,
  CompareResult,
  ProtocolKind,
} from '../types/comparison';
import type { ScoreEngineOutput, UserState } from '../types';
import { COMPARE_PRODUCTS } from '../data/productDatabase';
import { fraction01FromScale10 } from '../utils/quantities';

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

// ─── Provenance (D3) ─────────────────────────────────────────────────────────

/** The five scored attributes, in scoring order. */
const ALL_ATTRIBUTES: CompareAttribute[] = [
  'hydrationSpeed',
  'electrolytes',
  'sugar',
  'absorptionRate',
  'recoveryEfficiency',
];

export const knownAttributes = { ALL: ALL_ATTRIBUTES } as const;

/**
 * Evidence quality for one attribute (founder ruling D3).
 *
 * Resolution order, deliberately explicit:
 *   1. an explicit provenance entry wins;
 *   2. a `null` value is UNKNOWN by definition — there is nothing to grade;
 *   3. otherwise ESTIMATED, the catalog default.
 *
 * VERIFIED is never inferred. It must be declared against a canonical source,
 * and brand ownership is not one (`isAForce` is not read here, by design).
 */
export function attributeProvenance(
  p: CompareProduct,
  attr: CompareAttribute,
): AttributeProvenance {
  const declared = p.provenance?.[attr];
  if (declared) return declared;
  return p[attr] == null ? 'unknown' : 'estimated';
}

/** True when the attribute has a real value the engine may score. */
function isKnown(p: CompareProduct, attr: CompareAttribute): boolean {
  return p[attr] != null && attributeProvenance(p, attr) !== 'unknown';
}

// ─── Verdict mapping ─────────────────────────────────────────────────────────
function verdictFor(score: number | null): CompareResult['verdict'] {
  // Nothing known — the honest verdict is that there IS no verdict (founder
  // ruling R3, E7). The earlier form returned 'avoid' here, which punished
  // absence as though a bad measurement existed — the exact silent penalty
  // ruling D5 forbids. UNKNOWN ≠ ZERO ≠ BAD.
  if (score == null) return 'uncomparable';
  if (score >= 90) return 'optimal';
  if (score >= 78) return 'strong';
  if (score >= 65) return 'acceptable';
  if (score >= 45) return 'suboptimal';
  return 'avoid';
}

// ─── Per-product scoring ─────────────────────────────────────────────────────
function scoreProduct(
  p: CompareProduct,
  inputs: CompareInputs,
): { fit: number | null; axes: CompareResult['axes']; coverage: { known: number; total: number } } {
  const w = WEIGHTS[inputs.protocol];

  // UNKNOWN attributes carry no value and therefore do not vote (D5). The
  // previous behaviour defaulted them to 0, which — because sugar is inverted
  // and the rest are not — made the SAME absence reward some products and
  // penalize others. Excluding the axis and renormalizing over the weights
  // that remain makes absence genuinely neutral.
  const sugarKnown = isKnown(p, 'sugar');
  const axes: CompareResult['axes'] = {
    speed: isKnown(p, 'hydrationSpeed') ? p.hydrationSpeed : null,
    electrolyteBalance: isKnown(p, 'electrolytes') ? p.electrolytes : null,
    sugarImpact: sugarKnown ? 100 - (p.sugar as number) : null,
    absorption: isKnown(p, 'absorptionRate') ? p.absorptionRate : null,
    recovery: isKnown(p, 'recoveryEfficiency') ? p.recoveryEfficiency : null,
  };

  const contributions: { value: number; weight: number }[] = [
    { value: axes.speed, weight: w.speed },
    { value: axes.electrolyteBalance, weight: w.electrolyteBalance },
    { value: axes.sugarImpact, weight: w.sugarImpact },
    { value: axes.absorption, weight: w.absorption },
    { value: axes.recovery, weight: w.recovery },
  ].filter((c): c is { value: number; weight: number } => c.value != null);

  const coverage = { known: contributions.length, total: ALL_ATTRIBUTES.length };

  // Nothing known at all — the engine says so rather than inventing a number.
  if (contributions.length === 0) return { fit: null, axes, coverage };

  const weightSum = contributions.reduce((acc, c) => acc + c.weight, 0);
  let fit = contributions.reduce((acc, c) => acc + c.value * c.weight, 0) / weightSum;

  if (p.compatibleProtocols.includes(inputs.protocol)) {
    fit += w.protocolBoost;
  }

  // Every conditional penalty below is gated on a KNOWN attribute. An unknown
  // value must never be read as "low" — that is the silent-penalty failure the
  // ruling names explicitly.
  if (inputs.protocol === 'heat_stress' && sugarKnown && (p.sugar as number) >= 60) {
    fit -= 6;
  }
  if (inputs.protocol === 'depletion_correction' && p.category === 'plain_water') {
    fit -= 10;
  }
  if (inputs.score < 40 && isKnown(p, 'electrolytes') && (p.electrolytes as number) < 60) {
    fit -= 4;
  }

  return { fit: Math.max(0, Math.min(100, Math.round(fit))), axes, coverage };
}

// ─── Why-it-fits text ────────────────────────────────────────────────────────
// Symmetric, brand-agnostic phrasing. Text is generated strictly from
// axis values vs the protocol's needs — never from `isAForce`.
function whyItFits(p: CompareProduct, inputs: CompareInputs, axes: CompareResult['axes']): string {
  // Zero evidence → zero judgement (founder ruling R3). Without this branch
  // the fall-through below fabricated "Acceptable for general use. Not
  // optimized for current protocol." for a product NOTHING is known about.
  if (Object.values(axes).every((v) => v == null)) {
    return 'No product characteristics are on file.';
  }
  // An UNKNOWN axis may not satisfy or fail a threshold — absence is not a
  // low reading (D5). `at()` answers "is this KNOWN and past the bar?", so
  // every comparison below is false when the value is simply not on file.
  const at = (v: number | null, cmp: (n: number) => boolean) => v != null && cmp(v);

  if (p.category === 'plain_water') {
    return inputs.protocol === 'depletion_correction'
      ? 'Hydrates volume; contains no electrolytes.'
      : 'Baseline hydration only. No electrolyte support.';
  }
  if (at(axes.sugarImpact, (n) => n <= 40)) {
    return 'High sugar load slows uptake. Misaligned with current protocol.';
  }
  const compatible = p.compatibleProtocols.includes(inputs.protocol);
  const fastUptake = at(axes.speed, (n) => n >= 85) && at(axes.absorption, (n) => n >= 85);
  const strongElectrolytes = at(axes.electrolyteBalance, (n) => n >= 85);

  if (inputs.protocol === 'depletion_correction' || inputs.score < 50) {
    if (compatible && fastUptake && strongElectrolytes) return 'High electrolyte density and a fast-uptake profile for depletion protocols.';
    if (fastUptake) return 'Fast uptake but lower electrolyte density for the current depletion load.';
    return 'Slower uptake than the depletion state requires.';
  }
  if (inputs.protocol === 'heat_stress') {
    if (strongElectrolytes && at(axes.sugarImpact, (n) => n >= 80)) return 'Electrolyte density and low sugar load fit hot-conditions protocols.';
    if (strongElectrolytes) return 'Strong electrolyte density. Sugar load reduces fit for heat stress.';
    return 'Electrolyte density below the heat-stress threshold.';
  }
  if (inputs.protocol === 'recovery') {
    if (compatible && at(axes.recovery, (n) => n >= 85)) return 'Recovery-protocol fit with balanced electrolytes.';
    return 'Acceptable hydration but recovery efficiency below target.';
  }
  if (p.category === 'medical_oral_rehydration') {
    return 'Strong oral rehydration formula. Effective but not state-adaptive.';
  }
  if (fastUptake && strongElectrolytes) return 'Strong electrolyte and absorption profile. Compatible with current protocol.';
  return 'Acceptable for general use. Not optimized for current protocol.';
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
    };
  }

  const scored = catalog.map((product) => {
    const { fit, axes, coverage } = scoreProduct(product, safeInputs);
    const result: CompareResult = {
      product,
      fitScore: fit,
      rank: 0,
      whyItFits: whyItFits(product, safeInputs, axes),
      axes,
      coverage,
      verdict: verdictFor(fit),
    };
    return result;
  });

  // An uncomparable product (nothing known) sorts last rather than winning by
  // virtue of having no data to hold against it.
  scored.sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1));
  scored.forEach((r, i) => { r.rank = i + 1; });

  const winner = scored[0];
  return {
    generatedAt: new Date().toISOString(),
    inputs: safeInputs,
    results: scored,
    winner,
  };
}

// ─── Adapter: derive CompareInputs from app state ────────────────────────────
export function inferInputs(engineOutput: ScoreEngineOutput, userState: UserState, goal: CompareInputs['goal'] = 'performance'): CompareInputs {
  const { performanceState, score } = engineOutput;

  // Store drives are on the canonical 0–10 scale (realApi defaults 3/5/4);
  // CompareInputs' axis is 0–1 (normalizeInputs pins it, and the
  // heat_stress protocol threshold below assumes it). Reading them raw
  // made EVERY default member `heat_stress` (4 >= 0.7).
  // Bridge at this boundary via the ONLY sanctioned scale conversion —
  // non-finite degrades to 0, matching normalizeInputs' prior semantic.
  const heatLoad01 = fraction01FromScale10(
    Number.isFinite(userState.heatLoad) ? userState.heatLoad : 0,
  );
  const sweatRate01 = fraction01FromScale10(
    Number.isFinite(userState.sweatRate) ? userState.sweatRate : 0,
  );

  let protocol: ProtocolKind = 'maintenance';
  if (heatLoad01 >= 0.7) protocol = 'heat_stress';
  else if (performanceState.level === 'DEPLETED' || score < 40) protocol = 'depletion_correction';
  else if (performanceState.level === 'RECOVERING' || score < 65) protocol = 'recovery';
  else if (userState.isAwake && !userState.hasSeenMorningCommand && userState.unitsConsumedToday === 0) protocol = 'morning_reset';

  const hoursSinceLastIntake = (Date.now() - new Date(userState.lastIntakeTime).getTime()) / (1000 * 60 * 60);

  return {
    state: performanceState.level,
    score,
    protocol,
    goal,
    heatLoad: heatLoad01,
    sweatRate: sweatRate01,
    symptomCount: userState.symptoms.length,
    hoursSinceLastIntake,
  };
}
