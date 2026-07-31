# AForce OS — Master Specification

**Status:** Canonical (tier 4) · **Version:** 2.0 · **Updated:** 2026-07-22
**Authority:** `governance/SPECIFICATION-AUTHORITY.md` · **Supersedes** the tier-5 legacy set
where they conflict.

The entry point to the AForce OS specification system. This document defines the structure and
routes to the canonical specification for each part. It does not restate them.

---

## 1. What AForce OS is

**AForce OS is the complete operating system** — a real-time human performance operating system
delivered as a React Native / Expo application over a Node/Postgres backend.

Beneath it sits **AForce Intelligence™**, the coordinated intelligence architecture. At the
centre of that architecture sits **HydroState™**, the foundational state engine and the single
hero metric. Every other system operates around and through HydroState™.

```
  AForce OS                    the operating system — what the user installs
    └── AForce Intelligence™   the coordinated intelligence architecture
          └── HydroState™      the foundational state engine · single hero metric
                └── everything else operates around and through it
```

**AForce Intelligence™ has four functional layers** (canonical:
`docs/AFORCE-INTELLIGENCE-ARCHITECTURE.md` §2):

**Eighteen members.**

| Layer | Members |
|---|---|
| **Core Intelligence** | HydroState™ · Evidence Engine™ · Command Confidence™ · Performance Memory™ · Adaptive Response Engine™ · Living Performance Model™ |
| **Learning Intelligence** | Performance Knowledge Graph™ · Prediction Engine™ · Performance DNA™ |
| **Interaction Intelligence** | AI Coach · HydroScan™ · Explainability · Response Timeline |
| **Context Intelligence** | Climate Profile™ · Environmental Pressure™ · Tomorrow Load Forecast™ · Recovery Window™ · Performance Drift™ |

Context feeds Core. Core feeds Learning. Learning returns through Core. Interaction surfaces the
result — after the §42 gate. Context never commands or scores. Only Core holds the hero metric,
and only HydroState™ is it.

## 2. Specification map

### Part I — Governance (authority over everything below)

| Document | Covers |
|---|---|
| `governance/AForce-Constitution.md` | Locked principles. Tier 0. |
| `governance/SPECIFICATION-AUTHORITY.md` | Which document wins in a conflict |
| `governance/Claude-Code-Build-Rules.md` | The build contract |
| `governance/Architecture-Appendix.md` | Every section with a Status tag |
| `governance/decisions/` | Settled founder rulings |
| `governance/proposals/` | Proposals awaiting ruling |

### Part II — HydroState™ (the centerpiece)

| Document | Covers |
|---|---|
| **`docs/HYDROSTATE-SPEC.md`** | The foundational state engine — inputs, bands, protection rules |
| `docs/HYDROSTATE-WHITE-PAPER.md` | Why HydroState exists and why it is the only hero metric |

### Part III — AForce Intelligence™

| Document | Covers |
|---|---|
| **`docs/AFORCE-INTELLIGENCE-ARCHITECTURE.md`** | The umbrella architecture and coordination rules |
| `docs/PERFORMANCE-KNOWLEDGE-GRAPH-SPEC.md` | §38 — the substrate |
| `docs/PREDICTION-ENGINE-SPEC.md` | §39 — observation extended forward |
| `docs/PERFORMANCE-DNA-SPEC.md` | §40 — durable qualitative patterns |
| `docs/LIVING-PERFORMANCE-MODEL-SPEC.md` | §61 — what the body taught us |
| `governance/INTELLIGENCE-DEPENDENCY-MAP.md` | What reads what, and what may never be bypassed |

### Part IV — Product, commerce, engineering

| Document | Covers |
|---|---|
| `docs/PRODUCT-EXPERIENCE-SPEC.md` | Surfaces, navigation, the command experience |
| `docs/COMMERCE-AND-ENTERPRISE-SPEC.md` | Tiers, store, team and enterprise |
| `docs/ENGINEERING-ARCHITECTURE.md` | Stack, module layout, build and release |

### Part V — Trust

