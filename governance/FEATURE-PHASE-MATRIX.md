# Feature Phase Matrix

**Status:** Canonical · **Updated:** 2026-07-22 (Phase 2)

Single view of what is built, what is exposed, and when. Supersedes ad-hoc phase statements in
tier-5 legacy documents. Groups follow `Phase-Roadmap.md`.

**Status vocabulary:** Build Now · Architecture Only · Phase 2 · Phase 3 · Phase 4 · Reserved

> **Built ≠ exposed.** Constitution Principles 8 and 9: architecture is built complete; surfaces
> release in phases behind flags. Founder Decision 1 restates this for the new systems: they must
> not "be exposed publicly merely because their backend exists."

---

## 1. Core state and intelligence

| § | System | Build status | Exposure phase | Flag |
|---|---|---|---|---|
| 1–17 | HydroState™ (core) | Build Now | Phase 1 | — |
| 1–17 | HydroState™ Visual Intelligence | Architecture Only | Phase 2 (after device/lighting validation) | `hydrostate_visual_enabled` |
| 18–20 | Adaptive Performance Profile™ / Body Recalibration | Build Now | Phase 1 | — |
| 21 | Sleep Readiness Intelligence™ | Build Now (architecture) | Phase 2 | — |
| 22 | Tomorrow Load Forecast™ | Build Now (architecture) | Phase 2 | — |
| 23–27 | Resilience, Oral Signal, Visual Intelligence, Adaptive Learning, Drift | Build Now (architecture) | Phase 2 | — |
| 28–37 | HydroScan™ | Build Now (base scan) | Phase 1 base / Phase 2 full | `spec_hydroScan` |
| — | Evidence Engine™ | Build Now | Phase 1 | — |
| 58 | Command Confidence™ Display | Build Now (UI only) | Phase 1 | `spec_commandConfidenceDisplay` |
| 59 | Adaptive Response Engine™ | Build Now | Phase 1 | — |
| 60 | Response Timeline | Architecture Only | Phase 2 (gated on 60–90 days data) | off by default |
| 61 | Living Performance Model™ — daily lesson | Build Now | Phase 1 | — |
| 64 | Conversational Intelligence Architecture™ | Build Now | Phase 1 onward | — |

## 2. Newly authorized intelligence systems (Founder Decisions 1 & 5)

All headless at authorization. **No public surface in Phase 1.** Flags proposed in Phase 3
design; none exist yet — Phase 2 created no flags.

## Canonical capability status labels

Every capability below uses **exactly one** primary status (never combined, e.g. never
"Built/Live"):

| Label | Meaning |
|---|---|
| **Proposed** | Concept exists but is not yet in the canonical approved specification |
| **Specified** | Canonical requirements and architecture exist; implementation incomplete |
| **Partially Built** | Some implementation exists; approved end-to-end capability incomplete |
| **Built-Hidden** | A **functioning end-to-end capability** exists and is **intentionally withheld** via flag / internal route / audience control / configuration. **Not** satisfied by code with no runtime caller, an undeployed schema, or a foundation with no executable workflow — those are *Partially Built*. |
| **Internal Preview** | Available to approved founders, employees, testers or Sandbox users — not the public |
| **Live** | Available in production to its intended public or enterprise users |
| **Validated** | Live/deployed **and** has completed applicable product, engineering, privacy, compliance, scientific and performance validation |
| **Blocked** | Progress or release prevented by a recorded dependency, defect, decision, approval or risk |

**Phase 4 progress (limited authorization: Stages 1–3 only):**

> **Canonical register:** [`CAPABILITY-STATUS-REGISTER.md`](CAPABILITY-STATUS-REGISTER.md) is
> authoritative for capability status. This table mirrors it.

| Stage | Scope | Status | Evidence |
|---|---|---|---|
| **1** | Shared intelligence data contracts | **Partially Built** | `types/intelligenceEvents.ts`, `utils/intelligence/intelligenceEventContracts.ts`, `config/hydroStateModel.ts` (retention). No schema, no flag, **no runtime caller**. 34 tests passing. Not user-visible. |
| **2** | §38 Knowledge Graph foundation | **Partially Built** *(corrected 2026-07-22 — was Built-Hidden)* | `types/knowledgeGraph.ts`, 4 modules, 2 tables **defined but `drizzle-kit push` NOT executed**. 54 tests passing. **Schema not deployed; no executable end-to-end graph workflow in the target environment.** |
| **3** | §42 Language & Claims Gate | **Partially Built** *(corrected 2026-07-22 — was Built-Hidden)* | `types/claimGate.ts`, 4 modules. 62 tests passing. English-only validated. **No approved internal caller; no executable end-to-end claim path.** |
| 4–9 | Everything else | **Blocked** — not authorized | — |

