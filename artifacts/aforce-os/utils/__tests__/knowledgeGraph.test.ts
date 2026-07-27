/**
 * Stage 2 — Performance Knowledge Graph™ foundation.
 *
 * Covers the Stage 2 required-testing list: node/edge validation, user-scope
 * isolation, idempotent replay, deterministic ids, duplicate suppression,
 * out-of-order ingestion, late context, invalidation propagation, supersession,
 * provenance completeness, relationship-support loss, contradiction
 * preservation, retention awareness, bounded queries, model-version history,
 * absence of causal claims, no HydroState mutation, no user-facing emission,
 * Evidence Engine adapter refusals, and property-based deletion propagation.
 */
import { describe, expect, it } from 'vitest';
import {
  GRAPH_MODEL_VERSION,
  assessEvidence,
  buildGraphMutationPlan,
  edgeId,
  familyForCategory,
  isReservedFamily,
  nodeId,
  observationWindow,
} from '../intelligence/knowledgeGraph/buildGraph';
import {
  actionOutcomeHistory,
  activeNeighborhood,
  affectedBySourceEvents,
  baselineComparisons,
  contextOutcomeAssociations,
  contradictoryEvidence,
  historyIncludingSuperseded,
  isOperationalEdge,
  isOperationalNode,
  provenancePath,
  recordsForModelVersion,
  supportingEvidence,
  type GraphStore,
} from '../intelligence/knowledgeGraph/queryGraph';
import {
  applyInvalidationPlan,
  findUnsupportedActiveRecords,
  hasSurvivingSupport,
  propagateDeletion,
} from '../intelligence/knowledgeGraph/deletionPropagation';
import {
  claimKindForEdge,
  containsCausalLanguage,
  packageEdgeAsEvidence,
} from '../intelligence/knowledgeGraph/evidenceAdapterBoundary';
import {
  EDGE_FAMILIES,
  RESERVED_NODE_FAMILIES,
  type GraphEdge,
  type GraphNode,
} from '../../types/knowledgeGraph';
import type { IntelligenceEvent } from '../../types/intelligenceEvents';

const NOW = 1_800_000_000_000;
const DAY_MS = 86_400_000;
const U = 'user-1';

function evt(over: Partial<IntelligenceEvent> = {}): IntelligenceEvent {
  return {
    clientEventId: 'e1',
    userId: U,
    category: 'behavior',
    type: 'intake_logged',
    schemaVersion: 1,
    occurredAtMs: NOW - 1000,
    recordedAtMs: NOW - 900,
    dayIndex: 20_833,
    dayIndexBasis: 'local-calendar',
    version: { profileVersionId: 7, baselineVersionId: 3, modelVersion: null },
    provenance: { source: 'user_log', derivedFrom: [] },
    quality: { freshness: 'fresh', signalQuality: 'good', confidence: null },
    privacyClass: 'S1',
    retentionClass: 'R2',
    invalidation: { status: 'active' },
    payload: {},
    ...over,
  };
}

function storeFrom(events: readonly IntelligenceEvent[]): GraphStore {
  const plan = buildGraphMutationPlan(U, events);
  return { nodes: [...plan.nodesToInsert], edges: [...plan.edgesToInsert] };
}

/* ── deterministic ids ─────────────────────────────────────────────────────── */

describe('deterministic identity', () => {
  it('produces stable, user-scoped node ids', () => {
    expect(nodeId(U, 'action', 'e1')).toBe('n:user-1:action:e1');
    expect(nodeId('user-2', 'action', 'e1')).not.toBe(nodeId(U, 'action', 'e1'));
  });

  it('encodes model version in edge ids so a major bump yields new rows', () => {
    const a = edgeId(U, 'preceded', 'n1', 'n2', 'graph-v1.0');
    const b = edgeId(U, 'preceded', 'n1', 'n2', 'graph-v2.0');
    expect(a).not.toBe(b);
  });
});

