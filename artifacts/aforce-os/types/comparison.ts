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

/**
 * Evidence quality for ONE product attribute (founder ruling D3, 2026-08-30).
 *
 *  verified  — backed by a panel, COA or published label on file. Nothing
 *              carries this yet; it may never be inferred from brand ownership.
 *  estimated — hand-authored, or synthesized from partial public data. The
 *              catalog default: every row is an editorial estimate, AForce and
 *              competitor alike.
 *  unknown   — no value on file. The attribute has NO number, and must be
 *              excluded from every calculation rather than defaulted (D5).
 */
export type AttributeProvenance = 'verified' | 'estimated' | 'unknown';

/** The five scored attributes provenance is tracked against. */
export type CompareAttribute =
  | 'hydrationSpeed'
  | 'electrolytes'
  | 'sugar'
  | 'absorptionRate'
  | 'recoveryEfficiency';

/**
 * Per-attribute evidence quality. Deliberately field-granular: one product may
 * acquire a source for a single attribute while its siblings stay estimated.
 * An absent key resolves to 'estimated' — the catalog default.
 */
export type ProvenanceMap = Partial<Record<CompareAttribute, AttributeProvenance>>;

/** Catalog entry — physiology-only. No marketing copy. */
export interface CompareProduct {
  id: string;
  name: string;
  brand: string;
  category: 'electrolyte_mix' | 'sports_drink' | 'medical_oral_rehydration' | 'plain_water';
  /**
   * Sub-scores 0-100. Higher = better.
   *
   * `null` means UNKNOWN — no value on file (D5). It is NOT a zero, and the
   * engine excludes it from scoring rather than defaulting it. A measured `0`
   * is data and stays `0`.
   */
  hydrationSpeed: number | null;
  electrolytes: number | null;
  /** Lower = better. Inverted in fit calc. `null` = UNKNOWN. */
  sugar: number | null;
  absorptionRate: number | null;
  recoveryEfficiency: number | null;
  /** Compatible protocols (used as a soft boost). */
  compatibleProtocols: ProtocolKind[];
  /** One-line factual descriptor. No claims. */
  factualNote: string;
  isAForce: boolean;
  /** Per-attribute evidence quality (D3). Absent = 'estimated'. */
  provenance?: ProvenanceMap;
}

/** Per-product comparison output. */
export interface CompareResult {
  product: CompareProduct;
  /**
   * 0-100, or `null` when NO attribute was known — the engine states that it
   * cannot compare rather than fabricating a number (D5).
   */
  fitScore: number | null;
  rank: number;              // 1 = best
  /** Plain-language explanation tied to user state. */
  whyItFits: string;
  /** Per-axis breakdown for the expandable card. */
  axes: {
    speed: number | null;
    electrolyteBalance: number | null;
    sugarImpact: number | null;   // 100 = ideal (low sugar); null = UNKNOWN
    absorption: number | null;
    recovery: number | null;
  };
  /**
   * How much of the comparison was actually backed by data (D5). Carried so a
   * thin comparison can never present itself as a complete one.
   */
  coverage: { known: number; total: number };
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

// COMMAND-AUTHORITY CONTAINMENT (re-plumb wave, founder-authorized):
// `CompareCommand` is retired. The comparison engine COMPARES — fit
// scores, ranking, and factual why-it-fits explanations. It no longer
// authors an action line: the old `command` field carried its own doses
// and recheck clocks, was rendered by NO surface (its sole caller, the
// scan service, reads `results` only), and stood as a second command
// authority beside the canonical RecoveryCommand
// (services/__tests__/commandAuthorityContainment.test.ts).
export interface CompareEngineOutput {
  generatedAt: string;
  inputs: CompareInputs;
  results: CompareResult[];   // sorted by fitScore desc
  /** Undefined when catalog is empty/invalid. UI must guard. */
  winner?: CompareResult;
}
