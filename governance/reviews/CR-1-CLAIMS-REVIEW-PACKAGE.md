# CR-1 — Pre-Launch Claims & Compliance Review Package

**Status:** ⏳ **NOT YET REVIEWED — reviewer not yet booked.**
**Prepared:** 2026-07-31 · **Reviewer:** _to be assigned_ · **Owner:** Brandon + performance-scientist (+ counsel)
**Governs by:** `docs/COMPLIANCE_FRAMEWORK.md` (esp. §2 Observation-Never-Diagnosis, §14 Health Disclaimers, §16 Legal Review Gates) · `governance/CLAIMS-REGISTER.md` · `governance/Risk-Register.md` §CR-1

> **No compliance or legal approval exists for any claim in this package.** This document *requests*
> the CR-1 review and gives the reviewer a complete, cited worksheet. It does **not** record an
> approval. Nothing here may be treated as cleared on the basis of this document. Citations point to
> the repo as of the prepared date — confirm each against live copy before dispositioning.

---

## Part 1 — What CR-1 is, and why it blocks launch

CR-1 is the single deliberate review that signs off **every user-facing claim** before the
September 2026 launch (per `governance/Risk-Register.md` §CR-1). It is **not a code step** — it is a
human go/no-go by a qualified reviewer. It has been the #1 launch blocker since 2026-07-17 and has
had **no reviewer booked**; this package exists to make booking a one-step action.

**What clearing CR-1 unblocks** (nothing on this list may ship until it clears here):

| Gated item | Flag / gate | What it is |
|---|---|---|
| §64 Conversational Intelligence | `conversational_intelligence_enabled` (OFF) → RD-1 go/no-go | Proactive + reactive voice coach lines |
| HydroScan 2.0 | `hydro_scan_2_enabled` (OFF) — CR-1 per-claim | Efficiency %, fit score, superfood signals |
| §20 surfacing copy | `spec_section20_calibration` (OFF) — COND-3 | Recalibration/calibration user copy |
| §56 personalization copy (S56-1) | headless today | Confidence/personalization surfacing vs. shipped reality |
| §39 prediction language | §42-gated, blocked | Must be covered explicitly (OPEN-RISKS R-01; REVIEW-APPROVAL-MATRIX; DR-007) |
| Product / ingredient / marketing claims | live | Structure-function, quantified, and comparative claims (app + `aforce-site`) |
| Non-English locales | R-24 | Only English is §42-validated |

---

## Part 2 — Who to book (reviewer specification)

CR-1 needs a **regulatory / advertising-claims reviewer** (attorney or specialist consultant), not a
generalist. Required competencies, matched to the claims actually in the inventory:

| Competency | Why it's needed here | Inventory tie-in |
|---|---|---|
| **FTC advertising substantiation** (Section 5; "competent and reliable scientific evidence") | Quantified efficacy + superiority claims need substantiation on file | Efficiency %, comparison verdicts, "72 minerals," recovery-window timing |
| **FDA / DSHEA structure-function claims** (dietary supplement **and** food/functional-beverage; the food-vs-supplement classification question) | Ingredient mechanism claims + the unresolved SKU classification | Sea moss / dulse / chlorella claims; `aforce-site/legal/fda-disclaimer` open TODO |
| **Health/wellness app claims — "observation, never diagnosis"; not a medical device** | The urine/HydroScan surfaces border diagnosis; FDA general-wellness / 21 CFR device line | Urine verdicts; HydroScan "optical measurement" framing |
| **Comparative advertising / named-competitor claims** (Lanham Act disparagement) | The app names and characterizes competitors | Sweat-calculator table (LMNT / Gatorade / Liquid IV) |
| **AI-generated-content disclosure** | Coach/voice is AI-authored | §64 lines; COMPLIANCE_FRAMEWORK §17 |

**Internal partner (does not need external booking):** the **performance-scientist** owns the
*scientific substantiation* half — does the evidence support each claim as worded. That half can run
in parallel now (see Part 5). CR-1 clears only when both the regulatory and scientific passes agree.