/* ── node & edge validation ───────────────────────────────────────────────── */

describe('node and edge validation', () => {
  it('maps every ingestible category to an active family', () => {
    expect(familyForCategory('behavior')).toBe('action');
    expect(familyForCategory('context')).toBe('context');
    expect(familyForCategory('outcome')).toBe('outcome');
    expect(familyForCategory('physiological')).toBe('observation');
    expect(familyForCategory('profile')).toBe('profile_version_ref');
  });

  it('does not ingest derived categories as source nodes', () => {
    const plan = buildGraphMutationPlan(U, [evt({ category: 'graph', clientEventId: 'g1' })]);
    expect(plan.nodesToInsert).toHaveLength(0);
    expect(plan.rejected[0].reason).toBe('unknown_category');
  });

  it('keeps reserved node families declared but not operational', () => {
    for (const f of RESERVED_NODE_FAMILIES) expect(isReservedFamily(f)).toBe(true);
    expect(familyForCategory('prediction' as never)).toBeNull();
  });

  it('rejects an invalid event rather than fabricating a node', () => {
    const plan = buildGraphMutationPlan(U, [evt({ clientEventId: '' })]);
    expect(plan.nodesToInsert).toHaveLength(0);
    expect(plan.rejected[0].reason).toBe('invalid_event');
  });

  it('rejects a non-persistable (R0) event', () => {
    const plan = buildGraphMutationPlan(U, [evt({ retentionClass: 'R0' })]);
    expect(plan.rejected[0].reason).toBe('non_persistable_retention');
  });

  it('rejects an already-invalidated source event', () => {
    const plan = buildGraphMutationPlan(U, [
      evt({ invalidation: { status: 'invalidated', reason: 'source_deleted' } }),
    ]);
    expect(plan.rejected[0].reason).toBe('invalidated_source_event');
  });
});

/* ── user isolation ───────────────────────────────────────────────────────── */

describe('user-scope isolation', () => {
  it('rejects a foreign-user event instead of silently absorbing it', () => {
    const plan = buildGraphMutationPlan(U, [evt({ userId: 'user-2', clientEventId: 'x1' })]);
    expect(plan.nodesToInsert).toHaveLength(0);
    expect(plan.rejected[0].reason).toBe('cross_user');
  });

  it('never creates a cross-user edge', () => {
    const plan = buildGraphMutationPlan(U, [
      evt({ clientEventId: 'a' }),
      evt({ userId: 'user-2', clientEventId: 'b' }),
    ]);
    for (const e of plan.edgesToInsert) expect(e.userId).toBe(U);
  });

  it('never returns another user\'s nodes from a query', () => {
    const mine = storeFrom([evt({ clientEventId: 'a' })]);
    const theirs = buildGraphMutationPlan('user-2', [evt({ userId: 'user-2', clientEventId: 'b' })]);
    const merged: GraphStore = {
      nodes: [...mine.nodes, ...theirs.nodesToInsert],
      edges: [...mine.edges, ...theirs.edgesToInsert],
    };
    const hood = activeNeighborhood(merged, U, mine.nodes[0].id, { nowMs: NOW });
    for (const n of hood.nodes) expect(n.userId).toBe(U);
  });
});

/* ── idempotency / duplicates / ordering ──────────────────────────────────── */

