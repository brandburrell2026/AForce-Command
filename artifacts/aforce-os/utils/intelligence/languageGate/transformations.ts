/**
 * Stage 3 — §42 governed transformations.
 *
 * The gate may transform a candidate ONLY through governed templates / approved
 * copy keys. **Unrestricted generative rewriting is never a compliance
 * mechanism** — there is deliberately no model call, no template interpolation
 * from untrusted text, and no free-text synthesis in this module.
 *
 * Every transformation must PRESERVE: claim category · evidence strength ·
 * uncertainty · source scope · context-only vs personal-learning status ·
 * contradiction status.
 *
 * It must NEVER turn an unsupported claim into an apparently supported one —
 * so a transformation is offered only for phrasing problems (causality,
 * certainty), never for evidence, provenance, or scope problems.
 */
import type { ClaimCategory, GateOutcome } from '../../../types/claimGate';

export interface GovernedTransformation {
  /** The gate outcome this transformation resolves. */
  resolves: GateOutcome;
  /** Approved copy key replacing the candidate's text. */
  copyKey: string;
  /** Uncertainty phrasing the surface must include alongside it. */
  requiredUncertaintyKey: string | null;
  /** Categories this transformation may be applied to. null ⇒ any. */
  applicableCategories: readonly ClaimCategory[] | null;
  /** Illustrative only — never rendered; the copy key owns the real text. */
  intent: string;
}

/**
 * Only two outcomes are transformable. Everything else is an evidence,
 * provenance, scope, or hard-policy failure, where rewording would disguise the
 * problem rather than fix it.
 */
export const GOVERNED_TRANSFORMATIONS: readonly GovernedTransformation[] = [
  {
    resolves: 'SUPPRESS_UNSUPPORTED_CAUSALITY',
    copyKey: 'gate.association.observed_alongside',
    requiredUncertaintyKey: 'gate.uncertainty.association_not_causation',
    applicableCategories: ['association', 'observation', 'comparison', 'historical_summary'],
    intent:
      'Causal phrasing → governed association phrasing. ' +
      '"Heat caused your poor recovery." → "Higher heat exposure appeared alongside ' +
      'lower recovery in several recent observations."',
  },
  {
    resolves: 'SUPPRESS_UNSUPPORTED_CERTAINTY',
    copyKey: 'gate.uncertainty.may_decline',
    requiredUncertaintyKey: 'gate.uncertainty.based_on_limited_observations',
    applicableCategories: [
      'emerging_personal_prediction',
      'calibrated_personal_prediction',
      'context_estimate',
      'uncertainty_statement',
    ],
    intent:
      'Deterministic phrasing → hedged phrasing. ' +
      '"You will crash in 40 minutes." → "Your current conditions suggest your ' +
      'readiness may decline within the next hour."',
  },
];

/**
 * Find a governed transformation for an outcome + category.
 *
 * Returns null when none applies — the caller must then SUPPRESS. A missing
 * transformation is never a reason to let a claim through.
 */
export function findTransformation(
  outcome: GateOutcome,
  category: ClaimCategory,
): GovernedTransformation | null {
  return (
    GOVERNED_TRANSFORMATIONS.find(
      (t) =>
        t.resolves === outcome &&
        (t.applicableCategories === null || t.applicableCategories.includes(category)),
    ) ?? null
  );
}

/** Outcomes for which a transformation may EVER be offered. */
export const TRANSFORMABLE_OUTCOMES: readonly GateOutcome[] = Array.from(
  new Set(GOVERNED_TRANSFORMATIONS.map((t) => t.resolves)),
);

export function isTransformable(outcome: GateOutcome): boolean {
  return TRANSFORMABLE_OUTCOMES.includes(outcome);
}