**Founder approval log:** Stage 1 approved 2026-07-22 · Stage 2 approved 2026-07-22 ·
**Stage 3 approved 2026-07-22.** The Phase 4 authorization covered **Stages 1–3 only**; no
subsequent stage is authorized, and none has been started.

**Prerequisites recorded before any further stage:**

| # | Item | Tracking |
|---|---|---|
| 1 | Stage 2 schema exists only as a typechecked definition — `drizzle-kit push` never executed (no `DATABASE_URL` on the build machine). Tables exist in no database. | `OPEN-RISKS.md` **R-21** |
| 2 | §42 validates **English only**; five launch locales suppress intelligence claims. Affects any §39/§40 surface scope. | `LOCALE-POLICY-REGISTRY.md` · **R-24** |
| 3 | No Stage 1–3 artifact has legal, scientific, privacy, or partner review recorded — all **"Not yet reviewed"**. | Truth rules §5 · Register §12 |

> **Status honesty note (truth rules §2, corrected 2026-07-22).** Stages 1–3 are **not** "Live",
> "Shipped", "Validated", or **"Built-Hidden"**. All three are **Partially Built**: passing unit
> tests over foundations with **no runtime consumer, no deployed schema, no executable end-to-end
> workflow, no feature flag, no route, and no user visibility**.
>
> A passing unit test is not workflow validation. A defined schema is not a deployed one. Code
> with no caller is not a withheld capability — **Built-Hidden requires a functioning end-to-end
> capability that is intentionally withheld**, which none of these is.

| § | System | Build status | Exposure phase | Gate to proceed |
|---|---|---|---|---|
| — | **Shared intelligence contracts (Stage 1)** | ✅ **Built** — headless, no surface | n/a — contracts only | — |
| 38 | Performance Knowledge Graph™ | Build Now (architecture, headless) | Phase 2 for any surface | Score-Protection + provenance tests green |
| 39 | Prediction Engine™ | **Architecture Only** | Phase 2 earliest | **§42 gate must clear first** |
| 40 | Performance DNA™ | **Architecture Only** | Phase 2+ | Principle 2 review (patterns, never a score) |
| 41 | Intelligence Provenance, Retention & Model Versioning | Build Now (with §38) | n/a — cross-cutting | ships with §38 |
| 42 | Intelligence Language & Compliance Gate | Build Now (required revision) | n/a — gate | **blocks §39 and §40 user-facing output** |
| 43 | AForce Moments — preparation layer (Moments, prep windows, ritual delivery) | Phases 1–2 + 3a Built; Phase 3b calendar core Built DARK (`moments_calendar_enabled` OFF in prod, DR-011) | Phase 2 (flag-gated) | DR-010 fully ratified. Calendar ACTIVATION blocked pending Legal+Privacy (PR-002 Appendix A); Julius pending on 5.3; 5.6 open. |
| 44–46 | Reserved | Reserved | — | decision record required to allocate |
| 61 | LPM — Your Body's Manual (reads §38) | Architecture Only | Phase 2 | §38 complete |
| 61 | LPM — Confidence Journey | Architecture Only | Phase 2 | §41 complete |
| 61 | LPM — Legacy summary | Architecture Only | Phase 4 | language review |

## 3. Operating modes and engagement

| § | System | Build status | Exposure phase |
|---|---|---|---|
| — | Guardian™ | Architecture Only | Phase 3 |
| — | Cruise Mode™ (revised streak mechanic per §63) | Build Now | Phase 3 full |
| — | Clutch™ | Architecture Only | Phase 3 |
| — | AutoPilot™ | Architecture Only | Phase 3 |
| — | Global Adaptation Engine™ | Build Now | Phase 1 |
| 47–52 | Sharing, Referral, Year in Performance, Status, Privacy Center, Explainability Center | Architecture Only | Phase 2 |
| 53–57 | V1 refinements | Build Now | Phase 1 |
| 62 | Founder Mode | Build Now | **Internal only — never Production** |
| 63 | Compliance pass | Build Now | Phase 1 |

## 4. Tiers and hardware

| Item | Phase | Note |
|---|---|---|
| Founding 250 (free) | Phase 1 | — |
| Subscription tiers | Phase 2 | — |
| **Meridian™ premium tier** | **Phase 3** | Commercial tier only. Owns no architecture (Founder Decision 2). |
| Phantom Band™ Core | Phase 3 | Hardware |
| Phantom Meridian (ceramic edition) | 2027 target | Hardware SKU, distinct from the software tier |
| Enterprise | Phase 3 | — |

## 5. Phase-gate rule

A system moves from Architecture Only to an exposure phase only when **all** hold:

1. Its section's gate in §2 above has cleared.
2. Its claims appear in `CLAIMS-REGISTER.md` with approved phrasing.
3. Its data classes appear in `DATA-CLASSIFICATION-MATRIX.md`.
4. Its validation row in `INTELLIGENCE-VALIDATION-MATRIX.md` is green.
5. Founder approval for that specific surface.
