# DR-002 — Intelligence Persistence Topology

- **Status:** ACCEPTED — settled. Documents a ruling the founder has made. Closes **D-02**.
- **Date:** 2026-07-22
- **Owner / decider:** Brandon (founder)
- **Governs:** §38 Performance Knowledge Graph™, §39 Prediction Engine™, §40 Performance DNA™,
  §41 Provenance/Retention/Model Versioning, §61 Living Performance Model™ expansion
- **Related:** `governance/DATA-CLASSIFICATION-MATRIX.md`, `governance/OPEN-RISKS.md` R-04,
  Constitution Principle 7, `docs/COMPLIANCE_FRAMEWORK.md` §5–§9

---

## Decision

**Server-synced architecture with a limited encrypted local cache. PostgreSQL remains the
authoritative persistence layer** for all approved intelligence systems.

### The server is authoritative for

canonical intelligence events · graph nodes · graph relationships · provenance ·
observation counts · confidence history · profile versions · baseline versions · model versions ·
invalidation and supersession status · prediction records · prediction outcomes ·
Performance DNA pattern history · audit records

### The mobile cache — limited, encrypted, non-authoritative

Permitted contents only:

- offline continuity
- pending event synchronization
- recent HydroState context
- recent commands
- selected graph-derived insights
- the current approved Living Performance Model snapshot

**The mobile cache is not the authoritative intelligence record.** On conflict, the server wins.
The cache is a read-through convenience plus a write-ahead queue — never a source of truth.

## Retention

**No unrestricted permanent retention.** Phase 3 must propose explicit **retention, minimization,
export, deletion and invalidation rules by data class**.

## Required deletion behavior

Deletion is a **propagation**, not a row removal:

```
source data deletion
  → dependent evidence invalidation
  → graph relationship recalculation or invalidation
  → Living Performance Model recalculation
  → Prediction Engine review
  → Performance DNA pattern review
  → user-facing outputs updated where required
```

**A derived relationship may not remain active when all supporting evidence has been deleted or
invalidated.** This is the hard invariant of the whole layer.

## Consequences (recorded, to be designed in Phase 3)

1. **Encryption is a new requirement.** Every existing client store (`commandLedger`,
   `hydroScanHistory`, `intakeOutbox`, …) uses **plaintext AsyncStorage**. `expo-secure-store` is
   already a dependency but is keychain-backed and unsuitable for bulk payloads. An encrypted
   bulk-cache strategy must be designed.
2. **Per-user cache keying is mandatory.** The intake-outbox ruling — scope durable local stores
   under a per-user key rather than clearing on sign-out — applies to every new cache, or a user
   switch replays or reads another person's intelligence.
3. **A sync and conflict surface now exists** where none did before. Idempotency, retry, and
   degraded behavior must be designed (Phase 3 output E).
4. **Privacy posture changes.** Derived S1/S2 data now lives server-side: encryption at rest,
   retention limits, and a deletion cascade that also reaches the device cache.
5. **No account-wide deletion endpoint exists today.** Only `POST /analytics/forget`
   (pseudonymous analytics). The propagation above requires a new, broader path.

## Revisit criteria

Reversible only by a superseding decision record from Brandon. A change to server-authoritative
status would invalidate the Phase 3 persistence and sync design in full.
