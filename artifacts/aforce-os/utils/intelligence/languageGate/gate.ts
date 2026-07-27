/**
 * Stage 3 — §42 Intelligence Language and Claims Gate (pure evaluation).
 *
 * The mandatory final policy boundary. Decides whether a proposed claim may be
 * emitted, and in what form. It does NOT originate recommendations, calculate
 * HydroState, determine Command Confidence™, or replace the Evidence Engine™.
 *
 * DESIGN: every applicable rule is evaluated and ALL violations collected, then
 * the outcome is chosen by severity rank. Refusals are never collapsed into one
 * generic result — a caller must be able to see precisely why.
 *
 * HARD LOCKS:
 *  - Pure + RN-free. No I/O, no clock (time is passed in), no model calls.
 *  - FAIL CLOSED: anything unevaluable suppresses. Absence of a policy is never
 *    permission.
 *  - No generative rewriting. Transformation is governed templates only.
 *  - Never upgrades an unsupported claim into an apparently supported one.
 */
import {
  PERSONAL_LEARNING_CATEGORIES,
  RESERVED_CLAIM_CATEGORIES,
  STRICT_SURFACES,
  type ClaimCandidate,
  type GateDecision,
  type GateOutcome,
  type GateReason,
} from '../../../types/claimGate';
import {
  GATE_POLICY_VERSION,
  conceptPresent,
  rulesFor,
} from './policyRegistry';
import {
  LOCALE_POLICY_VERSION,
  isValidatedLocale,
  localePolicyFor,
} from './localePolicy';
import { findTransformation, isTransformable } from './transformations';

/**
 * Severity rank — highest wins when several rules fire. Hard prohibitions
 * outrank evidence problems so the most serious reason is the reported outcome.
 */
const OUTCOME_RANK: Record<GateOutcome, number> = {
  SUPPRESS_SCORE_PROTECTION_VIOLATION: 100,
  SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE: 95,
  SUPPRESS_POLICY_VIOLATION: 90,
  SUPPRESS_PRODUCT_BIAS: 85,
  SUPPRESS_UNSUPPORTED_CAUSALITY: 80,
  SUPPRESS_CONTEXT_AS_PERSONAL: 75,
  SUPPRESS_UNSUPPORTED_CERTAINTY: 70,
  SUPPRESS_INVALID_PROVENANCE: 65,
  SUPPRESS_UNVALIDATED_LOCALE: 60,
  SUPPRESS_CONTRADICTORY_SUPPORT: 55,
  SUPPRESS_INSUFFICIENT_EVIDENCE: 50,
  SUPPRESS_STALE_INPUT: 45,
  ALLOW_WITH_APPROVED_TRANSFORMATION: 10,
  ALLOW: 0,
};

export interface GateOptions {
  nowMs: number;
  /**
   * Result of the Stage 2 Evidence Engine adapter. When the adapter marked the
   * candidate ineligible the gate refuses outright — it never second-guesses
   * the boundary.
   */
  adapterEligible: boolean;
}

/* ─── Evaluation ──────────────────────────────────────────────────────────── */

