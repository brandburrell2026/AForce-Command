/**
 * Stage 2 — deletion and invalidation propagation foundation (§38, DR-002/DR-005).
 *
 * Implements the mandated chain as a PURE PLANNER:
 *
 *   source event deletion or invalidation
 *     → dependent node review
 *     → dependent edge review
 *     → active-support check
 *     → invalidation or recalculation candidate
 *     → downstream notification contract (for future phases)
 *
 * THE HARD INVARIANT (DR-002 / DR-005):
 *   No active derived graph record may remain when all of its supporting
 *   provenance is deleted, invalidated, or expired.
 *
 * HARD LOCKS:
 *  - Pure. Produces a plan; applies nothing. Never touches HydroState.
 *  - Fails closed: a record whose surviving support cannot be established is
 *    treated as unsupported.
 *  - Contradictory evidence stays independently traceable — never folded away.
 *  - Superseded records remain historically auditable but operationally inactive.
 */
import type {
  GraphEdge,
  GraphMutationPlan,
  GraphNode,
  RecordInvalidation,
} from '../../../types/knowledgeGraph';
import type { InvalidationReason } from '../../../types/intelligenceEvents';
import type { GraphStore } from './queryGraph';
import { isOperationalEdge, isOperationalNode } from './queryGraph';

/* ─── Downstream notification contract (future phases) ────────────────────── */

/**
 * Systems that must review their own derived records when graph support
 * changes. Stage 2 only EMITS these notices — no consumer exists yet, which is
 * exactly why the contract is defined now rather than retrofitted later.
 */
export type DownstreamSystem =
  | 'living_performance_model'
  | 'prediction_engine'
  | 'performance_dna'
  | 'evidence_engine';

export interface DownstreamNotice {
  system: DownstreamSystem;
  reason: InvalidationReason;
  affectedRecordIds: readonly string[];
}

export const ALL_DOWNSTREAM_SYSTEMS: readonly DownstreamSystem[] = [
  'living_performance_model',
  'prediction_engine',
  'performance_dna',
  'evidence_engine',
];

/* ─── Result ──────────────────────────────────────────────────────────────── */

export interface DeletionPropagationPlan extends GraphMutationPlan {
  notices: readonly DownstreamNotice[];
}

export interface PropagationInput {
  /** Source event ids deleted or invalidated. */
  removedSourceEventIds: ReadonlySet<string>;
  reason: InvalidationReason;
  nowMs: number;
}

/* ─── Support evaluation ──────────────────────────────────────────────────── */

/**
 * Whether any of a record's supporting events survive.
 *
 * Fails closed twice over: a record with no recorded provenance was never
 * supportable, and support that is itself removed does not count.
 */
export function hasSurvivingSupport(
  provenanceIds: readonly string[],
  removed: ReadonlySet<string>,
): boolean {
  if (provenanceIds.length === 0) return false;
  return provenanceIds.some((id) => !removed.has(id));
}

/* ─── Propagation ─────────────────────────────────────────────────────────── */

/**
 * Review every dependent record and decide, per record:
 *  - INVALIDATE  — all supporting provenance is gone
 *  - RECALCULATE — some support was lost, some survives (evidence must be
 *                  re-evaluated, but the relationship itself stands)
 *  - untouched   — no support was lost
 *
 * Deleting one of several supporting observations therefore does NOT remove a
 * relationship; deleting all of them does.
 */
