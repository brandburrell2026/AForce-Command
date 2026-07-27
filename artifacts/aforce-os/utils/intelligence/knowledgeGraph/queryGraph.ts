/**
 * Stage 2 — Performance Knowledge Graph™ internal query interfaces (§38).
 *
 * Pure, in-memory query surface over a node/edge set. The persistence layer
 * supplies the records; this module owns the RULES — scoping, invalidation
 * awareness, retention awareness, and traversal bounds.
 *
 * HARD LOCKS:
 *  - **Internal only.** No public graph-query API. Nothing here is a route.
 *  - User-scoped: every query filters by userId first. No cross-user read.
 *  - Operational queries default to ACTIVE, non-invalidated, non-expired
 *    records. History including superseded records requires an explicit opt-in.
 *  - Bounded: every traversal is depth- and size-capped from config so a dense
 *    graph cannot produce an unbounded walk.
 *  - Score-Protection: reads only; never mutates anything.
 *  - Emits no user-facing copy.
 */
import type { GraphEdge, GraphNode } from '../../../types/knowledgeGraph';
import type { IntelligenceEvent } from '../../../types/intelligenceEvents';
import { isExpiredByRetention } from '../intelligenceEventContracts';
import {
  GRAPH_QUERY_MAX_DEPTH,
  GRAPH_QUERY_MAX_EDGES,
  GRAPH_QUERY_MAX_NODES,
} from '../../../config/hydroStateModel';

/* ─── Store shape ─────────────────────────────────────────────────────────── */

export interface GraphStore {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

export interface QueryOptions {
  /** Include superseded / invalidated records. Operational paths must not. */
  includeHistory?: boolean;
  /** Clock for retention evaluation. */
  nowMs: number;
  maxNodes?: number;
  maxEdges?: number;
  maxDepth?: number;
}

interface ResolvedOptions {
  includeHistory: boolean;
  nowMs: number;
  maxNodes: number;
  maxEdges: number;
  maxDepth: number;
}

function resolve(options: QueryOptions): ResolvedOptions {
  return {
    includeHistory: options.includeHistory ?? false,
    nowMs: options.nowMs,
    maxNodes: Math.min(options.maxNodes ?? GRAPH_QUERY_MAX_NODES, GRAPH_QUERY_MAX_NODES),
    maxEdges: Math.min(options.maxEdges ?? GRAPH_QUERY_MAX_EDGES, GRAPH_QUERY_MAX_EDGES),
    maxDepth: Math.min(options.maxDepth ?? GRAPH_QUERY_MAX_DEPTH, GRAPH_QUERY_MAX_DEPTH),
  };
}

/* ─── Operational eligibility ─────────────────────────────────────────────── */

/**
 * Retention is evaluated with the same helper the event layer uses, by shaping
 * a minimal record — so graph records and events can never drift apart on what
 * "expired" means.
 */
function retentionExpired(
  record: Pick<GraphNode, 'retentionClass' | 'invalidation'> & { recordedAtMs: number },
  nowMs: number,
): boolean {
  const shim = {
    retentionClass: record.retentionClass,
    recordedAtMs: record.recordedAtMs,
    invalidation: record.invalidation,
  } as unknown as IntelligenceEvent;
  return isExpiredByRetention(shim, nowMs);
}

export function isOperationalNode(node: GraphNode, nowMs: number): boolean {
  if (node.invalidation.status !== 'active') return false;
  return !retentionExpired({ ...node, recordedAtMs: node.recordedAtMs }, nowMs);
}

export function isOperationalEdge(edge: GraphEdge, nowMs: number): boolean {
  if (edge.invalidation.status !== 'active') return false;
  return !retentionExpired(
    { retentionClass: edge.retentionClass, invalidation: edge.invalidation, recordedAtMs: edge.audit.createdAtMs },
    nowMs,
  );
}

/* ─── Scoping ─────────────────────────────────────────────────────────────── */

function scopedNodes(store: GraphStore, userId: string, o: ResolvedOptions): GraphNode[] {
  return store.nodes
    .filter((n) => n.userId === userId)
    .filter((n) => (o.includeHistory ? true : isOperationalNode(n, o.nowMs)))
    .slice(0, o.maxNodes);
}

function scopedEdges(store: GraphStore, userId: string, o: ResolvedOptions): GraphEdge[] {
  return store.edges
    .filter((e) => e.userId === userId)
    .filter((e) => (o.includeHistory ? true : isOperationalEdge(e, o.nowMs)))
    .slice(0, o.maxEdges);
}

/* ─── 1. Active neighbourhood ─────────────────────────────────────────────── */

export interface Neighborhood {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  /** True when the traversal hit a bound — the caller sees a partial view. */
  truncated: boolean;
}

/**
 * Breadth-first neighbourhood around a node, bounded by depth and size.
 * `truncated` is surfaced explicitly: a partial result must never be mistaken
 * for a complete one.
 */
export function activeNeighborhood(
  store: GraphStore,
  userId: string,
  originNodeId: string,
  options: QueryOptions,
): Neighborhood {
  const o = resolve(options);
  const nodes = scopedNodes(store, userId, o);
  const edges = scopedEdges(store, userId, o);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (!byId.has(originNodeId)) return { nodes: [], edges: [], truncated: false };

  const visited = new Set<string>([originNodeId]);
  const collectedEdges: GraphEdge[] = [];
  let frontier = [originNodeId];
  let truncated = false;

  for (let depth = 0; depth < o.maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of edges) {
        if (edge.sourceNodeId !== id && edge.targetNodeId !== id) continue;
        if (collectedEdges.length >= o.maxEdges) { truncated = true; break; }
        if (!collectedEdges.includes(edge)) collectedEdges.push(edge);

        const other = edge.sourceNodeId === id ? edge.targetNodeId : edge.sourceNodeId;
        if (visited.has(other) || !byId.has(other)) continue;
        if (visited.size >= o.maxNodes) { truncated = true; break; }
        visited.add(other);
        next.push(other);
      }
      if (truncated) break;
    }
    if (truncated) break;
    frontier = next;
  }

  return {
    nodes: [...visited].map((id) => byId.get(id)!).filter(Boolean),
    edges: collectedEdges,
    truncated,
  };
}

