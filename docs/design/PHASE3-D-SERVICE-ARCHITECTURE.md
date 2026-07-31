# Phase 3 · D — Service Architecture

**Status:** DESIGN ONLY — nothing implemented. **Updated:** 2026-07-22

Service boundaries for the intelligence layer. Pure logic in `utils/`, persistence and I/O in
`services/`, server derivation in `api-server` — following the established split.

---

## 1. Boundary principle

| Layer | Contains | May not |
|---|---|---|
| **Pure utils** (`utils/intelligence/**`) | All derivation math, merge, gates, confidence | Touch RN, storage, network, or clock directly |
| **Client services** (`services/**`) | Cache, sync, encryption, lifecycle | Contain derivation logic |
| **Server services** (`api-server/src/**`) | Ingestion, graph construction, derivation of record | Mutate score, bypass Evidence Engine |

**Derivation runs in both places from the same pure modules.** The client derives for offline
continuity; the server derives the canonical record. Identical pure inputs → identical outputs,
which is what makes server-wins conflict resolution safe.

## 2. Services

### 2.1 Ingestion — `api-server/src/services/intelligenceIngest.ts`

Accepts batches of `IntelligenceEvent`. Responsibilities:

- validate envelope + payload against the shared zod contract;
- **idempotent insert** on `(user_id, client_event_id)` — retries return the existing row;
- stamp `received_at`, `privacy_class`, `retention_class`;
- resolve `profile_version_id` / `baseline_version_id` from current state;
- enqueue graph construction.

**Never** writes score, never mutates `aforce_user_state`.

### 2.2 Graph construction — `api-server/src/services/graphBuilder.ts`

Consumes ingested events → nodes and relationships.

- deterministic `node_key` / `relationship_key` so re-derivation is idempotent;
- increments `observation_count` **and** `contradiction_count`;
- recomputes `confidence` and `distinct_day_count`;
- writes `aforce_provenance_links` for every derived record — **mandatory, no exceptions**;
- stamps `model_version`.

Pure core: `utils/intelligence/knowledgeGraph/buildGraph.ts` (shared with client).

### 2.3 Graph query — `api-server/src/services/graphQuery.ts`

Read surface for §39, §40, §61, Evidence Engine, and Founder Mode.

- filters `invalidation_status = 'active'` **by default** — invalidated records are never silently
  included;
- returns confidence, observation period, evidence counts, and provenance with every result;
- never returns raw nodes/edges to a user-facing path (§38: never surfaced as a graph).

Pure core: `utils/intelligence/knowledgeGraph/queryGraph.ts`.

### 2.4 Model snapshot generation — `api-server/src/services/lpmSnapshot.ts` (§61)

Generates the LPM daily lesson / on-track snapshot from §59 **and** §38.

- calls the **existing** `utils/intelligence/livingPerformanceModel.ts` — exports unchanged (A13);
- persists to `aforce_lpm_snapshots`; pushes the current snapshot to the device cache;
- preserves Silent Intelligence: no qualifying lesson → on-track, **never a manufactured lesson**.

### 2.5 Prediction — `api-server/src/services/predictionEngine.ts` (§39)

- evaluates the `DR-003` gates (7 days / 5 comparable observations / 3 distinct days / fresh
  context / sufficient signal quality / confidence floor), all read from
  `config/hydroStateModel.ts`;
- resolves one of the **four states**: `insufficient_data` · `context_only` · `emerging` ·
  `calibrated`;
- **a context-only estimate is labeled context-based and never presented as personal learning**;
- sets `expires_at` on every projection;
- **emits nothing to a user-facing path until §42 clears** (fail-closed).

Pure core: `utils/intelligence/predictionEngine.ts`. Freshness/quality come from the existing
`utils/confidence/*` (A16), not a new definition.

### 2.6 Outcome reconciliation — `api-server/src/services/predictionOutcomes.ts` (§39)

