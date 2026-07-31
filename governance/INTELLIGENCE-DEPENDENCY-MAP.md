# Intelligence Dependency Map

> ## ⚠️ SUPERSEDED IN PART — Phase 3.5 freeze (2026-07-22)
>
> This document is retained for history. Two documents are now canonical:
>
> - **[`INTELLIGENCE-DATA-FLOW-CONTRACTS.md`](INTELLIGENCE-DATA-FLOW-CONTRACTS.md)** — the
>   canonical pipeline, feedback loop, allowed side paths, and prohibited bypasses.
> - **[`INTELLIGENCE-DEPENDENCY-MATRIX.md`](INTELLIGENCE-DEPENDENCY-MATRIX.md)** — permitted and
>   prohibited dependencies, current violations, cycles, and enforcement requirements.
>
> Where this document differs from either, **those control**.


**Status:** Canonical · **Updated:** 2026-07-22 (Phase 2)

What reads what, in what order, and what may never be bypassed. Supersedes the Master
Architecture Engine Flow in `docs/AFORCE_OS_ARCHITECTURE_V1.md` where they differ
(`SPECIFICATION-AUTHORITY.md` tier 3 over tier 5).

---

## 0. The four layers

AForce Intelligence™ is organized by function into four layers (founder-defined 2026-07-22).
Canonical detail: `docs/AFORCE-INTELLIGENCE-ARCHITECTURE.md` §2.

| Layer | Members | Flow role |
|---|---|---|
| **Context Intelligence** | Climate Profile™ · Environmental Pressure™ · Tomorrow Load Forecast™ · Recovery Window™ · **Performance Drift™** | Feeds Core — the world the body is in, and how the state is evolving |
| **Core Intelligence** | HydroState™ · Evidence Engine™ · Command Confidence™ · Performance Memory™ · Adaptive Response Engine™ · Living Performance Model™ | Establishes state, explains, decides, remembers |
| **Learning Intelligence** | Performance Knowledge Graph™ · Prediction Engine™ · Performance DNA™ | Consumes Core history; returns **only** through Core |
| **Interaction Intelligence** | AI Coach · HydroScan™ · Explainability (§52) · Response Timeline (§60) | Surfaces what Core and Learning produced |

**Directional rule (canonical):**

```
   CONTEXT INTELLIGENCE
   Climate Profile™ · Environmental Pressure™ · Tomorrow Load Forecast™
   Recovery Window™ · Performance Drift™
              │  informs — never commands, never scores
              ▼
   CORE INTELLIGENCE
   HydroState™ · Evidence Engine™ · Command Confidence™
   Performance Memory™ · Adaptive Response Engine™ · Living Performance Model™
              │                                    ▲
              │ history                            │ returns through Core
              ▼                                    │ (Evidence Engine™)
   LEARNING INTELLIGENCE                           │
   Performance Knowledge Graph™ ────────────────────┘
   Prediction Engine™ · Performance DNA™
              │
              ▼   (after the §42 gate)
   INTERACTION INTELLIGENCE
   AI Coach · HydroScan™ · Explainability (§52) · Response Timeline (§60)
              │
              ▼
          the person
```

**Invariants:**

1. Context informs Core. It never issues a command, never creates a score, never bypasses Core.
2. Learning Intelligence never reaches a user directly — always back through Core.
3. Interaction Intelligence never originates a claim; it surfaces what Core and Learning produced.
4. Only Core holds the hero metric, and only HydroState™ is it.
5. Nothing reaches a person without the Evidence Engine™, and §39/§40 output additionally passes
   the §42 gate.

**Performance Drift™ flow (D-07, closed 2026-07-22):**

```
Context Intelligence → Core Intelligence → Learning Intelligence (where applicable)
                     → Core Intelligence → Interaction Intelligence
```

## 1. Coordination order

**AForce Intelligence™ coordinates** — it is the architecture, not a step in the chain
(Founder Decision 2).