| Document | Covers |
|---|---|
| `docs/PRIVACY-COMPLIANCE-VALIDATION.md` | Privacy, compliance and validation posture |
| `docs/COMPLIANCE_FRAMEWORK.md` | The governing compliance framework |
| `governance/CLAIMS-REGISTER.md` | Approved phrasing for every user-facing claim |
| `governance/DATA-CLASSIFICATION-MATRIX.md` | Every data class and its handling |

### Registers

`TERMINOLOGY-REGISTRY` · `FEATURE-PHASE-MATRIX` · `SPECIFICATION-RECONCILIATION-REGISTER` ·
`MODEL-VERSION-REGISTRY` · `INTELLIGENCE-VALIDATION-MATRIX` · `INTELLIGENCE-MIGRATION-PLAN` ·
`OPEN-RISKS` · `DECISION-REQUIRED` — all under `governance/`.

## 3. The locks (canonical statement)

Stated once here. Other documents reference; they do not restate.

| Lock | Rule |
|---|---|
| **Water-First** | Recommendation order is Water → Command → Optional support → Score Update. Products never precede water. |
| **Score Protection** | Only completed behavior modifies score. Recommendations, scans, and product selection never increase score. |
| **Body first, product last** | HydroState determines need; Evidence Engine explains; only then is a product recommended. When no product is needed, the OS says so. |
| **One hero metric** | HydroState™. No competing hero metric, ever. |
| **Observation, never diagnosis** | The OS notices patterns; it never claims medical authority. |
| **Build once, reveal over time** | Architecture complete; surfaces phased behind flags. Built ≠ exposed. |
| **Language lock** | Launch: English, Spanish, French, German, Portuguese, Italian. Additional locales resource-only behind flags. |
| **Navigation lock** | 5 visible tabs. No new tabs, no navigation redesign. |
| **Evidence Engine is mandatory** | No claim reaches a user without an explanation route. |
| **Config discipline** | Every threshold in `config/hydroStateModel.ts`. Never hardcoded. |

## 4. Section index

| Range | Subject | Canonical location |
|---|---|---|
| §1–17 | HydroState™ | `HYDROSTATE-SPEC.md` |
| §18–27 | Adaptive Profile & HydroState Intelligence | `AFORCE_OS_ARCHITECTURE_V1.md` (tier 5) |
| §28–37 | HydroScan™ | `AFORCE_OS_ARCHITECTURE_V1.md`, amended by DR-001 |
| **§38** | **Performance Knowledge Graph™** | `PERFORMANCE-KNOWLEDGE-GRAPH-SPEC.md` |
| **§39** | **Prediction Engine™** | `PREDICTION-ENGINE-SPEC.md` |
| **§40** | **Performance DNA™** | `PERFORMANCE-DNA-SPEC.md` |
| **§41** | **Intelligence Provenance, Retention & Model Versioning** | `AFORCE-INTELLIGENCE-ARCHITECTURE.md` §6 |
| **§42** | **Intelligence Language & Compliance Gate** | `AFORCE-INTELLIGENCE-ARCHITECTURE.md` §7 |
| §43–46 | Reserved | — |
| §47–52 | Engagement, sharing, transparency | `AFORCE_OS_ARCHITECTURE_V1.md` |
| §53–57 | V1 refinements | `AFORCE_OS_ARCHITECTURE_V1.md` |
| §58 | Command Confidence Display | `Architecture-Appendix.md` |
| §59 | Adaptive Response Engine™ | `Architecture-Appendix.md` |
| §60 | Response Timeline | `Architecture-Appendix.md` |
| §61 | Living Performance Model™ | `LIVING-PERFORMANCE-MODEL-SPEC.md` |
| §62 | Founder Mode | `governance/Section-62-Founder-Mode-Spec.md` |
| §63 | Compliance pass | `governance/Section-63-Compliance-Pass.md` |
| §64 | Conversational Intelligence Architecture™ | `Architecture-Appendix.md` |

**Mantra:** Pause → Hydrate → Lock In → Perform. **Performance Is Non-Negotiable.**
