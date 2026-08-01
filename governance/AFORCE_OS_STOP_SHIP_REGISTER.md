# AForce OS — Stop-Ship Register (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Verified against:** working commit `52986ece` (2026-08-01), branch `docs/phase0-elite-audit`.
**Cross-links:** `OPEN-RISKS.md`, `Risk-Register.md`, `Launch-Readiness.md` §1, `SPECIFICATION-RECONCILIATION-REGISTER.md`.

> A stop-ship item must be **resolved or explicitly accepted** by Julius + Brandon before the
> relevant surface reaches public production. Severity: **S1** blocks launch · **S2** major ·
> **S3** moderate. "Verdict" reflects static evidence; items marked **needs verification** require a
> runtime/prod-build/secret check this read-only environment could not perform. Nothing here has
> been fixed — Phase 0 is audit only.

---

## 1. Register

| ID | Sev | Item | Evidence | Verdict | Owner / decision |
|---|---|---|---|---|---|
| **SS-01** | **S1** | **Client "Developer"/flag-admin tab in `ProfileScreenV2`.** `PROFILE_TABS` includes `developer` unconditionally (`ProfileScreenV2.tsx:2323-2328,2345`); it renders a master "unlock all" toggle + per-flag switches for Clutch/Guardian/Phantom (`:1441-1474`) and the Dev-Mode switch (`:1970`). No `__DEV__`/`devMode`/role/entitlement gate. Flags live in client `useAppStore`. | 0A | **CONFIRMED in source; needs prod-build verification** (whether DEMO/flag lighting neutralizes it in a `DEFAULT_FLAGS` store build). Contradicts Build-Rule #9 / §62 "Founder Mode never in Production." | Founder — confirm gate or add server/`__DEV__` gate |
| **SS-02** | **S1** | **No server-side entitlement/RBAC for enterprise capabilities.** `FeatureGate` "Activate Demo" flips the flag client-side (`FeatureGate.tsx:37-40`); `flags.ts:6-8` admits prod entitlement service does not exist. Any signed-in user can enable Clutch/Guardian/Cruise features. | 0J | CONFIRMED (for feature access; consumer *purchase* path is server-gated per 0K) | Founder — gate enterprise behind server entitlement before any such tier is enabled |
| **SS-03** | **S1** | **Provider OAuth tokens may be stored plaintext in production.** pgcrypto dual-write built but encryption is env-key-conditional (`whoopFetchWorker.ts:252` `?? null`); Phase C (drop plaintext columns) not done (`lib/db/src/whoopTokenStore.ts:71`). If `*_TOKEN_ENCRYPTION_KEY` env vars are unset in prod, tokens persist plaintext. | 0L | **needs verification** (secrets off-limits in this env) | devops/security — confirm keys set in prod; schedule Phase C |
| **SS-04** | **S1** | **No GDPR/CCPA data export or deletion path.** Consent versioning + withdrawal exist (`analytics/privacy_manager.ts`), but no `deleteAccount`/`exportData`/erasure implementation found in app or api-server. | 0L | CONFIRMED (absence) | Founder + counsel — required before EU/CA launch |
| **SS-05** | **S1** | **Prohibited BAC / impairment / "Do not drive" logic + copy still in the build.** `socialModeEngine.ts:69,101-114` computes `social.bac/impairment/transportation`; strings ship in all 12 locales (`en.json:792,811,814,819`); render components orphaned but re-importable. Constitution Principle 5 + CLAIMS-REGISTER. | 0D | CONFIRMED (computed + localized; not currently rendered) | Founder + counsel — complete the deprecation (remove call sites, strip locale keys, delete components) |
| **SS-06** | **S2** | **Default share posture leaks personalized state.** `DEFAULT_PRIVACY` = scope `circle`, every field `true` (`data/mockCircleData.ts:70-73`): score + HydroState label + streak + protocol + trend shared opt-out. Constitution Principle 7 (who sees this data). | 0J | CONFIRMED | Founder — default to `private`/opt-in |
| **SS-07** | **S2** | **Global individual leaderboard exposes named users + city/state health-state label.** `CompetitionScreen.tsx:245,262,270`; `global_leaderboard_enabled` = true (`flags.ts:41`). Governance direction de-emphasizes/prohibits public raw ranking. | 0J | CONFIRMED | Founder — scope/consent-gate or remove public leaderboard |
| **SS-08** | **S2** | **No moderation / blocking / reporting / minor(COPPA) gate** in the entire circle/community/share system (relationship model tops out at `muted`, `types/circle.ts:9`). | 0J | CONFIRMED (absence) | Founder + counsel |
| **SS-09** | **S2** | **Guardian/Clutch render prescriptive medical-adjacent directives with no disclaimer** — "PULL FROM ROTATION. Medical eval." + body-risk map + CRITICAL over `coreTempEstimate`/`pH` (`guardian.tsx:37-104`; `recommendations.ts:134-190`). DR-006 removed Guardian injury/medical-risk claims. | 0J/0F | CONFIRMED (behind default-OFF flags) | Founder + counsel — DR-006 governed language + disclaimer before enable |
| **SS-10** | **S2** | **Smart Capture "on-device" claim mismatch + no image minimization/consent.** Photo is base64-POSTed to server for OpenAI vision (`smartCaptureApi.ts:2-4,52`); no raw-image deletion/retention or feature-level consent found. | 0F | CONFIRMED | Privacy sign-off before `hydro_scan_2_enabled` flip |
| **SS-11** | **S2** | **Three band systems disagree at scores 85–89.** 4-state 90/75/60 (`breakdown.ts:13-16`) vs 5-band 85/70/50/30 with *different labels* — `statusColor` OPTIMAL/… vs `commandVoice` PEAK/STABLE/CORRECT/… At 85–89: orb=BALANCED, voice="Flow state… elite"(PEAK), color=OPTIMAL. (The 4-vs-5 split itself is governed/intentional — Terminology §6/RC-L2; the *threshold+label divergence across surfaces* is the defect.) | 0B | CONFIRMED | Founder + eng — centralize band cutoffs, reconcile the three label sets |
| **SS-12** | **S2** | **"Readiness" overloaded** — user-facing HydroState hero label (`index.tsx:250`, `_layout.tsx:208`) collides with a separate biometrics-fed Metabolic Readiness feature (`types/index.ts:898`, `metabolic_readiness_enabled`). Constitution Principle 2 clarity. | 0B | CONFIRMED | Founder — pick one hero name |
| **SS-13** | **S2** | **AForce sodium data contradiction** — 500 mg (`beverageCompetitors.ts:67`, feeds "more Na = better" rubric) vs 25 mg brand thesis (`sweatRateEngine.ts:129`). | 0D | CONFIRMED (comparison engine currently dormant/no render consumer) | Founder + performance-scientist — reconcile before any comparison surface ships |
| **SS-14** | **S2** | **Detox / "cellular reset" / internal-cleansing / alkaline-as-benefit claims in shipped data** — `data/flavors.ts:63-73`, `data/pricing.ts:121`, `beverageComparisonEngine.ts:149-166`. Compliance test guard (`hydrationDemandEngine.test.ts:127`) does not cover these files. | 0D | CONFIRMED (mostly data-latent; "cellular hydration" hedged copy *is* rendered on Scan via `superfoodSignals.ts:115`) | Founder + counsel — verify none reach render; extend the guard |
| **SS-15** | **S2** | **Score Protection not enforced in production.** Server guard `scoreWriteGuard.ts` runs shadow-only; `off` in prod (`:36-42`) until Phase 3B. Server still persists client-supplied score (RC-L8b / N-5 / R-29). | 0B | CONFIRMED (Built-Hidden, shadow) | Founder — Phase 3B pre-flight before enforce |
| **SS-16** | **S2** | **Competition presented over unverified client score + mock opponents.** Blended formula is sound, but opponents are mock and the "You" row derives from unverified client intake (`competitionEngine.ts:22-99`). | 0D | CONFIRMED | Founder — no real ranking without server-authoritative scoring/anti-cheat |
| **SS-17** | **S2** | **Voice/coach defaults ON, no quiet-hours / OS-DnD respect.** `voiceCoachEnabled` init `true`, `voiceScope` `all` (`useAppStore.tsx:172,183`); no `quietHours`, no DnD gating for TTS. If Force Mode must be opt-in (0G), this ships audible-by-default. | 0C | CONFIRMED | Founder — decide opt-in default + quiet hours |
| **SS-18** | **S3** | **No per-screen error boundary on Profile/Leaderboard** — single root boundary only (`_layout.tsx:371`); the known React-Compiler crash is mitigated only by a babel-config workaround (`babel.config.js:19-21`). A regression blanks the whole app. | 0A | CONFIRMED | eng — add per-screen boundaries (durable fix) |
| **SS-19** | **S3** | **`modules.tsx` "INTERNAL EVALUATION" launcher ships ungated** (`modules.tsx:179`), reachable from every Profile; links onward to science/sensors/social-v2/phantom. | 0A | CONFIRMED | Founder — gate or relabel for production |
| **SS-20** | **S3** | **`/social-legacy` deep-link reachable in production** though the tab is dev-gated (`social-legacy.tsx:9-12`). Duplicate `social-v2` mounts the same V2 screen a second time. | 0A | CONFIRMED | eng — retire legacy/duplicate mounts |
| **SS-21** | **S3** | **"injury risk reduction" + "Heat Risk" + "RISK" band user-facing copy** — `SubscriptionScreen.tsx:353` (marketing), `HeatRiskScreen.tsx`, RISK band in voice/notifications. Terminology §7 bans "risk"/"injury" in user-facing intelligence copy. | 0F | CONFIRMED (RISK band is an internal token per §7 note, but the marketing "injury risk" is user-facing) | Founder + counsel — governed observational language |
| **SS-22** | **S3** | **Command standard missing verification-method (#11) and safe-alternative (#13) fields**; confidence/source/adjust/decline/partial absent from the flagship Home card (present only on RecoveryCoach). | 0C | CONFIRMED | product — complete the Universal Command Standard |
| **SS-23** | **S3** | **Consumption is a single tap = immediate credit; no partial/started/completed state machine** (RC-L12). Two "Log scanned/replacement" paths auto-assume full `ozPerServing` with no amount confirmation (`realApi.ts:337`). | 0D | CONFIRMED | product — minimal honest consumption ladder |
| **SS-24** | **S3** | **Stick-allotment unit mismatch** — `unitsPerCycle: 2` vs `24` for the same "2 Stick Packs" (`subscriptionPlans.ts:140` vs `:170`). Both plans dark; fulfillment data-integrity bug. | 0K | CONFIRMED | eng — fix before either plan launches |
| **SS-25** | **S3** | **Social RTD command leads with product before water** ("Take 1 RTD now. Sip 16 ounces of water…", `en.json:720`). Water-First ordering exception. | 0C | CONFIRMED (gated by state+behavior) | Founder — ruling on ordering |

---

## 2. Disposition of the prompt's ten named defects

| # | Named defect | Disposition | Evidence |
|---|---|---|---|
| 1 | Profile route error boundary | **Partially resolved** — crash mitigated by `babel.config.js` React-Compiler scope workaround; still no per-screen boundary → **SS-18** | 0A |
| 2 | Leaderboard route error boundary | Same as #1 → **SS-18** | 0A |
| 3 | Sweat Calculator unit/formula (~600 vs ~54–56) | **NOT reproduced — proven correct.** Engine computes 54.3 oz/h for the example (`sweatRateEngine.ts:229-235,522`); screen shows 1.61 L/h (`SweatCalculatorScreen.tsx:770`). Residual: **zero sweat unit tests** (required coverage gap) + screen shows only L/h. | direct verify |
| 4 | HydroState shown as "Readiness" | **Confirmed** → **SS-12** | 0B |
| 5 | Conflicting 4-/5-state ladders | **Governed non-defect** (Terminology §6 / RC-L2) — but a *third* label set + threshold divergence at 85–89 is a real defect → **SS-11** | 0B |
| 6 | Positive/Balanced shown red | **Not found** — PEAK→green, BALANCED→cyan, RECOVERING→amber, only DEPLETED→red; `#FF2800`≠`#C1281B` intentional (`homePresentation.ts:12-13,49-57`). Clear. | 0B |
| 7 | Offline intake "complete" without durable queue | **Resolved** — durable per-user outbox + idempotency + server dedupe (`intakeOutbox.ts`, `intake.ts:84-104`). Reinstall reconciles from server. | 0B |
| 8 | Conflicting pricing / plan names / Founding counts | **Pricing clean** (parity-tested, Command $20/$200); **Founding 200/250** is a docs-only reconciliation (RC-L7) → Recon `PA-*`; **stick-allotment** data bug → **SS-24**; stale "Athlete/System" comments (cosmetic) | 0K |
| 9 | Duplicate Social surfaces / non-actionable copy | **Confirmed** → **SS-20**; naming three-way → Recon `PA-01` | 0A/0J |
| 10 | Empty / unassessable motion/gallery states | **Gated correctly** — gallery/motion-demo behind `__DEV__`/`DEMO_MODE` redirects; not a prod exposure. Motion placeholders low. | 0A/0L |

---

## 3. Summary

- **S1 (blocks launch): 5** — SS-01, SS-02, SS-03, SS-04, SS-05.
- **S2 (major): 12** — SS-06…SS-17.
- **S3 (moderate): 8** — SS-18…SS-25.
- Two named defects (#6 red-for-positive, #7 offline durability) are **clean**; one (#3 Sweat) is
  **proven correct with a test-coverage gap**; one (#5 ladders) is a **governed non-defect** with a
  real secondary divergence.

Sequencing of fixes is proposed (not authorized) in `AFORCE_OS_ELITE_IMPLEMENTATION_PLAN.md`.