export function propagateDeletion(
  store: GraphStore,
  userId: string,
  input: PropagationInput,
): DeletionPropagationPlan {
  const { removedSourceEventIds: removed, reason, nowMs } = input;

  const nodesToInvalidate: RecordInvalidation[] = [];
  const edgesToInvalidate: RecordInvalidation[] = [];
  const recalculationCandidates: string[] = [];
  const invalidatedIds: string[] = [];

  const userNodes = store.nodes.filter((n) => n.userId === userId);
  const userEdges = store.edges.filter((e) => e.userId === userId);

  /* --- dependent node review --- */
  for (const node of userNodes) {
    if (!isOperationalNode(node, nowMs)) continue;

    const provenanceIds = node.sourceEventId
      ? [node.sourceEventId, ...node.provenance.derivedFrom]
      : [...node.provenance.derivedFrom];

    const touched = provenanceIds.some((id) => removed.has(id));
    if (!touched) continue;

    if (hasSurvivingSupport(provenanceIds, removed)) {
      recalculationCandidates.push(node.id);
    } else {
      nodesToInvalidate.push({ recordId: node.id, reason, atMs: nowMs });
      invalidatedIds.push(node.id);
    }
  }

  const invalidatedNodeIds = new Set(nodesToInvalidate.map((n) => n.recordId));

  /* --- dependent edge review --- */
  for (const edge of userEdges) {
    if (!isOperationalEdge(edge, nowMs)) continue;

    const touched = edge.provenanceLinks.some((id) => removed.has(id));
    // An edge is also unsupportable if either endpoint is being invalidated —
    // no edge may reference a non-operational node.
    const endpointGone =
      invalidatedNodeIds.has(edge.sourceNodeId) || invalidatedNodeIds.has(edge.targetNodeId);

    if (!touched && !endpointGone) continue;

    if (!endpointGone && hasSurvivingSupport(edge.provenanceLinks, removed)) {
      recalculationCandidates.push(edge.id);
    } else {
      edgesToInvalidate.push({ recordId: edge.id, reason, atMs: nowMs });
      invalidatedIds.push(edge.id);
    }
  }

  /* --- downstream notification --- */
  const notices: DownstreamNotice[] =
    invalidatedIds.length === 0 && recalculationCandidates.length === 0
      ? []
      : ALL_DOWNSTREAM_SYSTEMS.map((system) => ({
          system,
          reason,
          affectedRecordIds: [...invalidatedIds, ...recalculationCandidates],
        }));

  return {
    nodesToInsert: [],
    nodesToSupersede: [],
    nodesToInvalidate,
    edgesToInsert: [],
    edgesToSupersede: [],
    edgesToInvalidate,
    recalculationCandidates,
    provenanceUpdates: [],
    rejected: [],
    notices,
  };
}

/* ─── Invariant check ─────────────────────────────────────────────────────── */

export interface InvariantViolation {
  recordId: string;
  kind: 'node' | 'edge';
  detail: 'active_without_surviving_support';
}

/**
 * Executable form of the hard invariant, for property testing and for a
 * post-apply assertion in later stages.
 *
 * Returns every active record that still claims support it no longer has.
 * An empty array means the invariant holds.
 */
export function findUnsupportedActiveRecords(
  store: GraphStore,
  userId: string,
  removedSourceEventIds: ReadonlySet<string>,
  nowMs: number,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const node of store.nodes) {
    if (node.userId !== userId) continue;
    if (!isOperationalNode(node, nowMs)) continue;
    // Primary observation nodes are anchored by their own source event.
    const ids = node.sourceEventId
      ? [node.sourceEventId, ...node.provenance.derivedFrom]
      : [...node.provenance.derivedFrom];
    if (!hasSurvivingSupport(ids, removedSourceEventIds)) {
      violations.push({ recordId: node.id, kind: 'node', detail: 'active_without_surviving_support' });
    }
  }

  for (const edge of store.edges) {
    if (edge.userId !== userId) continue;
    if (!isOperationalEdge(edge, nowMs)) continue;
    if (!hasSurvivingSupport(edge.provenanceLinks, removedSourceEventIds)) {
      violations.push({ recordId: edge.id, kind: 'edge', detail: 'active_without_surviving_support' });
    }
  }

  return violations;
}

/* ─── Applying a plan (pure, for tests and future persistence) ────────────── */

/**
 * Apply an invalidation plan to an in-memory store. Superseded and invalidated
 * records are RETAINED with changed state — never deleted — so history stays
 * auditable while operational queries exclude them.
 */
export function applyInvalidationPlan(
  store: GraphStore,
  plan: DeletionPropagationPlan,
): GraphStore {
  const nodeInvalidations = new Map(plan.nodesToInvalidate.map((i) => [i.recordId, i]));
  const edgeInvalidations = new Map(plan.edgesToInvalidate.map((i) => [i.recordId, i]));

  const nodes: GraphNode[] = store.nodes.map((n) => {
    const inv = nodeInvalidations.get(n.id);
    if (!inv) return n;
    return {
      ...n,
      invalidation: { status: 'invalidated', reason: inv.reason, atMs: inv.atMs },
      audit: { ...n.audit, updatedAtMs: inv.atMs, lastEvaluatedAtMs: inv.atMs },
    };
  });

  const edges: GraphEdge[] = store.edges.map((e) => {
    const inv = edgeInvalidations.get(e.id);
    if (!inv) return e;
    return {
      ...e,
      invalidation: { status: 'invalidated', reason: inv.reason, atMs: inv.atMs },
      audit: { ...e.audit, updatedAtMs: inv.atMs, lastEvaluatedAtMs: inv.atMs },
    };
  });

  return { nodes, edges };
}
