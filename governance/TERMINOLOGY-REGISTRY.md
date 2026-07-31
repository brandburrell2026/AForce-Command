# Terminology Registry

**Status:** Canonical · **Updated:** 2026-07-22 (Phase 2)

Canonical definition for every branded term. A term used outside this definition is a defect.
Aliases listed here are tolerated in legacy documents but must not be used in new writing.

---

## 1. Umbrella and tier terms

| Term | Definition | Not |
|---|---|---|
| **AForce OS** | The complete operating system — the product users install and use. | Not an engine. |
| **AForce Intelligence™** | The coordinated intelligence architecture beneath AForce OS. The collective noun for every engine that observes, learns, explains, decides, and routes. *(Founder Decision 2)* | Not a subscription tier. Not a navigation surface. Not a user-facing score. Not a replacement for HydroState™. Not a separately marketed application. |
| **Meridian™** | The future **Phase 3 premium / luxury product tier**. May consume and expose advanced AForce Intelligence™ capabilities as a premium experience. *(Founder Decision 2)* | Does **not** own, define, or route the underlying architecture. Any statement that "Meridian decides" is superseded. |
| **Phantom Meridian** | A **hardware SKU** — the ceramic luxury edition of Phantom Band™ (`exports/phantom-rfp/`). Distinct from the Meridian™ software tier. | Not the software tier. Not an architecture layer. |

> **Three distinct Meridian meanings existed before Phase 2.** Only two survive: the Phase 3
> software tier and the Phantom hardware edition. The architectural meaning is retired — see
> `SPECIFICATION-RECONCILIATION-REGISTER.md` §2.

## 2. Hero metric

| Term | Definition |
|---|---|
| **HydroState™** | The foundational state engine and **single hero metric**. Constitution Principle 2. Every other system operates around and through it. No system may emit a competing hero metric. |

## 3. Coordinated engines (AForce Intelligence™ members)

**Four-layer taxonomy, founder-defined 2026-07-22.** **Eighteen members** grouped by function.
Canonical detail: `docs/AFORCE-INTELLIGENCE-ARCHITECTURE.md` §2.

### Core Intelligence — establishes and acts on state

| Term | Role | Section |
|---|---|---|
| **HydroState™** | Foundational state engine; **single hero metric** | §1–17 |
| **Evidence Engine™** | Explains why. Mandatory path — nothing bypasses it. | cross-cutting |
| **Command Confidence™** | Prioritizes and qualifies commands | §58 |
| **Performance Memory™** | Remembers; never overwrites history | cross-cutting |
| **Adaptive Response Engine™** | Personal Response Library, What Worked, Confidence After Action | §59 |
| **Living Performance Model™** | Reflects back what the body taught us | §61 |

### Learning Intelligence — turns history into understanding

| Term | Role | Section |
|---|---|---|
| **Performance Knowledge Graph™** | Structured substrate of demonstrated behavior | §38 |
| **Prediction Engine™** | Observation extended forward, with confidence | §39 |
| **Performance DNA™** | Qualitative durable personal patterns — never a score | §40 |

### Interaction Intelligence — how understanding reaches the person

| Term | Role | Section |
|---|---|---|
| **AI Coach** | Conversational surface, per Conversational Intelligence Architecture™ | §64 |
| **HydroScan™** | Advisory decision intelligence (advisory-only per DR-001) | §28–37 |
| **Explainability** | Explainability Center — user route into the reasoning | §52 |
| **Response Timeline** | Query layer over Performance Memory; data-gated 60–90 days | §60 |

### Context Intelligence — the world the body is in

| Term | Role | Section |
|---|---|---|
| **Climate Profile™** | Persistent local climate adaptation | engine flow |
| **Environmental Pressure™** | Current external load | engine flow |
| **Tomorrow Load Forecast™** | Forward demand signal | §22 |
| **Recovery Window™** | Recovery timing signal | cross-cutting |
| **Performance Drift™** | Slower directional movement across time | §27 |