Scheduled sweep matching expired predictions to what actually happened.

- writes `matched` / `diverged` / `unresolved`;
- feeds confidence calibration (Output G);
- **never** retroactively edits the original prediction — accountability requires the original
  stands as issued.

### 2.7 Pattern detection — `api-server/src/services/dnaPatterns.ts` (§40)

- derives patterns from relationships **over time**;
- assigns one of the five approved states only;
- maintains supporting **and** contradictory counts;
- slow transitions — hysteresis thresholds in config so a single contrary day cannot flip a
  High-Confidence Pattern (validation D-5);
- logs every transition to `aforce_dna_pattern_history`;
- honors `user_disposition`: a dismissed pattern is retired and **does not silently return**.

Pure core: `utils/intelligence/performanceDna.ts`. **No numeric score type exists** anywhere in
this service.

### 2.8 Evidence Engine adapter — `utils/intelligence/evidenceAdapter.ts`

The **only** exit from Learning Intelligence to a user-facing path.

- converts a graph relationship, prediction, or pattern into an Evidence Engine explanation;
- attaches provenance, confidence, observation period, evidence count;
- **refuses to emit** anything lacking a provenance path (§41) — no "trust me" path exists;
- routes output through the **§42 language gate** before returning.

### 2.9 Founder Mode inspection — `api-server/src/services/founderIntelligenceInspector.ts`

Per §62 and `DR-003` exposure step 1.

- read-only over Sandbox; **writes nothing to Production**;
- exposes raw nodes, relationships, provenance chains, prediction records + outcomes, pattern
  history, model versions, invalidation status, failed sync items;
- persistent **FOUNDER MODE / SANDBOX** watermark;
- **internal only — never exposed in Production** (§62).

This is the first surface where DNA appears (`DR-003`), and deliberately the least risky: no
user-facing copy, no §42 exposure path.

## 3. Client services

| Service | Role |
|---|---|
| `services/commandLedger.ts` **(extend)** | Existing ledger becomes a sync participant; gains encryption + per-user keying. **One ledger only** (A8). |
| `services/intelligenceOutbox.ts` **(generalize from `intakeOutbox`)** | Pending-event queue; frozen `clientEventId`; chronological replay. **Not a second queue** (A11). |
| `services/intelligenceCache.ts` (new) | Encrypted, per-user, non-authoritative read-through cache. Deferred write until after boot-hydration; `clear()` bumps generation counter. |
| `services/intelligenceSync.ts` (new) | Push outbox, pull canonical, resolve conflicts **server-wins**, mark sync state. |

## 4. Data flow

```
device                                    server
──────                                    ──────
behavior/context/outcome
   │
   ▼
commandLedger (extend) ──► intelligenceOutbox ──POST──► intelligenceIngest
   │                                                        │ idempotent on
   │                                                        │ (user_id, client_event_id)
   │                                                        ▼
   │                                                   graphBuilder
   │                                                        │ + provenance_links
   │                                                        ▼
   │                                                   graphQuery
   │                                          ┌─────────────┼─────────────┐
   │                                          ▼             ▼             ▼
   │                                    predictionEngine  dnaPatterns  lpmSnapshot
   │                                          │             │             │
   │                                          └─────────────┼─────────────┘
   │                                                        ▼
   │                                              evidenceAdapter  ──► §42 gate
   │                                                        │
   ◄────────────── pull: insights + LPM snapshot ───────────┘
intelligenceCache (encrypted, non-authoritative)
```

## 5. Score-Protection isolation

**No service in this document dispatches a reducer action or writes score.** Reading score
read-only for fail-closed gating is permitted (DR-001 precedent) — for example, a DEPLETED state
must never yield a projection that lengthens a prompt.

Adherence / follow-rate remains deliberately **not** fed into Command Confidence™ — wiring it would
let follow-rate silently upgrade confidence, which is a Score-Protection breach (A-note, existing
constraint).
