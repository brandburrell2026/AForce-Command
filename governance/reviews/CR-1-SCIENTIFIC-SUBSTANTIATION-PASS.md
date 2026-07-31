# CR-1 — Scientific Substantiation Pass (Internal)

**Status:** Internal scientific worksheet — **NOT a legal clearance, NOT a launch approval.** Feeds the regulatory/claims reviewer (still unbooked) per `governance/reviews/CR-1-CLAIMS-REVIEW-PACKAGE.md` Part 5. Nothing here clears any claim.
**Prepared by:** performance-scientist · **Date:** 2026-07-31 · **Standard applied:** FTC "competent and reliable scientific evidence" + `docs/COMPLIANCE_FRAMEWORK.md` §2 (Observation, Never Diagnosis) / §14 (Health Disclaimers).
**Wording confirmed live at each cited location on 2026-07-31.** File paths resolve under `artifacts/aforce-os/` (app) and `aforce-site/` (marketing).

**Honesty constraints honored:** no specific study is asserted to exist unless already cited in-repo; where general physiology is used the finding is named and unverifiable specifics are marked "needs citation check." Throughout, *physiologically plausible in general* is separated from *proven for THIS product as worded* — the second is what FTC requires and is, for most items below, absent.

---

## Executive summary (read first)

- **Salvageable with a qualifier / rewrite (5):** the HydroScan efficiency % *for AForce only* (relabel as a transparent formulation index, never a physiological "efficiency"); the urine verdicts (rewrite to observation-only, drop "Correction"/"before performance is affected"); "Heat Guard" (reframe as ordinary electrolyte replacement); the competitor table (keep only each brand's published-nutrition-facts numbers, delete the characterizations); pH 8.8 (hold to the existing brand-standard framing, never a cellular-uptake mechanism).
- **Must remove or substantiate-on-file before it can stand (5):** Chlorella **"binds heavy metals and supports oxygen transport"** (remove — detox/medical, disease-adjacent hard stop); Dulse **"thyroid + metabolic recovery"** (remove "thyroid" — organ-function claim); **"drive cellular recovery" / "structured water for cellular uptake"** (unsupported mechanism); the quantified anchors **"72 trace minerals," "marine bioavailable," "4-Hour Recovery Window," pH 8.8** (need product-specific CoA / bioavailability / PK data on file); the **efficiency % rendered on scanned competitor products** (unsubstantiated quantified superiority — remove).
- **Hard diagnosis red-lines (COMPLIANCE §2):** urine **"Hydration Correction Recommended"** + **"Address before performance is affected"**; chlorella **"binds heavy metals"**; dulse **"thyroid."** These detect/correct/treat a physiological state and cannot ship in current form regardless of plausibility.
- **Cross-cutting:** none of these strings trip the §42 *absolute banned-vocabulary* list (risk/prevent/treat/cure/deficiency…). That is exactly why they are dangerous — they are **semantic conflations the language guard cannot catch**. "Correction," "efficiency," "cellular recovery," "Heat Guard," and "thyroid" are all forbidden *meanings* wearing permitted *words*.
- **Non-English intelligence copy (item 6):** outside the scientific pass's competence to bless — English is the only §42-validated evidence base. Keep runtime-suppressed until each locale's 8-item review runs.

---

## 1. "Hydrates at {N}% efficiency"

**(a) Claim as worded.** `efficiencyLabel()` → `` `Hydrates at ${Math.round(efficiency*100)}% efficiency` `` at `services/hydrationScanService.ts:71–72`; formula `computeHydrationEfficiency` at `:61–68`: `efficiency = M*0.4 + W*0.3 + LS*0.2 − S*0.1`, where `M = electrolytes/100`, `W = hydrationSpeed/100`, `LS = 1 − sugar/100`, `S = sugar/100`, clamped [0,1]. Rendered for **any** scanned product including competitors.

**(b) Scientific status — UNSUPPORTED as worded.** "Hydration efficiency" in physiology would denote a measured absorption/fluid-retention outcome — e.g. the *Beverage Hydration Index* (BHI) literature, which measures urine output over hours after a fixed volume (Maughan et al.; **needs citation check** on the specific index). This code computes **none of that**. It is a fixed 0.4/0.3/0.2/−0.1 weighting of three catalog attributes (`electrolytes`, `hydrationSpeed`, `sugar`), with `hydrationSpeed` self-described in the comment as a "proxy" for water availability. The weights have no stated external derivation. The rendered noun ("efficiency," a physiological absorption metric) does not match the variable computed (a marketing composite of nutrition-panel fields). **This is a false-precision claim.**

**(c) What would substantiate it as worded.** (i) A documented derivation of the weighting and the choice of `hydrationSpeed` as a water-availability proxy; (ii) validation of the composite against an actual measured hydration outcome (e.g. BHI-style fluid-retention testing) showing the % tracks real absorption; (iii) for competitor products, verified nutrition inputs for each competitor AND evidence the same formula is valid off-label. General rehydration literature does **not** supply any of this — it is product/method-specific and currently absent.

**(d) Disposition.**
- **Competitor products: REMOVE.** A quantified physiological-efficiency number computed for a named competitor from your own weighting is the single highest FTC + Lanham exposure in the set and has zero substantiation.
- **AForce products: QUALIFY.** Relabel away from "efficiency." Exact replacement: **"Formulation score {N}/100 — based on mineral load and low added sugar"** with an adjacent methodology tap ("How we score: weighted from listed minerals, hydration speed, and sugar. Not a measured absorption rate."). This keeps it honest as an internal index and stops it masquerading as physiology.

**(e) Diagnosis red-line.** Not diagnosis, but a **quantified-efficacy overclaim**; the word "efficiency" is the problem — it asserts a measured physiological rate the app never measures.

---

## 2. Urine verdicts — "Correction Recommended" / "before performance is affected" / "mineral recovery support"

**(a) Claim as worded.** `services/urineHydrationCheck.ts`, `dark_yellow` branch `:94–98`: verdict **"Hydration Correction Recommended"**; detail **"Hydration is trailing the demand curve. Address before performance is affected."**; recommendation **"Recommended: 16 oz water + AForce for mineral recovery support. Recheck in 30 minutes."** Disclaimer present at `:39–40`: "Urine color is a general hydration signal and not a medical diagnostic tool." (`yellow` branch `:84–87` "Hydration Support Suggested" is the softer sibling.)

**(b) Scientific status — PARTIALLY SUPPORTED (signal), UNSUPPORTED (verdict register).** Urine color as a *rough* hydration indicator is a real, established relationship (darker color ↔ higher concentration/lower recent fluid intake; the Armstrong urine-color chart line of work — **needs citation check** on specifics). That supports an *observation*. It does **not** support "Correction," "trailing the demand curve," or "before performance is affected": those assert (i) a physiological deviation exists, (ii) it must be corrected, and (iii) a performance consequence is impending — a detect-and-correct sequence the color read cannot deliver, especially from a manual color match.

**(c) What would substantiate it as worded.** Nothing available brings "Correction Recommended" and "before performance is affected" within the observation register — these are structurally diagnostic/predictive and would require exactly the medical-device framing the disclaimer disclaims. The underlying *observation* needs no product data.

**(d) Disposition — QUALIFY (mandatory rewrite).** Exact replacements, staying observation-only and keeping the disclaimer adjacent to the verdict (not just in a constant):
- Verdict: **"Deeper Color — A Good Time for Fluids"**
- Detail: **"Deeper urine color often tracks with lower recent fluid intake."**
- Recommendation: **"16 oz water + AForce. Recheck in 30 minutes."** (drop "mineral recovery support" — see item 3 on unsubstantiated mineral-recovery mechanism; the pour itself is fine as a ritual.)
- Apply the same de-escalation to `yellow`: "A small correction now" → "A good moment to top up."

**(e) Diagnosis red-line — HARD STOP.** "Hydration **Correction** Recommended" + "**Address before performance is affected**" crosses observation → detecting and correcting a physiological state, and adds a performance-consequence prediction. Violates COMPLIANCE §2 ("No output may state or imply a medical condition… never diagnoses, treats"). The disclaimer does not cure a verdict that itself overshoots.

---

## 3. "drive cellular recovery…"; Chlorella "binds heavy metals + oxygen transport"; Dulse "thyroid + metabolic recovery"

**(a) Claim as worded** (`locales/en.json`):
- `ri_body` `:1708`: "AForce uses {{mg}}mg of sodium paired with **marine bioavailable minerals and pH 8.8 alkaline structuring to drive cellular recovery** — not flood you with salt."
- `sys_ph_v` `:1718`: "**Structured water for cellular uptake.**" · `sys_minerals_k` `:1715`: "**72 Trace Minerals**" · `sys_window` `:1719–1720`: "**4-Hour Recovery Window** / Time-released absorption profile."
- `ing_chlorella_line` `:1725`: "**Binds heavy metals and supports oxygen transport.**"
- `ing_dulse_line` `:1727`: "**Iodine-rich for thyroid + metabolic recovery.**"

**(b) Scientific status.**
- **"drive cellular recovery" / "structured water for cellular uptake" — UNSUPPORTED.** "Structured water" is not a recognized concept in mainstream physiology; there is no accepted mechanism by which beverage pH or "structuring" enhances cellular water uptake. Blood/intracellular pH is tightly homeostatically regulated independent of drink pH. "Drive cellular recovery" is a mechanistic outcome claim with no product evidence.
- **"marine bioavailable minerals" / "72 trace minerals" — PLAUSIBLE INGREDIENT, UNSUPPORTED AS QUANTIFIED/COMPARATIVE.** Seaweed (Irish sea moss) does contain a broad mineral profile (general fact), but "72" is a specific count and "bioavailable" is an absorption superiority claim — both require product-specific lab data.
- **Chlorella "binds heavy metals" — UNSUPPORTED for this product + disease-adjacent.** There is preliminary/animal literature on chlorella and heavy-metal binding (**needs citation check**; largely rodent/in-vitro, not established for humans at food doses). As worded in a hydration product it reads as a **detox/chelation** claim — a medical action.
- **Chlorella "supports oxygen transport" — UNSUPPORTED as worded.** Chlorella contains iron/chlorophyll (general fact), but "supports oxygen transport" is an unproven mechanistic leap for this product.
- **Dulse "iodine-rich for thyroid" — PLAUSIBLE PHYSIOLOGY, UNACCEPTABLE FRAMING.** Iodine is genuinely required for thyroid-hormone synthesis (established), and dulse contains iodine — but naming an **organ/gland** ("thyroid") is a structure-function/health claim, and seaweed iodine content is highly variable (a real safety consideration, not a benefit to tout). "Metabolic recovery" is an additional unsupported outcome claim.

**(c) What would substantiate as worded.** Product-specific data on file, not general physiology: a **Certificate of Analysis** proving the "72" mineral count and the actual mineral/iodine content; **bioavailability/absorption testing** for "bioavailable" and "cellular uptake"; **pharmacokinetic data** for "4-Hour Recovery Window / time-released absorption profile"; for chlorella, human heavy-metal-binding and oxygen-transport evidence at the actual dose (and even then the framing is medical and would not clear §2). None of these are general-literature-satisfiable.

**(d) Disposition.**
- Chlorella `:1725`: **REMOVE.** Replace with a permitted descriptor only, e.g. **"Freshwater green algae — a whole-food source of chlorophyll and minerals."**
- Dulse `:1727`: **REMOVE "thyroid + metabolic recovery."** Replace: **"Atlantic seaweed — a natural source of iodine and trace minerals."** (Gate even this behind the CoA, given iodine variability.)
- `ri_body` `:1708` / `sys_ph_v` `:1718`: **QUALIFY.** Drop "to drive cellular recovery" and "structured water for cellular uptake." Replace `ri_body`: **"AForce pairs {{mg}}mg of sodium with marine-sourced minerals and a pH 8.8 profile — designed to help you rehydrate, not flood you with salt."** Replace `sys_ph_v`: **"A smooth, higher-pH profile — part of the AForce standard."** (pH 8.8 held as a *brand/sensory* standard, never a cellular mechanism — consistent with how the marketing site already load-bears that framing.)
- "72 Trace Minerals," "marine bioavailable," "4-Hour Recovery Window": **NEEDS-EVIDENCE-ON-FILE** — CoA (mineral count/content), bioavailability testing, and PK/time-release data respectively. Hold the specific numbers until each document is attached.

**(e) Diagnosis red-line — HARD STOP on two:** chlorella **"binds heavy metals"** (detox/chelation = treatment action) and dulse **"thyroid"** (organ-function/health claim). Both violate §2 and the Constitution's "never diagnose/treat." "Drive cellular recovery" is not diagnosis but is an unsupported physiological-mechanism claim.

---

## 4. "Heat Guard minerals for high-heat output"

**(a) Claim as worded.** `aforce-site/shop/index.html:706`, Watermelon Surge `why`: "…Built for the days you sweat for a living — **Heat Guard minerals for high-heat output.**"

**(b) Scientific status — PARTIALLY SUPPORTED (underlying), UNSUPPORTED (as a coined benefit).** Replacing electrolytes (esp. sodium) lost in sweat during heat/high sweat rates is well-established rehydration science (ACSM position stand, Sawka 2007, already cited in-app; sweat-sodium ranges per Baker 2017). That supports "electrolytes to replace what you lose sweating in the heat." It does **not** support **"Heat Guard,"** which is a coined structure-function term implying the minerals *guard/protect* against heat — a protective claim with no product-specific evidence and a protection connotation edging toward the banned "prevent" register.

**(c) What would substantiate as worded.** "Heat Guard" as a protective benefit would need product-specific evidence that AForce mitigates a heat-related outcome — data you do not have and that would itself risk a medical/heat-illness claim. The *replacement* framing needs only the general sweat-electrolyte literature already on file.

**(d) Disposition — QUALIFY.** Replace with: **"extra electrolytes for the days you sweat hard in the heat."** Keep the DSHEA/wellness disclaimer adjacent (top marketing surface; homepage disclaimers are footer-only — §14 requires adjacency where the user acts).

**(e) Diagnosis red-line.** Not diagnosis, but "Guard" is a protection/prevention connotation — keep it out to stay clear of the §42 `prevent` family and any heat-illness implication.

---

## 5. Named-competitor characterizations + "Better recovery is."

**(a) Claim as worded** (`locales/en.json`, `sweat.v2` "HOW AFORCE COMPARES"):
- `cmp_closer` `:1783`: "**More sodium is not always the goal. Better recovery is.**"
- `cmp_profile_gatorade` `:1785`: "**Sugar-driven · table salt**" · `cmp_profile_lmnt` `:1786`: "**Salt-bomb · no minerals**" · `cmp_profile_liquid_iv` `:1787`: "**Sugar + salt · no structuring**" · (AForce `:1784`: "Marine · pH 8.8 · structured").

**(b) Scientific status — MIXED.** Some underlying facts are checkable and defensible *if sourced*: Gatorade's thirst-quench formulas do contain sugar and sodium chloride; LMNT is a deliberately high-sodium, sugar-free product; Liquid I.V. contains sugar (glucose, as an ORS-style co-transport aid) and sodium. But the *characterizations* are not neutral facts: **"Salt-bomb," "no minerals," "no structuring," "Sugar-driven"** are disparaging framings. "No minerals"/"no structuring" assert an absence that needs verified label data — and "structuring" is itself an unsubstantiated AForce concept (item 3), so faulting a competitor for lacking it is doubly unsupported. Note also: added glucose in an ORS is a *feature* for sodium co-transport (established ORS science), so "Sugar-driven" as a pejorative is scientifically slanted.

**(c) What would substantiate as worded.** Comparative substantiation on file: current published nutrition facts for each named product (sodium, sugar, mineral content), dated and sourced, supporting every stated/implied contrast. "Better recovery" (superiority) would additionally require head-to-head outcome data AForce does not have. "No structuring" is unsubstantiable while "structuring" itself is unproven.

**(d) Disposition.**
- Characterizations `:1785–1787`: **QUALIFY + NEEDS-EVIDENCE.** Keep only factual, sourced numbers (e.g. per-serving sodium and sugar in mg/g from each brand's published label), drop the pejorative adjectives and the "no minerals/no structuring" absence-claims. If the sourced numbers aren't on file, **REMOVE the named rows** and compare against generic categories ("high-sodium electrolyte mixes," "sugar-based sports drinks") instead of named brands.
- `cmp_closer` `:1783`: **QUALIFY** — "Better recovery is" implies a proven superiority outcome. Replace: **"More sodium isn't always the goal — the right balance is."** (opinion/positioning, no unproven outcome-superiority).

**(e) Diagnosis red-line.** Not a §2 diagnosis issue; this is FTC comparative-substantiation + Lanham-disparagement exposure. Route the factual numbers to the regulatory reviewer with sources attached.

---

## 6. Translated intelligence/coach claims (es/fr/de/it/pt), not §42-validated (R-24)

**(a) Claim as worded.** Confirmed live: non-English locales contain **fully translated** intelligence/coach copy, not English placeholders — e.g. `es.json` `depleted_action`: "Puntaje {{score}}. Agotado. Bebe 20 ounces y toma 2 sticks ahora…"; `social_stop_action`: "Detén el alcohol. Recuperación necesaria."; `de.json` `recovering_action`: "Score {{score}}. Erholung. Nimm jetzt 1 Stick…". ar/hi/ja/ko/zh fall back to English.

**(b) Scientific status — OUT OF SCOPE for this pass / UNVALIDATED.** The scientific-substantiation pass validates the *English* evidence base only; only English is §42-validated. A translated string can preserve the English *words* while shifting the *claim register* in ways this pass cannot certify (the banned-term list is language-specific and, per `LOCALE-POLICY-REGISTRY.md`, a direct translation of the English list is explicitly insufficient). "Recuperación necesaria" ("recovery necessary") is more imperative than the hedged English register and would need its own review.

**(c) What would substantiate.** The 8-item per-locale review in `governance/LOCALE-POLICY-REGISTRY.md`, run by a qualified reviewer in each language — not a translation of the English worksheet.

**(d) Disposition — REMOVE from launch scope / keep runtime-suppressed.** Do not surface any non-English intelligence/coach copy until its locale passes the 8-item review. This is a routing decision, not a science call — flag to Brandon/counsel and the §42/locale owners.

**(e) Diagnosis red-line.** Cannot be assessed here per-language; the fail-closed runtime suppression is the correct interim control. Keep it on.

---

## Secondary flags (brief)

- **Superfood signals** (`utils/superfoodSignals.ts`): "SUPERFOOD SIGNALS ACTIVE"; ingredient bodies hedged "may help support" (sea moss/dulse/chlorella); chip "Cellular Hydration Support." The DSHEA-style hedging is the right instinct, but "Cellular Hydration Support" carries the same unproven *cellular-uptake* mechanism as item 3 — **QUALIFY** to "Mineral + Hydration Support" and keep ingredient-specific structure-function gated behind CoA/evidence on file.
- **Signal-quality "proprietary optical measurement" / `verified`-tier** for the manual urine color match (`utils/confidence/signalQuality.ts:102,122–142`): calling a manual color read a "proprietary optical measurement" rated "verified/excellent" **overclaims measurement precision** and conflicts with the app's own "Simple color read · Not a medical test" hint (`en.json:1132–1134`). Ties to item 1's false-precision pattern. **QUALIFY** the tier language down to match the honest hint.
- **In-app citations block** (`en.json:1794–1810`): Sawka 2007, Baker 2017, Cheuvront 2014, Maughan & Shirreffs 2010 are real, well-known references and the general findings they're attached to (sweat-sodium ranges, >2% body-mass-loss performance decrement, replace 100–150% fluid within 4–6 h) are established. **Gap to close:** confirm each *in-app number* actually maps to the cited source — the citations lend the surface authority, so a mismatch between a rendered figure and its cited basis is its own substantiation defect. Reviewer should spot-check number-to-source.
- **Comparison-engine verdicts** (`comparisonEngine.ts`: "High sugar load slows uptake," "Closes the deficit rapidly," "Insufficient for current state"): general ORS/gastric-emptying physiology loosely supports "high sugar can slow uptake," but "Closes the deficit rapidly" is a quantified-rate claim needing product PK data. Same QUALIFY pattern as item 1 — soften rate/absolute claims to descriptive.

---

## Handoff

Every "QUALIFY" replacement above stays in the performance/ritual register and avoids the §42 absolute banned stems. The three hard stops (urine "Correction"/"before performance is affected"; chlorella "binds heavy metals"; dulse "thyroid") are §2 violations and should not ship in current form even though none trip the automated language gate — they are semantic conflations, precisely the class the machine cannot catch. On disposition, approved replacement phrasings flow into `governance/CLAIMS-REGISTER.md`; the **NEEDS-EVIDENCE-ON-FILE** items (72 minerals / bioavailable / 4-hour window / competitor numbers) each name the specific document required and should be logged as open evidence requests before their surfaces flip. **Now logged:** `governance/reviews/CR-1-EVIDENCE-REQUESTS.md` (ER-1…ER-7) — note ER-1 "72 minerals" and ER-2 "4-hour window" gate claims that are **currently live** in app copy, so they are substantiate-or-remove before launch.

**This is the internal science half only.** It does not substitute for, and is not, the external regulatory/claims review (CR-1 proper), which remains unbooked. Its purpose is to hand that reviewer a pre-analyzed worksheet and to give the founder an early, honest read on which claims are salvageable vs. which must change before launch.
