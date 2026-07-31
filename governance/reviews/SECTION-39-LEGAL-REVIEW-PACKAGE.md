# §39 Prediction Engine™ — Legal Review Package

**Status:** ⏳ **NOT YET REVIEWED** — prepared for external legal review
**Prepared:** 2026-07-22 (Phase 3.7) · **Reviewer:** _to be assigned_
**Scope:** the three candidate prediction types only

> **No legal approval exists for any part of this system.** This package requests review; it does
> not record one. Nothing may be treated as legally cleared on the basis of this document.

---

## Part 1 — What is being proposed

AForce OS is a consumer hydration and performance app. Its hero metric, **HydroState**, is a
0–100 performance-state score computed from the user's own logged behavior, profile, and
environmental conditions.

§39 would add a **Prediction Engine** that projects the user's **own previously demonstrated
patterns** forward. Three candidate types are in scope:

1. **Tomorrow Load Forecast** — projected demand for the coming day
2. **Performance Drift** — direction of a slow multi-day trend
3. **Environmental Pressure Outlook** — forward heat/humidity/altitude load

**Explicitly out of scope and permanently prohibited:** injury prediction · illness prediction ·
dehydration diagnosis · medical-risk prediction · treatment recommendations · exact failure or
crash-time claims · product-driven outcome predictions · alcohol impairment or BAC predictions ·
clinical or diagnostic predictions.

## Part 2 — Permitted states and the context/personal distinction

| State | Permitted? | Meaning |
|---|---|---|
| **Insufficient Data** | ✅ | No claim made. "Not enough data yet to say." |
| **Context-Only Estimate** | ✅ | Derived from **current conditions**, not from learning about the person |
| **Emerging Personal Prediction** | ✅ | Based on the person's own limited history; cautious language |
| **Calibrated Personal Prediction** | ❌ **PROHIBITED** | Blocked pending scientific validation, backtesting, and a separate legal review |

**The context/personal distinction is the central legal question in this package.** A
*Context-Only Estimate* says "conditions tomorrow are hot." An *Emerging Personal Prediction* says
"on days like this, you have reported feeling better when you started earlier." The second claims
the system learned something about the individual; the first does not. **Conflating them would
assert personal knowledge the system does not have.**

## Part 3 — Surfaces

| Intended | Prohibited |
|---|---|
| Weekly Performance Report (PT-1) | Notifications (short-form, no room to qualify) |
| Your Body's Manual (PT-2) | Guardian (safety-escalation surface) |
| Today's Command explanation (PT-3) | HydroScan (product-decision surface) |
| | Email |
| | **Onboarding — permanently** |

**No surface is currently approved.** Each requires separate approval.

## Part 4 — Existing language controls

A mechanical gate (§42) evaluates every candidate string before it can reach a user. It produces
14 distinct outcomes and **fails closed**.

### 4.1 Blocked absolutely

**Medical/diagnostic:** diagnose · diagnosis · disease · disorder · medical condition · treatment ·
cure · symptom · clinically proven · medically necessary · deficiency
**Injury/risk:** injury · injuries · injured · injury prevention · predicts injury ·
medical-risk detection · at risk · risk of
**Causal:** caused · causes · will cause · resulted in · led to · because of · due to · prevent ·
prevention
**Certainty:** definitely · guaranteed · always · never · certain · proven · will happen · exactly ·
no doubt
**Product bias:** you need AForce · requires AForce · must drink AForce · buy to improve
**Score protection:** scanning increases your score · purchase increases · raises your HydroState

### 4.2 Permitted association constructions

Only these, and only at an approved evidence state: *was associated with · appeared alongside ·
was observed after · may have contributed · often occurred when.*

### 4.3 Transformation

The gate may rewrite **only** through pre-approved copy templates — **never generative rewriting**,
and never in a way that turns an unsupported claim into an apparently supported one.

| Unsupported | Approved transformation |
|---|---|
| "You will crash in 40 minutes." | "Your current conditions suggest your readiness may decline within the next hour." |
| "Heat caused your poor recovery." | "Higher heat exposure appeared alongside lower recovery in several recent observations." |

## Part 5 — Sample language for ruling

### 5.1 Proposed permitted

| Type | Sample |
|---|---|
| PT-1 | "Based on 12 days of your own data, mornings like tomorrow have tended to run low for you." |
| PT-2 | "Your recent pattern has been moving in one direction. This is based on your own logs and may change." |
| PT-3 | "Conditions tomorrow are forecast to be hotter than your recent average. This is based on the forecast, not on your personal history." |
| Any | "Not enough data yet to say." |

