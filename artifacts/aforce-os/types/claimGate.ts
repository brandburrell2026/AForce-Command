/**
 * Stage 3 — §42 Intelligence Language and Claims Gate contracts.
 *
 * The mandatory final policy boundary between intelligence-derived content and
 * any user-facing copy surface.
 *
 * REQUIRED PATH (nothing may bypass it):
 *   Learning or Context Intelligence
 *     → Evidence Engine adapter boundary (Stage 2)
 *     → §42 gate
 *     → approved Interaction Intelligence surface
 *
 * THE GATE DOES NOT: originate recommendations · calculate HydroState ·
 * determine Command Confidence™ · replace the Evidence Engine™. It decides
 * ONLY whether a proposed claim may be emitted, and in what form.
 *
 * HARD LOCKS:
 *  - Types only. RN-free, dependency-free (type-only imports).
 *  - Score-Protection: no field here can carry or confer score authority.
 *  - Prediction Engine™ and Performance DNA™ candidates are REPRESENTABLE here
 *    so their policy can be tested now — neither system is implemented.
 */
import type {
  ModelVersion,
  PrivacyClass,
  RetentionClass,
} from './intelligenceEvents';
import type { EvidenceState } from './knowledgeGraph';

/* ─── Claim categories ────────────────────────────────────────────────────── */

/** Operational categories — a candidate may declare one of these. */
export type ActiveClaimCategory =
  | 'observation'
  | 'association'
  | 'comparison'
  | 'context_estimate'
  | 'emerging_personal_prediction'
  | 'calibrated_personal_prediction'
  | 'emerging_pattern'
  | 'observed_pattern'
  | 'high_confidence_pattern'
  | 'command_explanation'
  | 'uncertainty_statement'
  | 'historical_summary';

/**
 * RESERVED — declared so policy can name and refuse them. Not operational.
 * A candidate declaring one of these is suppressed, never evaluated.
 */
export type ReservedClaimCategory = 'medical' | 'diagnostic' | 'treatment';

export type ClaimCategory = ActiveClaimCategory | ReservedClaimCategory;

export const ACTIVE_CLAIM_CATEGORIES: readonly ActiveClaimCategory[] = [
  'observation',
  'association',
  'comparison',
  'context_estimate',
  'emerging_personal_prediction',
  'calibrated_personal_prediction',
  'emerging_pattern',
  'observed_pattern',
  'high_confidence_pattern',
  'command_explanation',
  'uncertainty_statement',
  'historical_summary',
];

export const RESERVED_CLAIM_CATEGORIES: readonly ReservedClaimCategory[] = [
  'medical',
  'diagnostic',
  'treatment',
];

/** Categories that assert something LEARNED ABOUT THE PERSON. */
export const PERSONAL_LEARNING_CATEGORIES: readonly ActiveClaimCategory[] = [
  'emerging_personal_prediction',
  'calibrated_personal_prediction',
  'emerging_pattern',
  'observed_pattern',
  'high_confidence_pattern',
];

/* ─── Prediction / pattern states ─────────────────────────────────────────── */

/** DR-003 / DR-006. Eligibility and confidence are separate decisions. */
export type PredictionState =
  | 'insufficient_data'
  | 'context_only'
  | 'emerging_personal'
  | 'calibrated_personal';

/** Founder Decision 4. The ONLY permitted Performance DNA™ lifecycle labels. */
export type PatternLifecycleState =
  | 'emerging'
  | 'observed'
  | 'high_confidence'
  | 'recalibrating'
  | 'retired'
  | 'superseded';

export const PATTERN_LIFECYCLE_STATES: readonly PatternLifecycleState[] = [
  'emerging',
  'observed',
  'high_confidence',
  'recalibrating',
  'retired',
  'superseded',
];

/* ─── Surfaces ────────────────────────────────────────────────────────────── */

export type IntendedSurface =
  | 'home'
  | 'todays_command_explanation'
  | 'ai_coach'
  | 'weekly_performance_report'
  | 'your_bodys_manual'
  | 'hydroscan'
  | 'guardian'
  | 'clutch'
  | 'founder_sandbox_inspection'
  | 'notification'
  | 'email'
  | 'export';

export const INTENDED_SURFACES: readonly IntendedSurface[] = [
  'home',
  'todays_command_explanation',
  'ai_coach',
  'weekly_performance_report',
  'your_bodys_manual',
  'hydroscan',
  'guardian',
  'clutch',
  'founder_sandbox_inspection',
  'notification',
  'email',
  'export',
];

/**
 * Surfaces with STRICTER rules: short-form or high-stakes copy with no room for
 * qualification, where an unqualified claim does the most damage.
 */
export const STRICT_SURFACES: readonly IntendedSurface[] = [
  'notification',
  'guardian',
  'hydroscan',
  'email',
];

/* ─── Freshness / uncertainty ─────────────────────────────────────────────── */

export type UncertaintyRequirement = 'none' | 'optional' | 'required';

export type DisclaimerClass = 'none' | 'general_wellness' | 'consult_physician';

/* ─── The candidate ───────────────────────────────────────────────────────── */

export interface ClaimCandidate {
  candidateId: string;
  userId: string;

