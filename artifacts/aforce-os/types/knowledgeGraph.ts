/**
 * Stage 2 — Performance Knowledge Graph™ contracts (§38).
 *
 * The canonical relationship and provenance layer for AForce Intelligence™.
 * Represents explainable relationships among observations, context, commands,
 * actions, outcomes, derived features, and the version references that anchor
 * them.
 *
 * IT IS NOT: a replacement for Performance Memory™ or the Living Performance
 * Model™; a new hero metric; a medical knowledge graph; a social graph; a
 * user-facing visualization; an autonomous command engine; or a direct
 * HydroState mutation source.
 *
 * HARD LOCKS:
 *  - Types only. RN-free, dependency-free (type-only imports).
 *  - Score-Protection: no node, edge, or field carries authority to mutate
 *    score. The graph RECORDS; it never awards.
 *  - **Association is not causation.** There is deliberately no CAUSES
 *    relationship and no field that could carry one. A causal family may only
 *    be added under a future scientifically approved causal-evidence policy.
 *  - No fabrication: absence of evidence resolves to `insufficient`, never to a
 *    favourable default.
 *  - Headless: nothing here emits user-facing copy. Graph output leaves only
 *    through the Evidence Engine adapter boundary.
 */
import type {
  DayIndexBasis,
  InvalidationState,
  ModelVersion,
  PrivacyClass,
  Provenance,
  QualityContext,
  RetentionClass,
} from './intelligenceEvents';

/* ─── Node families ───────────────────────────────────────────────────────── */

/** Operational node families — these may be constructed in Stage 2. */
export type ActiveNodeFamily =
  | 'observation'
  | 'context'
  | 'command'
  | 'action'
  | 'outcome'
  | 'derived_feature'
  | 'baseline_version_ref'
  | 'profile_version_ref'
  | 'model_version_ref';

/**
 * Declared but NOT operational. Reserved so later stages are additive rather
 * than a schema change. Construction of these families is rejected in Stage 2.
 */
export type ReservedNodeFamily = 'prediction' | 'dna_pattern' | 'lpm_snapshot';

export type NodeFamily = ActiveNodeFamily | ReservedNodeFamily;

export const ACTIVE_NODE_FAMILIES: readonly ActiveNodeFamily[] = [
  'observation',
  'context',
  'command',
  'action',
  'outcome',
  'derived_feature',
  'baseline_version_ref',
  'profile_version_ref',
  'model_version_ref',
];

export const RESERVED_NODE_FAMILIES: readonly ReservedNodeFamily[] = [
  'prediction',
  'dna_pattern',
  'lpm_snapshot',
];

/** Families whose content is DERIVED rather than directly observed. */
export const DERIVED_NODE_FAMILIES: readonly NodeFamily[] = [
  'derived_feature',
  'prediction',
  'dna_pattern',
  'lpm_snapshot',
];

/* ─── Edge families ───────────────────────────────────────────────────────── */

/**
 * Approved relationship families.
 *
 * NOTE THE ABSENCE OF `causes`. Every family here is observational,
 * associative, structural, or lifecycle. None asserts causation, and none may
 * be described as causal in any downstream surface.
 */
export type EdgeFamily =
  | 'observed_in_context'
  | 'preceded'
  | 'followed'
  | 'command_recommended'
  | 'action_completed'
  | 'action_skipped'
  | 'outcome_observed'
  | 'derived_from'
  | 'supports'
  | 'contradicts'
  | 'associated_with'
  | 'compared_against_baseline'
  | 'generated_by_model'
  | 'supersedes'
  | 'invalidates';

export const EDGE_FAMILIES: readonly EdgeFamily[] = [
  'observed_in_context',
  'preceded',
  'followed',
  'command_recommended',
  'action_completed',
  'action_skipped',
  'outcome_observed',
  'derived_from',
  'supports',
  'contradicts',
  'associated_with',
  'compared_against_baseline',
  'generated_by_model',
  'supersedes',
  'invalidates',
];

/**
 * Families that carry accumulated EVIDENCE (counts, confidence, an observation
 * window). Structural and lifecycle families do not — an edge recording that a
 * node supersedes another is a fact, not an accumulating association.
 */
export const EVIDENCE_BEARING_EDGE_FAMILIES: readonly EdgeFamily[] = [
  'observed_in_context',
  'supports',
  'contradicts',
  'associated_with',
  'compared_against_baseline',
];

/** Lifecycle families — they express record state, never a body relationship. */
export const LIFECYCLE_EDGE_FAMILIES: readonly EdgeFamily[] = [
  'supersedes',
  'invalidates',
  'generated_by_model',
  'derived_from',
];

export type EdgeDirection = 'directed' | 'undirected';

/* ─── Confidence ──────────────────────────────────────────────────────────── */

/**
 * Stage 2 confidence is EVIDENCE STRENGTH for a relationship.
 *
 * It is NOT HydroState, NOT Command Confidence™, NOT a medical probability,
 * NOT certainty, and NOT a user-facing score.
 *
 * Where no approved scientific weighting exists, the graph stores the INPUTS
 * and exposes this conservative internal state rather than inventing a number.
 */
export type EvidenceState =
  | 'insufficient'
  | 'emerging'
  | 'supported'
  | 'contradicted'
  | 'superseded';

export const EVIDENCE_STATES: readonly EvidenceState[] = [
  'insufficient',
  'emerging',
  'supported',
  'contradicted',
  'superseded',
];

