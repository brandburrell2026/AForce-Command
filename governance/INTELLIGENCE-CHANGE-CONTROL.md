# Intelligence Change Control

**Status:** FROZEN (Phase 3.5) · **Effective:** 2026-07-22 · **Authority:** tier 3

After Phase 3.5, the intelligence architecture is **frozen**. Any change to the areas below
requires a Change Record and the approvals in §4. **No future intelligence system may bypass this
process.**

---

## 1. What is frozen

A Change Record is required for any change to:

| # | Frozen area | Canonical document |
|---|---|---|
| F1 | **Ownership** — what a system owns, produces, persists, may/never mutate or emit | `INTELLIGENCE-OWNERSHIP-MATRIX.md` |
| F2 | **Dependencies** — permitted or prohibited paths | `INTELLIGENCE-DEPENDENCY-MATRIX.md` |
| F3 | **Data-flow** — pipeline, feedback loop, side paths, bypasses | `INTELLIGENCE-DATA-FLOW-CONTRACTS.md` |
| F4 | **Event vocabulary** — names, categories, ledgers, eligibility | `INTELLIGENCE-EVENT-REGISTRY.md` |
| F5 | **Confidence taxonomy** — the eleven concepts and their non-equivalences | `INTELLIGENCE-CONFIDENCE-TAXONOMY.md` |
| F6 | **Score behaviour** — what is completed behaviour; what may change HydroState | Data-Flow §5 · Score Protection lock |
| F7 | **Claim policy** — banned concepts, outcomes, transformations | `CLAIMS-REGISTER.md` + `policyRegistry.ts` |
| F8 | **Model versioning** — when a version is required, increment triggers | `INTELLIGENCE-VERSION-CONTEXT.md` |
| F9 | **Public visibility** — any capability status change toward exposure | `CAPABILITY-STATUS-REGISTER.md` |
| F10 | **Terminology, section allocation, status labels** | `TERMINOLOGY-REGISTRY.md` · `Architecture-Appendix.md` |

**Calendar classifier keyword list (F4 — under change control). ⟦Draft — counsel
review required⟧** The fixed keyword list that maps calendar event titles to
preparation categories (`artifacts/aforce-os/services/momentClassification.ts`,
`CATEGORY_KEYWORDS`) is an Event-vocabulary (F4) surface tied to the consumer-
health-data determination in **PR-002 Appendix A §2a**. Because the derived
category can carry a health inference, **any addition to this list reopens
Appendix A determination 2a and must be re-signed by Legal + Privacy before that
change ships.** Counsel signs 2a against the exact list reproduced verbatim in
Appendix A §2a.1.

## 2. Change Record — required content

No change proceeds without all of these:

1. **Proposed change record** — id, date, author, summary
2. **Affected systems** — from the ownership matrix
3. **Architectural impact** — which frozen area (F1–F10)
4. **Privacy impact** — data classes, retention, deletion, consent
5. **Compliance impact** — claims, language, disclosure
6. **Scoring impact** — *"none"* must be explicitly asserted and evidenced, not assumed
7. **Migration impact** — schema, back-derivation, re-derivation
8. **Test impact** — which suites change; which invariants are affected
9. **Rollback plan** — including whether user data is affected
10. **Required approvals** — per §4
11. **Reconciliation Register update** — spec position vs. code behaviour
12. **Version increment** — which of the 14 versions bumps, and major vs. minor

## 3. Severity

| Level | Definition | Examples |
|---|---|---|
| **Critical** | Touches score behaviour, hero metric, claim policy, or public visibility | New score-eligible event; new user-facing surface; banned-concept change |
| **Major** | Touches ownership, dependencies, event vocabulary, versioning | New system; new event; new dependency |
| **Minor** | Internal refinement with no frozen-area effect | Threshold tuning within an approved range; test additions |

## 4. Approval gates

| Change area | Founder | Legal | Privacy | Scientific | Engineering |
|---|---|---|---|---|---|
| Score behaviour (F6) | **Required** | — | — | Required if physiological | **Required** |
| Hero metric / new score | **Required (Julius + Brandon)** | — | — | Required | Required |
| Claim policy (F7) | **Required** | **Required** | — | Required if physiological | Required |
| Public visibility (F9) | **Required** | Required if external | Required if new data | — | Required |
| Event vocabulary (F4) | Required | — | **Required** | — | **Required** |
| Ownership / dependencies (F1–F3) | Required | — | — | — | **Required** |
| Confidence taxonomy (F5) | **Required** | — | — | Required | Required |
| Model versioning (F8) | Required for major | — | — | — | **Required** |
| Terminology / sections (F10) | **Required** | — | — | — | — |
| Retention classes | **Required** | **Required** | **Required** | — | Required |

**Constitution changes** remain under their own Change Control: documented proposal + beta
evidence (never a single account) + Julius **and** Brandon + version bump.

## 5. Standing prohibitions (no Change Record can authorize these)

These require a **Constitutional amendment**, not a change record:

1. A second hero metric or competing readiness score.
2. HydroScan mutating HydroState.
3. A recommendation, scan, view, or purchase changing score.
4. Any claim reaching a user without the Evidence Engine and §42.
5. A derived record surviving total loss of its supporting evidence.
6. Performance DNA producing a score.
7. Demo Mode bypassing Score Protection.
8. A causal relationship type without an approved causal-evidence policy.

## 6. Process

```
proposal → Change Record (§2) → severity (§3) → approvals (§4)
  → implement behind a disabled flag → tests + validation
  → Reconciliation Register + Capability Status Register update
  → version increment → per-surface approval before any exposure
```

**Emergency changes** (production defect) may implement first, but the Change Record must be filed
within one working day and carries the same approvals retroactively. An emergency change may
**never** touch a §5 prohibition.

## 7. Enforcement gaps

Change control is currently **procedural, not mechanical**. Recorded, not assumed:

| Gap | Detail |
|---|---|
| G-3 | No automated dependency-cycle check |
| G-4 | No automated check that `utils/intelligence/**` never imports the store |
| G-5 | No event-name collision check |
| R-25 | No policy-registry ↔ Claims Register drift check |
| R-21 | No schema-vs-definition deployment check |

Only the governance-mirror drift check (`scripts/src/check-governance-drift.mjs`) is automated.
Building the rest is not authorized in Phase 3.5.
