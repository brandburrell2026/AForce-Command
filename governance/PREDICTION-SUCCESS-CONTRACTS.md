# Prediction Success Contracts

**Status:** Canonical · **Established:** 2026-07-22 · **Mandated by:** `DR-008`
**Authority:** tier 3 · **Single source of truth** for prediction-type success contracts

> **A prediction type may not be activated unless it has an approved success contract.**
> A contract with **any** UNSET required field **fails closed** — the type cannot activate, and no
> value may be substituted, inferred, or defaulted.

**None of the three candidates has an approved contract. None may be activated.**

---

## 1. Completion status

| Type | Fields defined | Fields UNSET | Contract approved? | Status |
|---|---|---|---|---|
| PT-1 Tomorrow Load Forecast™ | 18 / 26 | **8** | ❌ No | **Candidate only** |
| PT-2 Performance Drift™ | 18 / 26 | **8** | ❌ No | **Candidate only** |
| PT-3 Environmental Pressure Outlook | 18 / 26 | **8** | ❌ No | **Candidate only** |

**Every UNSET field is a scientific-review item.** Per `DR-008` §2 these are deliberately left
unset rather than filled with plausible-looking values — inventing them would repeat the N-1 error.

## 2. PT-1 — Tomorrow Load Forecast™ (§22)

| # | Field | Value |
|---|---|---|
| 1 | Prediction Purpose | Project tomorrow's demand from the user's own recorded load and context patterns |
| 2 | Prediction Horizon | ~24h, single forward day |
| 3 | Input Domain | §38 edges (load ↔ outcome) · calendar-derived load · weather outlook · sleep readiness · recent intake · profile/baseline version |
| 4 | Prohibited Inputs | Medical or clinical signals · BAC · purchase or product data · another user's data · population baselines once personal data exists |
| 5 | Observed Outcome | **UNSET — pending scientific review.** What constitutes "the load that actually occurred" is not defined. |
| 6 | Outcome Source | Completed-behaviour events (command completions, logged intake) + context events |
| 7 | Success Criteria | **UNSET — pending scientific review** |
| 8 | Error Tolerance | **UNSET — pending scientific review** |
| 9 | Invalidation Rules | Source deletion · profile version change · baseline recalibration · model major bump · total evidence loss |
| 10 | Expiration Rules | Expires at end of the forecast day; stale projections discarded, never re-surfaced |
| 11 | Minimum Historical Data | DR-003 defaults (7 days / 5 comparable observations / 3 distinct days); **per-type "comparable observation" definition UNSET** |
| 12 | Backtest Dataset Requirements | **UNSET — pending scientific review** |
| 13 | Backtest Method | **UNSET — pending scientific review** |
| 14 | Success Metric | **UNSET — pending scientific review** |
| 15 | Calibration Method | **UNSET — pending scientific review** |
| 16 | Recalibration Trigger | **UNSET** — governed by N-4; no automatic trigger authorized |
| 17 | Confidence Eligibility | `emerging_personal` **maximum**. `calibrated_personal` NOT authorized (`DR-007` §A). Floor UNSET (N-1) ⇒ currently resolves to `insufficient_data`. |
| 18 | Suppression Conditions | Any gate unmet · floor UNSET · locale unvalidated · contradictions dominate · stale/unavailable signal · §42 suppression |
| 19 | §42 Language Category | `context_estimate` (context-only) · `emerging_personal_prediction` |
| 20 | Approved Surfaces | **None.** Candidate: Weekly Performance Report |
| 21 | Prohibited Surfaces | notification · guardian · hydroscan · email (strict surfaces) |
| 22 | Privacy Class | S0 projection / S1 outcome |
| 23 | Retention Class | R5 (24 months) |
| 24 | Required Versions | prediction model · prediction policy · graph derivation · profile · baseline · §42 gate-policy · locale-policy |
| 25 | Required Reviews | Legal · Scientific · Privacy · Engineering · §42 |
| 26 | Current Status | **Specified — not authorized for activation** |

## 3. PT-2 — Performance Drift™ (§27)

