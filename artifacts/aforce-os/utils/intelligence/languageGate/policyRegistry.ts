/**
 * Stage 3 — §42 canonical machine-readable policy registry.
 *
 * THE SINGLE SOURCE for gate policy in code. Policy constants must not be
 * scattered across unrelated modules — every rule lives here with an id.
 *
 * GOVERNANCE SOURCE: `governance/CLAIMS-REGISTER.md` is authoritative. This
 * file is a compiled machine-readable representation of it and MUST NOT
 * silently diverge. A change here without a corresponding Claims Register
 * change is a governance defect.
 *
 * HARD LOCKS:
 *  - Pure data + pure matchers. RN-free, dependency-free.
 *  - No generative rewriting anywhere. Transformations are governed templates.
 *  - Concepts are matched by whole-word/phrase, so "prevention" is caught while
 *    an unrelated substring is not.
 */
import type {
  ClaimCategory,
  GateOutcome,
  IntendedSurface,
} from '../../../types/claimGate';

/** Bump on ANY policy change. Recorded in every gate decision. */
export const GATE_POLICY_VERSION = 'p42-v1.0';

export type RuleSeverity = 'block' | 'transform' | 'warn';

export type RuleCategory =
  | 'medical_diagnostic'
  | 'causality'
  | 'certainty'
  | 'injury_risk'
  | 'product_bias'
  | 'score_protection'
  | 'evidence'
  | 'provenance'
  | 'locale'
  | 'state_integrity';

export interface PolicyRule {
  ruleId: string;
  category: RuleCategory;
  severity: RuleSeverity;
  outcome: GateOutcome;
  /** null ⇒ applies to every claim category. */
  applicableCategories: readonly ClaimCategory[] | null;
  /** null ⇒ applies to every surface. */
  applicableSurfaces: readonly IntendedSurface[] | null;
  /** Phrases whose presence triggers the rule. Whole-word / phrase matched. */
  prohibitedConcepts: readonly string[];
  /** Governed replacement copy key, when the rule is transformable. */
  approvedTransformKey: string | null;
  /** Human-readable prerequisite, for audit. */
  evidencePrerequisite: string | null;
  requiredUncertaintyKey: string | null;
  effectiveVersion: string;
  reviewStatus: 'founder_approved' | 'not_yet_reviewed' | 'legal_review_required';
  governanceSource: string;
}

/* ─── A. Medical and diagnostic framing ───────────────────────────────────── */

const MEDICAL_RULES: readonly PolicyRule[] = [
  {
    ruleId: 'P42-MED-001',
    category: 'medical_diagnostic',
    severity: 'block',
    outcome: 'SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE',
    applicableCategories: null,
    applicableSurfaces: null,
    prohibitedConcepts: [
      'diagnose', 'diagnoses', 'diagnosed', 'diagnosis', 'diagnostic',
      'disease', 'disorder', 'medical condition', 'treatment', 'treat', 'treats',
      'cure', 'cures', 'cured', 'symptom', 'symptoms',
      'clinically proven', 'medically necessary', 'medical risk',
      'dehydration diagnosis', 'deficiency',
    ],
    approvedTransformKey: null,
    evidencePrerequisite: null,
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'governance/CLAIMS-REGISTER.md §1',
  },
  {
    ruleId: 'P42-MED-002',
    category: 'medical_diagnostic',
    severity: 'block',
    outcome: 'SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE',
    applicableCategories: null,
    applicableSurfaces: null,
    // "healthy"/"unhealthy" used as a diagnostic classification of the person.
    prohibitedConcepts: ['you are healthy', 'you are unhealthy', 'unhealthy'],
    approvedTransformKey: null,
    evidencePrerequisite: null,
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'governance/CLAIMS-REGISTER.md §1',
  },
  {
    ruleId: 'P42-MED-003',
    category: 'medical_diagnostic',
    severity: 'block',
    outcome: 'SUPPRESS_POLICY_VIOLATION',
    // Reserved categories are never operational.
    applicableCategories: ['medical', 'diagnostic', 'treatment'],
    applicableSurfaces: null,
    prohibitedConcepts: [],
    approvedTransformKey: null,
    evidencePrerequisite: 'reserved category — not operational',
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'Stage 3 §4',
  },
];

