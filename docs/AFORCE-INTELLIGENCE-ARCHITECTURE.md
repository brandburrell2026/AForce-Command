# AForce Intelligence™ — Architecture Specification

**Status:** Canonical (tier 4) · **Established:** 2026-07-22 by **Founder Decision 2**
**Contains:** §41 (Provenance, Retention & Model Versioning) and §42 (Language & Compliance Gate)

---

## 1. Definition

**AForce Intelligence™ is the coordinated intelligence architecture beneath AForce OS.** It is
the collective noun for every engine that observes, learns, explains, decides, and routes.

**AForce Intelligence™ is not:**

- a subscription tier;
- a new navigation surface;
- a user-facing score;
- a replacement for HydroState™;
- a separately marketed application.

Users never see the term. It is an architecture-level concept for engineering and governance.

### 1.1 Relationship to Meridian™

**Meridian™ is the future Phase 3 premium / luxury product tier.** It may consume and expose
advanced AForce Intelligence™ capabilities as a premium experience, but **it does not own or
define the underlying architecture.**

The pre-Phase-2 statement *"Meridian decides"* is **retired**. The correct statement is
**"AForce Intelligence coordinates."** A withheld commercial tier can never gate system-wide
routing — that was the defect this resolves. Full reference disposition:
`governance/SPECIFICATION-RECONCILIATION-REGISTER.md` §2.

## 2. What it coordinates — the four intelligence layers

**Canonical taxonomy, founder-defined 2026-07-22.** AForce Intelligence™ is organized into four
layers by *what each engine does*, not by phase or tier. **Eighteen members.**

### 2.1 Core Intelligence — establishes and acts on state

The load-bearing loop. Determines what is true now, explains it, decides, remembers, and reflects.

| Member | Role | Section |
|---|---|---|
| **HydroState™** | Foundational state engine · **single hero metric** | §1–17 |
| **Evidence Engine™** | Explains why — mandatory, never bypassed | cross-cutting |
| **Command Confidence™** | Prioritizes and qualifies | §58 |
| **Performance Memory™** | Remembers; never overwrites history | cross-cutting |
| **Adaptive Response Engine™** | Personal Response Library, What Worked, Confidence After Action | §59 |
| **Living Performance Model™** | Reflects back what the body taught us | §61 |

### 2.2 Learning Intelligence — turns history into understanding

How the OS gets more personal over time. All three are **newly authorized** (Founder Decision 1)
and all are **advisory-only**.

| Member | Role | Section |
|---|---|---|
| **Performance Knowledge Graph™** | Structured substrate of demonstrated behavior | §38 |
| **Prediction Engine™** | Observation extended forward, with confidence | §39 |
| **Performance DNA™** | Durable qualitative patterns — never a score | §40 |

### 2.3 Interaction Intelligence — how understanding reaches the person

The surfaces through which intelligence becomes conversation, decision, or explanation.

| Member | Role | Section |
|---|---|---|
| **AI Coach** | Conversational surface, context pre-loaded | §64 |
| **HydroScan™** | Advisory decision intelligence — **never mutates score (DR-001)** | §28–37 |
| **Explainability** | Explainability Center — the user's route into the reasoning | §52 |
| **Response Timeline** | Query layer over Performance Memory; data-gated 60–90 days | §60 |

### 2.4 Context Intelligence — the world the body is in

External and forward-looking conditions that shape what the body needs.

| Member | Role | Section |
|---|---|---|
| **Climate Profile™** | Persistent local climate adaptation | engine flow |
| **Environmental Pressure™** | Current external load | engine flow |
| **Tomorrow Load Forecast™** | Forward demand | §22 |
| **Recovery Window™** | Recovery timing | cross-cutting |
| **Performance Drift™** | Slower directional movement across time — how the performance state is evolving | §27 |

**Performance Drift™ membership (D-07, closed 2026-07-22).** Drift is contextual, not commanding.
It reports slower directional movement across time and provides context about how the user's
performance state is evolving. It **does not** independently issue commands, create a competing
score, or bypass Core Intelligence.

Mandatory flow for Performance Drift™:

```
Context Intelligence → Core Intelligence → Learning Intelligence (where applicable)
                     → Core Intelligence → Interaction Intelligence
```

### 2.5 Layer rules

| # | Rule |
|---|---|
| 1 | **Layers describe function, not privilege.** No layer outranks another; all serve HydroState™. |
| 2 | **Context feeds Core. Core feeds Learning. Learning returns through Core.** Learning Intelligence never reaches a user except via Core (Evidence Engine™) and Interaction. |
| 3 | **Interaction Intelligence never originates a claim.** It surfaces what Core and Learning produced, after the §42 gate. |
| 4 | **Only Core may hold the hero metric** — and only HydroState™ does. |
| 5 | **Context Intelligence never issues commands.** Context members inform Core; they never command, never score, and never bypass Core. |
| 6 | Adding, removing, or moving a member between layers requires a decision record. |