> **Performance Drift™ membership settled — D-07, closed 2026-07-22.** Drift sits in **Context
> Intelligence**: it reports how the performance state is evolving, and never issues a command,
> creates a competing score, or bypasses Core Intelligence.

## 3.1 Adaptive Response Engine™ — canonical name rule

**Founder decision, 2026-07-22.** The canonical branded and technical name is
**Adaptive Response Engine™**. Section mapping is unchanged: **§59**.

**Adaptive Response™** is an **approved shorthand for explanatory prose only**. It is not an
alias to be normalized away, and it is not permitted in structural contexts.

| Use **Adaptive Response Engine™** | May use **Adaptive Response™** |
|---|---|
| Architecture documents | Explanatory prose |
| Terminology registry | Narrative passages |
| Dependency maps | — |
| Interfaces | — |
| System diagrams | — |
| Acceptance criteria | — |
| Governance records | — |
| Engineering specifications | — |

## 4. Alias table — canonical vs. tolerated legacy

New writing uses the canonical form only.

| Canonical | Tolerated legacy aliases |
|---|---|
| Adaptive Performance Profile™ | Adaptive Profile™, Adaptive Profile Engine™ (§18 engine name), Performance Profile™ (§19) |
| Sleep Readiness Intelligence™ | Sleep Readiness™ |
| Performance Age™ | AForce Performance Age™ |
| Cruise Mode™ | Cruise™ |
| Advanced Visual Intelligence™ | Skin Performance Intelligence™ |
| Conversational Intelligence Architecture™ | Intelligence Architecture™ |
| Evidence Engine™ | The Evidence Engine™ |

## 5. Performance DNA™ pattern vocabulary (Founder Decision 4)

Performance DNA™ emits **patterns**, never a score. Approved pattern states:

| State | Meaning |
|---|---|
| **Emerging Pattern** | Early signal; insufficient evidence to rely on |
| **Observed Pattern** | Repeatedly seen; usable with stated confidence |
| **High-Confidence Pattern** | Sustained across many observations and contexts |
| **Recalibrating Pattern** | Contradictory evidence accumulating; under revision |
| **Retired / Superseded Pattern** | No longer supported, or replaced by a better-evidenced pattern |

Prohibited outputs: a single DNA score, a competing 0–100 score, genetic interpretation, fixed
identity classification, medical label, biologically deterministic claim.

## 6. Band vocabulary — two systems, deliberately separate

**Do not merge these and do not describe one as an alias of the other.** Their thresholds do
not align; a range-based alias mapping is mathematically wrong.

**Performance State — 4 bands** (`utils/scoring/breakdown.ts` → `resolveState`; colors in
`theme/colors.ts`). Drives the orb, risk timer, pulse config, command selection.

| Band | Threshold |
|---|---|
| PEAK | ≥ 90 |
| BALANCED | ≥ 75 |
| RECOVERING | ≥ 60 |
| DEPLETED | else |

**Score Status — 5 bands** (`theme/statusColor.ts`). Drives the AI Coach status-color layer and
the score read-out.

| Band | Range |
|---|---|
| OPTIMAL | 85–100 |
| STABLE | 70–84 |
| DECLINING | 50–69 |
| RISK | 30–49 |
| CRITICAL | 0–29 |

Both ladders share only the top green `#1FA35A` and bottom red `#FF2800`. `statusColor.ts` is
off-limits for edits.

## 7. Banned vocabulary (all user-facing surfaces)

From §59, §42, and Constitution Principle 5. Never: **risk**, **injury**, **diagnosis**,
**prevent** (and their inflections) in any user-facing intelligence copy. Never population
comparison once sufficient personal data exists. See `CLAIMS-REGISTER.md`.

> Note: "RISK" as a *Score Status band identifier* in `statusColor.ts` is an internal token,
> not user-facing copy. It must not be rendered to users as the word "risk".