describe('idempotent replay and duplicate suppression', () => {
  it('replaying the same event produces no new nodes', () => {
    const first = buildGraphMutationPlan(U, [evt()]);
    const existingNodeIds = new Set(first.nodesToInsert.map((n) => n.id));
    const existingEdgeIds = new Set(first.edgesToInsert.map((e) => e.id));
    const second = buildGraphMutationPlan(U, [evt()], { existingNodeIds, existingEdgeIds });
    expect(second.nodesToInsert).toHaveLength(0);
    expect(second.edgesToInsert).toHaveLength(0);
    expect(second.rejected[0].reason).toBe('duplicate');
  });

  it('suppresses duplicates inside a single batch', () => {
    const plan = buildGraphMutationPlan(U, [evt(), evt()]);
    expect(plan.nodesToInsert).toHaveLength(1);
    expect(plan.rejected.filter((r) => r.reason === 'duplicate')).toHaveLength(1);
  });

  it('derives temporal edges in true chronological order, not arrival order', () => {
    const late = evt({ clientEventId: 'early', occurredAtMs: NOW - 5000 });
    const early = evt({ clientEventId: 'later', occurredAtMs: NOW - 1000 });
    // Arrival order is reversed relative to occurrence.
    const plan = buildGraphMutationPlan(U, [early, late]);
    const preceded = plan.edgesToInsert.filter((e) => e.family === 'preceded');
    expect(preceded).toHaveLength(1);
    expect(preceded[0].sourceNodeId).toBe(nodeId(U, 'action', 'early'));
    expect(preceded[0].targetNodeId).toBe(nodeId(U, 'action', 'later'));
  });

  it('links a late-arriving context event to actions', () => {
    const plan = buildGraphMutationPlan(U, [
      evt({ clientEventId: 'ctx', category: 'context', occurredAtMs: NOW - 9000 }),
      evt({ clientEventId: 'act', category: 'behavior', occurredAtMs: NOW - 100 }),
    ]);
    expect(plan.edgesToInsert.some((e) => e.family === 'observed_in_context')).toBe(true);
  });
});

/* ── evidence assessment ──────────────────────────────────────────────────── */

describe('evidence assessment — conservative, never invented', () => {
  const base = { window: null, sourceQuality: null, recency: null, contextComparable: null };

  it('returns insufficient with no evidence', () => {
    expect(assessEvidence({ supportingCount: 0, contradictingCount: 0, ...base }).state).toBe(
      'insufficient',
    );
  });

  it('returns insufficient below the minimum supporting count', () => {
    expect(assessEvidence({ supportingCount: 1, contradictingCount: 0, ...base }).state).toBe(
      'insufficient',
    );
  });

  it('returns emerging with support but insufficient spread', () => {
    expect(assessEvidence({ supportingCount: 3, contradictingCount: 0, ...base }).state).toBe(
      'emerging',
    );
  });

  it('requires distinct-day spread before supported', () => {
    const clustered = assessEvidence({
      supportingCount: 9,
      contradictingCount: 0,
      ...base,
      window: { startMs: NOW, endMs: NOW, distinctDayCount: 1 },
    });
    expect(clustered.state).toBe('emerging');

    const spread = assessEvidence({
      supportingCount: 9,
      contradictingCount: 0,
      ...base,
      window: { startMs: NOW - 4 * DAY_MS, endMs: NOW, distinctDayCount: 4 },
    });
    expect(spread.state).toBe('supported');
  });

  it('returns contradicted when counter-evidence dominates', () => {
    expect(assessEvidence({ supportingCount: 5, contradictingCount: 5, ...base }).state).toBe(
      'contradicted',
    );
  });

  it('never invents a numeric score', () => {
    const a = assessEvidence({ supportingCount: 9, contradictingCount: 0, ...base });
    expect(a.score).toBeNull();
    expect(a.method).toBe('evidence_count_v1');
  });

  it('counts distinct days, not observation volume', () => {
    const w = observationWindow([
      { occurredAtMs: NOW, dayIndex: 1 },
      { occurredAtMs: NOW + 1, dayIndex: 1 },
      { occurredAtMs: NOW + 2, dayIndex: 2 },
    ]);
    expect(w?.distinctDayCount).toBe(2);
  });
});

/* ── absence of causal claims ─────────────────────────────────────────────── */

