# DR-003 — Intelligence Design Rulings (D-01, D-03, D-04, D-05, D-06)

- **Status:** ACCEPTED — settled. Closes **D-01, D-03, D-04, D-05, D-06**.
- **Date:** 2026-07-22
- **Owner / decider:** Brandon (founder)
- **Related:** `DR-002` (persistence topology), `governance/CLAIMS-REGISTER.md`,
  `governance/FEATURE-PHASE-MATRIX.md`, `docs/PREDICTION-ENGINE-SPEC.md`,
  `docs/PERFORMANCE-DNA-SPEC.md`, `docs/COMMERCE-AND-ENTERPRISE-SPEC.md`

---

## D-03 — Prediction sufficiency defaults

Approved as **configurable beta-validation defaults, not permanent scientific thresholds**:

| Gate | Default |
|---|---|
| Minimum usable personal history | **7 days** |
| Minimum comparable observations per prediction type | **5** |
| Distribution | across at least **3 distinct days** |
| Current-context inputs | must be **fresh** |
| Signal quality | must be **sufficient** |
| Confidence | **no prediction below the configured threshold** |

A broader **tomorrow-load or environmental forecast may use less personal history** when it is
**clearly labeled as context-based** rather than a learned personal prediction.

All thresholds live in **one canonical configuration source**
(`artifacts/aforce-os/config/hydroStateModel.ts`).

### Four required output states

The system must distinguish, and never blur:

1. **Insufficient data**
2. **Context-only estimate** — labeled as context-based, not personal
3. **Emerging personal prediction**
4. **Calibrated personal prediction**

> This materially revises the earlier 60–90 day proposal. 7 days / 5 observations / 3 distinct
> days is far more permissive — deliberately, because it is a **beta-validation default subject to
> revision**, and because the four-state model means a thin-evidence answer is *labeled* rather
> than suppressed. The §60 Response Timeline retains its own 60–90 day data gate; these are
> different gates on different surfaces and must not be conflated.

**Closed for design purposes, subject to beta validation.**

## D-06 — Guardian language

**"Injury-risk protection" is removed as an approved Guardian description.**

| | Wording |
|---|---|
| **Canonical** | "Performance readiness and recovery oversight." |
| **Permitted secondary** | "Readiness monitoring and escalation support." |

Guardian must **not** claim to: predict injury · prevent injury · diagnose injury · assess medical
risk · replace medical or emergency care.

Escalation language must be based on **observable state, user-defined rules, and approved safety
boundaries**.

**Closed.**

## D-04 — Performance DNA™ surfacing

Approved exposure sequence, in order:

1. **Founder Mode inspector**
2. **Weekly Performance Report beta**
3. **Profile → Your Body's Manual**
4. **AI Coach explanations**
5. **Selected Home insight card, behind a feature flag**

**Performance DNA™ must not appear during onboarding.** It must not appear merely because the
backend exists. A pattern may surface **only when its minimum evidence, observation-period,
confidence and compliance gates are satisfied**.

**Closed.**

## D-05 — Legacy documents

Retain superseded banners and canonical links. **Do not de-duplicate historical text** during the
current architecture and implementation-design sequence. Historical documents must remain clearly
non-authoritative.

**Closed as deferred maintenance.**

## D-01 — Reserved sections

**§43–46 stay reserved.** Do not pre-assign names. Do not create additional branded systems.

**Closed.**