## 3. Coordination rules

| # | Rule |
|---|---|
| 1 | **Nothing operates independently.** Every engine feeds the Evidence Engine™. |
| 2 | **HydroState™ is load-bearing and singular.** No system emits a competing hero metric. |
| 3 | **Everything ends in a Water-First command.** |
| 4 | **Everything is remembered.** Performance Memory™ never overwrites history. |
| 5 | **Everything is explainable** in plain language using the user's own data. |
| 6 | **Silence is valid output.** The OS speaks only when speaking adds value. |
| 7 | **Advisory systems never mutate score.** Only completed behavior does. |
| 8 | **Absence is never favorable.** Missing data yields insufficient-data, never a default. |

## 4. Architecture constraints on all members (Founder Decision 1)

No member of AForce Intelligence™ may:

- create a competing hero metric;
- create additional public navigation tabs;
- replace HydroState™;
- bypass the Evidence Engine™;
- violate Score Protection;
- duplicate an existing system;
- be exposed publicly merely because its backend exists.

## 5. Flow

See `governance/INTELLIGENCE-DEPENDENCY-MAP.md` for the full diagram and the prohibited-dependency
table. In brief:

> inputs → **HydroState™** → **§38 graph** → {§39 projections · §40 patterns · §61 lessons}
> → **§42 gate** → **Evidence Engine™** → **Command Confidence™** → Today's Command
> → Performance Memory™ → delivery

---

# 6. §41 — Intelligence Provenance, Retention and Model Versioning

**Status:** Build Now (ships with §38)

A cross-cutting rule, not a feature. It is what makes Constitution Principle 3 — *every
recommendation must be explainable in plain language, using the user's own data* — mechanically
enforceable rather than aspirational.

## 6.1 Provenance

Every claim any intelligence system makes must resolve, on demand, to:

1. the **real recorded source events** it derives from;
2. the **model version** of the logic that read them;
3. the **observation period** and **evidence count**;
4. the **confidence** and how it was reached.

A claim that cannot produce this is not emitted. There is no "trust me" path.

## 6.2 Retention

| Rule | Detail |
|---|---|
| Derived data is subordinate to its sources | Deleting source events invalidates every edge, pattern, and projection built from them |
| No orphan inference | A pattern whose supporting events were deleted is **retired**, not preserved |
| Projections expire | Valid only for their stated window; stale projections are discarded, never re-surfaced |
| Append-only history | Consistent with Performance Memory™ — history is never overwritten |
| Privacy Center governs | Export and deletion route through the existing §51 contract |

## 6.3 Model versioning

Full rules and the registry: `governance/MODEL-VERSION-REGISTRY.md`.

- Every derived record stores the model version that produced it.
- A **major** bump means old records are not comparable — re-derive or retire, never silently
  reinterpret.
- If a bump retires patterns a user has already seen, that is a **surface change requiring founder
  approval**. A pattern vanishing without explanation is a trust breach under Principle 10.

---

# 7. §42 — Intelligence Language and Compliance Gate

**Status:** Build Now (required revision, not a new feature)
**Blocking:** **§39 and §40 may not surface any user-facing output until this gate is accepted.**
(Founder Decision 5)

Modeled on §63, which established that a compliance pass is itself a numbered section.

## 7.1 What the gate does

Every candidate user-facing string from §39, §40, and the §61 expansion passes through the gate
before it can reach a surface — visual **or voice**.

## 7.2 Rules

| # | Rule |
|---|---|
| 1 | **Banned vocabulary is absolute.** *risk · injury · diagnosis · diagnose · prevent · prevention · treat · cure · deficiency · disorder.* Full list: `governance/CLAIMS-REGISTER.md` §1. |
| 2 | **Cause-and-effect from the user's own history only.** Never population comparison once personal data exists. |
| 3 | **Never medical authority.** Observation, never diagnosis (Principle 5). |
| 4 | **Recurring or severe symptoms always route to physician consultation.** Inherited from §59. |
| 5 | **Fail-closed.** If the gate cannot be evaluated, output is blocked, not passed. |
| 6 | **Mechanically enforced.** A test asserts no banned term can appear in any emitted copy key, in any locale. A surface without that test is not shippable. |
| 7 | **Voice included.** The gate covers spoken output, not only rendered text. |

## 7.3 Why this is a section and not a style guide

A style guide is advice. A numbered section with a mechanical test is a gate. §39 is the highest
compliance-risk system in the OS: a projection delivered in the wrong register becomes a medical
claim, which breaches Principle 5 and `COMPLIANCE_FRAMEWORK.md` §2 simultaneously. The gate exists
specifically to make that failure mode structurally unreachable rather than merely discouraged.

Tracked as `OPEN-RISKS.md` **R-01**, severity S1, launch-blocking.
