# AForce OS — Reconciliation Register (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Verified against:** working commit `52986ece` (2026-08-01), branch `docs/phase0-elite-audit`.

> **This register EXTENDS `governance/SPECIFICATION-RECONCILIATION-REGISTER.md` — it does not replace
> it.** That file remains the canonical spec-reconciliation source (`RC-L1…RC-L15`, §1–§23). New
> conflicts found by this Phase-0 OS audit are numbered `PA-*` here and cross-reference existing
> `RC-L*` rulings rather than restating them. Per `SPECIFICATION-AUTHORITY.md` §2, a conflict that
> materially changes product behavior, scoring, privacy, navigation, entitlement, pricing, or public
> claims is escalated to Julius + Brandon and marked **blocking**; it is never resolved by choosing.

Each row: conflicting sources · current code behavior · governing rule · impact · recommended
resolution · decision owner · blocking?

---

## 1. New reconciliation items (`PA-*`)

### PA-01 — 4th tab identity: Circle / Community / Competition (extends RC-L1, RC-L4)
- **Conflicting sources:** route id `competition` (`app/(tabs)/competition.tsx`); code comments +
  in-screen title "Community" (`competition.tsx:2`, `(tabs)/_layout.tsx:9`, `CompetitionScreen.tsx:143`);
  visible i18n label "Circle" (`locales/en.json:30`); icon `trophy`/"SPORT MODE" (`_layout.tsx:58`).
- **Current behavior:** label reads "Circle" (RC-L1 DONE `4000791f`) but content is competition-first
  — global leaderboard with named users + city/state (`CompetitionScreen.tsx:245,262,270`).
- **Governing rule:** RC-L1/L4 founder ruling — canonical = **Circle**, competition folds *inside* it
  (§22); private support over public vanity (Constitution Principle 7, 11).
- **Impact:** navigation + product identity; content model contradicts the ruled intent.
- **Recommended resolution:** align route id, all 12 locale files, code comments, screen copy, icon,
  and content model to Circle; nest competition; reconcile leaderboard exposure (see SS-07).
- **Owner:** Julius + Brandon. **Blocking:** yes (structural fold-in is PENDING BUILD, not done).

### PA-02 — Founding 200 vs 250 mirror staleness (extends RC-L7)
- **Conflicting sources:** canonical `governance/*` = "Founding 250" (RC-L7 2a DONE); frozen
  `governance/AForce-Constitution.md:73,91` + `Phase-Roadmap.md:11` still "200" (HELD for founder);
  **app mirror `artifacts/aforce-os/governance/Learning-Journal.md:5` still "200"** (stale).
- **Governing rule:** RC-L7 canonical = "Founding 250"; Constitution edit needs Julius **and** Brandon;
  `SPECIFICATION-AUTHORITY.md` §3 — the app mirror must not carry authoritative divergent content.
- **Impact:** docs-only; zero app code/locales use the term.
- **Recommended resolution:** (a) Julius + Brandon sign-off to update the two frozen docs; (b) refresh
  the app-mirror pointer so it carries no stale count.
- **Owner:** Julius + Brandon (frozen-doc edit). **Blocking:** no (no user surface).

### PA-03 — Three band-label systems; only two are governed (extends RC-L2, Terminology §6)
- **Conflicting sources:** 4-state Performance ladder 90/75/60 (`breakdown.ts:13-16`); 5-band Score
  Status OPTIMAL/STABLE/DECLINING/RISK/CRITICAL 85/70/50/30 (`statusColor.ts:155-159`); **third**
  5-band voice ladder PEAK/STABLE/CORRECT/RISK/CRITICAL 85/70/50/30 (`commandVoice.ts:63-67`), which
  reuses `PEAK/STABLE/RISK/CRITICAL` labels with different meaning.
- **Governing rule:** Terminology §6 documents **two** deliberately-separate systems; the third
  (voice) naming is **undocumented**. `scoringEngine.ts:10-14` docstring also omits it.
- **Impact:** at scores 85–89 the orb (BALANCED), voice ("Flow state… elite" = PEAK), and color
  (OPTIMAL) disagree simultaneously (SS-11).
- **Recommended resolution:** register the voice band names in Terminology §6 or rename them to the
  Score-Status set; centralize the cutoffs; document the intended cross-surface mapping.
- **Owner:** Julius + Brandon + eng. **Blocking:** yes (cross-surface coherence).

### PA-04 — "Readiness" terminology overload
- **Conflicting sources:** HydroState hero labeled "READINESS SCORE" (`index.tsx:250`,
  `_layout.tsx:208`, `homePresentation.ts:20` `ReadinessBand`) vs a separate **Metabolic Readiness**
  feature fed by biometrics "never the Score" (`types/index.ts:897-898`, `metabolic_readiness_enabled`)
  vs the Oura `readinessScore` biometric (`types/biometrics.ts:36`).
- **Governing rule:** Constitution Principle 2 (one hero, HydroState); Terminology Registry is
  canonical for every term (`SPECIFICATION-AUTHORITY.md` §4).
