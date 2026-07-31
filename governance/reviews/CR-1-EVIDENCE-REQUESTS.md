# CR-1 — Evidence Requests (open register)

**Status:** OPEN register — tracks the product-specific evidence that must be **on file** before certain claims can stand at launch. Derived from `governance/reviews/CR-1-SCIENTIFIC-SUBSTANTIATION-PASS.md` (the NEEDS-EVIDENCE-ON-FILE items). **Prepared:** 2026-07-31.
**Governed by:** `docs/COMPLIANCE_FRAMEWORK.md` §2/§14 · FTC "competent and reliable scientific evidence" standard · `governance/CLAIMS-REGISTER.md`.

> **What this is:** a checklist of documents to gather. General physiology does **not** satisfy these — each is a claim about *this product* and needs *this product's* data. Until the document is attached **and** validated, the claim it gates cannot be treated as substantiated.
>
> **Two of these gate claims that are LIVE in the app right now** (ER-1, ER-2) — **substantiate-or-remove before launch**; the copy currently ships an unsubstantiated claim. (ER-3 was RESOLVED 2026-07-31 by genericizing the competitor table — PR #413.)

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
| **ER-1** | **"72 Trace Minerals"** — `locales/*.json` `sys_minerals_k` (`en.json:1715`); marketing "72 minerals" framing | **LIVE — unsubstantiated** | **Certificate of Analysis** proving ≥72 distinct minerals and per-serving content in the actual formulation | Formulation lab / manufacturer → performance-scientist | OPEN | Keeping the "72" count anywhere (app + marketing). No CoA ⇒ remove/soften before launch |
| **ER-2** | **"4-Hour Recovery Window" / "Time-released absorption profile"** — `sys_window` / `sys_window_v` (`en.json:1719–1720`) | **LIVE — unsubstantiated** | **Pharmacokinetic / time-release data** showing the 4-hour window and time-released absorption for this formulation | Formulation lab → performance-scientist | OPEN | Keeping the "4-hour" / "time-released" claim. No PK data ⇒ remove before launch |
| **ER-3** | ~~Named-competitor characterizations~~ ("Sugar-driven · table salt", "Salt-bomb · no minerals", "Sugar + salt · no structuring") | ~~LIVE~~ → **RESOLVED (genericized)** | n/a — founder chose the genericize path, so no per-brand sourcing needed | Founder decision (done) | **RESOLVED 2026-07-31 (PR #413)** | Table de-branded to categories (Sports drinks / Salt mixes / ORS mixes), additive profiles, category-typical `~` sodium; named brands + pejorative/absence claims removed. Reinstating named-brand comparisons would re-open this (need sourced nutrition facts) |
| **ER-4** | **HydroScan "Hydrates at {N}% efficiency"** — `services/hydrationScanService.ts:71–72`, formula `:61–68` | Dark (`hydro_scan_2_enabled` OFF) | (i) documented **derivation** of the 0.4/0.3/0.2/−0.1 weighting + the `hydrationSpeed` water-availability proxy; (ii) **validation** against a measured hydration outcome (e.g. Beverage Hydration Index / fluid-retention testing) showing the % tracks real absorption | Data/formulation → performance-scientist | OPEN | Enabling the efficiency % at all. Even with evidence, relabel away from "efficiency" per the science pass (item 1) and never render it on competitor products |
| **ER-5** | **In-app citation numbers** — `en.json:1794–1810` (Sawka 2007, Baker 2017, Cheuvront 2014, Maughan & Shirreffs 2010) | LIVE | **Number-to-source verification**: confirm each rendered in-app figure (sweat-sodium ranges, >2% decrement, replace 100–150% in 4–6 h, ±15% calibration) actually maps to the cited paper | performance-scientist (internal verification — no new lab data) | OPEN | Trust of the whole Sweat Calculator surface — a figure that doesn't match its cited basis is its own substantiation defect |
| **ER-6** | **Absorption / "bioavailable" claims** — currently **removed** from copy (#411 reworded "marine bioavailable" → "marine-sourced") | Removed | **Bioavailability / absorption testing** for the formulation's minerals | Formulation lab → performance-scientist | OPEN (low priority) | Only gates *reinstating* any absorption/bioavailability/"cellular uptake" claim. Not needed while the copy stays "marine-sourced" |
| **ER-7** | **Ingredient structure-function** (sea moss / dulse / chlorella) — currently **removed** to plain whole-food descriptors (#411) | Removed | Ingredient-specific human substantiation at the actual dose (and even then, medical/organ framing like "thyroid"/"binds heavy metals" stays barred under §2) | Formulation lab → performance-scientist + regulatory reviewer | OPEN (low priority) | Only gates *reinstating* any ingredient benefit claim beyond the current plain descriptors |

---

## Priority

- **Before launch (gate live claims):** ER-1, ER-2, ER-5. Each is either substantiated (doc attached + validated) or the claim is removed/reworded — no "pending" claims ship. (ER-3 resolved via genericize, PR #413.)
- **Before enabling the flag:** ER-4 (with the efficiency % relabel).
- **Only if reinstating a dropped claim:** ER-6, ER-7 — not blocking while the #411 conservative wording stands.

*This register does not clear any claim. It names the document each claim needs. Attaching and validating a document, then the external CR-1 reviewer's sign-off, is what clears a claim into `CLAIMS-REGISTER.md`.*