/* ─── D. Injury and risk framing ──────────────────────────────────────────── */

const INJURY_RULES: readonly PolicyRule[] = [
  {
    ruleId: 'P42-INJ-001',
    category: 'injury_risk',
    severity: 'block',
    outcome: 'SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE',
    applicableCategories: null,
    applicableSurfaces: null,
    prohibitedConcepts: [
      'injury', 'injuries', 'injured',
      'injury-risk protection', 'injury risk protection',
      'injury prevention', 'predicts injury', 'medical-risk detection',
      'medical risk detection', 'at risk', 'risk of',
    ],
    approvedTransformKey: 'gate.guardian.readiness_oversight',
    evidencePrerequisite: null,
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'DR-003 (D-06) · governance/CLAIMS-REGISTER.md §5.1',
  },
];

/* ─── B. Unsupported causality ────────────────────────────────────────────── */

const CAUSALITY_RULES: readonly PolicyRule[] = [
  {
    ruleId: 'P42-CAU-001',
    category: 'causality',
    severity: 'transform',
    outcome: 'SUPPRESS_UNSUPPORTED_CAUSALITY',
    applicableCategories: null,
    applicableSurfaces: null,
    prohibitedConcepts: [
      'caused', 'causes', 'cause', 'causing', 'will cause',
      'resulted in', 'results in', 'led to', 'leads to',
      'because of', 'due to', 'prevent', 'prevents', 'prevented', 'prevention',
    ],
    approvedTransformKey: 'gate.association.observed_alongside',
    evidencePrerequisite: 'no approved causal-evidence policy exists',
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'Stage 2 §2 (no CAUSES family) · Stage 3 §5B',
  },
];

/**
 * Governed association constructions — permitted ONLY at an approved evidence
 * state. These are the approved replacements for causal phrasing.
 */
export const APPROVED_ASSOCIATION_PHRASES: readonly string[] = [
  'was associated with',
  'appeared alongside',
  'was observed after',
  'may have contributed',
  'often occurred when',
];

/* ─── C. Unsupported certainty ────────────────────────────────────────────── */

const CERTAINTY_RULES: readonly PolicyRule[] = [
  {
    ruleId: 'P42-CER-001',
    category: 'certainty',
    severity: 'transform',
    outcome: 'SUPPRESS_UNSUPPORTED_CERTAINTY',
    applicableCategories: null,
    applicableSurfaces: null,
    prohibitedConcepts: [
      'definitely', 'guaranteed', 'guarantee', 'always', 'never',
      'certain', 'certainly', 'proven', 'will happen', 'exactly', 'no doubt',
    ],
    approvedTransformKey: 'gate.uncertainty.may_decline',
    evidencePrerequisite: 'certainty must match evidence and prediction state',
    requiredUncertaintyKey: 'gate.uncertainty.based_on_limited_observations',
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'Stage 3 §5C · DR-006',
  },
];

/* ─── E. Product bias ─────────────────────────────────────────────────────── */

const PRODUCT_RULES: readonly PolicyRule[] = [
  {
    ruleId: 'P42-PRD-001',
    category: 'product_bias',
    severity: 'block',
    outcome: 'SUPPRESS_PRODUCT_BIAS',
    applicableCategories: null,
    applicableSurfaces: null,
    prohibitedConcepts: [
      'you need aforce', 'requires aforce', 'must drink aforce',
      'only aforce', 'aforce is required', 'buy to improve',
      'purchase to improve', 'required to complete',
    ],
    approvedTransformKey: null,
    evidencePrerequisite: 'product-neutral guidance must remain available',
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'Constitution Principle 1 · Water-First lock',
  },
];