```
  INPUTS
    Adaptive Performance Profile™  ─┐
    Global Adaptation Engine™       │
    Climate Profile™                │
    Environmental Pressure™         ├──►  HydroState™          ◄── hero metric, load-bearing
    Sleep Readiness Intelligence™   │      (§1–17)
    Tomorrow Load Forecast™         │
    Wearables / biometrics         ─┘         │
                                              ▼
  SUBSTRATE                        Performance Knowledge Graph™  (§38)
    ledger events ────────────────►  nodes · edges · provenance
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
      Prediction Engine™ (§39)   Performance DNA™ (§40)   Living Performance Model™ (§61)
       projections + confidence    patterns + evidence      "your body taught us"
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              ▼
                              §42 Language & Compliance Gate      ◄── MANDATORY
                                              ▼
                                     Evidence Engine™             ◄── MANDATORY, never bypassed
                                              ▼
                                    Command Confidence™  (§58)
                                              ▼
                                       Today's Command
                                              ▼
                                    Performance Memory™
                                              ▼
                            delivery: AI Coach (§64) · AutoPilot™ · surfaces
```

## 2. Mandatory paths

These cannot be bypassed by any system, present or future (Founder Decision 1):

| Path | Rule |
|---|---|
| **→ Evidence Engine™** | Every user-facing claim routes through it. A claim with no explanation route does not ship. |
| **→ §42 gate** | Every §39 / §40 user-facing output passes the language gate first. |
| **→ HydroState™** | No system replaces it, competes with it, or emits a rival hero metric. |
| **→ Score Protection** | Only completed behavior modifies score. §38–42 are advisory-only. |
| **→ §41 provenance** | Every emitted claim resolves to real source events. |

## 3. Dependency table

| System | Reads | Writes | May mutate score? |
|---|---|---|---|
| HydroState™ | Profile, intake, environment, biometrics | score, band | ✅ via completed behavior only |
| Evidence Engine™ | All engines | explanation text | ❌ |
| Command Confidence™ | Today-behavior, fresh biometrics/weather | confidence level | ❌ |
| Performance Memory™ | Ledger, check-ins, snapshots | history (append-only) | ❌ |
| Adaptive Response Engine™ (§59) | Ledger, outcomes | Personal Response Library | ❌ |
| **§38 Knowledge Graph** | Ledger events, §59 library | nodes, edges, provenance | ❌ **advisory-only** |
| **§39 Prediction Engine** | §38 edges, HydroState (read-only) | projections (ephemeral) | ❌ **advisory-only** |
| **§40 Performance DNA** | §38 edges over time | patterns | ❌ **advisory-only** |
| **§41 Provenance** | §38, all derived claims | provenance + model version records | ❌ |
| **§42 Language Gate** | any emitted copy | pass/block verdict | ❌ |
| **§61 LPM** | §59 library, **§38 (new)** | daily lesson, manual, journey | ❌ |
| HydroScan™ | Camera, context | advisory rows only | ❌ **DR-001** |

## 4. Ordering constraints

1. **§41 before §38.** Provenance types must exist before the graph writes edges, or edges are
   created without a provenance path and become unreconstructable.
2. **§38 before §39, §40, and the §61 expansion.** All three read the graph.
3. **§42 before any §39/§40 user-facing output.** Founder Decision 5, explicit.
4. **§38 does not depend on §39 or §40.** The graph is useful headless on its own — this is what
   makes it a safe first increment.

## 5. What must not depend on what

| Prohibited dependency | Why |
|---|---|
| HydroState™ → §38/§39/§40 | Would make the hero metric depend on advisory systems and risk a Score-Protection breach |
| Score calculation → any new system | Score Protection |
| Evidence Engine™ → §39 projections | Explanation must stand on recorded fact, not forecast |
| Meridian™ tier → routing | Founder Decision 2: a withheld tier cannot gate architecture |
| Any new system → new raw data collection | §38–42 derive from already-consented data only |