export function evaluateClaim(
  candidate: ClaimCandidate,
  options: GateOptions,
): GateDecision {
  const reasons: GateReason[] = [];
  const text = candidate.proposedText ?? '';

  const push = (
    ruleId: string,
    outcome: GateOutcome,
    severity: GateReason['severity'],
    detail: string,
  ) => reasons.push({ ruleId, outcome, severity, detail });

  /* --- 1. Reserved categories are never operational --- */
  if ((RESERVED_CLAIM_CATEGORIES as readonly string[]).includes(candidate.claimCategory)) {
    push('P42-MED-003', 'SUPPRESS_POLICY_VIOLATION', 'block',
      `reserved_category:${candidate.claimCategory}`);
  }

  /* --- 2. Adapter eligibility (Stage 2 boundary) --- */
  if (!options.adapterEligible) {
    push('P42-PRV-002', 'SUPPRESS_INVALID_PROVENANCE', 'block', 'adapter_marked_ineligible');
  }

  /* --- 3. Provenance and scope integrity --- */
  if (candidate.provenancePath.length === 0) {
    push('P42-PRV-001', 'SUPPRESS_INVALID_PROVENANCE', 'block', 'empty_provenance_path');
  }
  if (!candidate.userId) {
    push('P42-PRV-003', 'SUPPRESS_INVALID_PROVENANCE', 'block', 'missing_user_scope');
  }
  if (!candidate.modelVersion) {
    push('P42-PRV-004', 'SUPPRESS_INVALID_PROVENANCE', 'block', 'missing_model_version');
  }

  /* --- 4. Locale governance --- */
  const localePolicy = localePolicyFor(candidate.locale);
  if (!localePolicy || !isValidatedLocale(candidate.locale)) {
    push('P42-LOC-001', 'SUPPRESS_UNVALIDATED_LOCALE', 'block',
      `locale_not_validated:${candidate.locale}`);
  }

  /* --- 5. Evidence state --- */
  if (candidate.evidenceState === 'insufficient') {
    push('P42-EVD-001', 'SUPPRESS_INSUFFICIENT_EVIDENCE', 'block', 'evidence_state_insufficient');
  }
  if (candidate.evidenceState === 'contradicted') {
    push('P42-EVD-002', 'SUPPRESS_CONTRADICTORY_SUPPORT', 'block', 'evidence_state_contradicted');
  }
  if (candidate.evidenceState === 'superseded') {
    push('P42-EVD-004', 'SUPPRESS_INSUFFICIENT_EVIDENCE', 'block', 'evidence_state_superseded');
  }
  // Contradictions must never be hidden: counter-evidence at or above support
  // cannot be presented as a clean finding.
  if (
    candidate.contradictoryObservationCount > 0 &&
    candidate.contradictoryObservationCount >= candidate.supportingObservationCount
  ) {
    push('P42-EVD-003', 'SUPPRESS_CONTRADICTORY_SUPPORT', 'block', 'contradictions_dominate');
  }

  /* --- 6. Freshness --- */
  if (candidate.freshness === 'stale' || candidate.freshness === 'expired') {
    push('P42-FRS-001', 'SUPPRESS_STALE_INPUT', 'block', `freshness:${candidate.freshness}`);
  }
  if (candidate.signalQuality === 'unavailable') {
    push('P42-FRS-002', 'SUPPRESS_STALE_INPUT', 'block', 'signal_quality_unavailable');
  }

  /* --- 7. Context-only must never be presented as personal learning --- */
  const claimsPersonalLearning = (
    PERSONAL_LEARNING_CATEGORIES as readonly string[]
  ).includes(candidate.claimCategory);

  if (candidate.contextOnly && claimsPersonalLearning) {
    push('P42-STA-001', 'SUPPRESS_CONTEXT_AS_PERSONAL', 'block',
      'context_only_declared_as_personal_category');
  }
  if (candidate.contextOnly && candidate.predictionState !== 'context_only' &&
      candidate.predictionState !== null) {
    push('P42-STA-002', 'SUPPRESS_CONTEXT_AS_PERSONAL', 'block',
      `context_only_with_state:${candidate.predictionState}`);
  }
  // Minimum beta eligibility is not high confidence (DR-006).
  if (
    candidate.predictionState === 'emerging_personal' &&
    candidate.claimCategory === 'calibrated_personal_prediction'
  ) {
    push('P42-STA-003', 'SUPPRESS_UNSUPPORTED_CERTAINTY', 'block',
      'emerging_state_claimed_as_calibrated');
  }
  // An insufficient-data prediction may make no personal forecast claim.
  if (candidate.predictionState === 'insufficient_data' && claimsPersonalLearning) {
    push('P42-STA-004', 'SUPPRESS_INSUFFICIENT_EVIDENCE', 'block',
      'insufficient_data_with_personal_claim');
  }
  // Pattern state must agree with the declared category.
  if (
    candidate.patternState === 'emerging' &&
    candidate.claimCategory === 'high_confidence_pattern'
  ) {
    push('P42-STA-005', 'SUPPRESS_UNSUPPORTED_CERTAINTY', 'block',
      'emerging_pattern_claimed_as_high_confidence');
  }
  if (
    (candidate.patternState === 'retired' || candidate.patternState === 'superseded') &&
    claimsPersonalLearning
  ) {
    push('P42-STA-006', 'SUPPRESS_INSUFFICIENT_EVIDENCE', 'block',
      `inactive_pattern_state:${candidate.patternState}`);
  }

  /* --- 8. Prohibited language (registry-driven) --- */
  for (const rule of rulesFor(candidate.claimCategory, candidate.intendedSurface)) {
    for (const concept of rule.prohibitedConcepts) {
      if (conceptPresent(text, concept)) {
        push(rule.ruleId, rule.outcome, rule.severity, `concept:${concept}`);
        break; // one hit per rule is enough; the rule identifies the class
      }
    }
  }

  /* --- 9. Strict surfaces --- */
  // Short-form / high-stakes copy has no room to qualify a claim, so anything
  // needing uncertainty language cannot go there at all.
  if (
    STRICT_SURFACES.includes(candidate.intendedSurface) &&
    candidate.uncertaintyRequirement === 'required'
  ) {
    push('P42-SRF-001', 'SUPPRESS_POLICY_VIOLATION', 'block',
      `strict_surface_requires_qualification:${candidate.intendedSurface}`);
  }
  // Predictive copy is not permitted on strict surfaces at all.
  if (
    STRICT_SURFACES.includes(candidate.intendedSurface) &&
    (candidate.claimCategory === 'emerging_personal_prediction' ||
      candidate.claimCategory === 'calibrated_personal_prediction')
  ) {
    push('P42-SRF-002', 'SUPPRESS_POLICY_VIOLATION', 'block',
      `predictive_copy_on_strict_surface:${candidate.intendedSurface}`);
  }

  /* --- 10. Resolve outcome --- */
  return decide(candidate, reasons, options);
}