/**
 * How an evidence state was reached. Recorded so a state can be explained and
 * so a future approved weighting can be distinguished from today's counting.
 */
export type ConfidenceMethod =
  | 'evidence_count_v1'
  | 'not_computed'
  | 'inherited_from_source';

export interface ObservationWindow {
  startMs: number;
  endMs: number;
  /** Distinct days observed within the window — spread, not just volume. */
  distinctDayCount: number;
}

/**
 * The raw inputs behind an evidence state. Stored in full so a later approved
 * weighting can be applied retroactively WITHOUT re-deriving from source events.
 */
export interface EvidenceInputs {
  supportingCount: number;
  contradictingCount: number;
  window: ObservationWindow | null;
  /** Coarsest source quality across the contributing evidence. */
  sourceQuality: QualityContext['signalQuality'] | null;
  /** Coarsest freshness across the contributing evidence. */
  recency: QualityContext['freshness'] | null;
  /** Whether contributing observations shared a comparable context. */
  contextComparable: boolean | null;
}

export interface EvidenceAssessment {
  state: EvidenceState;
  method: ConfidenceMethod;
  inputs: EvidenceInputs;
  /**
   * Optional 0..1 scalar. **null whenever no approved weighting applies** — the
   * graph must not invent a number to look precise.
   */
  score: number | null;
}

/* ─── Audit ───────────────────────────────────────────────────────────────── */

export interface GraphAuditMetadata {
  createdAtMs: number;
  updatedAtMs: number;
  /** Last time the record's evidence was re-evaluated. */
  lastEvaluatedAtMs: number | null;
}

/* ─── Nodes ───────────────────────────────────────────────────────────────── */

export interface GraphNode {
  /** Deterministic, stable identity — re-derivation reproduces it exactly. */
  id: string;
  /** Scope. Every read and write is filtered by this; no cross-user access. */
  userId: string;
  family: NodeFamily;

  /** clientEventId of the source event, where the node came from one. */
  sourceEventId: string | null;

  occurredAtMs: number;
  recordedAtMs: number;
  dayIndex: number;
  dayIndexBasis: DayIndexBasis;

  /** References to the EXISTING server-canonical version tables — never copies. */
  profileVersionId: number | null;
  baselineVersionId: number | null;
  modelVersion: ModelVersion | null;

  provenance: Provenance;
  privacyClass: PrivacyClass;
  retentionClass: RetentionClass;
  quality: QualityContext;
  invalidation: InvalidationState;
  audit: GraphAuditMetadata;

  /** Family-specific normalized attributes. Never raw source payload copies. */
  attributes: Readonly<Record<string, string | number | boolean | null>>;
}

/* ─── Edges ───────────────────────────────────────────────────────────────── */

export interface GraphEdge {
  id: string;
  userId: string;
  family: EdgeFamily;
  direction: EdgeDirection;

  sourceNodeId: string;
  targetNodeId: string;

  /** clientEventIds justifying this edge. Empty ⇒ unsupportable. */
  provenanceLinks: readonly string[];

  evidence: EvidenceAssessment;
  modelVersion: ModelVersion;

  privacyClass: PrivacyClass;
  retentionClass: RetentionClass;
  invalidation: InvalidationState;
  audit: GraphAuditMetadata;
}

/* ─── Mutation plan ───────────────────────────────────────────────────────── */

/**
 * Graph construction produces a PLAN, never a direct write. This is what keeps
 * construction pure, testable, replayable — and structurally unable to touch
 * HydroState or user-facing state.
 */
export interface GraphMutationPlan {
  nodesToInsert: readonly GraphNode[];
  nodesToSupersede: readonly NodeSupersession[];
  nodesToInvalidate: readonly RecordInvalidation[];
  edgesToInsert: readonly GraphEdge[];
  edgesToSupersede: readonly EdgeSupersession[];
  edgesToInvalidate: readonly RecordInvalidation[];
  /** Records whose evidence should be re-evaluated; never auto-applied. */
  recalculationCandidates: readonly string[];
  provenanceUpdates: readonly ProvenanceUpdate[];
  /** Inputs the plan deliberately declined, with a reason. Never silent. */
  rejected: readonly RejectedInput[];
}

export interface NodeSupersession {
  nodeId: string;
  supersededByNodeId: string;
  atMs: number;
}

export interface EdgeSupersession {
  edgeId: string;
  supersededByEdgeId: string;
  atMs: number;
}

export interface RecordInvalidation {
  recordId: string;
  reason: InvalidationState['reason'];
  atMs: number;
}

export interface ProvenanceUpdate {
  recordId: string;
  addSourceEventIds: readonly string[];
  removeSourceEventIds: readonly string[];
}

export type RejectionReason =
  | 'invalid_event'
  | 'reserved_node_family'
  | 'invalidated_source_event'
  | 'cross_user'
  | 'unknown_category'
  | 'non_persistable_retention'
  | 'duplicate';

export interface RejectedInput {
  clientEventId: string;
  reason: RejectionReason;
}

export const EMPTY_MUTATION_PLAN: GraphMutationPlan = {
  nodesToInsert: [],
  nodesToSupersede: [],
  nodesToInvalidate: [],
  edgesToInsert: [],
  edgesToSupersede: [],
  edgesToInvalidate: [],
  recalculationCandidates: [],
  provenanceUpdates: [],
  rejected: [],
};