/* ─── 2 & 3. Supporting and contradictory evidence ────────────────────────── */

export function supportingEvidence(
  store: GraphStore,
  userId: string,
  edgeId: string,
  options: QueryOptions,
): readonly string[] {
  const o = resolve(options);
  const edge = scopedEdges(store, userId, o).find((e) => e.id === edgeId);
  return edge ? edge.provenanceLinks : [];
}

/**
 * Contradictory evidence is tracked as its own edge family, so it stays
 * independently traceable and can never be quietly folded into the support.
 */
export function contradictoryEvidence(
  store: GraphStore,
  userId: string,
  nodeIdValue: string,
  options: QueryOptions,
): readonly GraphEdge[] {
  const o = resolve(options);
  return scopedEdges(store, userId, o).filter(
    (e) => e.family === 'contradicts' && (e.sourceNodeId === nodeIdValue || e.targetNodeId === nodeIdValue),
  );
}

/* ─── 4. Action → outcome history ─────────────────────────────────────────── */

export interface ActionOutcomePair {
  action: GraphNode;
  outcome: GraphNode;
  edge: GraphEdge;
}

export function actionOutcomeHistory(
  store: GraphStore,
  userId: string,
  options: QueryOptions,
): readonly ActionOutcomePair[] {
  const o = resolve(options);
  const nodes = scopedNodes(store, userId, o);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: ActionOutcomePair[] = [];

  for (const edge of scopedEdges(store, userId, o)) {
    if (edge.family !== 'outcome_observed') continue;
    const action = byId.get(edge.sourceNodeId);
    const outcome = byId.get(edge.targetNodeId);
    if (action?.family === 'action' && outcome?.family === 'outcome') {
      out.push({ action, outcome, edge });
    }
  }
  return out;
}

/* ─── 5. Context → outcome associations ───────────────────────────────────── */