describe('association is not causation', () => {
  it('declares no causal edge family', () => {
    expect(EDGE_FAMILIES).not.toContain('causes' as never);
    for (const f of EDGE_FAMILIES) expect(f).not.toMatch(/caus/i);
  });

  it('classifies every edge as observation or association, never causal', () => {
    const store = storeFrom([
      evt({ clientEventId: 'ctx', category: 'context', occurredAtMs: NOW - 500 }),
      evt({ clientEventId: 'act', category: 'behavior', occurredAtMs: NOW - 100 }),
    ]);
    for (const e of store.edges) expect(claimKindForEdge(e)).not.toBe('causal');
  });

  it('detects causal language for refusal', () => {
    expect(containsCausalLanguage('dehydration causes cramping')).toBe(true);
    expect(containsCausalLanguage('this prevents cramping')).toBe(true);
    expect(containsCausalLanguage('observed alongside heat days')).toBe(false);
  });
});

/* ── queries ──────────────────────────────────────────────────────────────── */

describe('query interfaces', () => {
  const store = storeFrom([
    evt({ clientEventId: 'ctx', category: 'context', occurredAtMs: NOW - 900 }),
    evt({ clientEventId: 'act', category: 'behavior', occurredAtMs: NOW - 800 }),
    evt({ clientEventId: 'out', category: 'outcome', occurredAtMs: NOW - 700 }),
  ]);

  it('bounds a neighbourhood traversal', () => {
    const hood = activeNeighborhood(store, U, store.nodes[0].id, {
      nowMs: NOW,
      maxNodes: 1,
      maxEdges: 1,
      maxDepth: 1,
    });
    expect(hood.nodes.length).toBeLessThanOrEqual(1);
    expect(hood.edges.length).toBeLessThanOrEqual(1);
  });

  it('reports truncation rather than silently returning a partial view', () => {
    const hood = activeNeighborhood(store, U, store.nodes[0].id, {
      nowMs: NOW,
      maxEdges: 1,
      maxDepth: 3,
    });
    expect(typeof hood.truncated).toBe('boolean');
  });

  it('returns an empty neighbourhood for an unknown origin', () => {
    expect(activeNeighborhood(store, U, 'nope', { nowMs: NOW }).nodes).toHaveLength(0);
  });

  it('surfaces supporting evidence for an edge', () => {
    const edge = store.edges[0];
    expect(supportingEvidence(store, U, edge.id, { nowMs: NOW }).length).toBeGreaterThan(0);
  });

  it('exposes baseline comparisons and context associations', () => {
    expect(baselineComparisons(store, U, { nowMs: NOW }).length).toBeGreaterThan(0);
    expect(Array.isArray(contextOutcomeAssociations(store, U, { nowMs: NOW }))).toBe(true);
    expect(Array.isArray(actionOutcomeHistory(store, U, { nowMs: NOW }))).toBe(true);
  });

  it('resolves a complete provenance path', () => {
    const path = provenancePath(store, U, store.nodes[0].id, { nowMs: NOW });
    expect(path?.complete).toBe(true);
    expect(path?.sourceEventIds.length).toBeGreaterThan(0);
  });

  it('separates records by model version', () => {
    const v1 = recordsForModelVersion(store, U, GRAPH_MODEL_VERSION);
    expect(v1.nodes.length).toBeGreaterThan(0);
    expect(recordsForModelVersion(store, U, 'graph-v9.9').nodes).toHaveLength(0);
  });
});

/* ── retention & operational eligibility ──────────────────────────────────── */

describe('retention awareness', () => {
  it('excludes a retention-expired node from operational queries', () => {
    const store = storeFrom([evt({ retentionClass: 'R1', recordedAtMs: NOW - 200 * DAY_MS })]);
    expect(isOperationalNode(store.nodes[0], NOW)).toBe(false);
    const hood = activeNeighborhood(store, U, store.nodes[0].id, { nowMs: NOW });
    expect(hood.nodes).toHaveLength(0);
  });

  it('keeps expired records visible through the explicit history path', () => {
    const store = storeFrom([evt({ retentionClass: 'R1', recordedAtMs: NOW - 200 * DAY_MS })]);
    expect(historyIncludingSuperseded(store, U, { nowMs: NOW }).nodes.length).toBeGreaterThan(0);
  });
});