- **Impact:** "is my Readiness the score or the wearable number?" confusion; not a second hero *engine*.
- **Recommended resolution:** add a Terminology entry disambiguating "HydroState" (the hero) from
  "Metabolic Readiness" (a biometric surface); rename the hero label away from "Readiness."
- **Owner:** Julius + Brandon. **Blocking:** yes (public label + Principle 2).

### PA-05 — Terminology lists 18 Intelligence members; several have no engine in code
- **Conflicting sources:** `TERMINOLOGY-REGISTRY.md` §3 lists 18 members incl. **Tomorrow Load
  Forecast™, Performance Drift™, Oral Hydration Signal, AutoPilot**; 0F found these **absent /
  Proposed** in code (Tomorrow Load Forecast, Performance Drift not found; Oral Hydration Signal
  absent; AutoPilot only a voice-intent token `types/voice.ts:37`).
- **Governing rule:** the registry is authoritative for **names**, not for **status**;
  `CAPABILITY-STATUS-REGISTER.md` §4 governs status ("documentation is not evidence of implementation").
- **Impact:** none to users (all dark); a truth-hygiene item so the roster is not read as "built."
- **Recommended resolution:** record each as **Specified/Proposed** in the capability matrix; keep the
  names. No name change.
- **Owner:** Brandon (register owner). **Blocking:** no.

### PA-06 — Guardian shipped copy vs DR-006 (governance beats code)
- **Conflicting sources:** DR-006 (Tier 1) removed Guardian injury/medical-risk claims → canonical
  "Performance readiness and recovery oversight"; code renders body-risk-map, CRITICAL over
  `coreTempEstimate`/`pH`, "PULL FROM ROTATION. Medical eval." (`guardian.tsx:37-104`,
  `recommendations.ts:189`), no disclaimer.
- **Governing rule:** DR-006 (Tier 1) controls; the code is **defective**, not an alternative reading
  (`SPECIFICATION-AUTHORITY.md` §1).
- **Impact:** compliance exposure if Guardian is ever enabled (currently default-OFF).
- **Recommended resolution:** bring Guardian/Clutch copy to DR-006 language + disclaimer before enable
  (SS-09).
- **Owner:** Founder + counsel. **Blocking:** yes for any Guardian enable; not for launch (dark).