/** ASSOCIATIONS only. Nothing here asserts, or may be described as, causation. */
export function contextOutcomeAssociations(
  store: GraphStore,
  userId: string,
  options: QueryOptions,
): readonly GraphEdge[] {
  const o = resolve(options);
  const nodes = scopedNodes(store, userId, o);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return scopedEdges(store, userId, o).filter((e) => {
    if (e.family !== 'observed_in_context' && e.family !== 'associated_with') return false;
    const a = byId.get(e.sourceNodeId);
    const b = byId.get(e.targetNodeId);
    if (!a || !b) return false;
    return (
      (a.family === 'context' && b.family === 'outcome') ||
      (a.family === 'outcome' && b.family === 'context')
    );
  });
}

/* ─── 6. Baseline comparisons ─────────────────────────────────────────────── */

export function baselineComparisons(
  store: GraphStore,
  userId: string,
  options: QueryOptions,
): readonly GraphEdge[] {
  const o = resolve(options);
  return scopedEdges(store, userId, o).filter((e) => e.family === 'compared_against_baseline');
}

/* ─── 7. Provenance path ──────────────────────────────────────────────────── */

export interface ProvenancePath {
  recordId: string;
  sourceEventIds: readonly string[];
  modelVersion: string | null;
  /** False ⇒ the record cannot justify itself and must not be surfaced. */
  complete: boolean;
}

export function provenancePath(
  store: GraphStore,
  userId: string,
  recordId: string,
  options: QueryOptions,
): ProvenancePath | null {
  const o = resolve({ ...options, includeHistory: true });
  const node = store.nodes.find((n) => n.userId === userId && n.id === recordId);
  if (node) {
    const ids = node.sourceEventId ? [node.sourceEventId] : [...node.provenance.derivedFrom];
    return {
      recordId,
      sourceEventIds: ids,
      modelVersion: node.modelVersion,
      complete: ids.length > 0,
    };
  }
  const edge = store.edges.find((e) => e.userId === userId && e.id === recordId);
  if (edge) {
    return {
      recordId,
      sourceEventIds: edge.provenanceLinks,
      modelVersion: edge.modelVersion,
      complete: edge.provenanceLinks.length > 0,
    };
  }
  void o;
  return null;
}

/* ─── 8. Affected-derived-record discovery (deletion support) ─────────────── */

export interface AffectedRecords {
  nodeIds: readonly string[];
  edgeIds: readonly string[];
}

/**
 * Which records depend on the given source events. This is the entry point for
 * the deletion cascade — it is a lookup over recorded provenance, never a guess.
 */
export function affectedBySourceEvents(
  store: GraphStore,
  userId: string,
  deletedSourceEventIds: ReadonlySet<string>,
): AffectedRecords {
  const nodeIds = store.nodes
    .filter((n) => n.userId === userId)
    .filter(
      (n) =>
        (n.sourceEventId !== null && deletedSourceEventIds.has(n.sourceEventId)) ||
        n.provenance.derivedFrom.some((id) => deletedSourceEventIds.has(id)),
    )
    .map((n) => n.id);

  const edgeIds = store.edges
    .filter((e) => e.userId === userId)
    .filter((e) => e.provenanceLinks.some((id) => deletedSourceEventIds.has(id)))
    .map((e) => e.id);

  return { nodeIds, edgeIds };
}

/* ─── 9. History ──────────────────────────────────────────────────────────── */

export interface GraphHistory {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

/**
 * Superseded and invalidated records remain historically auditable — but only
 * through this explicit path. They never leak into an operational query.
 */
export function historyIncludingSuperseded(
  store: GraphStore,
  userId: string,
  options: QueryOptions,
): GraphHistory {
  const o = resolve({ ...options, includeHistory: true });
  return {
    nodes: store.nodes.filter((n) => n.userId === userId).slice(0, o.maxNodes),
    edges: store.edges.filter((e) => e.userId === userId).slice(0, o.maxEdges),
  };
}

/* ─── Model-version awareness ─────────────────────────────────────────────── */

/**
 * Records produced by a given model version. A major bump must not silently
 * rewrite history, so callers can separate versions rather than blend them.
 */
export function recordsForModelVersion(
  store: GraphStore,
  userId: string,
  modelVersion: string,
): GraphHistory {
  return {
    nodes: store.nodes.filter((n) => n.userId === userId && n.modelVersion === modelVersion),
    edges: store.edges.filter((e) => e.userId === userId && e.modelVersion === modelVersion),
  };
}
