# R-28 — Investor & Demo Material Audit Plan

**Status:** ⏳ **PLAN ONLY — no audit performed.** R-28 remains **OPEN**.
**Prepared:** 2026-07-22 (Phase 3.7)

> **Nothing below has been audited.** Per the truth rules, unavailable material is **not** audited
> by inference. This plan lists exactly what is required to complete R-28.

---

## 1. Materials identified in the repository

| # | Material | Location | In scope | Audited? |
|---|---|---|---|---|
| M1 | Investor pitch deck (source) | `artifacts/aforce-pitch/src/` | ✅ | ❌ **No** |
| M2 | Slide guide | `artifacts/aforce-pitch/SLIDE-GUIDE.md` + `.pdf` | ✅ | ❌ **No** |
| M3 | Investor demo beats | `artifacts/aforce-os/services/demo/investorDemoBeats.ts` | ✅ | ❌ **No** |
| M4 | Seeded demo profile | `artifacts/aforce-os/data/demoProfile.ts` | ✅ | ⚠️ **Partial** — confirmed as the seeded source; content not audited |
| M5 | Demo Mode service | `artifacts/aforce-os/services/demoMode.ts` | ✅ | ✅ **Verified clean** (Phase 3.5): 725 bytes, zero score references, no reducer dispatch |
| M6 | Investor-demo readiness doc | `artifacts/aforce-os/docs/investor-demo-readiness.md` | ✅ | ❌ **No** |
| M7 | Exported spec PDFs (7) | `exports/*.pdf` | ✅ | ❌ **No** |
| M8 | Phantom RFP / tearsheet | `exports/phantom-rfp/` | ✅ | ❌ **No** |
| M9 | Command center / pitch web surfaces | `artifacts/aforce-command-center/`, `aforce-pitch/public/` | ✅ | ❌ **No** |

**Not in the repository and therefore not auditable here** — must be supplied:

| # | Material |
|---|---|
| X1 | Any investor deck maintained outside the repo (Google Slides, Keynote, PDF sent to investors) |
| X2 | Lender or bank materials |
| X3 | Partner/enterprise one-pagers |
| X4 | Website marketing copy as currently deployed (`drinkaforce.com`) |
| X5 | Recorded demo videos or screen recordings |
| X6 | Any data room contents |
| X7 | Email or memo claims made to investors |

## 2. Audit checks (11 required)

Applied to every material in scope.

| # | Check | What fails it |
|---|---|---|
| **C1** | **Score changes without completed behavior** | Any slide, script, or beat showing HydroState rising from a scan, view, purchase, or the passage of time |
| **C2** | **Demo Mode bypasses Score Protection** | Any demo path writing score. *(M5 verified clean; M3/M4 unaudited)* |
| **C3** | **Predictions shown as live when simulated** | Any prediction shown at all — **§39 does not exist**, so any predictive demo is necessarily synthetic |
| **C4** | **Architecture labeled built when only specified** | "Full architecture built" · "complete OS" · "all engines implemented" · any Built/Live claim contradicting the Capability Status Register |
| **C5** | **Unsupported superiority claims** | "only" · "first" · "no competitor" · "most advanced" without substantiation *(overlaps R-27)* |
| **C6** | **Clinical or diagnostic implications** | Any framing implying diagnosis, treatment, injury/illness prediction, or medical risk |
| **C7** | **Unsupported validation claims** | "validated" · "clinically proven" · "scientifically validated" — **no validation exists** |
| **C8** | **Schema-deployment claims** | Any claim the intelligence layer is deployed. **The graph schema exists in no database (R-21).** |
| **C9** | **External-review claims** | Any claim of legal, scientific, privacy, security, clinical, or partner approval. **None exists.** |
| **C10** | **English-only limitation** | Any claim of multilingual intelligence. **Only English is §42-validated.** |
| **C11** | **Feature status accuracy** | Every capability claim reconciled against `CAPABILITY-STATUS-REGISTER.md` |

## 3. Known-answer reference (for auditors)

| Claim an auditor may encounter | Truth as of 2026-07-22 |
|---|---|
| "Prediction engine" | **Specified.** No algorithm exists. Four gates open. |
| "Performance DNA" | **Specified.** No implementation. |
| "Knowledge graph" | **Partially Built.** Schema defined, **deployed nowhere**. |
| "§42 language gate" | **Partially Built.** No caller. |
| "Living Performance Model" | **Live** — daily lesson only. Expansion is Specified. |
| "Validated" / "clinically reviewed" | **Nothing in the repository is validated or reviewed.** |
| "Multilingual" | Product copy in 6 locales; **intelligence is English-only**. |
| "Full architecture built" | Contradicts the Capability Status Register. |

## 4. Method

1. Inventory — confirm M1–M9 and obtain X1–X7.
2. Per material, run C1–C11 and record **pass / fail / not-applicable with evidence**.
3. Every failure records: exact wording · location · check failed · corrected wording · reviewer.
4. **Do not infer.** A material not supplied is recorded as **"not audited"**, never as "passed".
5. Cross-reference R-27 for overlapping superiority claims.

## 5. Closure criteria

R-28 closes only when: M1–M9 audited with recorded results · X1–X7 supplied and audited or
explicitly declared non-existent · every failure dispositioned · founder sign-off recorded.

**Partial audit does not close R-28.** It may reduce severity if the residual scope is recorded.

## 6. Required from the founder

1. **Supply or declare non-existent:** X1–X7.
2. **Authorize** the audit of M1–M9.
3. **Rule** on whether investor demos may show synthetic predictions at all — this is also
   question 9 in the legal-review package.

**Highest-priority material:** **M3 `investorDemoBeats.ts`** — a scripted demo sequence is the most
likely place for a score to move without completed behavior (C1) or for a capability to appear
more finished than it is (C4).
