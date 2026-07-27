/**
 * Stage 2 — Performance Knowledge Graph™ construction (§38).
 *
 * Converts canonical intelligence events into a GRAPH MUTATION PLAN. It never
 * writes: the plan is data, applied by a persistence layer outside this module.
 * That separation is what makes construction pure, replayable, and structurally
 * incapable of touching HydroState or user-facing state.
 *
 * HARD LOCKS:
 *  - Pure + RN-free (type-only imports where possible); no database logic here.
 *  - Score-Protection: never reads, awards, mutates, or fabricates score.
 *  - Idempotent replay: deterministic ids + first-wins merge ⇒ processing the
 *    same event twice equals processing it once.
 *  - No fabrication: absence of evidence yields `insufficient`, never a
 *    favourable default; every declined input is reported in `rejected`.
 *  - **Association is not causation.** No causal family exists to emit.
 *  - User isolation: a batch spanning users is rejected, not silently split.
 */
import {
  ACTIVE_NODE_FAMILIES,
  DERIVED_NODE_FAMILIES,
  EVIDENCE_BEARING_EDGE_FAMILIES,
  RESERVED_NODE_FAMILIES,
  type ActiveNodeFamily,
  type ConfidenceMethod,
  type EdgeFamily,
  type EvidenceAssessment,
  type EvidenceInputs,
  type EvidenceState,
  type GraphEdge,
  type GraphMutationPlan,
  type GraphNode,
  type NodeFamily,
  type ObservationWindow,
  type RecordInvalidation,
  type RejectedInput,
} from '../../../types/knowledgeGraph';
import type {
  EventCategory,
  IntelligenceEvent,
  ModelVersion,
} from '../../../types/intelligenceEvents';
import {
  isPersistable,
  isValidIntelligenceEvent,
} from '../intelligenceEventContracts';
import {
  GRAPH_CONTRADICTION_RATIO,
  GRAPH_MIN_SUPPORTING_OBSERVATIONS,
  GRAPH_SUPPORTED_MIN_DISTINCT_DAYS,
  GRAPH_SUPPORTED_MIN_OBSERVATIONS,
} from '../../../config/hydroStateModel';

/** Current graph derivation logic version. Bump per MODEL-VERSION-REGISTRY. */
export const GRAPH_MODEL_VERSION: ModelVersion = 'graph-v1.0';

/* ─── Deterministic identity ──────────────────────────────────────────────── */

/**
 * Node identity is deterministic so re-derivation reproduces the same node and
 * a first-wins merge is idempotent. Scoped by user so two users can never
 * collide on a shared key.
 */
export function nodeId(userId: string, family: NodeFamily, key: string): string {
  return `n:${userId}:${family}:${key}`;
}

/** Edge identity is deterministic in (user, family, endpoints, model version). */
export function edgeId(
  userId: string,
  family: EdgeFamily,
  sourceNodeId: string,
  targetNodeId: string,
  modelVersion: ModelVersion,
): string {
  return `e:${userId}:${family}:${sourceNodeId}->${targetNodeId}@${modelVersion}`;
}

/* ─── Category → node family ──────────────────────────────────────────────── */

const CATEGORY_TO_FAMILY: Partial<Record<EventCategory, ActiveNodeFamily>> = {
  behavior: 'action',
  context: 'context',
  physiological: 'observation',
  outcome: 'outcome',
  profile: 'profile_version_ref',
};

export function familyForCategory(category: EventCategory): ActiveNodeFamily | null {
  return CATEGORY_TO_FAMILY[category] ?? null;
}

export function isReservedFamily(family: NodeFamily): boolean {
  return (RESERVED_NODE_FAMILIES as readonly NodeFamily[]).includes(family);
}

export function isActiveFamily(family: NodeFamily): boolean {
  return (ACTIVE_NODE_FAMILIES as readonly NodeFamily[]).includes(family);
}

export function isDerivedFamily(family: NodeFamily): boolean {
  return DERIVED_NODE_FAMILIES.includes(family);
}

/* ─── Evidence assessment ─────────────────────────────────────────────────── */

/**
 * Conservative COUNTING assessment — deliberately not a scientific weighting.
 *
 * `score` stays **null** because no approved weighting exists; inventing a
 * number would imply a precision the evidence does not support. The raw inputs
 * are stored in full so an approved weighting can be applied later without
 * re-deriving from source events.
 */