| # | Field | Value |
|---|---|---|
| 1 | Prediction Purpose | Project continuation of slower directional movement the user has already demonstrated |
| 2 | Prediction Horizon | Multi-day trend direction. **Never a dated failure point.** |
| 3 | Input Domain | §38 edges over an extended window · Performance Drift context signals · baseline version |
| 4 | Prohibited Inputs | Medical or clinical signals · BAC · product data · population baselines once personal data exists |
| 5 | Observed Outcome | **UNSET — pending scientific review.** What constitutes "drift continued" is not defined. |
| 6 | Outcome Source | Longitudinal completed-behaviour and outcome events |
| 7 | Success Criteria | **UNSET — pending scientific review** |
| 8 | Error Tolerance | **UNSET — pending scientific review** |
| 9 | Invalidation Rules | As PT-1, **plus baseline recalibration invalidates drift conclusions outright** — a new baseline changes what "drift" is measured against |
| 10 | Expiration Rules | Expires on window close or baseline change, whichever first |
| 11 | Minimum Historical Data | DR-003 + a **longer window than PT-1**; exact window **UNSET** |
| 12 | Backtest Dataset Requirements | **UNSET — pending scientific review** |
| 13 | Backtest Method | **UNSET — pending scientific review** |
| 14 | Success Metric | **UNSET — pending scientific review** |
| 15 | Calibration Method | **UNSET — pending scientific review** |
| 16 | Recalibration Trigger | **UNSET** — governed by N-4 |
| 17 | Confidence Eligibility | `emerging_personal` maximum; floor UNSET |
| 18 | Suppression Conditions | As PT-1, plus **any phrasing implying inevitable decline** |
| 19 | §42 Language Category | `emerging_personal_prediction` · `comparison` |
| 20 | Approved Surfaces | **None.** Candidate: Your Body's Manual (§61) |
| 21 | Prohibited Surfaces | Strict surfaces · **any surface implying decline is inevitable** |
| 22 | Privacy Class | S0 / S1 |
| 23 | Retention Class | R5 |
| 24 | Required Versions | As PT-1 |
| 25 | Required Reviews | Legal · Scientific · Privacy · Engineering · §42 |
| 26 | Current Status | **Specified — not authorized for activation** |

> **Highest language risk of the three.** Drift phrasing sits closest to implying deterioration.
> Legal review must cover "decline" phrasing explicitly, and §42's banned-term list does not by
> itself catch a compliant-sounding sentence that still implies inevitability.

## 4. PT-3 — Environmental Pressure Outlook

| # | Field | Value |
|---|---|---|
| 1 | Prediction Purpose | Project forward environmental load (heat, humidity, UV, altitude) affecting hydration demand |
| 2 | Prediction Horizon | 24–48h |
| 3 | Input Domain | Weather forecast · Climate Profile™ · location band · Environmental Pressure™ |
| 4 | Prohibited Inputs | Medical signals · **personal physiological inference presented as environmental** |
| 5 | Observed Outcome | **UNSET — pending scientific review.** Note this is partly *observed weather*, not personal outcome. |
| 6 | Outcome Source | Recorded environmental context events |
| 7 | Success Criteria | **UNSET — pending scientific review** |
| 8 | Error Tolerance | **UNSET — pending scientific review** |
| 9 | Invalidation Rules | Forecast supersession · expiry · source deletion |
| 10 | Expiration Rules | Short — superseded by each new forecast |
| 11 | Minimum Historical Data | **Context-based**: may use less personal history (DR-003), but **must be labeled context-based** |
| 12 | Backtest Dataset Requirements | **UNSET — pending scientific review** |
| 13 | Backtest Method | **UNSET.** Partly a *weather-forecast accuracy* question, not a personal-learning one — the method must separate the two. |
| 14 | Success Metric | **UNSET — pending scientific review** |
| 15 | Calibration Method | **UNSET — pending scientific review** |
| 16 | Recalibration Trigger | **UNSET** — governed by N-4 |
| 17 | Confidence Eligibility | Primarily `context_only`; personal states require personal evidence |
| 18 | Suppression Conditions | Forecast unavailable · stale · locale unvalidated · **any framing as personal learning** |
| 19 | §42 Language Category | **`context_estimate` primarily** — must never present as personal learning |
| 20 | Approved Surfaces | **None.** Candidate: Today's Command explanation |
| 21 | Prohibited Surfaces | Strict surfaces until reviewed |
| 22 | Privacy Class | S0 |
| 23 | Retention Class | R5 |
| 24 | Required Versions | As PT-1, plus **source-adapter version** (weather provider) — currently a gap (G-9) |
| 25 | Required Reviews | Legal · Scientific · Privacy · Engineering · §42 |
| 26 | Current Status | **Specified — not authorized for activation** |

> **Most likely of the three to be mistaken for personal learning.** `P42-STA-001/002` are the
> mechanical guard.

## 4.5 Field readiness classification (Phase 3.7)

Every field classified by **who must resolve it**. **No UNSET scientific field was changed to a
defined value.**