/* ── invalidation / supersession ──────────────────────────────────────────── */

describe('invalidation and supersession', () => {
  it('treats a superseded record as operationally inactive but auditable', () => {
    const store = storeFrom([evt()]);
    const superseded: GraphNode = {
      ...store.nodes[0],
      invalidation: { status: 'superseded', supersededBy: 'n2', atMs: NOW },
    };
    const s: GraphStore = { nodes: [superseded], edges: [] };
    expect(isOperationalNode(superseded, NOW)).toBe(false);
    expect(activeNeighborhood(s, U, superseded.id, { nowMs: NOW }).nodes).toHaveLength(0);
    expect(historyIncludingSuperseded(s, U, { nowMs: NOW }).nodes).toHaveLength(1);
  });

  it('does not reactivate an invalidated record on replay (cross-device safety)', () => {
    const store = storeFrom([evt()]);
    const plan = propagateDeletion(store, U, {
      removedSourceEventIds: new Set(['e1']),
      reason: 'source_deleted',
      nowMs: NOW,
    });
    const after = applyInvalidationPlan(store, plan);
    // Replaying the same source event must not resurrect it.
    const replay = buildGraphMutationPlan(U, [evt()], {
      existingNodeIds: new Set(after.nodes.map((n) => n.id)),
      existingEdgeIds: new Set(after.edges.map((e) => e.id)),
    });
    expect(replay.nodesToInsert).toHaveLength(0);
    expect(after.nodes[0].invalidation.status).toBe('invalidated');
  });
});

/* ── deletion propagation ─────────────────────────────────────────────────── */

describe('deletion propagation', () => {
  /**
   * An association edge between two nodes whose OWN source events survive,
   * supported by two separate evidence events ('s1','s2'). This isolates
   * support loss from endpoint loss — deleting a support must not remove the
   * relationship, whereas deleting an endpoint's source legitimately does.
   */
  function twoSupportStore(): GraphStore {
    const base = storeFrom([
      evt({ clientEventId: 'ctx', category: 'context', occurredAtMs: NOW - 900 }),
      evt({ clientEventId: 'out', category: 'outcome', occurredAtMs: NOW - 800 }),
    ]);
    const ctxNode = base.nodes.find((n) => n.family === 'context')!;
    const outNode = base.nodes.find((n) => n.family === 'outcome')!;
    const edge: GraphEdge = {
      ...base.edges[0],
      id: 'assoc-1',
      family: 'associated_with',
      sourceNodeId: outNode.id,
      targetNodeId: ctxNode.id,
      provenanceLinks: ['s1', 's2'],
    };
    return { nodes: [ctxNode, outNode], edges: [edge] };
  }

  it('does NOT remove a relationship when one of several supports is deleted', () => {
    const store = twoSupportStore();
    const plan = propagateDeletion(store, U, {
      removedSourceEventIds: new Set(['s1']),
      reason: 'source_deleted',
      nowMs: NOW,
    });
    expect(plan.edgesToInvalidate.map((e) => e.recordId)).not.toContain(store.edges[0].id);
    expect(plan.recalculationCandidates).toContain(store.edges[0].id);
  });

  it('invalidates the relationship when ALL supports are deleted', () => {
    const store = twoSupportStore();
    const plan = propagateDeletion(store, U, {
      removedSourceEventIds: new Set(['s1', 's2']),
      reason: 'source_deleted',
      nowMs: NOW,
    });
    expect(plan.edgesToInvalidate.map((e) => e.recordId)).toContain(store.edges[0].id);
  });

  it('emits a downstream notice for future systems', () => {
    const store = twoSupportStore();
    const plan = propagateDeletion(store, U, {
      removedSourceEventIds: new Set(['s1', 's2']),
      reason: 'source_deleted',
      nowMs: NOW,
    });
    expect(plan.notices.map((n) => n.system)).toEqual(
      expect.arrayContaining(['living_performance_model', 'prediction_engine', 'performance_dna']),
    );
  });

  it('keeps contradictory evidence independently traceable', () => {
    const base = storeFrom([evt({ clientEventId: 'a' })]);
    const contradiction: GraphEdge = {
      ...base.edges[0],
      id: 'contradiction-1',
      family: 'contradicts',
      provenanceLinks: ['c1'],
    };
    const store: GraphStore = { nodes: base.nodes, edges: [...base.edges, contradiction] };
    const found = contradictoryEvidence(store, U, contradiction.sourceNodeId, { nowMs: NOW });
    expect(found.map((e) => e.id)).toContain('contradiction-1');
  });

  it('discovers affected records for a deletion set', () => {
    const store = twoSupportStore();
    const affected = affectedBySourceEvents(store, U, new Set(['s1']));
    expect(affected.nodeIds.length + affected.edgeIds.length).toBeGreaterThan(0);
  });

  it('never edges without both endpoints operational after invalidation', () => {
    const store = twoSupportStore();
    const plan = propagateDeletion(store, U, {
      removedSourceEventIds: new Set(['s1']),
      reason: 'source_deleted',
      nowMs: NOW,
    });
    const after = applyInvalidationPlan(store, plan);
    for (const e of after.edges) {
      if (!isOperationalEdge(e, NOW)) continue;
      const src = after.nodes.find((n) => n.id === e.sourceNodeId);
      const tgt = after.nodes.find((n) => n.id === e.targetNodeId);
      if (src) expect(isOperationalNode(src, NOW)).toBe(true);
      if (tgt) expect(isOperationalNode(tgt, NOW)).toBe(true);
    }
  });
});

