# Capability Status Register

**Status:** Canonical · **Established:** 2026-07-22 · **Owner:** Brandon (founder)
**Governed by:** assignment-wide truth/status rules §4

The single register of canonical capability status. Every major capability carries **exactly one**
primary status — never a combined label such as "Built/Live".

---

## 1. Canonical status labels

| Label | Meaning |
|---|---|
| **Proposed** | Concept exists but is not yet part of the canonical approved specification. |
| **Specified** | Canonical requirements and architecture exist, but implementation is not complete. |
| **Partially Built** | Some supporting implementation exists, but the approved **end-to-end capability is incomplete**. |
| **Built-Hidden** | A **functioning end-to-end capability** exists and is **intentionally unavailable** to normal users through a feature flag, internal route, audience control or configuration. |
| **Internal Preview** | Available to approved founders, employees, testers or Sandbox users, but not to the general public. |
| **Live** | Available in the approved production environment to its intended public or enterprise users. |
| **Validated** | Live or otherwise deployed to its intended environment **and** has completed the applicable product, engineering, privacy, compliance, scientific and performance validation. |
| **Blocked** | Progress or release is prevented by a recorded dependency, defect, decision, approval or risk. |

### 1.1 Built-Hidden — clarified definition (founder correction, 2026-07-22)

**Built-Hidden requires a functioning end-to-end capability that is intentionally withheld.**

It is **not** satisfied by:

- code that typechecks and passes unit tests but has **no runtime caller**;
- a schema that is **defined but not deployed** to the target environment;
- a module with **no executable end-to-end workflow** in the target environment;
- a foundation whose consumers do not yet exist.

Those conditions are **Partially Built**. The distinction is deliberate: "hidden" implies the
capability *works* and is being *withheld*, which is a materially different claim from "the
foundation exists."

Optional secondary metadata: environment · feature flag · audience · validation state · blocker ·
target phase.

## 2. Current status — AForce Intelligence™ (Phase 4 Stages 1–3)

| Capability | **Status** | Environment | Flag | Audience | Blocker | Evidence |
|---|---|---|---|---|---|---|
| **Stage 1 — Shared intelligence data contracts** | **Partially Built** | local repo only | none | none | no runtime consumer | `types/intelligenceEvents.ts`, `utils/intelligence/intelligenceEventContracts.ts`, retention config. 34 tests passing. No schema, no caller, no user visibility. |
| **Stage 2 — §38 Performance Knowledge Graph™ foundation** | **Partially Built** | **schema deployed to prod (founder-attested 2026-07-31)** | none | none | **R-21 closed on founder attestation**; still no end-to-end workflow / no ingestion path | `types/knowledgeGraph.ts`, 4 modules under `utils/intelligence/knowledgeGraph/`, 2 tables in `lib/db/src/schema/aforce.ts` — **deployed to production per founder attestation 2026-07-31** (`\d`/`\di` console verification not independently captured in-repo). 54 tests passing. No runtime caller / ingestion path yet — deployed schema ≠ working capability. |
| **Stage 3 — §42 Intelligence Language & Claims Gate** | **Partially Built** | local repo only | none | none | **no approved internal caller**; no executable claim path | `types/claimGate.ts`, 4 modules under `utils/intelligence/languageGate/`. 62 tests passing. Nothing consumes the gate; English-only validated. |
| §39 Prediction Engine™ | **Specified** | — | — | — | **implementation gated — `DR-007` + `DR-008`** (legal review · scientific review of DR-003/N-1/N-2 · schema deploy · **approved success contract per type**) | `docs/PREDICTION-ENGINE-SPEC.md` · `docs/design/SECTION-39-PREDICTION-ENGINE-DESIGN.md`. **Design approved 2026-07-22 (`DR-007` §A–§G); no code written.** Scope: **3 states only** (`calibrated_personal` NOT authorized); **3 candidate prediction types**, none activated. Confidence thresholds **UNSET, fail-closed**. **No prediction type has an approved success contract (`DR-008`); none may activate.** Does not advance to Partially Built until implementation begins. |
| §40 Performance DNA™ | **Specified** | — | — | — | not authorized | `docs/PERFORMANCE-DNA-SPEC.md` |
| §61 Living Performance Model™ — daily lesson | **Live** | production | none | public | — | `utils/intelligence/livingPerformanceModel.ts`, shipped pre-Phase-4, tested |
| §61 — Your Body's Manual · Confidence Journey · Legacy | **Specified** | — | — | — | Phase 2 / Phase 4 | `docs/LIVING-PERFORMANCE-MODEL-SPEC.md` |
| §41 Provenance & Model Versioning | **Partially Built** | local repo only | none | none | ships with §38 | contract types only; no persistence |

## 2.1 Phase 3.7 readiness (2026-07-22)

**No status changed.** §39 remains **Specified**; Stage 2 remains **Partially Built** (schema
still deployed nowhere). Phase 3.7 produced review packages, a runbook, and an authorization
request — **no capability advanced**.

| Item | Outcome |
|---|---|
| D-08 HydroState model version | ✅ **APPROVED and IMPLEMENTED IN SOURCE 2026-07-22** (`DR-009` + D-09). Constant `hydrostate-v0` · nullable column · central `scoreSnapshotRepo.ts` · 23 tests. **N/A migration** (repo uses schema push). ❌ **NOT deployed** to dev/staging/production. |
| Stage 2 + D-08 schema deployment | **Stage 2 graph schema: PRODUCTION deploy founder-attested 2026-07-31** (R-21 closed on attestation; console verification not captured in-repo — see runbook §11). The 2026-07-22 attempts were blocked (no `DATABASE_URL`). **D-08 `hydrostate_model_version` column: deploy NOT separately attested — confirm before relying on it.** |
| Scientific / Legal review | Packages prepared; **neither reviewed** |
| Prediction types | **0 of 3** have an approved success contract |

## 3. Correction log

| Date | Capability | From | To | Reason |
|---|---|---|---|---|
| 2026-07-22 | Stage 1 | Partially Built | **Partially Built** *(unchanged)* | Already correct. |
| 2026-07-22 | Stage 2 | ~~Built-Hidden~~ | **Partially Built** | **Founder correction.** Schema is not deployed and **no executable end-to-end graph workflow exists in the target environment**. Built-Hidden requires a functioning end-to-end capability. |
| 2026-07-22 | Stage 3 | ~~Built-Hidden~~ | **Partially Built** | **Founder correction.** **No approved internal caller or executable end-to-end claim path** currently consumes the gate. |

## 4. Evidence requirement

No capability may be labeled Built-Hidden, Internal Preview, Live, or Validated without
identifying: supporting code files · data model or schema **and its deployment state** ·
runtime configuration · feature flag and current default · tests and current results ·
integration status · current user or internal visibility · known limitations · dependencies ·
validation or approval owner.

**Documentation is not evidence of implementation. A passing unit test is not evidence of a
validated workflow. A hidden backend is not evidence of a live capability.**

## 5. External-readiness

**No Stage 1–3 artifact has any legal, scientific, privacy, partner, or engineering review
recorded.** All are **"Not yet reviewed"** — never inferred as approval.
