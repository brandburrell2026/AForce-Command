# Phase 3 · B — Canonical Event Model & Shared Intelligence Data Contracts

**Status:** DESIGN ONLY — nothing implemented. **Updated:** 2026-07-22

The single event envelope every intelligence system reads and writes. One shape, one identity
scheme, one provenance contract.

---

## 1. Design rules

| # | Rule | Source |
|---|---|---|
| 1 | **One envelope.** Every intelligence event uses the same shape; category-specific data lives in a typed payload. | forward-compat (A5 pattern) |
| 2 | **Events record only real completed behavior or observed context.** Never inferred, never seeded, never back-filled with assumptions. | §38 |
| 3 | **Client-minted, stable identity.** `clientEventId` frozen at creation; server applies exactly once. | intake-outbox precedent |
| 4 | **Every event carries its versioning context** — profile version, baseline version, model version. | §41 |
| 5 | **Absence is never favorable.** A missing event yields insufficient-data. | §38 |
| 6 | **Invalidation is a state, not a delete.** Events and derived records carry invalidation status. | `DR-002` |
| 7 | **Day-index conventions are preserved round-trip**, never normalized. | ledger constraint |
| 8 | **Score Protection.** No event write path can mutate score. | Constitution |

## 2. The envelope

```ts
interface IntelligenceEvent<C extends EventCategory = EventCategory> {
  // ---- identity ----
  clientEventId: string;        // UUID minted on-device at creation; NEVER regenerated
  serverId?: number;            // assigned on first successful ingest
  userId: string;               // Clerk id (intelligence events are user-identified)

  // ---- classification ----
  category: C;
  type: string;                 // category-scoped discriminator
  schemaVersion: number;        // envelope version, for forward compatibility

  // ---- time (three distinct clocks — do not collapse) ----
  occurredAt: string;           // ISO8601 — when it happened, device clock
  recordedAt: string;           // ISO8601 — when it was captured locally
  receivedAt?: string;          // ISO8601 — server ingest, server clock
  dayIndex: number;             // per-source convention (see §4)
  dayIndexBasis: 'local-calendar' | 'utc-floor';   // MUST travel with dayIndex

  // ---- versioning context (§41) ----
  profileVersionId: number | null;   // FK aforce_profile_versions
  baselineVersionId: number | null;  // FK aforce_baseline_versions
  modelVersion: string | null;       // derivation logic version, for derived events

  // ---- provenance (§41) ----
  provenance: {
    source: EventSource;             // where the fact came from
    derivedFrom: string[];           // clientEventIds this was derived from; [] for primary
    sourceRecordRef?: string;        // e.g. intake log id, scan id
  };

  // ---- quality ----
  freshness: FreshnessClass;         // from utils/confidence/dataFreshness
  signalQuality: SignalQualityClass; // from utils/confidence/signalQuality
  confidence: number | null;         // 0..1; null for primary observations

  // ---- governance ----
  privacyClass: 'S0' | 'S1' | 'S2' | 'S3';
  invalidation: {
    status: 'active' | 'invalidated' | 'superseded';
    reason?: InvalidationReason;
    at?: string;
    supersededBy?: string;           // clientEventId
  };

  // ---- sync ----
  sync: {
    state: 'pending' | 'sent' | 'acked' | 'conflict' | 'failed';
    attempts: number;
    lastAttemptAt?: string;
  };

  payload: EventPayload[C];
}
```

## 3. Event categories

| Category | Records | Primary or derived | Privacy |
|---|---|---|---|
| `behavior` | Completed commands, logged intake, timing | Primary | S1 |
| `context` | Environmental pressure, climate, heat, travel, location band | Primary | S1 |
| `physiological` | Wearable/HealthKit signals, sleep, recovery | Primary | S2 |
| `outcome` | Self-reported energy, Confidence After Action, follow-through | Primary | S1 |
| `profile` | Profile/baseline version transitions | Primary | S2 |
| `graph` | Node and relationship creation/update (§38) | **Derived** | S1 |
| `prediction` | Projections issued (§39) | **Derived** | S0 |
| `prediction_outcome` | What actually happened vs. the projection | **Derived** | S1 |
| `pattern` | DNA pattern state transitions (§40) | **Derived** | S1 |
| `model_snapshot` | LPM snapshot generation (§61) | **Derived** | S1 |
| `audit` | Access, export, deletion, invalidation cascade | **Derived** | S0 |

**Primary events are facts. Derived events are conclusions** and always carry `modelVersion` and a
non-empty `derivedFrom`.

## 4. Identifiers and time

### 4.1 Identity

| Field | Rule |
|---|---|
| `clientEventId` | UUIDv4 minted on-device, **frozen forever**. Server unique on `(user_id, client_event_id)` → retries land once. Mirrors the `clientChangeId` contract on `aforceProfileVersions`. |
| `serverId` | Server-assigned; never used for dedupe. |
| Derived-event ids | Deterministic from inputs + `modelVersion`, so re-derivation is idempotent under first-wins merge. |

### 4.2 Three clocks, deliberately separate

`occurredAt` (device, when it happened) · `recordedAt` (device, when captured) ·
`receivedAt` (server, ingest). Offline capture makes these genuinely different; collapsing them
destroys the ability to reconstruct offline sequences.

### 4.3 Day index — the trap

**Conventions differ per source and MUST be preserved round-trip.** Voice check-ins carry the
record's **local-calendar** day index (what streak math compares against); Performance Age
snapshots carry the **UTC floor** (`floor(ms/86400000)`).

Normalizing to one convention silently breaks streaks or snapshot alignment. `dayIndexBasis`
travels with every event so no consumer has to guess.

## 5. Invalidation reasons

| Reason | Trigger |
|---|---|
| `source_deleted` | User deleted the underlying data (`DR-002` cascade) |
| `profile_version_changed` | Major profile change invalidates baseline-relative conclusions |
| `baseline_recalibrated` | New baseline opened |
| `model_version_major` | Derivation logic no longer comparable |
| `contradicted` | Sustained counter-evidence (§40 recalibration) |
| `expired` | Projection past its validity window (§39) |
| `superseded` | Replaced by a better-evidenced record |

**Invariant:** a derived record whose `derivedFrom` set is entirely invalidated **must not remain
`active`**. This is the mechanical form of `DR-002`'s hard rule.

## 6. Freshness and signal quality

Both come from the **existing** `utils/confidence/*` modules — `dataFreshness.ts` and
`signalQuality.ts`. §39's `DR-003` gates ("fresh current-context inputs", "sufficient signal
quality") resolve to these implementations. **No parallel definition is introduced** (A16).

## 7. Sync state

| State | Meaning |
|---|---|
| `pending` | Captured locally, not yet sent |
| `sent` | In flight |
| `acked` | Server confirmed; safe to trim from cache |
| `conflict` | Server holds a divergent record — **server wins** (`DR-002`) |
| `failed` | Retries exhausted; retained, surfaced in Founder Mode |

Sync state is **cache-local metadata** and is not part of the canonical server record.

## 8. Where the contracts live

| Artifact | Location | Notes |
|---|---|---|
| Envelope + category types | `artifacts/aforce-os/types/intelligenceEvents.ts` | Pure types, RN-free |
| Payload types | `types/knowledgeGraph.ts`, `types/prediction.ts`, `types/performanceDna.ts` | Per §38/§39/§40 |
| Shared client/server contract | `lib/api-zod` → generated | Never hand-write clients (A25) |
| Merge semantics | extend `utils/intelligence/commandEvents.ts` | First-wins, already idempotent |
