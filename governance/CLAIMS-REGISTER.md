# Claims Register

**Status:** Canonical · **Updated:** 2026-07-22 (Phase 2)
**Governed by:** `docs/COMPLIANCE_FRAMEWORK.md` §2 (Observation, Never Diagnosis), §4 (Evidence
Engine Requirements), §14 (Health Disclaimer Standards), §17 (AI Disclosure); Constitution
Principle 5; §59 language rule; §42 gate.

Every user-facing statement asserting a physiological, performance, or predictive effect must
appear here with approved phrasing **before it ships**. A claim not in this register may not be
surfaced.

---

## 0. Machine-readable representation (§42 gate)

This document is **authoritative**. Code compiles a machine-readable representation of it at
`artifacts/aforce-os/utils/intelligence/languageGate/policyRegistry.ts`
(`GATE_POLICY_VERSION = p42-v1.0`). **The two must not silently diverge** — a policy change in code
without a change here is a governance defect.

Rule families implemented: `P42-MED-*` (medical/diagnostic) · `P42-INJ-*` (injury/risk) ·
`P42-CAU-*` (causality) · `P42-CER-*` (certainty) · `P42-PRD-*` (product bias) ·
`P42-SCR-*` (Score Protection) · `P42-DNA-*` (pattern language) · plus gate-internal
`P42-PRV-*` (provenance), `P42-EVD-*` (evidence), `P42-FRS-*` (freshness), `P42-STA-*` (state
integrity), `P42-LOC-*` (locale), `P42-SRF-*` (surface).

Locale scope: `governance/LOCALE-POLICY-REGISTRY.md`. **Only English is validated** — these
policies are enforced in `en` only; all other locales suppress intelligence claims entirely.

## 1. Banned vocabulary — absolute

Never in user-facing intelligence copy, in any language, in any surface including voice:

**risk · injury · diagnosis · diagnose · prevent · prevents · prevention · treat · cure · deficiency · disorder**

Also prohibited: population comparison once sufficient personal data exists (Principle 4);
any statement implying medical authority (Principle 5); any biologically deterministic or
genetic framing (Founder Decision 4).

## 2. Claim classes

| Class | Definition | Allowed? |
|---|---|---|
| **C1 — Observation** | Restates recorded user data. "You logged 48 oz by noon." | ✅ Always |
| **C2 — Personal cause-and-effect** | Links the user's own behavior to their own recorded outcome. "On days you started before 9am, you reported feeling better." | ✅ With confidence + provenance |
| **C3 — Personal projection** | Extends C2 forward. "On days like this, you've felt best starting earlier." | ⚠️ **§39 + §42 gate only** |
| **C4 — Durable pattern** | A stable trait with evidence both for and against. | ⚠️ **§40 + §42 gate only** |
| **C5 — Population claim** | Any statement about people in general. | ❌ Prohibited once personal data exists |
| **C6 — Health / medical claim** | Any physiological outcome framed as health. | ❌ Prohibited outright |

## 3. Approved phrasing — §39 Prediction Engine™

Prediction is **observation extended forward**, never a forecast of health.

| ✅ Approved | ❌ Prohibited |
|---|---|
| "On days like this, you've told us you feel best when you start earlier." | "You are at risk of dehydration." |
| "Your last four heat days went better when you front-loaded water." | "This prevents cramping." |
| "Based on 62 days of your own data, mornings like this tend to run low." | "You will become dehydrated." |
| "Not enough data yet to say." | *(silently guessing instead)* |

**Mandatory with every projection:** confidence value, observation period, evidence count, and
a provenance path to source events (§41).

## 4. Approved phrasing — §40 Performance DNA™

| ✅ Approved | ❌ Prohibited |
|---|---|
| "Observed pattern: you respond strongly to early hydration." | "Your DNA score is 78." |
| "Emerging pattern — still gathering evidence." | "You are a heat-intolerant type." |
| "Recalibrating: recent days disagree with this pattern." | "Genetically, you…" |
| "This pattern is based on 34 observations over 90 days; 5 observations disagree." | *(hiding contradictory evidence)* |

**Mandatory with every pattern** (Founder Decision 4): supporting observations, contradictory
observations, confidence, observation period, evidence count, last evaluation, plain-language
explanation, and user challenge/dismissal controls.

## 5. Approved phrasing — §61 Living Performance Model™

Register: **"your body taught us"** — never "what I learned about you."

| ✅ Approved | ❌ Prohibited |
|---|---|
| "Your body taught us that…" | "I've figured out that you…" |
| "You're exactly where you should be." *(Silent Intelligence on-track state)* | *(inventing a lesson when nothing stands out)* |
| "You completed 240 commands and improved 12%. Thank you for showing up." *(Legacy)* | "You prevented 30 dehydration events." *(Legacy)* |

## 5.1 Approved phrasing — Guardian™ (`DR-003`, D-06)

| ✅ Approved | ❌ Prohibited |
|---|---|
| "Performance readiness and recovery oversight." *(canonical)* | "Injury-risk protection." |
| "Readiness monitoring and escalation support." *(secondary)* | "Predicts injury." / "Prevents injury." |
| Escalation framed on **observable state**, user-defined rules, approved safety boundaries | "Assesses medical risk." / "Diagnoses injury." |
| — | Any wording implying Guardian replaces medical or emergency care |

Applies to marketing, contractual, and in-product surfaces alike.

## 6. Standing requirements

1. **Recurring or severe symptoms always route to physician consultation.** Non-negotiable,
   inherited from §59 and the Adaptive Response Engine's existing trigger.
2. **AI disclosure** per COMPLIANCE_FRAMEWORK §17 wherever generated language appears.
3. **Evidence Engine path is mandatory** — no claim reaches a user without an explanation route
   (Founder Decision 1: must not bypass the Evidence Engine™).
4. **Mechanical enforcement.** §42 requires a test asserting no banned term can appear in any
   emitted copy key. A claim surface without that test is not shippable.

## 7. Register status

| Section | Claims classes used | Approved for user-facing output? |
|---|---|---|
| §38 Performance Knowledge Graph™ | C1, C2 (internal only) | Headless — no user-facing output |
| §39 Prediction Engine™ | C3 | ❌ **Blocked until §42 clears** |
| §40 Performance DNA™ | C4 | ❌ **Blocked until §42 clears** |
| §41 Provenance | — | Supporting |
| §61 Living Performance Model™ (daily lesson) | C1, C2 | ✅ Approved (shipped) |
| §61 Your Body's Manual / Confidence Journey / Legacy | C2, C4 | ❌ Not yet — Phase 2/4 |
