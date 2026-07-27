/**
 * Stage 2 — Evidence Engine adapter BOUNDARY (§38 → Evidence Engine).
 *
 * The single approved exit from Learning Intelligence. Stage 2 implements the
 * CONTRACT and the REFUSAL RULES only — it deliberately does not change any
 * current Evidence Engine user behaviour and emits nothing to a user.
 *
 * HARD LOCKS:
 *  - **Refuses user-facing emission.** This module produces a structured,
 *    internal evidence package. It never returns rendered copy, and the package
 *    is explicitly marked as not user-facing.
 *  - **Refuses causal language.** Association is not causation. Any candidate
 *    carrying causal framing is rejected outright.
 *  - **Requires a valid provenance path.** No provenance ⇒ no emission. There
 *    is no "trust me" path.
 *  - **Requires active, non-invalidated support.**
 *  - Carries contradictions, confidence state, uncertainty, source and model
 *    versions — and distinguishes OBSERVATION from ASSOCIATION.
 *  - Everything here remains behind the §42 language gate in later stages. This
 *    boundary is necessary, never sufficient.
 */
import type { GraphEdge, EvidenceState } from '../../../types/knowledgeGraph';
import { LIFECYCLE_EDGE_FAMILIES } from '../../../types/knowledgeGraph';
import type { GraphStore } from './queryGraph';
import { isOperationalEdge, provenancePath } from './queryGraph';

/* ─── Claim kind ──────────────────────────────────────────────────────────── */

/**
 * What a package is permitted to assert.
 *
 * `causal` exists ONLY so it can be named and refused. Nothing in Stage 2 may
 * produce it, and no approved policy authorizes it yet.
 */
export type ClaimKind = 'observation' | 'association' | 'causal';

/* ─── Package ─────────────────────────────────────────────────────────────── */

export interface EvidencePackage {
  recordId: string;
  /** Never `causal` — enforced at construction. */
  claimKind: Exclude<ClaimKind, 'causal'>;
  supportingEventIds: readonly string[];
  contradictingEdgeIds: readonly string[];
  evidenceState: EvidenceState;
  /** null whenever no approved weighting applies — uncertainty stays explicit. */
  confidenceScore: number | null;
  uncertaintyNote: 'no_approved_weighting' | 'bounded_by_evidence_count';
  modelVersion: string;
  sourceProfileVersionId: number | null;
  sourceBaselineVersionId: number | null;
  /**
   * Always false in Stage 2. The Evidence Engine + §42 gate decide user-facing
   * emission; this boundary never does.
   */
  userFacing: false;
}

/* ─── Refusals ────────────────────────────────────────────────────────────── */

export type EvidenceRefusalReason =
  | 'no_provenance_path'
  | 'not_active'
  | 'insufficient_evidence'
  | 'causal_claim_refused'
  | 'lifecycle_edge_not_evidence'
  | 'cross_user'
  | 'unknown_record';

export interface EvidenceRefusal {
  recordId: string;
  reason: EvidenceRefusalReason;
}

export type EvidenceAdapterResult =
  | { ok: true; package: EvidencePackage }
  | { ok: false; refusal: EvidenceRefusal };

/* ─── Claim classification ────────────────────────────────────────────────── */

/**
 * Direct observation families state what was recorded. Everything else that
 * carries evidence is an ASSOCIATION — never upgraded to causation.
 */
const OBSERVATION_FAMILIES: readonly GraphEdge['family'][] = [
  'observed_in_context',
  'outcome_observed',
  'action_completed',
  'action_skipped',
  'command_recommended',
];

export function claimKindForEdge(edge: GraphEdge): ClaimKind {
  return OBSERVATION_FAMILIES.includes(edge.family) ? 'observation' : 'association';
}

/* ─── Adapter ─────────────────────────────────────────────────────────────── */

export interface AdapterOptions {
  nowMs: number;
  /** States eligible to leave the boundary. Defaults to the supported set. */
  eligibleStates?: readonly EvidenceState[];
}

const DEFAULT_ELIGIBLE_STATES: readonly EvidenceState[] = ['emerging', 'supported', 'contradicted'];

/**
 * Attempt to package a graph edge as evidence.
 *
 * Fails closed at every gate: unknown record, cross-user, non-operational,
 * lifecycle-only, missing provenance, insufficient evidence, or any causal
 * framing all refuse rather than degrade.
 */
export function packageEdgeAsEvidence(
  store: GraphStore,
  userId: string,
  edgeId: string,
  options: AdapterOptions,
): EvidenceAdapterResult {
  const eligible = options.eligibleStates ?? DEFAULT_ELIGIBLE_STATES;

  const edge = store.edges.find((e) => e.id === edgeId);
  if (!edge) return refuse(edgeId, 'unknown_record');
  if (edge.userId !== userId) return refuse(edgeId, 'cross_user');

  if (!isOperationalEdge(edge, options.nowMs)) return refuse(edgeId, 'not_active');

  // Lifecycle edges describe record state, not a relationship about the body.
  if (LIFECYCLE_EDGE_FAMILIES.includes(edge.family)) {
    return refuse(edgeId, 'lifecycle_edge_not_evidence');
  }

  const kind = claimKindForEdge(edge);
  if (kind === 'causal') return refuse(edgeId, 'causal_claim_refused');

  const path = provenancePath(store, userId, edgeId, { nowMs: options.nowMs });
  if (!path || !path.complete) return refuse(edgeId, 'no_provenance_path');

  if (!eligible.includes(edge.evidence.state)) return refuse(edgeId, 'insufficient_evidence');

  const contradicting = store.edges
    .filter((e) => e.userId === userId && e.family === 'contradicts')
    .filter((e) => e.sourceNodeId === edge.sourceNodeId || e.targetNodeId === edge.targetNodeId)
    .map((e) => e.id);

  const source = store.nodes.find((n) => n.id === edge.sourceNodeId && n.userId === userId);

  return {
    ok: true,
    package: {
      recordId: edge.id,
      claimKind: kind,
      supportingEventIds: path.sourceEventIds,
      contradictingEdgeIds: contradicting,
      evidenceState: edge.evidence.state,
      confidenceScore: edge.evidence.score,
      uncertaintyNote:
        edge.evidence.score === null ? 'no_approved_weighting' : 'bounded_by_evidence_count',
      modelVersion: edge.modelVersion,
      sourceProfileVersionId: source?.profileVersionId ?? null,
      sourceBaselineVersionId: source?.baselineVersionId ?? null,
      userFacing: false,
    },
  };
}

function refuse(recordId: string, reason: EvidenceRefusalReason): EvidenceAdapterResult {
  return { ok: false, refusal: { recordId, reason } };
}

/* ─── Causal-language guard ───────────────────────────────────────────────── */

/**
 * Terms that would turn an association into a causal claim. Kept here as a
 * structural guard at the boundary; the §42 language gate (Stage 3) is the
 * mechanical enforcement over emitted copy.
 */
export const REFUSED_CAUSAL_TERMS: readonly string[] = [
  'causes',
  'caused',
  'causing',
  'because of',
  'due to',
  'results in',
  'leads to',
  'prevents',
  'prevented',
];

/** True when text carries causal framing this boundary must refuse. */
export function containsCausalLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return REFUSED_CAUSAL_TERMS.some((term) => lower.includes(term));
}