export function assessEvidence(inputs: EvidenceInputs): EvidenceAssessment {
  const method: ConfidenceMethod = 'evidence_count_v1';
  const total = inputs.supportingCount + inputs.contradictingCount;

  let state: EvidenceState;
  if (total === 0 || inputs.supportingCount < GRAPH_MIN_SUPPORTING_OBSERVATIONS) {
    // Absence is never favourable.
    state = 'insufficient';
  } else if (inputs.contradictingCount / total >= GRAPH_CONTRADICTION_RATIO) {
    state = 'contradicted';
  } else if (
    inputs.supportingCount >= GRAPH_SUPPORTED_MIN_OBSERVATIONS &&
    (inputs.window?.distinctDayCount ?? 0) >= GRAPH_SUPPORTED_MIN_DISTINCT_DAYS
  ) {
    state = 'supported';
  } else {
    state = 'emerging';
  }

  return { state, method, inputs, score: null };
}

export function emptyEvidence(): EvidenceAssessment {
  return assessEvidence({
    supportingCount: 0,
    contradictingCount: 0,
    window: null,
    sourceQuality: null,
    recency: null,
    contextComparable: null,
  });
}

/* ─── Node construction ───────────────────────────────────────────────────── */

function nodeFromEvent(event: IntelligenceEvent, family: ActiveNodeFamily): GraphNode {
  return {
    id: nodeId(event.userId, family, event.clientEventId),
    userId: event.userId,
    family,
    sourceEventId: event.clientEventId,
    occurredAtMs: event.occurredAtMs,
    recordedAtMs: event.recordedAtMs,
    dayIndex: event.dayIndex,
    // Preserved round-trip — never normalized to a single convention.
    dayIndexBasis: event.dayIndexBasis,
    profileVersionId: event.version.profileVersionId,
    baselineVersionId: event.version.baselineVersionId,
    modelVersion: GRAPH_MODEL_VERSION,
    provenance: event.provenance,
    privacyClass: event.privacyClass,
    retentionClass: event.retentionClass,
    quality: event.quality,
    invalidation: { status: 'active' },
    audit: {
      createdAtMs: event.recordedAtMs,
      updatedAtMs: event.recordedAtMs,
      lastEvaluatedAtMs: null,
    },
    attributes: { type: event.type },
  };
}

/* ─── Edge construction ───────────────────────────────────────────────────── */

function makeEdge(
  userId: string,
  family: EdgeFamily,
  sourceNodeId: string,
  targetNodeId: string,
  provenanceLinks: readonly string[],
  atMs: number,
  privacyClass: GraphNode['privacyClass'],
  retentionClass: GraphNode['retentionClass'],
): GraphEdge {
  const carriesEvidence = EVIDENCE_BEARING_EDGE_FAMILIES.includes(family);
  return {
    id: edgeId(userId, family, sourceNodeId, targetNodeId, GRAPH_MODEL_VERSION),
    userId,
    family,
    direction: 'directed',
    sourceNodeId,
    targetNodeId,
    provenanceLinks,
    evidence: carriesEvidence
      ? assessEvidence({
          supportingCount: provenanceLinks.length,
          contradictingCount: 0,
          window: null,
          sourceQuality: null,
          recency: null,
          contextComparable: null,
        })
      : { state: 'insufficient', method: 'not_computed', inputs: emptyEvidence().inputs, score: null },
    modelVersion: GRAPH_MODEL_VERSION,
    privacyClass,
    retentionClass,
    invalidation: { status: 'active' },
    audit: { createdAtMs: atMs, updatedAtMs: atMs, lastEvaluatedAtMs: null },
  };
}

/* ─── Construction ────────────────────────────────────────────────────────── */

export interface BuildGraphOptions {
  /** Node ids already present, so replay is a no-op rather than a duplicate. */
  existingNodeIds?: ReadonlySet<string>;
  /** Edge ids already present. */
  existingEdgeIds?: ReadonlySet<string>;
}

/**
 * Build a mutation plan from a batch of events for a SINGLE user.
 *
 * Out-of-order and late-arriving events are handled by sorting on `occurredAtMs`
 * before deriving temporal edges, so a late context event still links correctly
 * rather than producing a reversed `preceded` relationship.
 */
