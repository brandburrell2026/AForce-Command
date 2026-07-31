# Phase 3 — Implementation Design Package: Overview

**Status:** DESIGN ONLY — awaiting approval. **Updated:** 2026-07-22

> **Nothing has been implemented.** No production code, no migrations, no API changes, no schema
> changes, no feature flags, no scoring changes, no navigation changes, no user-facing behavior.
> The only repository changes are documents and governance records.

**Authorized by:** Phase 3 authorization (2026-07-22) · **Governed by:** `DR-002`, `DR-003`,
Founder Decisions 1–5

---

## 1. Package contents

| Output | Document |
|---|---|
| **A** | [Existing Capability Extension Map](PHASE3-A-CAPABILITY-EXTENSION-MAP.md) |
| **B** | [Canonical Event Model & Shared Contracts](PHASE3-B-EVENT-MODEL.md) |
| **C** | [Proposed Persistence Model](PHASE3-C-PERSISTENCE-MODEL.md) |
| **D** | [Service Architecture](PHASE3-D-SERVICE-ARCHITECTURE.md) |
| **E** | [API and Synchronization Design](PHASE3-E-API-SYNC.md) |
| **F** | [Privacy and Data Lifecycle](PHASE3-F-PRIVACY-LIFECYCLE.md) |
| **G** | [Model and Confidence Design](PHASE3-G-MODEL-CONFIDENCE.md) |
| **H** | [Feature-Flag Design](PHASE3-H-FEATURE-FLAGS.md) |
| **I** | [Migration and Rollback Plan](PHASE3-I-MIGRATION-ROLLBACK.md) |
| **J** | [Test and Validation Plan](PHASE3-J-TEST-VALIDATION.md) |
| **K** | [Risks and Decisions Required](PHASE3-K-RISKS-DECISIONS.md) |

## 2. Proposed architecture

```
DEVICE                                          SERVER (PostgreSQL authoritative — DR-002)
──────                                          ─────────────────────────────────────────
behavior · context · outcome
      │
      ▼
commandLedger (extend, one ledger only)
      │
      ▼
intelligenceOutbox ──── POST /intelligence/events ────► intelligenceIngest
 (per-user key, frozen clientEventId)                        │ idempotent
      ▲                                                      ▼
      │                                                 graphBuilder ──► provenance_links
      │                                                      ▼
      │                                                  graphQuery
      │                                    ┌─────────────────┼─────────────────┐
      │                                    ▼                 ▼                 ▼
      │                            predictionEngine    dnaPatterns      lpmSnapshot
      │                                    │                 │                 │
      │                                    └────────┬────────┴─────────────────┘
      │                                             ▼
      │                                      evidenceAdapter
      │                                             ▼
      │                                   §42 LANGUAGE GATE (fail-closed)
      │                                             ▼
      └────── pull: insights + LPM snapshot ────────┘
intelligenceCache  (encrypted · per-user · NEVER authoritative)
```

**Service boundaries:** pure derivation in `utils/intelligence/**` (shared by both sides),
persistence and I/O in `services/**`, canonical derivation in `api-server`. Same pure code both
sides is what makes server-wins conflict resolution non-destructive.

## 3. Proposed schema

**Extend (1):** `aforce_privacy` — intelligence consent/retention columns, no JSONB default.
**Unchanged, referenced by FK:** `aforce_profile_versions`, `aforce_baseline_versions`,
`aforce_profile_change_log` — **these already exist and must not be duplicated.**

**New (11):** `aforce_intelligence_events` · `aforce_graph_nodes` ·
`aforce_graph_relationships` · `aforce_provenance_links` · `aforce_model_versions` ·
`aforce_predictions` · `aforce_prediction_outcomes` · `aforce_dna_patterns` ·
`aforce_dna_pattern_history` · `aforce_lpm_snapshots` · `aforce_intelligence_audit`.

Full detail in Output C. **No `dna_score` column exists anywhere, by construction.**

## 4. Proposed API

New under `/api/aforce/intelligence`: `POST /events` · `GET /insights` · `GET /lpm/snapshot` ·
`GET /predictions` · `GET /patterns` · `POST /patterns/:id/disposition` ·
`GET /provenance/:kind/:id` · `GET /sync/cursor`. Internal: `GET /internal/intelligence/inspect`
(Sandbox only).

