# §39 — Prediction Engine™ Specification

**Status:** **Architecture Only.** May not produce user-facing predictive language until the §42
gate is accepted (Founder Decision 5).
**Authorized by:** Founder Decisions 1 and 5 · **Updated:** 2026-07-22
**Implementation status:** **Not implemented.** Phase 2 is documentation-only.

> **This is the highest compliance-risk system in AForce OS.** A projection delivered in the wrong
> register stops being an observation and becomes a medical claim — breaching Constitution
> Principle 5 and `COMPLIANCE_FRAMEWORK.md` §2 simultaneously. §42 exists specifically to make
> that failure mode structurally unreachable. Tracked as `OPEN-RISKS.md` **R-01**, severity S1,
> launch-blocking.

---

## 1. Purpose

The Prediction Engine™ is **observation extended forward** — nothing more.

It projects **the user's own demonstrated response pattern**, drawn from the §38 graph. It does
not forecast health, and it does not predict outcomes the user has never demonstrated.

| It is | It is not |
|---|---|
| "On days like this, you've felt best starting earlier." | "You are at risk of dehydration." |
| The user's history, pointed forward | A health forecast |
| Confidence-bound and expiring | A statement of fact |

## 2. Data-sufficiency gate — settled by `DR-003`

**Configurable beta-validation defaults, not permanent scientific thresholds.** All values live in
the single canonical config source, `config/hydroStateModel.ts`.

| Gate | Default |
|---|---|
| Minimum usable personal history | **7 days** |
| Minimum comparable observations per prediction type | **5** |
| Distribution | across at least **3 distinct days** |
| Current-context inputs | must be **fresh** |
| Signal quality | must be **sufficient** |
| Confidence | **no prediction below the configured threshold** |

A broader **tomorrow-load or environmental forecast may use less personal history**, provided it is
**clearly labeled as context-based** rather than a learned personal prediction.

> The earlier 60–90 day proposal is superseded. The §60 Response Timeline keeps its own 60–90 day
> gate — these are **different gates on different surfaces** and must never be conflated.

### 2.1 Four required output states

The engine must distinguish these and never blur them:

| State | Meaning | Labeling requirement |
|---|---|---|
| **Insufficient data** | Gates not met | "Not enough data yet to say" — a valid, expected, non-failure output |
| **Context-only estimate** | Derived from environment/load, not personal history | **Must be labeled context-based**, never presented as learned about the person |
| **Emerging personal prediction** | Gates met, confidence still low | Must carry its emerging status |
| **Calibrated personal prediction** | Gates met, confidence established | Full confidence + provenance |

Collapsing a context-only estimate into a personal prediction is a **trust breach** — it claims the
OS learned something about the person that it did not.

## 3. Confidence is mandatory

Every projection carries:

| Field | Rule |
|---|---|
| `confidence` | Sourced from the underlying §38 edge confidence |
| `observationPeriod` | The window the supporting observations span |
| `evidenceCount` | How many real observations back it |
| `provenance` | Resolves to source events + model version (§41) |
| `expiresAt` | Projections are valid only for a stated window |

**A projection that cannot state its confidence is not emitted.** There is no unqualified
prediction path.

**Projections expire.** A stale projection is discarded, never re-surfaced.

## 4. Language rule — non-negotiable

Inherits §59 and is enforced by §42.

**Banned absolutely:** *risk · injury · diagnosis · diagnose · prevent · prevention · treat ·
cure · deficiency · disorder.* Full list in `governance/CLAIMS-REGISTER.md` §1.

| ✅ Approved | ❌ Prohibited |
|---|---|
| "On days like this, you've told us you feel best when you start earlier." | "You are at risk of dehydration." |
| "Your last four heat days went better when you front-loaded water." | "This prevents cramping." |
| "Based on 62 days of your own data, mornings like this tend to run low." | "You will become dehydrated." |
| "Not enough data yet to say." | *(guessing instead of saying so)* |

Additional rules:

- **Cause-and-effect from the user's own history only.** Never population comparison.
- **Never medical authority.** Observation, never diagnosis.
- **Recurring or severe symptoms always route to physician consultation** (inherited from §59).
- **Voice output is covered**, not only rendered text.

## 5. Hard constraints

| # | Constraint |
|---|---|
| 1 | **Score Protection.** Advisory-only, per DR-001 precedent. Never mutates score. |
| 2 | **Evidence Engine™ is mandatory.** No projection reaches a user without an explanation route. |
| 3 | **§42 gate is blocking.** No user-facing output before it clears. |
| 4 | **No competing hero metric.** A projection is never rendered as a headline number. |
| 5 | **No new navigation.** |
| 6 | **Fail-closed.** An unevaluable gate, flag, or sufficiency check blocks output. |
| 7 | Pure, RN-free, config-driven. |

## 6. Reads

§38 edges (primary) and HydroState™ read-only for fail-closed gating — for example, a DEPLETED
state must never yield a projection that lengthens a prompt. **Reading score is not a breach;
mutating it is.**

The Prediction Engine™ **must not** feed the Evidence Engine's factual explanation path — an
explanation stands on recorded fact, never on a forecast
(`INTELLIGENCE-DEPENDENCY-MAP.md` §5).

## 7. Validation

`INTELLIGENCE-VALIDATION-MATRIX.md` — universal V-1…V-8 plus P-1…P-6. **P-5 (§42 gate cleared)
is a blocking prerequisite.** All currently not started.