/* ─── Decision assembly ───────────────────────────────────────────────────── */

function decide(
  candidate: ClaimCandidate,
  reasons: GateReason[],
  options: GateOptions,
): GateDecision {
  const audit: GateDecision['audit'] = {
    evaluatedAtMs: options.nowMs,
    gatePolicyVersion: GATE_POLICY_VERSION,
    localePolicyVersion: LOCALE_POLICY_VERSION,
    modelVersion: candidate.modelVersion,
    evidenceRefs: candidate.evidenceRefs,
    provenanceComplete: candidate.provenancePath.length > 0,
    privacyClass: candidate.privacyClass,
    retentionClass: candidate.retentionClass,
  };

  if (reasons.length === 0) {
    return {
      candidateId: candidate.candidateId,
      outcome: 'ALLOW',
      reasons: [],
      transformedCopyKey: null,
      requiredUncertaintyKey:
        candidate.uncertaintyRequirement === 'required'
          ? 'gate.uncertainty.based_on_limited_observations'
          : null,
      requiredDisclaimerClass: candidate.disclaimerClass,
      emittedLocale: candidate.locale,
      audit,
    };
  }

  // Highest-severity reason determines the reported outcome.
  const top = [...reasons].sort(
    (a, b) => OUTCOME_RANK[b.outcome] - OUTCOME_RANK[a.outcome],
  )[0];

  // A transformation may resolve ONLY a phrasing problem, and only when it is
  // the sole class of violation. If anything else fired — evidence, provenance,
  // scope, locale, state integrity, or a hard prohibition — rewording would
  // disguise the real failure, so the candidate is suppressed.
  //
  // Transformability follows the RULE THAT FIRED (`severity === 'transform'`),
  // not the outcome alone. A state-integrity violation such as "emerging
  // evidence presented as calibrated" maps to the same outcome as a certainty
  // phrasing problem, but rewording it would turn an unsupported claim into an
  // apparently supported one — which is exactly what must never happen.
  const allTransformable = reasons.every(
    (r) => r.severity === 'transform' && isTransformable(r.outcome),
  );
  if (allTransformable) {
    const transformation = findTransformation(top.outcome, candidate.claimCategory);
    if (transformation) {
      return {
        candidateId: candidate.candidateId,
        outcome: 'ALLOW_WITH_APPROVED_TRANSFORMATION',
        reasons,
        transformedCopyKey: transformation.copyKey,
        requiredUncertaintyKey: transformation.requiredUncertaintyKey,
        requiredDisclaimerClass: candidate.disclaimerClass,
        emittedLocale: candidate.locale,
        audit,
      };
    }
  }

  return {
    candidateId: candidate.candidateId,
    outcome: top.outcome,
    reasons,
    transformedCopyKey: null,
    requiredUncertaintyKey: null,
    requiredDisclaimerClass: candidate.disclaimerClass,
    emittedLocale: null,
    audit,
  };
}

/* ─── Convenience ─────────────────────────────────────────────────────────── */

/** True only for an outcome that permits emission. */
export function mayEmit(decision: GateDecision): boolean {
  return (
    decision.outcome === 'ALLOW' || decision.outcome === 'ALLOW_WITH_APPROVED_TRANSFORMATION'
  );
}
