/**
 * Comparison Engine — type contracts.
 *
 * Real-time, personalized product matching. Every result is tied to the
 * user's current physiological state and protocol; results MUST update when
 * state changes. The engine is unbiased — products win on physiology, not
 * marketing.
 */

import type { PerformanceLevel } from './index';

export type ProtocolKind =
  | 'maintenance'
  | 'recovery'
  | 'depletion_correction'
  | 'heat_stress'
  | 'morning_reset';

export type CompareGoal = 'performance' | 'recovery' | 'daily';

/** Catalog entry — physiology-only. No marketing copy. */
export interface CompareProduct {
  id: string;
  name: string;
  brand: string;
  category: 'electrolyte_mix' | 'sports_drink' | 'medical_oral_rehydration' | 'plain_water';
  /** Sub-scores 0-100. Higher = better. */
  hydrationSpeed: number;
  electrolytes: number;
  /** Lower = better. Inverted in fit calc. */
  sugar: number;
  absorptionRate: number;
  recoveryEfficiency: number;
  /** Compatible protocols (used as a soft boost). */
  compatibleProtocols: ProtocolKind[];
  /** One-line factual descriptor. No claims. */
  factualNote: string;
  isAForce: boolean;
}

/** Per-product comparison output. */
export interface CompareResult {
  product: CompareProduct;
  fitScore: number;          // 0-100
  rank: number;              // 1 = best
  /** Plain-language explanation tied to user state. */
  whyItFits: string;
  /** Per-axis breakdown for the expandable card. */
  axes: {
    speed: number;
    electrolyteBalance: number;
    sugarImpact: number;       // 100 = ideal (low sugar)
    absorption: number;
    recovery: number;
  };
  verdict: 'optimal' | 'strong' | 'acceptable' | 'suboptimal' | 'avoid';
}

export interface CompareInputs {
  state: PerformanceLevel;
  score: number;
  protocol: ProtocolKind;
  goal: CompareGoal;
  heatLoad: number;     // 0-1
  sweatRate: number;    // 0-1
  /** Optional context. */
  symptomCount?: number;
  hoursSinceLastIntake?: number;
}

export interface CompareCommand {
  /** WHAT + WHEN/HOW MUCH + OUTCOME. */
  action: string;
  explanation: string;
  productId: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface CompareEngineOutput {
  generatedAt: string;
  inputs: CompareInputs;
  results: CompareResult[];   // sorted by fitScore desc
  /** Undefined when catalog is empty/invalid. UI must guard. */
  winner?: CompareResult;
  command: CompareCommand;
}