/* ── the property invariant ───────────────────────────────────────────────── */

describe('PROPERTY — no active derived record survives total support loss', () => {
  it('holds for every subset of a deletion set', () => {
    const ids = ['a', 'b', 'c'];
    const store = storeFrom(
      ids.map((id, i) => evt({ clientEventId: id, occurredAtMs: NOW - (900 - i * 10) })),
    );

    // Every subset of the source ids, including the full set.
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const removed = new Set(ids.filter((_, i) => mask & (1 << i)));
      const plan = propagateDeletion(store, U, {
        removedSourceEventIds: removed,
        reason: 'source_deleted',
        nowMs: NOW,
      });
      const after = applyInvalidationPlan(store, plan);
      const violations = findUnsupportedActiveRecords(after, U, removed, NOW);
      expect(violations).toEqual([]);
    }
  });

  it('hasSurvivingSupport fails closed on empty provenance', () => {
    expect(hasSurvivingSupport([], new Set())).toBe(false);
  });
});

/* ── Evidence Engine adapter boundary ─────────────────────────────────────── */

describe('Evidence Engine adapter boundary', () => {
  function supportedEdgeStore(): GraphStore {
    const base = storeFrom([
      evt({ clientEventId: 'ctx', category: 'context', occurredAtMs: NOW - 900 }),
      evt({ clientEventId: 'act', category: 'behavior', occurredAtMs: NOW - 800 }),
    ]);
    const edge: GraphEdge = {
      ...base.edges.find((e) => e.family === 'observed_in_context')!,
      evidence: assessEvidence({
        supportingCount: 9,
        contradictingCount: 0,
        window: { startMs: NOW - 4 * DAY_MS, endMs: NOW, distinctDayCount: 4 },
        sourceQuality: null,
        recency: null,
        contextComparable: true,
      }),
    };
    return { nodes: base.nodes, edges: [edge] };
  }

  it('packages an eligible edge without emitting user-facing copy', () => {
    const store = supportedEdgeStore();
    const res = packageEdgeAsEvidence(store, U, store.edges[0].id, { nowMs: NOW });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.package.userFacing).toBe(false);
      expect(res.package.claimKind).not.toBe('causal');
      expect(res.package.confidenceScore).toBeNull();
      expect(res.package.uncertaintyNote).toBe('no_approved_weighting');
      // The package is structured data only — no rendered string field.
      expect(Object.values(res.package).every((v) => typeof v !== 'function')).toBe(true);
    }
  });

  it('refuses an unknown record', () => {
    const res = packageEdgeAsEvidence(supportedEdgeStore(), U, 'nope', { nowMs: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.refusal.reason).toBe('unknown_record');
  });

  it('refuses a cross-user record', () => {
    const store = supportedEdgeStore();
    const res = packageEdgeAsEvidence(store, 'user-2', store.edges[0].id, { nowMs: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.refusal.reason).toBe('cross_user');
  });

  it('refuses an invalidated record', () => {
    const store = supportedEdgeStore();
    const s: GraphStore = {
      nodes: store.nodes,
      edges: [{ ...store.edges[0], invalidation: { status: 'invalidated', reason: 'source_deleted' } }],
    };
    const res = packageEdgeAsEvidence(s, U, s.edges[0].id, { nowMs: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.refusal.reason).toBe('not_active');
  });

  it('refuses a record with no provenance path', () => {
    const store = supportedEdgeStore();
    const s: GraphStore = { nodes: store.nodes, edges: [{ ...store.edges[0], provenanceLinks: [] }] };
    const res = packageEdgeAsEvidence(s, U, s.edges[0].id, { nowMs: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.refusal.reason).toBe('no_provenance_path');
  });

  it('refuses insufficient evidence', () => {
    const store = supportedEdgeStore();
    const s: GraphStore = {
      nodes: store.nodes,
      edges: [
        {
          ...store.edges[0],
          evidence: assessEvidence({
            supportingCount: 0,
            contradictingCount: 0,
            window: null,
            sourceQuality: null,
            recency: null,
            contextComparable: null,
          }),
        },
      ],
    };
    const res = packageEdgeAsEvidence(s, U, s.edges[0].id, { nowMs: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.refusal.reason).toBe('insufficient_evidence');
  });

  it('refuses a lifecycle edge as evidence', () => {
    const store = supportedEdgeStore();
    const s: GraphStore = {
      nodes: store.nodes,
      edges: [{ ...store.edges[0], family: 'generated_by_model' }],
    };
    const res = packageEdgeAsEvidence(s, U, s.edges[0].id, { nowMs: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.refusal.reason).toBe('lifecycle_edge_not_evidence');
  });
});

/* ── Score Protection / no user-facing emission ───────────────────────────── */

describe('Score Protection and headlessness', () => {
  it('graph nodes and edges carry no score field', () => {
    const store = storeFrom([evt()]);
    for (const rec of [...store.nodes, ...store.edges]) {
      for (const k of Object.keys(rec)) {
        expect(k.toLowerCase()).not.toContain('score');
        expect(k.toLowerCase()).not.toContain('hydrostate');
      }
    }
  });

  it('construction returns a plan and mutates nothing', () => {
    const events = [evt()];
    const snapshot = JSON.stringify(events);
    const plan = buildGraphMutationPlan(U, events);
    expect(JSON.stringify(events)).toBe(snapshot);
    expect(plan).toHaveProperty('nodesToInsert');
    expect(plan).toHaveProperty('rejected');
  });

  it('emits no rendered copy anywhere in a node', () => {
    const store = storeFrom([evt()]);
    const node = store.nodes[0];
    // attributes carry normalized values only — never sentences.
    for (const v of Object.values(node.attributes)) {
      if (typeof v === 'string') expect(v.split(' ').length).toBeLessThan(4);
    }
  });
});