  /** Which subsystem proposed this claim. */
  sourceSubsystem:
    | 'knowledge_graph'
    | 'prediction_engine'
    | 'performance_dna'
    | 'living_performance_model'
    | 'evidence_engine'
    | 'hydroscan'
    | 'guardian';

  intendedSurface: IntendedSurface;
  locale: string;

  /** Prefer a governed copy key; free text is evaluated more strictly. */
  copyKey: string | null;
  proposedText: string;

  claimCategory: ClaimCategory;
  /** What the claim is about (e.g. 'hydration_timing'). Non-sensitive label. */
  claimSubject: string;

  /** Graph record ids backing this claim. */
  evidenceRefs: readonly string[];
  /** Source event ids. Empty ⇒ no provenance path. */
  provenancePath: readonly string[];

  supportingObservationCount: number;
  contradictoryObservationCount: number;
  evidenceState: EvidenceState;

  predictionState: PredictionState | null;
  patternState: PatternLifecycleState | null;

  /** TRUE ⇒ derived from current context, NOT learned about this person. */
  contextOnly: boolean;

  modelVersion: ModelVersion;
  profileVersionId: number | null;
  baselineVersionId: number | null;

  freshness: 'fresh' | 'aging' | 'stale' | 'expired';
  signalQuality: 'excellent' | 'good' | 'limited' | 'unavailable';

  uncertaintyRequirement: UncertaintyRequirement;
  disclaimerClass: DisclaimerClass;

  /** Does the copy reference an AForce product? */
  referencesProduct: boolean;
  /** Does the copy reference a command? */
  referencesCommand: boolean;

  privacyClass: PrivacyClass;
  retentionClass: RetentionClass;
  createdAtMs: number;
}

/* ─── Outcomes ────────────────────────────────────────────────────────────── */

/**
 * Fourteen distinct outcomes. Refusals are NEVER collapsed into one generic
 * result — the reason must be actionable.
 */
export type GateOutcome =
  | 'ALLOW'
  | 'ALLOW_WITH_APPROVED_TRANSFORMATION'
  | 'SUPPRESS_INSUFFICIENT_EVIDENCE'
  | 'SUPPRESS_INVALID_PROVENANCE'
  | 'SUPPRESS_CONTRADICTORY_SUPPORT'
  | 'SUPPRESS_UNVALIDATED_LOCALE'
  | 'SUPPRESS_UNSUPPORTED_CAUSALITY'
  | 'SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE'
  | 'SUPPRESS_UNSUPPORTED_CERTAINTY'
  | 'SUPPRESS_CONTEXT_AS_PERSONAL'
  | 'SUPPRESS_PRODUCT_BIAS'
  | 'SUPPRESS_SCORE_PROTECTION_VIOLATION'
  | 'SUPPRESS_STALE_INPUT'
  | 'SUPPRESS_POLICY_VIOLATION';

export const GATE_OUTCOMES: readonly GateOutcome[] = [
  'ALLOW',
  'ALLOW_WITH_APPROVED_TRANSFORMATION',
  'SUPPRESS_INSUFFICIENT_EVIDENCE',
  'SUPPRESS_INVALID_PROVENANCE',
  'SUPPRESS_CONTRADICTORY_SUPPORT',
  'SUPPRESS_UNVALIDATED_LOCALE',
  'SUPPRESS_UNSUPPORTED_CAUSALITY',
  'SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE',
  'SUPPRESS_UNSUPPORTED_CERTAINTY',
  'SUPPRESS_CONTEXT_AS_PERSONAL',
  'SUPPRESS_PRODUCT_BIAS',
  'SUPPRESS_SCORE_PROTECTION_VIOLATION',
  'SUPPRESS_STALE_INPUT',
  'SUPPRESS_POLICY_VIOLATION',
];

export function isSuppression(outcome: GateOutcome): boolean {
  return outcome.startsWith('SUPPRESS_');
}

/* ─── Decision ────────────────────────────────────────────────────────────── */

export interface GateReason {
  /** Policy-rule identifier, e.g. `P42-MED-001`. */
  ruleId: string;
  outcome: GateOutcome;
  severity: 'block' | 'transform' | 'warn';
  /** Non-sensitive machine-readable detail. Never raw payload. */
  detail: string;
}

export interface GateAuditMetadata {
  evaluatedAtMs: number;
  gatePolicyVersion: string;
  localePolicyVersion: string;
  modelVersion: ModelVersion;
  /** Ids only — never raw copy or payload. */
  evidenceRefs: readonly string[];
  provenanceComplete: boolean;
  privacyClass: PrivacyClass;
  retentionClass: RetentionClass;
}

export interface GateDecision {
  candidateId: string;
  outcome: GateOutcome;
  reasons: readonly GateReason[];
  /** Governed copy key after transformation; null when unchanged or suppressed. */
  transformedCopyKey: string | null;
  /** Uncertainty phrasing the surface MUST include. */
  requiredUncertaintyKey: string | null;
  requiredDisclaimerClass: DisclaimerClass;
  /** Locale actually approved for emission (may be a recorded fallback). */
  emittedLocale: string | null;
  audit: GateAuditMetadata;
}