### 5.2 Proposed suppressed

"You are at risk of dehydration." · "This will prevent cramping." · "You will crash tomorrow." ·
"Your recovery is declining and will continue to decline." · "Drink AForce to avoid this."

### 5.3 Uncertainty language

Every Emerging Personal Prediction must carry a qualifier: *"based on limited recent
observations"* or equivalent. **Please rule on sufficiency.**

### 5.4 Adverse-performance language — specific concern

PT-2 (Drift) may need to communicate that a trend is **unfavorable**. This is the closest the
system comes to telling a user something negative about their body. **Please rule on whether
adverse-performance framing requires special treatment, additional qualifiers, or prohibition.**

## Part 6 — Other legal surfaces

| Area | Current position | Ruling requested |
|---|---|---|
| **Product neutrality** | Product-neutral guidance must remain available independently of commerce; the gate blocks copy implying a product is required | Sufficient? |
| **Score Protection** | Only completed behavior changes score. Scans, views, purchases never do. Copy implying otherwise is blocked. | Sufficient? |
| **Disclaimers** | Three classes: none · general wellness · consult a physician. Recurring/severe symptoms always route to physician consultation. | Which class per type? |
| **Locale** | **English only.** Five launch locales (es, fr, de, pt, it) ship product copy but **cannot emit any prediction** — output is suppressed. Machine translation does not bypass the gate. | Is English-only launch acceptable? |
| **Deletion/retention** | Predictions retained 24 months. Deleting source data invalidates dependent predictions. Account-wide deletion workflow **does not yet exist**. | Sufficient? |
| **Privacy** | Predictions are derived data, no new collection. Derived personal data is stored server-side. | Sufficient? |
| **Investor demos** | Demo Mode reads seeded data and writes nothing; it cannot change score. Whether demos may show **synthetic predictions** is unruled. | Ruling requested |

## Part 7 — Twelve rulings requested

1. **May each prediction type be presented as a prediction at all?**
2. **Do the terms "forecast", "outlook", "drift", and "load" create legal risk?**
3. **Should Context-Only output use different terminology entirely** to prevent it reading as personal knowledge?
4. **What qualifiers and disclaimers are required** per type and per state?
5. **What certainty language must be prohibited** beyond the current list?
6. **Is the medical/diagnostic/treatment/injury/illness/impairment/dehydration/safety prohibition list complete?**
7. **Do adverse-performance warnings (PT-2) require special treatment?**
8. **Should language differ by surface?**
9. **May investor demos show synthetic predictions**, and under what labeling?
10. **Is English-only launch acceptable**, given other locales suppress entirely?
11. **Which claims require evidence disclosure** (showing the user the data behind a claim)?
12. **Which claims must always be suppressed** regardless of evidence?

## Part 8 — Reviewer response section

> Complete this section directly. Do not rewrite the package.

**Reviewer:** ______________________ **Firm / role:** ______________________
**Date:** ____________
**Overall status:** ☐ Approved ☐ Approved With Conditions ☐ Rejected ☐ Needs Revision ☐ Not Reviewed

### 8.1 Per-type rulings

| Type | Ruling | Conditions |
|---|---|---|
| PT-1 Tomorrow Load Forecast | ☐ Approved ☐ Approved w/ Conditions ☐ Rejected ☐ Needs Revision ☐ Not Reviewed | |
| PT-2 Performance Drift | ☐ Approved ☐ Approved w/ Conditions ☐ Rejected ☐ Needs Revision ☐ Not Reviewed | |
| PT-3 Environmental Pressure Outlook | ☐ Approved ☐ Approved w/ Conditions ☐ Rejected ☐ Needs Revision ☐ Not Reviewed | |

### 8.2 Rulings on the twelve questions

| # | Question | Ruling |
|---|---|---|
| 1 | Presentable as predictions? | |
| 2 | Terminology risk | |
| 3 | Context-only terminology | |
| 4 | Required qualifiers/disclaimers | |
| 5 | Prohibited certainty language | |
| 6 | Prohibition list complete? | |
| 7 | Adverse-performance treatment | |
| 8 | Surface-specific language | |
| 9 | Investor demo synthetic predictions | |
| 10 | English-only launch | |
| 11 | Evidence-disclosure claims | |
| 12 | Always-suppressed claims | |

### 8.3 Additional required language changes

_______________________________________________

**Signature:** ______________________ **Date:** ____________

> On completion, record the outcome in `governance/REVIEW-APPROVAL-MATRIX.md` and extend
> Risk-Register **CR-1** to cover §39 explicitly. **Legal approval may not be inferred from this
> document's existence.**
