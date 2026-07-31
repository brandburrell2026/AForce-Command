# Model Version Registry

**Status:** Canonical (structure established; no entries yet) · **Updated:** 2026-07-22 (Phase 2)
**Mandated by:** §41 — Intelligence Provenance, Retention and Model Versioning

Every intelligence system that derives a claim must stamp its outputs with a model version.
Without this, a pattern surfaced today cannot be explained after the derivation logic changes —
which would break Constitution Principle 3 retroactively.

**No derivation logic exists yet.** Phase 4 Stage 1 implemented the *contracts* that carry model
versions (`ModelVersionRef`, `VersionContext.modelVersion`), but no system derives anything yet, so
no version has been minted. The first entries are created when Stage 2 graph construction lands.

---

## 1. What a model version covers

A version identifies **the derivation logic**, not the data. Bump it whenever:

- the rule that creates a node or edge changes;
- a confidence formula changes;
- a threshold in `config/hydroStateModel.ts` that materially changes output changes;
- a pattern-state transition rule changes;
- banned-term or language-gate logic changes.

Do **not** bump for: refactors with identical output, copy edits that pass §42 unchanged,
or test-only changes.

## 2. Version format

`<system>-v<major>.<minor>`

- **major** — output is not comparable to the prior version. Existing derived records must be
  re-derived or retired; they may not be silently reinterpreted.
- **minor** — output remains comparable; refinement only.

## 3. Registry

| System | Version | Date | Change | Comparable to prior? | Migration |
|---|---|---|---|---|---|
| **HydroState™ scoring model** | **`hydrostate-v0`** | **2026-07-22** | **First identified version (D-08 / `DR-009`, founder Decision 2 Option C).** Status: **PRE-GOVERNANCE IDENTIFIED MODEL** — the known current scoring logic, formally identified *after the fact* but *before* the first governed v1.0 release. **NOT scientifically validated. NOT clinically validated.** Source: `artifacts/aforce-os/config/hydroStateModel.ts` → `HYDROSTATE_MODEL_VERSION` (single authoritative runtime source). | n/a — first identified | None. Historical rows stay **null** = "not recorded"; **never backfilled**. |
| *(contract only)* | — | 2026-07-22 | **Stage 1** — `ModelVersion` / `ModelVersionRef` / `VersionContext` types landed. Every derived record must carry a version; enforced by `hasValidProvenance`. No version minted. | n/a | n/a |
| **§38 Performance Knowledge Graph™** | **`graph-v1.0`** | **2026-07-22** | **Stage 2 — first minted version.** Deterministic node/edge construction; `evidence_count_v1` assessment (conservative counting, `score` always null — no approved weighting exists). Edge ids embed the model version, so a major bump yields new rows and cannot silently rewrite prior history. | n/a — first version | n/a |
| **§42 Language & Claims Gate** | **`p42-v1.0`** (policy) · **`l42-v1.0`** (locale) | **2026-07-22** | **Stage 3 — first minted policy versions.** Both are recorded in every gate decision so an evaluation is reproducible. Locale policy validates **English only**. | n/a — first version | n/a |
| §39 Prediction Engine™ | — | — | *not yet implemented* | — | — |
| §40 Performance DNA™ | — | — | *not yet implemented* | — | — |
| §61 Living Performance Model™ | — | — | *shipped pre-registry; version assigned at first change* | — | — |

### 3.1 HydroState increment rules (D-08)

| Level | Definition |
|---|---|
| **Major** | A governed change to the scoring model or interpretation that creates a **materially different scoring contract**. Historical scores are **not comparable**. |
| **Minor** | A governed **output-changing** adjustment that preserves the same overall scoring contract. |
| **No increment** | Documentation, formatting, refactoring, or bug fixes **proven not to alter HydroState output for identical inputs**. |

**Any output-changing bug fix requires an increment.** The governing test: *increment whenever an
approved change can alter HydroState output for identical inputs.*

**Approvers:** Founder + Engineering always. **Scientific additionally** when the change involves
physiological assumptions · signal weighting · readiness, baseline, or recovery interpretation ·
scientific thresholds · score-band meaning · or anything that could materially alter health- or
performance-related claims.

**Next version:** `hydrostate-v1.0` — the first *governed* scoring release, only after
engineering, scientific, governance and founder approvals.

## 4. Rules

1. **Every derived record stores the model version that produced it.** A record without a version
   is not trustworthy and must be retired, not reinterpreted.
2. **A major bump requires a migration decision** — re-derive, or retire. Recorded in
   `INTELLIGENCE-MIGRATION-PLAN.md`.
3. **Never reinterpret old records under new logic.** A pattern derived under v1.0 is a v1.0
   pattern permanently.
4. **User-visible consequence must be stated.** If a major bump retires patterns a user has seen,
   that is a surface change requiring founder approval — a pattern silently vanishing is a trust
   breach under Principle 10.
5. **Model version is part of provenance.** §41 provenance records include it, so any claim
   resolves to both its source events *and* the logic that read them.