export function buildGraphMutationPlan(
  userId: string,
  events: readonly IntelligenceEvent[],
  options: BuildGraphOptions = {},
): GraphMutationPlan {
  const existingNodeIds = options.existingNodeIds ?? new Set<string>();
  const existingEdgeIds = options.existingEdgeIds ?? new Set<string>();

  const rejected: RejectedInput[] = [];
  const nodesToInsert: GraphNode[] = [];
  const edgesToInsert: GraphEdge[] = [];
  const nodesToInvalidate: RecordInvalidation[] = [];
  const recalculationCandidates: string[] = [];

  const seenNodeIds = new Set<string>();
  const seenEdgeIds = new Set<string>();
  const accepted: { event: IntelligenceEvent; node: GraphNode }[] = [];

  for (const event of events) {
    // User isolation: never silently absorb another user's event.
    if (event.userId !== userId) {
      rejected.push({ clientEventId: event.clientEventId, reason: 'cross_user' });
      continue;
    }
    // Specific reasons are checked BEFORE the general validity gate: a
    // rejection must explain precisely why, not collapse everything into
    // "invalid". `validateIntelligenceEvent` also flags several of these, so
    // ordering is what makes the reported reason actionable.
    if (!isPersistable(event.retentionClass)) {
      rejected.push({ clientEventId: event.clientEventId, reason: 'non_persistable_retention' });
      continue;
    }
    // An invalidated source cannot justify a new active record.
    if (event.invalidation.status !== 'active') {
      rejected.push({ clientEventId: event.clientEventId, reason: 'invalidated_source_event' });
      continue;
    }

    const family = familyForCategory(event.category);
    if (family === null) {
      // Derived categories (graph/prediction/pattern/...) are not ingested as
      // source nodes in Stage 2; reserved families are not operationalized.
      rejected.push({
        clientEventId: event.clientEventId,
        reason: isReservedFamily(event.category as NodeFamily)
          ? 'reserved_node_family'
          : 'unknown_category',
      });
      continue;
    }

    if (!isValidIntelligenceEvent(event)) {
      rejected.push({ clientEventId: event.clientEventId, reason: 'invalid_event' });
      continue;
    }

    const node = nodeFromEvent(event, family);

    // Duplicate suppression — first wins, replay is a no-op.
    if (existingNodeIds.has(node.id) || seenNodeIds.has(node.id)) {
      rejected.push({ clientEventId: event.clientEventId, reason: 'duplicate' });
      continue;
    }

    seenNodeIds.add(node.id);
    nodesToInsert.push(node);
    accepted.push({ event, node });
  }

  // Out-of-order / late-arriving handling: derive temporal edges from real
  // chronological order, not arrival order.
  const ordered = [...accepted].sort((a, b) => a.event.occurredAtMs - b.event.occurredAtMs);

  const pushEdge = (edge: GraphEdge) => {
    if (existingEdgeIds.has(edge.id) || seenEdgeIds.has(edge.id)) return;
    seenEdgeIds.add(edge.id);
    edgesToInsert.push(edge);
  };

  for (let i = 0; i < ordered.length; i++) {
    const { event, node } = ordered[i];

    // Anchor every node to its version references (structural, no evidence).
    if (event.version.profileVersionId !== null) {
      const target = nodeId(userId, 'profile_version_ref', String(event.version.profileVersionId));
      pushEdge(
        makeEdge(userId, 'compared_against_baseline', node.id, target, [event.clientEventId],
          event.recordedAtMs, node.privacyClass, node.retentionClass),
      );
    }

    pushEdge(
      makeEdge(userId, 'generated_by_model', node.id,
        nodeId(userId, 'model_version_ref', GRAPH_MODEL_VERSION), [event.clientEventId],
        event.recordedAtMs, node.privacyClass, node.retentionClass),
    );

    // Temporal chain, in true chronological order.
    if (i > 0) {
      const prev = ordered[i - 1];
      pushEdge(
        makeEdge(userId, 'preceded', prev.node.id, node.id, [prev.event.clientEventId, event.clientEventId],
          event.recordedAtMs, node.privacyClass, node.retentionClass),
      );
    }

    // An action observed alongside context — ASSOCIATION, never causation.
    if (node.family === 'action' || node.family === 'outcome') {
      const contextNode = ordered.find((o) => o.node.family === 'context');
      if (contextNode) {
        pushEdge(
          makeEdge(userId, 'observed_in_context', node.id, contextNode.node.id,
            [event.clientEventId, contextNode.event.clientEventId],
            event.recordedAtMs, node.privacyClass, node.retentionClass),
        );
        recalculationCandidates.push(node.id);
      }
    }
  }

  return {
    nodesToInsert,
    nodesToSupersede: [],
    nodesToInvalidate,
    edgesToInsert,
    edgesToSupersede: [],
    edgesToInvalidate: [],
    recalculationCandidates,
    provenanceUpdates: [],
    rejected,
  };
}

/* ─── Observation window helper ───────────────────────────────────────────── */

/** Build a window from event times, counting DISTINCT days (spread, not volume). */
export function observationWindow(
  events: readonly Pick<IntelligenceEvent, 'occurredAtMs' | 'dayIndex'>[],
): ObservationWindow | null {
  if (events.length === 0) return null;
  let startMs = events[0].occurredAtMs;
  let endMs = events[0].occurredAtMs;
  const days = new Set<number>();
  for (const e of events) {
    if (e.occurredAtMs < startMs) startMs = e.occurredAtMs;
    if (e.occurredAtMs > endMs) endMs = e.occurredAtMs;
    days.add(e.dayIndex);
  }
  return { startMs, endMs, distinctDayCount: days.size };
}