**Existing counsel relationship:** the repo already engages **AWG Law (J. Peter Paredes,
patent@awglaw.com)** for the PA-1 patent matter. That is *IP* counsel — confirm whether AWG covers
FTC/FDA advertising-claims work or can refer a regulatory specialist; do not assume patent counsel
substitutes for the claims review.

---

## Part 3 — The claims inventory (the reviewer's worksheet)

Compiled 2026-07-31 from app locale, app code, marketing site, and governance. Claim-type key:
**EFF** efficacy · **SF** structure-function · **DIAG** diagnostic/detect/treat · **COMP**
comparative/superiority · **QE** quantified efficacy · **GW** general-wellness.

> **Read Part 3.7 (highest-risk triage) first.** The single most exposed strings are the computed
> HydroScan **"Hydrates at 43% efficiency"**, the urine **"Hydration Correction Recommended"**
> verdict, the **"drive cellular recovery"** ingredient copy, and the named-competitor table.

### 3.1 — HydroScan: efficiency %, superfood, urine/hydration assessment

- **Quantified efficiency (HIGHEST):** `services/hydrationScanService.ts:71–72` renders
  **"Hydrates at {N}% efficiency"** (e.g. 43%) from an internal weighting formula
  (`computeHydrationEfficiency:61–68`) with **no external substantiation** — and it is shown for
  scanned **competitor** products too. Surfaced in `components/ScanResultCard.tsx:93–95`
  (`hydroScan2.cards.efficiency`). Fit-score verdicts `en.json:1154–1158`
  (OPTIMAL/STRONG FIT/ACCEPTABLE/SUBOPTIMAL/AVOID). **QE/EFF.**
- **Superfood signals:** `utils/superfoodSignals.ts` — `SUPERFOOD SIGNALS ACTIVE` (L83);
  "mineral-rich superfoods designed to support recovery, hydration efficiency, and performance" (L88);
  chips incl. **"Cellular Hydration Support"** (L94–98); ingredient bodies L105–125 hedged with "may
  help support" (sea moss / dulse / chlorella). **SF** — DSHEA-style hedging present, but
  ingredient-specific structure-function still needs substantiation on file.
- **Urine Hydration Check (HIGH):** `services/urineHydrationCheck.ts` — disclaimer present
  (`URINE_DISCLAIMER:39–40` "not a medical diagnostic tool"), but verdicts push past observation:
  **"Hydration Correction Recommended" / "Address before performance is affected" / "16 oz water +
  AForce for mineral recovery support" (L95–98)**; "Hydration Support Suggested" (L84–87);
  "over-dilution" (L64–65). **DIAG/SF/EFF.**
- **Precision framing:** `utils/confidence/signalQuality.ts:102` classes the manual urine color-match
  as a `'wearable'`-tier **"proprietary optical measurement"** rated `verified`/`excellent`
  (L122–142) — reconcile with the "Simple color read · Not a medical test" hint (`en.json:1132–1134`).
