# CR-1 — Evidence Requests (open register)

**Status:** OPEN register — tracks the product-specific evidence that must be **on file** before certain claims can stand at launch. Derived from `governance/reviews/CR-1-SCIENTIFIC-SUBSTANTIATION-PASS.md` (the NEEDS-EVIDENCE-ON-FILE items). **Prepared:** 2026-07-31.
**Governed by:** `docs/COMPLIANCE_FRAMEWORK.md` §2/§14 · FTC "competent and reliable scientific evidence" standard · `governance/CLAIMS-REGISTER.md`.

> **What this is:** a checklist of documents to gather. General physiology does **not** satisfy these — each is a claim about *this product* and needs *this product's* data. Until the document is attached **and** validated, the claim it gates cannot be treated as substantiated.
>
> **Update 2026-07-31:** ER-1, ER-2, ER-3 resolved — ER-1/ER-2 **held** (claims removed pending evidence, like the marketing fix), ER-3 **genericized** (PR #413). **ER-5 verification done** (`CR-1-ER5-CITATION-VERIFICATION.md`); its **2 MISMATCH copy defects are now FIXED** (±15% line reworded to non-validated; per-sport attribution corrected to Maughan 2007 / Godek 2010). What remains on ER-5: **3 CHECK-PRIMARY** items that need the actual papers confirmed (section/table pointers) + a minor internal BSA constant — no unsubstantiated *claim* ships. ER-4 stays behind its dark flag.

---

## Process (per item)

1. **Provider** obtains the document (manufacturer/formulation lab for CoA/PK/bioavailability; founder for competitor sourcing).
2. **Validator** (performance-scientist) confirms the document actually supports the claim *as worded*.
3. **External regulatory reviewer** (CR-1 proper) blesses final wording → approved phrasing recorded in `CLAIMS-REGISTER.md`.
4. **If the evidence cannot be obtained** → the claim is **removed/reworded** before launch (do not ship on the "pending" status).

Status key: **OPEN** (not started) · **REQUESTED** (asked, awaiting doc) · **RECEIVED** (doc in hand, not yet validated) · **VALIDATED** (supports claim as worded) · **REMOVED** (claim dropped instead).

---

## Register

| ID | Claim / surface (file:line) | Live status | Evidence required | Provider → Validator | Status | Gates |
|---|---|---|---|---|---|---|
| **ER-1** | **"72 Trace Minerals"** — was `sys_minerals_k`; also the seamoss line "…72 trace minerals critical to cellular function" | ~~LIVE~~ → **HELD (count removed)** | **Certificate of Analysis** proving ≥72 distinct minerals + per-serving content — required only to *restore* the "72" count | Formulation lab → performance-scientist | **HELD 2026-07-31** | Interim: "72" dropped → "Trace Minerals"; seamoss line reworded (no count, no "critical to cellular function"). Attach CoA to restore the number |
| **ER-2** | **"4-Hour Recovery Window" / "Time-released absorption profile"** — was the 4th AFORCE-SYSTEM row | ~~LIVE~~ → **HELD (row removed)** | **Pharmacokinetic / time-release data** — required only to *restore* the row | Formulation lab → performance-scientist | **HELD 2026-07-31** | Interim: the row was removed from both sweat screens (no truthful non-PK residual). Attach PK data to restore it |
| **ER-3** | ~~Named-competitor characterizations~~ ("Sugar-driven · table salt", "Salt-bomb · no minerals", "Sugar + salt · no structuring") | ~~LIVE~~ → **RESOLVED (genericized)** | n/a — founder chose the genericize path, so no per-brand sourcing needed | Founder decision (done) | **RESOLVED 2026-07-31 (PR #413)** | Table de-branded to categories (Sports drinks / Salt mixes / ORS mixes), additive profiles, category-typical `~` sodium; named brands + pejorative/absence claims removed. Reinstating named-brand comparisons would re-open this (need sourced nutrition facts) |
| **ER-4** | **HydroScan "Hydrates at {N}% efficiency"** — `services/hydrationScanService.ts:71–72`, formula `:61–68` | Dark (`hydro_scan_2_enabled` OFF) | (i) documented **derivation** of the 0.4/0.3/0.2/−0.1 weighting + the `hydrationSpeed` water-availability proxy; (ii) **validation** against a measured hydration outcome (e.g. Beverage Hydration Index / fluid-retention testing) showing the % tracks real absorption | Data/formulation → performance-scientist | OPEN | Enabling the efficiency % at all. Even with evidence, relabel away from "efficiency" per the science pass (item 1) and never render it on competitor products |
| **ER-5** | **In-app citation numbers** — `en.json:1794–1810` (Sawka 2007, Baker 2017, Cheuvront 2014, Maughan & Shirreffs 2010) | LIVE | Verification done (`CR-1-ER5-CITATION-VERIFICATION.md`): **1 SUPPORTED · 3 CHECK-PRIMARY · 2 MISMATCH**; arithmetic all PASS | performance-scientist (done) → primary-source checks | **VERIFIED 2026-07-31 — 2 MISMATCH fixed** | Both copy defects fixed: **(1)** "±15%" reworded to non-validated language; **(2)** per-sport attribution corrected to credit Maughan 2007 / Godek 2010. Remaining: 3 CHECK-PRIMARY (Baker Table 2, Cheuvront §C, Sawka §G coords) + a minor BSA constant — need the papers, no claim risk |
| **ER-6** | **Absorption / "bioavailable" claims** — currently **removed** from copy (#411 reworded "marine bioavailable" → "marine-sourced") | Removed | **Bioavailability / absorption testing** for the formulation's minerals | Formulation lab → performance-scientist | OPEN (low priority) | Only gates *reinstating* any absorption/bioavailability/"cellular uptake" claim. Not needed while the copy stays "marine-sourced" |
| **ER-7** | **Ingredient structure-function** (sea moss / dulse / chlorella) — currently **removed** to plain whole-food descriptors (#411) | Removed | Ingredient-specific human substantiation at the actual dose (and even then, medical/organ framing like "thyroid"/"binds heavy metals" stays barred under §2) | Formulation lab → performance-scientist + regulatory reviewer | OPEN (low priority) | Only gates *reinstating* any ingredient benefit claim beyond the current plain descriptors |

---

## Priority

- **Before launch:** ER-5's 2 MISMATCH copy defects are **fixed**; only the **3 CHECK-PRIMARY** items remain (confirm section/table pointers against the actual papers — no claim risk, an accuracy-of-citation check). ER-1/ER-2 **held**, ER-3 **genericized**. Attach the CoA (ER-1) / PK data (ER-2) to *restore* those claims later.
- **Before enabling the flag:** ER-4 (with the efficiency % relabel).
- **Only if reinstating a dropped claim:** ER-6, ER-7 — not blocking while the #411 conservative wording stands.

*This register does not clear any claim. It names the document each claim needs. Attaching and validating a document, then the external CR-1 reviewer's sign-off, is what clears a claim into `CLAIMS-REGISTER.md`.*
