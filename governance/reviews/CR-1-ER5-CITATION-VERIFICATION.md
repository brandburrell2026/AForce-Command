# CR-1 / ER-5 — Sweat Calculator Citation Verification

**Status:** Internal accuracy check (figure ↔ cited-source mapping + arithmetic/units) — **NOT a legal clearance.** Per CR-1: a figure that doesn't match its cited basis is its own substantiation defect.
**Prepared by:** performance-scientist · **Date:** 2026-07-31.
**Sources of record:** `artifacts/aforce-os/locales/en.json` (sweat.v2, lines 1642–1808); `artifacts/aforce-os/services/sweatRateEngine.ts`; `artifacts/aforce-os/data/sweatSports.ts`.

**Summary:** 6 figure→source pairs assessed — **1 SUPPORTED · 3 CHECK-PRIMARY · 2 MISMATCH.**
Arithmetic/unit sub-checks (definitively verifiable in-repo): **all PASS** except one minor internal constant (BSA reference 1.9 vs computed 1.85 m²). **No validation study and no sweat-engine test exist in the repo** — the ±15% calibration figure is unsupported as written.

> **Update 2026-07-31 — both MISMATCH copy defects FIXED.** The "±15%" line is reworded to non-validated language ("This is a modeled estimate, not a measurement…"); the per-sport attribution now reads "(Baker 2017; sport-specific values from Maughan 2007 and Godek 2010)". Applied across all 11 locales + the legacy screen. **Update 2026-07-31 (bis) — primary-source check done (see the numbered "defects" list):** it did **not** cleanly confirm — **Baker "Table 2"** is the wrong table + the sodium range runs high (needs a table-pointer fix / possible re-source to Baker 2019), and **Maughan & Shirreffs 2010 is 20(Suppl 2):59–69, not 31–42** (page mismatch). The Cheuvront/Sawka coordinates are correct but the "§C/§G/§F" section letters are internal shorthand to replace with real locators. These are citation-accuracy fixes in user-facing methodology copy — they need the performance-scientist to pick the correct source/pages (not mechanical); the underlying physiological *directions* are sound and arithmetic is clean.
>
> **Update 2026-07-31 (ter) — citation corrections APPLIED (performance-scientist pass).** All 3 CHECK-PRIMARY items are fixed across 11 locales + the legacy screen + engine/type comments: Baker **"Table 2" → "Figure 2"**; the fabricated "mean ≈ 50 mmol/L" range replaced with source-accurate **"≈ 10–90 mmol/L (≈ 230–2070 mg/L)"** (matches the app's own SODIUM_BANDS); Maughan pages **31–42 → 20(Suppl 2):59–69**; all **§C/§G/§F** shorthand replaced with paper-level ACSM/Sawka coordinates. `cite_estimate_body` kept on Baker 2017 (the 2019 by-sport numbers don't match the app's values → citing 2019 would create a *fresh* mismatch). **Update 2026-07-31 (quater) — `data/sweatSports.ts` per-sport reconciliation done (performance-scientist pass).** Foundational finding: **Baker 2017 reports NO per-sport means** (its Table 1 is variability-methodology; only an overall WBSR range ~0.5–2.0 L/h), yet 8 sports were cited to it. **Citation fixes APPLIED (value-preserving, no calc change):** Distance Running → Barnes 2019; American Football → **Godek 2005** (exact 2.14 match); Hockey → Logan-Sprenger 2011; Basketball → Broad 1996; Soccer locus → Maughan 2007 IJSNEM 17(6):583–594; Tennis/Cycling/Triathlon/CrossFit/Hot-Yoga relabeled to Baker 2017's *range* (no false per-sport mean); docblock rewritten to the true mixed provenance. **Founder decisions (recorded 2026-07-31):** **(C-1) Hot Yoga 0.85 → 1.0 L/h — APPLIED** (founder-approved; cited to Alrefai H et al. 2020, *Physiol Rep* 8(22):e14647 — Bikram session 1.54 L / ~90 min ≈ 1.0 L/h). **(C-alt) Basketball — KEPT at 1.38** (founder declined the Barnes-2019 0.95 pooled mean; 1.38 stays as the Broad 1996 male-competition anchor for a competitive user base). CrossFit locus **RESOLVED 2026-07-31** — value 1.30 kept, now cited to Cronin CC, O'Neal EK et al. 2016, *Int J Exerc Sci* 9(4) (CrossFit training: men 1.66 / women 0.89 L/h, mixed ~1.3). **ER-5 is now fully closed** — all citations resolved to real, verified sources.

---

### Item 1 — Sweat-rate formula → Sawka 2007 (ACSM Position Stand)

**(a) Verbatim.** en.json 1794–1796: `"Sweat (L) = (Pre-weight − Post-weight) + Fluid intake − Urine"` / `"Sweat rate (L/h) = Sweat / duration (h)"` — `"Source: Sawka MN et al. 2007. ACSM Position Stand. Med Sci Sports Exerc 39(2):377–390."` Engine header (lines 8–14) matches verbatim and adds `"Equation 3, p.380."`

**(b) Verdict: SUPPORTED.** The body-mass-change method (pre−post mass, corrected for fluid intake and urine, per unit time) is the standard ACSM sweat-rate method and is attributable to the 2007 ACSM Position Stand "Exercise and Fluid Replacement" (Sawka et al.). The journal coordinates — *Med Sci Sports Exerc* 39(2):377–390, 2007 — match the known citation at a textbook level of confidence.

**(c) Action:** None required. One optional confirm: the engine asserts `"Equation 3, p.380"` — the equation number/page is not surfaced in-app, but if it ever becomes UI copy, confirm against the PDF first.

---

### Item 2 — Deficit thresholds (>2% / >4%) → ACSM 2007 §C; Cheuvront & Kenefick 2014

**(a) Verbatim.** en.json 1798–1799: `">2% body weight loss → measurable performance decline; >4% → heat-illness risk."` — `"Sources: ACSM 2007 §C; Cheuvront SN, Kenefick RW. 2014. Compr Physiol 4(1):257–285."` Engine `DEFICIT_BANDS` (lines 46–72): `impaired` at 2% (`"Performance loss likely (–4 to –6%)"`), `danger` at 4% (`"Heat-illness risk"`).

**(b) Verdict: CHECK-PRIMARY.** Direction and magnitude are well-established (performance decrement emerging around >2% body-mass loss; rising heat-illness risk with greater deficits), and the *Compr Physiol* 4(1):257–285 (2014) coordinates match the known Cheuvront & Kenefick "Dehydration" review. Cannot confirm from here: (i) that the section pointer `§C` is the correct section of the 2007 stand, and (ii) that a clean ">4% = heat-illness risk" bright line is stated as such rather than a simplification of a continuous risk relationship.

**(c) Action:** Confirm against the primary that the >2%/>4% cut-points are stated numerically and that `§C` is the right locus. Note the engine-internal message `"Performance loss likely (–4 to –6%)"` (line 64) — that specific magnitude is *not* in the cited UI text and needs its own basis if it ever renders user-facing.

---

### Item 3 — Sweat-sodium ranges → Baker 2017, Table 2

**(a) Verbatim.** en.json 1801–1802: `"Population mean ≈ 50 mmol/L (1150 mg/L); range 200–2300 mg/L."` — `"Source: Baker LB. 2017. Sports Med 47(Suppl 1):111–128, Table 2."` Engine lines 74–105 encode bands via `×23`: 30→690, 50→1150, 70→1610, 90→2070 mg/L.

**(b) Verdict: arithmetic SUPPORTED / attribution CHECK-PRIMARY.**
- **Unit conversion — PASS (definitive).** Na atomic mass = 22.99 g/mol → 50 mmol/L × 22.99 = 1149.5 ≈ **1150 mg/L**. The `×23` rounding is correct and consistent across all four bands (30×23=690, 70×23=1610, 90×23=2070). ✓
- **Range check.** 200–2300 mg/L ≈ 8.7–100 mmol/L — consistent with the broad inter-individual variability Baker's review is known for, so plausible; the exact endpoints and the `Table 2` attribution need the paper.
- **"≈50 mmol/L population mean"** is a defensible rounded central value; whether Baker states "50" as a mean vs. a range midpoint needs the source.

**(c) Action:** Confirm in Baker 2017 that (i) sodium data are in **Table 2** (note: `sweatSports.ts` cites **Table 1** of the *same paper* for sweat-*rate* ranges — verify neither table is misnumbered), (ii) ≈50 mmol/L is presented as a mean/median, and (iii) 200/2300 mg/L are within the reported spread.

---

### Item 4 — Replacement strategy (100–150% within 4–6 h) → Sawka 2007 §G; Maughan & Shirreffs 2010

**(a) Verbatim.** en.json 1804–1805: `"Replace 100–150% of fluid loss within 4–6 h post-exercise; pair sodium intake with fluid for full re-equilibration."` — `"Source: Sawka 2007 §G; Maughan RJ & Shirreffs SM. 2010. Scand J Med Sci Sports 20(s2):31–42."` Engine `buildPrescription` (lines 291–292): `REPLACEMENT_FACTOR = 1.25`, `WINDOW_H = 4`.

**(b) Verdict: arithmetic SUPPORTED / citation CHECK-PRIMARY.**
- **Band placement — PASS (definitive).** 1.25 (125%) sits squarely in the stated 100–150% band and is correctly described in-code as mid-band; WINDOW_H = 4 h sits in the 4–6 h band. ✓
- The science (needing >100%, up to ~150%, of body-mass loss to fully rehydrate, with sodium co-ingestion) is a well-established Shirreffs/Maughan finding — directionally SUPPORTED. The exact coordinates for the Sawka `§G` pointer and the *Scand J Med Sci Sports* 20(s2):31–42 supplement need confirming.

**(c) Action:** Confirm the Maughan & Shirreffs 2010 supplement coordinates and that `§G` is the correct Sawka section. **Flag:** the engine also encodes a per-hour "replace 80–100% as you go" figure (`× 0.9`, line 315, comment cites `"Sawka §F"`); it is not in any UI cite block, but gate it behind the same confirmation if it ever surfaces.

---

### Item 5 — Estimate path (Baker per-sport means, Du Bois BSA, USARIEM climate, Périard acclimatization)

**(a) Verbatim.** en.json 1807: `"Anchored to per-sport population-mean sweat rates (Baker 2017), scaled by Du Bois body-surface area, RPE-mapped intensity, USARIEM-style climate factors, and Périard 2015 acclimatization adjustment."` en.json 1665/1773 also credit the per-sport means to **"Baker 2017"** alone.

**(b) Verdict: MISMATCH (attribution).** The UI credits the per-sport sweat rates to **Baker 2017 only**, but `sweatSports.ts` shows the numbers come from **three** sources: most sports use Baker 2017, but **Soccer = Maughan 2007** (Br J Sports Med 41:e1) and **American Football = Godek 2010** (J Athl Train 45(4):364–371). A figure whose value comes from Maughan/Godek but is cited on-screen as "Baker 2017" is exactly the figure≠basis defect CR-1 targets. The other three attributions are used correctly:
- **Du Bois BSA — correct.** Formula in code (`0.007184 × W^0.425 × H^0.725`, line 179) is the genuine Du Bois & Du Bois 1916 equation. ✓ *Minor sub-defect:* the reference-athlete constant is hard-coded as **1.9 m²** (line 260) but the formula for the stated 70 kg/175 cm athlete yields **≈1.85 m²**; this makes estimates ~2–3% low for the reference case. Low priority, internal.
- **"USARIEM-style" climate — honestly hedged.** "style" correctly signals the piecewise coefficients (+4%/°C, +0.4%/RH%, 1.6× cap) are AForce's own approximation, not a USARIEM-published equation. Acceptable as labeled.
- **Périard 2015 acclimatization — attribution OK.** *Scand J Med Sci Sports* 25(s1):20–38 matches the known Périard/Racinais/Sawka heat-acclimation review. The specific magnitudes it drives (+8% sweat rate, −30% sweat [Na⁺], engine lines 204–211/405) are AForce assumptions → CHECK-PRIMARY on those two numbers, but the source is appropriate.

**(c) Action to fix:** Change the per-sport attribution from a bare "(Baker 2017)" to reflect the mixed sourcing — e.g. "population-mean sweat rates (Baker 2017; sport-specific values from Maughan 2007 and Godek 2010)" — or restrict the estimate model to Baker-sourced sports. Separately: correct 1.9→1.85 m² (or relabel as a deliberate rounded anchor), and confirm +8%/−30% acclimatization magnitudes against Périard.

---

### Item 6 — Calibration "±15% of measured rate" → (no source cited)

**(a) Verbatim.** en.json 1808: `"Calibration target: ±15% of measured rate at moderate intensity, thermoneutral conditions. Always confirm with a scale for clinical decisions. Not a medical device."` No citation attached. Grep confirms the string exists **only as UI copy** (en + 9 other locales) with **no backing** — no validation report in `docs/`, `governance/`, or `services/`, and **no sweat-engine test file exists at all**.

**(b) Verdict: MISMATCH (unsupported validation claim).** "target" softens it toward aspirational, but "±15% of measured rate" reads as an *achieved accuracy* — a validation result. No study, dataset, or test substantiates that the estimate path lands within ±15% of scale-measured rate under any condition. Per CR-1 this is an unsupported validation claim regardless of physiology, and it is the highest-exposure line in the block (an accuracy claim sitting next to "Not a medical device").

**(c) Action to fix (pick one before launch):**
1. **Preferred:** remove the implied validated number — e.g. "This estimate is a modeled approximation, not a measurement — always confirm with a scale." Drop "±15%" until a study exists.
2. Keep a numeric target only if relabeled unambiguously as a *design goal, not a measured result* ("design target, not yet validated") AND an actual calibration test (measured-vs-estimated on a reference dataset) is stood up in-repo. Absent (2), option (1) ships.

---

## Defects to fix before launch

1. **[MISMATCH — ✅ FIXED 2026-07-31] ±15% calibration line.** Reworded to "This is a modeled estimate, not a measurement — always confirm with a scale for clinical decisions. Not a medical device." (11 locales + legacy screen). The "±15%" number is gone; if a real calibration study is later done, a validated figure can be reintroduced with its evidence + a test.
2. **[MISMATCH — ✅ FIXED 2026-07-31] Per-sport mean attribution.** Now reads "(Baker 2017; sport-specific values from Maughan 2007 and Godek 2010)" in the methodology cite; the short label → "Anchored estimate (published means)" and the helper drops the single-source "(Baker 2017)". (11 locales + legacy screen.)
3. **[✅ FIXED] Baker 2017 "Table 2" → "Figure 2" + range corrected (en.json 1801–1802).** Primary-source check (2026-07-31, PMC5371639 full text): **Table 2 is a table of intra/inter-individual variability _factors_ (intensity, environment, sex, acclimation…), not a sweat-sodium range table** — the sodium data is in the text + Figure 2. Baker 2017 reports whole-body sweat [Na⁺] ≈ 10–70 mmol/L (local ≈ 10–90); the app's "≈ 50 mmol/L mean; range 200–2300 mg/L (≈ 8.7–100 mmol/L)" runs wider/higher and "50" is **not** stated as a mean. **Fix:** correct the table pointer and reconcile the numbers, or re-source to **Baker et al. 2019** (the normative "by sport" update, which the per-sport rates likely trace to anyway). Performance-scientist to confirm against the PDF + decide the numbers.
4. **[✅ FIXED] Maughan & Shirreffs 2010 page range → 20(Suppl 2):59–69 (en.json 1805).** Primary-source check: "Development of hydration strategies…" is *Scand J Med Sci Sports* 2010;**20(Suppl 2):59–69** (PubMed 20840563) — **not the cited "20(s2):31–42."** Either the pages are wrong or "31–42" is a different article in the same supplement. **Fix:** confirm the intended article + correct the pages.
5. **[✅ FIXED] Cheuvront 2014 "§C" / Sawka "§G/§F" shorthand replaced with paper-level coordinates.** Coordinates confirmed real (Cheuvront & Kenefick, *Compr Physiol* 2014;4(1):257–285; Sawka et al., *Med Sci Sports Exerc* 2007;39(2):377–390 — the ACSM Position Stand). The >2% performance / higher-deficit heat-illness direction and the 100–150% / 4–6 h guidance are standard. **But the "§C", "§G", "§F" section letters are AForce internal shorthand, not the papers' actual section labels** — replace each with a verifiable locator (page/figure) or drop the section pointer.
6. **[Minor — internal] BSA reference constant.** `referenceBsa = 1.9` (`sweatRateEngine.ts:260`) vs Du Bois-computed ~1.85 m² for 70 kg/175 cm. ~2–3% low bias on reference case; correct or relabel.
7. **[Confirm] Non-UI figures.** The engine-internal `–4 to –6%` performance-loss message (line 64), the per-hour `80–100%` figure (line 315), and the +8%/−30% acclimatization magnitudes are not in UI cite blocks today — gate any future surfacing behind the same source confirmation.

**Verified in-repo (definitive, no primary needed):** ×23 mmol→mg conversion correct and consistent across all four sodium bands; REPLACEMENT_FACTOR 1.25 and WINDOW_H 4 sit correctly mid-band of the cited 100–150% / 4–6 h; Du Bois formula transcribed correctly. **Not verified:** no sweat-engine unit test exists — recommend one be added alongside fixing defect #1.

*This is an internal accuracy pass. It does not clear the Sweat Calculator; the external CR-1 review still governs the surface. Defects 1–2 are copy fixes; 3–5 need the primary papers; 6 is an internal constant.*