/* ─── F. Score Protection ─────────────────────────────────────────────────── */

const SCORE_RULES: readonly PolicyRule[] = [
  {
    ruleId: 'P42-SCR-001',
    category: 'score_protection',
    severity: 'block',
    outcome: 'SUPPRESS_SCORE_PROTECTION_VIOLATION',
    applicableCategories: null,
    applicableSurfaces: null,
    prohibitedConcepts: [
      'scan to raise', 'scanning raises', 'scanning increases',
      'scan increases your score', 'purchase increases', 'buying increases',
      'drinking this raises your score', 'raises your hydrostate',
      'boost your hydrostate', 'increase your hydrostate',
      'this recommendation raises',
    ],
    approvedTransformKey: null,
    evidencePrerequisite: 'only completed behaviour modifies score',
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'DR-001 · Score Protection lock',
  },
  {
    ruleId: 'P42-SCR-002',
    category: 'score_protection',
    severity: 'block',
    outcome: 'SUPPRESS_SCORE_PROTECTION_VIOLATION',
    applicableCategories: null,
    applicableSurfaces: null,
    // A second hero score, in any guise.
    prohibitedConcepts: [
      'dna score', 'pattern score', 'graph score', 'confidence score of',
      'your intelligence score', 'second score', 'overall score is',
    ],
    approvedTransformKey: null,
    evidencePrerequisite: 'HydroState is the only hero metric',
    requiredUncertaintyKey: null,
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'Constitution Principle 2 · Founder Decision 4',
  },
];

/* ─── Performance DNA language ────────────────────────────────────────────── */

const DNA_RULES: readonly PolicyRule[] = [
  {
    ruleId: 'P42-DNA-001',
    category: 'state_integrity',
    severity: 'block',
    outcome: 'SUPPRESS_POLICY_VIOLATION',
    applicableCategories: ['emerging_pattern', 'observed_pattern', 'high_confidence_pattern'],
    applicableSurfaces: null,
    prohibitedConcepts: [
      'genetic', 'genetics', 'genetically', 'dna test', 'in your dna',
      'hardwired', 'permanent', 'permanently', 'unchangeable', 'fixed trait',
      'you are a', 'biologically determined',
    ],
    approvedTransformKey: null,
    evidencePrerequisite: 'patterns are observed and may change',
    requiredUncertaintyKey: 'gate.pattern.may_change',
    effectiveVersion: GATE_POLICY_VERSION,
    reviewStatus: 'founder_approved',
    governanceSource: 'Founder Decision 4 · docs/PERFORMANCE-DNA-SPEC.md',
  },
];

/* ─── Registry ────────────────────────────────────────────────────────────── */

export const POLICY_RULES: readonly PolicyRule[] = [
  ...MEDICAL_RULES,
  ...INJURY_RULES,
  ...CAUSALITY_RULES,
  ...CERTAINTY_RULES,
  ...PRODUCT_RULES,
  ...SCORE_RULES,
  ...DNA_RULES,
];

/** Every prohibited concept across the registry — used by the property test. */
export const ALL_PROHIBITED_CONCEPTS: readonly string[] = Array.from(
  new Set(POLICY_RULES.flatMap((r) => r.prohibitedConcepts)),
);

/* ─── Matching ────────────────────────────────────────────────────────────── */

/**
 * Whole-word / phrase match, case-insensitive.
 *
 * Word-boundary anchored so "prevention" matches the concept "prevention" but
 * an unrelated substring inside a longer word does not produce a false block.
 */
export function conceptPresent(text: string, concept: string): boolean {
  const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

/** Rules that apply to a given category + surface. */
export function rulesFor(
  category: ClaimCategory,
  surface: IntendedSurface,
): readonly PolicyRule[] {
  return POLICY_RULES.filter((r) => {
    const catOk = r.applicableCategories === null || r.applicableCategories.includes(category);
    const surfOk = r.applicableSurfaces === null || r.applicableSurfaces.includes(surface);
    return catOk && surfOk;
  });
}