| # | Field | Classification | Same for all 3 types? |
|---|---|---|---|
| 1 | Prediction Purpose | **Defined** | per-type |
| 2 | Prediction Horizon | **Governance Defined** | per-type |
| 3 | Input Domain | **Requires Engineering Decision** (candidate list defined; exact signal mapping pending) | per-type |
| 4 | Prohibited Inputs | **Governance Defined** | yes |
| 5 | Observed Outcome | **Requires Scientific Review** | per-type |
| 6 | Outcome Source | **Defined** | per-type |
| 7 | Success Criteria | **Requires Scientific Review** | per-type |
| 8 | Error Tolerance | **Requires Scientific Review** | per-type |
| 9 | Invalidation Rules | **Governance Defined** | per-type |
| 10 | Expiration Rules | **Governance Defined** | per-type |
| 11 | Minimum Historical Data | **Requires Scientific Review** (DR-003 defaults are product policy, not science) | per-type |
| 12 | Backtest Dataset Requirements | **Requires Scientific Review** | per-type |
| 13 | Backtest Method | **Requires Scientific Review** | per-type |
| 14 | Success Metric | **Requires Scientific Review** | per-type |
| 15 | Calibration Method | **Requires Scientific Review** | per-type |
| 16 | Recalibration Trigger | **Requires Scientific Review** + **N-4 governance** | yes |
| 17 | Confidence Eligibility | **Governance Defined** (cap) + **Requires Scientific Review** (floor, N-1) | yes |
| 18 | Suppression Conditions | **Governance Defined** | per-type |
| 19 | §42 Language Category | **Requires Legal Review** | per-type |
| 20 | Approved Surfaces | **Requires Founder Decision** + Legal | per-type |
| 21 | Prohibited Surfaces | **Governance Defined** | yes |
| 22 | Privacy Class | **Defined** | yes |
| 23 | Retention Class | **Defined** (R5) | yes |
| 24 | Required Versions | **Defined** (PT-3 also needs source-adapter version — gap G-9) | yes |
| 25 | Required Reviews | **Defined** | yes |
| 26 | Current Status | **Defined** — Candidate only | yes |

### 4.6 Summary by resolver

| Resolver | Fields |
|---|---|
| **Requires Scientific Review** | **10** (5, 7, 8, 11, 12, 13, 14, 15, 16, 17-floor) |
| **Requires Legal Review** | 1 (19) |
| **Requires Founder Decision** | 1 (20) |
| **Requires Engineering Decision** | 1 (3) |
| Governance Defined | 8 |
| Defined | 6 |

### 4.7 Activation gate checklist — per type

**All must be ✅ before a type activates. Currently 0 of 3 types has any scientific field resolved.**

| # | Gate | PT-1 | PT-2 | PT-3 |
|---|---|---|---|---|
| 1 | 10 scientific fields resolved | ❌ | ❌ | ❌ |
| 2 | 14 backtest-governance items resolved | ❌ | ❌ | ❌ |
| 3 | §42 claim category legally ruled | ❌ | ❌ | ❌ |
| 4 | Approved surface (founder + legal) | ❌ | ❌ | ❌ |
| 5 | Input signal mapping (engineering) | ❌ | ❌ | ❌ |
| 6 | N-1 confidence floor set | ❌ | ❌ | ❌ |
| 7 | N-4 recalibration governance approved | ❌ | ❌ | ❌ |
| 8 | Backtest executed and passed | ❌ | ❌ | ❌ |
| 9 | Legal · Scientific · Privacy · Engineering · §42 reviews recorded | ❌ | ❌ | ❌ |
| | **Activation status** | **Candidate only** | **Candidate only** | **Candidate only** |

**No type may be marked approved or active.**

## 5. Backtest governance per type

`DR-008` §7. **All entries UNSET pending scientific review** — recorded as a required structure,
not as decisions taken.

| Item | PT-1 | PT-2 | PT-3 |
|---|---|---|---|
| Eligible historical period | UNSET | UNSET | UNSET |
| Minimum sample size | UNSET | UNSET | UNSET |
| Exclusions | UNSET | UNSET | UNSET |
| Missing-data handling | UNSET | UNSET | UNSET |
| **Leakage prevention** | UNSET | UNSET | UNSET |
| **Training vs. evaluation separation** | UNSET | UNSET | UNSET |
| Baseline comparator | UNSET | UNSET | UNSET |
| Success metric | UNSET | UNSET | UNSET |
| Calibration metric | UNSET | UNSET | UNSET |
| Error metric | UNSET | UNSET | UNSET |
| Subgroup analysis | UNSET | UNSET | UNSET |
| Failure threshold | UNSET | UNSET | UNSET |
| Rollback threshold | UNSET | UNSET | UNSET |
| Review owner | UNSET | UNSET | UNSET |

**Standing rules (not UNSET — frozen now):**

- The same records may **not** be used for both tuning and final evaluation without documenting
  the method and its limitations.
- **Validation may not be claimed from internal tests alone.**

## 6. Prohibited prediction types

Permanently unauthorized (`DR-007` §C): injury prediction · illness prediction · dehydration
diagnosis · medical-risk prediction · treatment recommendations · exact failure or crash-time
claims · product-driven outcome predictions · alcohol impairment or BAC predictions · clinical or
diagnostic predictions.

Authorizing any of these requires a **Constitutional amendment**, not a change record.

> **Traceability note:** `artifacts/aforce-os/services/bacEstimationService.ts` exists in the
> codebase. It is **out of §39 scope** and must never become a prediction type. No change made.