### PA-07 — AForce sodium: 500 mg vs 25 mg (data-vs-data)
- **Conflicting sources:** `data/beverageCompetitors.ts:67` `sodiumMg: 500` vs
  `services/sweatRateEngine.ts:129` `AFORCE_SODIUM_PER_UNIT_MG = 25` ("NOT 500mg+… not sodium
  flooding"). Same brand fact, two values; the comparison rubric also treats more Na as better.
- **Governing rule:** Product facts come from one approved catalog (Product Positioning Principle;
  `SPECIFICATION-AUTHORITY.md` §5 Claims).
- **Impact:** contradictory brand fact; comparison engine currently dormant (no render consumer).
- **Recommended resolution:** set the canonical AForce sodium value; fix the loser; reconcile the
  "more Na = better" rubric with the 25 mg thesis (SS-13).
- **Owner:** Founder + performance-scientist. **Blocking:** yes before any comparison surface ships.

### PA-08 — Personal Cruise default-ON vs Phase-Roadmap Phase 3
- **Conflicting sources:** `cruise_mode_enabled` defaults **true** (`flags.ts:72`) → Personal Cruise
  live in the prod binary; `Phase-Roadmap.md:21` places "Cruise Mode (with revised streak mechanic)"
  in **Phase 3 — Enterprise**.
- **Governing rule:** Phase Roadmap (Tier 2) groups the phased rollout; a live default that precedes
  its phase needs a recorded decision.
- **Impact:** a Phase-3-scoped surface is discoverable at launch (consumer, disclaimered, non-diagnostic).
- **Recommended resolution:** confirm Personal Cruise is intentionally launch-scope (distinct from the
  Phase-3 Cruise Industry B2B), or gate it. Record the decision.
- **Owner:** Julius + Brandon. **Blocking:** no (consumer, disclaimered) — but record intent.

### PA-09 — "Section 63" naming: governance doc vs no code module
- **Conflicting sources:** `governance/Section-63-Compliance-Pass.md` exists; 0C found **no code**
  references §63 — the language guards are labeled §59/§61/§64 (`conversationalLanguage.ts`,
  `responseLanguage.ts`, `livingPerformanceLanguage.ts`).
- **Governing rule:** §63 is a **compliance-revision pass** to existing Profile/Guardian/Clutch/Cruise
  specs (Build-Rule #10), not a standalone code module — so this is expected, not a defect.
- **Impact:** none; documentation clarity only.
- **Recommended resolution:** note in §63 doc that its runtime enforcement lives in the §59/§61/§64
  guards + the compliance copy edits. **Owner:** doc owner. **Blocking:** no.

### PA-10 — App-mirror governance drift recurrence (extends R-05)
- **Conflicting sources:** `SPECIFICATION-AUTHORITY.md` §3 — `artifacts/aforce-os/governance/` is a
  pointer README, not a copy; yet it still holds stale content (PA-02, `Learning-Journal.md:5`).
- **Governing rule:** only `docs/COMPLIANCE_FRAMEWORK.md` ↔ app-legal mirror is a sanctioned duplicate;
  the governance-drift check (`scripts/src/check-governance-drift.mjs`) guards it.
- **Impact:** an in-tree agent could read a stale count as truth (the original R-05 failure mode).
- **Recommended resolution:** reduce the app-mirror to pure pointers (no substantive copy) or add it to
  the drift check. **Owner:** eng/governance. **Blocking:** no.

---

## 2. Confirmatory (already-ruled, no new conflict)

| Item | Existing ruling | Current code state |
|---|---|---|
| 4-band vs 5-band ladders | RC-L2 — intentional, do not merge | Holds (the *third* voice set is the new item PA-03) |
| 11 oz vs 12 oz | RC-L3 — keep 12 oz | Code is 12 oz; only hero artwork reads 11 oz (RC-L3 addendum) |
| Score Protection server gap | RC-L8b / N-5 / R-29 | Shadow guard built (`scoreWriteGuard.ts`), off in prod — unchanged (SS-15) |
| Consumption state machine | RC-L12 | Still absent; scan/select is score-neutral (SS-23) |
| Pricing/entitlement | RC-L14 | Command $20/$200 now unified + parity-tested (0K) — RC-L14 largely resolved |
| Ritual Save-10% displayed≠charged | RC-L10 | CLOSED 2026-07-31 (PR #405, verified) per Launch-Readiness §4 |
| Provider honesty | RC-L13 | `resolveHealthProviderStatus` wired; fake-LIVE removed (Launch-Readiness) |

---

## 3. Escalation summary

**Blocking (materially change behavior/label/claim):** PA-01, PA-03, PA-04, PA-06 (on enable), PA-07
(on comparison surface). **Non-blocking / docs-hygiene:** PA-02, PA-05, PA-08, PA-09, PA-10.

No conflict was resolved by choosing; each blocking item is routed to Julius + Brandon.

---

## 4. Night Out Protocol addendum (2026-08-01) — `NO-*`

Opened by the Night Out reconciliation pass (see `AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md`). Current
implementation = "Social Mode". Full evidence + Authority/Provider/Entitlement matrices live in the
spec; the register records the conflicts.

| ID | Conflict (source vs code) | Governing rule | Owner | Blocking? |
|---|---|---|---|---|
| **NO-1** | Public term is "Social Mode" (`SocialModeV2Screen`, `socialModeEngine`, `spec_social`, `social.*` locale keys) vs addendum name-lock "Night Out". | Addendum §2 (name lock); "Social Mode" retained as legacy alias only. | Julius + Brandon | yes |
| **NO-2** | Night Out must live **inside Protocol tab**; code exposes it as a hidden bottom-tab route (`(tabs)/social.tsx` href:null) + duplicate `social-v2` + legacy `social-legacy`. | Addendum §3; Build-Rule #14 (no new tab). | Founder + eng | yes |
| **NO-3** | Alcohol-depletion constants (`PER_DRINK_WEIGHT=5`, `SOCIAL_INTAKE_MAX_PENALTY`, `decayMultiplier`/`activeMinutes`) hardcoded in `hangoverRisk.ts`/`alcoholDrinks.ts`. | Build-Rule #13 — tunables in `config/hydroStateModel.ts`. | eng (DR if thresholds change) | yes |
| **NO-4** | Confirmed-drink correction/deletion lives in client `state.socialMode.drinks`; no approved event-reconciliation/replay for it. | Addendum §5 (correction must follow approved replay, not silent rewrite). | eng | yes (before any correction) |
| **NO-5** | `socialModeEngine` still computes BAC/impairment/transportation into `ScoreEngineOutput.social`; strings in 12 locales. | Addendum §12/§14; Constitution P5; = **SS-05**. | Founder + counsel | **S1** |
| **NO-6** | "Hangover Risk" user-facing terminology (`calculateHangoverRisk`; `en.json:770,1397`). | Terminology §7 (banned "risk"); addendum §12. | Founder + counsel | yes |
| **NO-7** | No consumption state machine (SCANNED→…→DISCARDED); partial consumption unmodeled. | Addendum §10; = RC-L12 / SS-23. | product | yes |
| **NO-8** | No age gating / regional alcohol eligibility logic (grep-clean). | Addendum §17; legal. | Founder + counsel | **S1 (legal)** |
| **NO-9** | No emergency-boundary path. | Addendum §18; legal + clinical. | Founder + counsel + clinical | yes (design) |
| **NO-10** | No dedicated `night_out_enabled` flag / entitlement; `spec_social` is a reskin flag; Athlete tier retired. | Addendum §7; server-authoritative per SS-02. | Julius + Brandon | yes |

**Aligned / confirmatory (no conflict):** alcohol's score influence is deterministic + capped +
time-decaying + prospective (addendum §5 ✔); alcohol logging is neutral via a separate `logSocialDrink`
path, no celebration (addendum §11 ✔); `socialModeEngine` rollup does not mutate the score (Score
Protection ✔); activation/scan/select/intent are score-neutral ✔.