- **Good disclaimer (base scan):** `en.json:1148` "not intended to diagnose, treat, cure, or prevent."
- **Camera Smart Capture** copy exists (`en.json:1211–1241`, "hydration demand, recovery load,
  stimulants, acidic burden") — must stay **flag-dark** per COMPLIANCE_FRAMEWORK §7/§10; confirm OFF.

### 3.2 — §20 surfacing copy (COND-3)

`spec_section20_calibration` is OFF. Engines are arithmetic, framed "calibration — never correction"
(`adaptiveProfileEngine.ts:222`). User copy in locale: `en.json:615` ("Quietly calibrates hydration
demand, sweat & load estimates… Not a medical record — used only on-device to tune your numbers"),
L618 ("Feeds your Personal Baseline… recalibrate future recommendations"), L634, L984/1004–1011
("MORNING CALIBRATION"). **GW** — COND-3 asks whether recalibration copy implies a physiological read.

### 3.3 — §64 conversational-intelligence / coach copy (RD-1)

Flag OFF in production. Two layers:
- **Proactive (locale):** `en.json:691–695` `coachIntelligence` ("Now — {{action}}", "Recovery
  window's open…", "Your body taught us something today…"), emitted by
  `voiceService.ts:buildProactiveCoachLine (476–514)`, each re-checked by `isCompliantCoachLine`.
- **Reactive (HARDCODED in `.ts`, not locale — locale-only audits miss these):**
  `services/voiceService.ts:composeContextDetail (366–384)` — "Readiness {score}." (L370), "Recovery
  window open." (L372), "On days you followed your {category} response, your logged energy has tended
  to run {higher/about the same/lower} so far." (L379, a hedged **C2** personal cause-effect), "Your
  {patterns} pattern is building." (L381). **EFF (C2).**
- **Recovery Coach live copy:** `en.json:696–751` — "Electrolytes will restore your balance" (L709,
  **SF**), "Heat is opening your recovery window faster. Add 20% to your intake" (L710, **QE**),
  safety line "Reaction time and judgment are significantly reduced. A ride is the safer next move"
  (L730).

### 3.4 — Personalization copy (S56-1)

§56 coverage resolver is **headless** (no UI shows which recs are population-default). Surfaced
pieces: profile-strength chips "RICH"/"SPARSE" (`utils/confidence/confidenceChip.ts:68/72`,
`en.json:307–309`); signal-quality labels "verified/partial/estimated"
(`utils/confidence/signalQuality.ts:140–146` — confirm "verified" isn't over-claiming, ties to 3.1);
freshness "LIVE"/"STALE" (`en.json:1376–1379`); "DATA BEHIND THIS" / "WHY THIS COMMAND"
(`components/DataBehindThisSheet.tsx:86`, `en.json:1370–1394`); "Estimate — complete your profile to
sharpen this" (`en.json:1060`). Coverage tokens `personalized | population-default`
(`utils/personalization/personalizationCoverage.ts:187`). **S56-1 concern:** confirm nothing implies a
personalized physiological read when the value is a population default. **GW.**

### 3.5 — Competitive / superiority claims (R-27)

- **Governance-catalogued external claims — all BLOCKED, none rewritten** (`R-27-COMPETITIVE-CLAIMS-DISPOSITION.md`):
  `docs/competitive-moat.md` ("the only company…", "a primitive no competitor has", Gatorade Gx "the
  only mainstream sweat-sodium sensor") and `docs/HYDROSTATE-WHITE-PAPER.md` ("the single most
  actionable lever" — flagged as an unsupported *physiological* claim). Both docs remain 🔴 BLOCKED.
- **In-app comparison table (LIVE — not in the governance catalogue):** `en.json:1778–1787` `sweat.v2`
  "HOW AFORCE COMPARES" — "More sodium is not always the goal. Better recovery is." (L1783) plus
  named-competitor rows **"Sugar-driven · table salt" (Gatorade), "Salt-bomb · no minerals" (LMNT),
  "Sugar + salt · no structuring" (Liquid IV)** (L1786–1787). **COMP, named third parties — highest
  in-app R-27 exposure.**
- **In-app product-fit verdicts (LIVE):** `services/comparisonEngine.ts` — "Insufficient for current
  state." (L100), "High sugar load slows uptake." (L104), "Closes the deficit rapidly." (L111),
  "Effective but not state-adaptive." (L125). **EFF/SF.**

### 3.6 — Product / ingredient / structure-function claims (app + marketing)

- **In-app (highest):** `en.json` `sweat.v2` — "AForce uses {mg}mg of sodium paired with **marine
  bioavailable minerals and pH 8.8 alkaline structuring to drive cellular recovery**" (L1707–1708);
  "72 Trace Minerals / Structured water for cellular uptake" (L1715–1718); "4-Hour Recovery Window"
  (L1719–1720); **Chlorella "Binds heavy metals and supports oxygen transport" (L1725)** and Dulse
  "Iodine-rich for thyroid + metabolic recovery" (L1727). **SF/QE/DIAG.** Citations block present
  (L1794–1810: Sawka 2007, Baker 2017, Cheuvront 2014, Maughan & Shirreffs 2010; "Not a medical
  device") — confirm the citations support the specific in-app numbers.
- **Marketing site (`aforce-site/`):** **"Heat Guard minerals for high-heat output"**
  (`shop/index.html:706`; coined structure-function term, top marketing surface); pervasive **pH 8.8**
  framing (framed as "hydration experience / brand standard" — that framing is load-bearing);
  ingredient structure-function in `science/index.html:440–458` (hedged). **Mitigations present:**
  explicit "Refusals" block (`science/index.html:538–543`, "do not soften"), FDA/DSHEA disclaimers on
  home/science/shop footers + dedicated legal pages. **Gaps flagged:** `manifesto/` and `our-story/`
  carry pH/ingredient descriptors with **no adjacent DSHEA disclaimer**; homepage disclaimer is
  footer-only, far below the claims. Two open counsel TODOs in `aforce-site/legal/` (SKU
  food-vs-supplement classification; general-wellness feature-copy review).

### 3.7 — Highest-risk triage (read first)

| # | Claim (verbatim) | Location | Type | Why highest-risk |
|---|---|---|---|---|
| 1 | **"Hydrates at 43% efficiency"** (computed, any product incl. competitors) | `services/hydrationScanService.ts:71–72` | QE/EFF | Quantified efficacy from an unsubstantiated internal formula, shown on competitor products |
| 2 | **"Hydration Correction Recommended" / "before performance is affected" / "mineral recovery support"** | `services/urineHydrationCheck.ts:95–98` | DIAG/SF/EFF | Reads as detecting + correcting a physiological state via urine; disclaimer present but verdict overshoots |
| 3 | **"drive cellular recovery… bioavailable minerals… pH 8.8 structuring"**; **Chlorella "binds heavy metals and supports oxygen transport"**; Dulse "for thyroid + metabolic recovery" | `en.json:1708,1725,1727` | SF/QE/DIAG | Ingredient-mechanism + organ-function claims; "binds heavy metals" is disease-adjacent |
| 4 | **"Heat Guard minerals for high-heat output"** | `aforce-site/shop/index.html:706` | SF/QE | Coined structure-function benefit term, top marketing surface |
| 5 | **Named-competitor characterizations** ("Salt-bomb · no minerals", "Sugar-driven · table salt", "Sugar + salt · no structuring") | `en.json:1783–1787` (LIVE) | COMP | R-27 pattern about named third parties, in a shipped surface, not in the governance catalogue |
| 6 | **Translated intelligence/coach claims in es/fr/de/it/pt, not §42-validated** | `locales/{es,fr,de,it,pt}.json` | R-24 | Un-reviewed foreign-language claims exist in-repo; only runtime suppression blocks them |

### 3.8 — Per-locale note (R-24)

Only English is §42-validated; all other locales suppress intelligence claims at runtime (fail-closed).
**But** es/fr/de/it/pt contain **fully translated** intelligence/coach copy (e.g. `coach.depleted_action`
"Puntaje {{score}}. Agotado. Bebe 20 ounces…"), not English placeholders, and are **not** §42-validated;
ar/hi/ja/ko/zh fall back to English. Each launch locale needs the **8-item review** in
`governance/LOCALE-POLICY-REGISTRY.md` before its intelligence claims can surface — a direct
translation of the English banned-term list is explicitly **not** sufficient.

---

## Part 4 — Existing controls the reviewer is building on (do not re-derive)

The claims layer is already partly mechanized. The reviewer's job is the human judgment the machine
can't make; this is what the machine already does:

- **`governance/CLAIMS-REGISTER.md` (canonical, §42-governed).** Every physiological/performance/
  predictive statement must appear there with approved phrasing before it ships. **Absolute banned
  vocabulary** (any language, any surface incl. voice): *risk · injury · diagnosis · diagnose · prevent
  · prevents · prevention · treat · cure · deficiency · disorder.* Also banned: population comparison
  once personal data exists; medical-authority or genetic/deterministic framing.
- **Six claim classes** C1 Observation (always OK) → C6 Health/medical (prohibited outright); C3/C4
  gated behind §39/§40 + §42 and currently **BLOCKED**.
- **§42 language gate** — machine-mirror of the register at
  `utils/intelligence/languageGate/policyRegistry.ts` (`GATE_POLICY_VERSION = p42-v1.0`), **fails
  closed**, rule families `P42-MED/INJ/CAU/CER/PRD/SCR/DNA/…`. Register §6.4: any approved claim
  surface must ship a test asserting no banned term reaches an emitted copy key — **spot-check that
  HydroScan (3.1), §20 (3.2), and §64 (3.3) surfaces each have that test before their flags flip.**
- **Confidence taxonomy (FROZEN):** 11 distinct "confidence" concepts must never merge; **HydroState
  is the only intelligence value ever rendered to the user as a number.**
- **R-27 default ruling:** qualify or remove superiority/competitive claims from external use absent
  documented substantiation + legal approval.

---

## Part 5 — What CR-1 must decide (go/no-go questions) + deliverable

For **each** inventory item, the reviewer returns one disposition:

1. **Approve as-is** — clears; record approved phrasing into `CLAIMS-REGISTER.md`.
2. **Approve with a required qualifier / disclaimer adjacency** — specify exact wording + placement.
3. **Remove / gate dark** — not shippable in current form.
4. **Needs substantiation on file** — claim may stand only once the performance-scientist's evidence
   packet is attached (names the study/data required).

The governing questions:

- Does any HydroScan / urine / coach string cross from **observation into diagnosis** (COMPLIANCE §2)?
- Is every **quantified** claim (efficiency %, "72 minerals", "4-hour window", "pH 8.8", "20%")
  substantiated to the FTC "competent and reliable scientific evidence" standard?
- Are the **structure-function** ingredient claims within DSHEA for the product's actual regulatory
  classification (the still-open food-vs-supplement SKU question)?
- Are the **named-competitor** comparisons defensible (Lanham Act) and substantiated?
- Is **AI authorship disclosed** wherever coach/voice language appears (COMPLIANCE §17)?
- Do **disclaimers** sit where users act, adjacent to the claim — not footer-only (COMPLIANCE §14)?
- For **§39 prediction language**, does output stay in the permitted register (context-only /
  emerging-personal), never calibrated-personal or health forecast? (Cover explicitly — R-01.)

**Deliverable:** a disposition table keyed to the Part 3 item IDs, plus any required qualifier
wording, so approvals flow straight back into `CLAIMS-REGISTER.md` and the §42 gate. On a full pass,
**RD-1** (§64 enable) and the HydroScan / §20 flag flips become decidable.

---

## Part 6 — Booking (the human action that will not self-surface)

1. **Confirm the reviewer** — AWG (regulatory scope?) or a referred FTC/FDA advertising-claims
   specialist. This package is the scope-of-work; it lets a reviewer quote and start.
2. **Internal science half — DONE (2026-07-31).** The performance-scientist's scientific-substantiation
   pass on Part 3.7 is complete: `governance/reviews/CR-1-SCIENTIFIC-SUBSTANTIATION-PASS.md` — 5 claims
   salvageable-with-qualifier (with exact replacement wording), 5 must-remove-or-substantiate-on-file,
   and 3 hard §2 diagnosis red-lines. It is an internal assessment, not a clearance; it hands the
   regulatory reviewer a pre-analyzed worksheet and gives an early read on what must change.
3. **On clearance** — record dispositions into `CLAIMS-REGISTER.md`, flip flags per Part 1, move
   CR-1 to RESOLVED in `Risk-Register.md` + `Launch-Readiness.md`.

*Prepared as review-prep only. No approval is recorded here, and no claim is cleared until the booked
reviewer dispositions it.*