Extend: `routes/privacy.ts` (**export + account-wide deletion — neither exists today**),
`routes/profile.ts` (emit invalidation-trigger events).

## 5. Proposed feature flags — all default `false`

Backend: `spec_knowledgeGraph` · `spec_intelligenceSync` · `spec_predictionEngine` ·
`spec_performanceDna` · `spec_intelligenceProvenance`.

DNA surfaces in `DR-003` order: `spec_dnaFounderInspector` → `spec_dnaWeeklyReport` →
`spec_dnaBodyManual` → `spec_dnaCoachExplanations` → `spec_dnaHomeInsightCard`.

Other surfaces: `spec_predictionSurface` (requires §42 accepted) · `spec_lpmBodyManual` ·
`spec_lpmConfidenceJourney` · `spec_intelligenceExport`.

**No onboarding flag exists** — DNA must never appear there.

## 6. Migration and rollback

I-0 → I-11, additive only, each independently deployable and reversible. **I-4 is the only step
touching an existing table**, and it is column-additive. No data migration required — the graph is
derived forward from events.

**Governing rule:** the intelligence layer is **never load-bearing**. HydroState, logging, commands,
and scoring must work identically if every table in this package is absent. No rollback path
deletes user data.

## 7. Testing

Eleven suites (Output J). Blocking gates: **Score Protection** (blocks everything) ·
**deletion propagation** (blocks persistence beyond Founder Mode) · **§42 copy tests** (block all
§39/§40 user-facing output) · sync (blocks multi-device) · backtesting/calibration (blocks
threshold finalization) · load (blocks GA).

## 8. Privacy-impact summary

No new raw collection. Derived S1/S2 data moves server-side — a real increase in exposure (R-17),
offset by verifiable deletion, mandatory provenance, and bounded retention, none of which the
device-only alternative could offer.

**Net posture improves — conditional on K-1 (encrypted cache) being resolved before any
intelligence data is cached.** If K-1 is unresolved, the device is the weakest link and the
assessment does not hold.

## 9. Estimated implementation sequence

| Stage | Scope | Depends on |
|---|---|---|
| **1** | I-0…I-3 schema (audit, model versions, events, provenance, graph) | **K-2** (retention class column) |
| **2** | Ingest endpoint + graph builder, flags off | Stage 1 |
| **3** | §42 gate + mechanical copy tests | — (parallel) · **founder sign-off** |
| **4** | Encrypted cache + outbox + sync | **K-1** |
| **5** | §39 prediction, headless | Stages 2–3 |
| **6** | §40 DNA, headless | Stages 2–3 |
| **7** | §61 expansion reading §38 | Stage 2 |
| **8** | Founder Mode inspector (DNA exposure step 1) | Stages 5–6 |
| **9** | Surfaces, one flag at a time, `DR-003` order | per-surface approval |

Stages 1–2 are the natural first increment: additive, no existing table touched until I-4, and
useful headless.

## 10. Unresolved decisions

**Blocking:** **K-1** encrypted cache strategy · **K-2** retention windows per class.
**Non-blocking:** K-3 deletion scope · K-4 back-derivation · K-5 Founder Mode vs §42 ·
K-6 prediction types · K-7 derivation cost model.

Full detail and options in Output K.

## 11. Recommendation on Phase 4

**Recommendation: authorize Phase 4 partially — Stages 1–3 only — and only after K-1 and K-2 are
ruled.**

Reasoning:

- The design is structurally sound and bounded by the right invariants. The architecture is
  additive and cannot destabilize existing systems.
- **K-2 blocks Stage 1** because `retention_class` is a column on the events table; guessing it
  means a migration to correct it later.
- **K-1 blocks Stage 4** and must not be worked around — caching intelligence data in plaintext
  would contradict `DR-002` directly.
- **Stage 3 (§42 gate) should run in parallel and early.** It gates the two highest-risk systems,
  and building it first means §39 and §40 are never *able* to emit ungated copy.
- Deferring Stages 5–9 keeps the highest-compliance-risk work behind both the §42 gate and
  backtesting evidence, rather than committing to thresholds that are explicitly beta defaults.

A full Phase 4 authorization now would put Stage 4 in front of an unresolved K-1, and Stage 1 in
front of an unresolved K-2. Partial authorization avoids both without slowing the useful work.
