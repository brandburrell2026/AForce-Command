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

---

## 4. Night Out Protocol addendum (2026-08-01)

From the Night Out reconciliation pass (`AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md`). SS-05 (residual
BAC/impairment/driving) already covers the largest Night-Out safety item. One net-new S1:

| ID | Sev | Item | Evidence | Verdict | Owner |
|---|---|---|---|---|---|
| **SS-26** | **S1** | **No age gating / regional alcohol eligibility** for alcohol-specific Night Out controls — grep-clean (no `drinkingAge`/`legalAge`/`ageGate`). Alcohol quick-log + disclaimers must respect jurisdiction; age entry alone ≠ legal eligibility. | direct verify | CONFIRMED (absence) | Founder + counsel — required before public alcohol features |

Night-Out items already tracked elsewhere: **SS-05** (BAC/driving = NO-5), **SS-06** (private-by-default
sharing), **SS-21** ("Hangover Risk" wording = NO-6), **SS-23** (consumption ladder = NO-7), **SS-25**
(RTD leads with product). New reconciliation-only items NO-1..NO-4, NO-9, NO-10 are in the
Reconciliation Register (not all stop-ship). **Aligned/compliant (no action):** deterministic capped
alcohol depletion (§5) and neutral alcohol logging (§11).

---

## 2. Wave-1 / Wave-2 hardening update — 2026-08-12

Founder-authorized hardening waves (Wave-1 PRs #722–#727, Wave-2 PRs #728–#733) changed the
status of several rows above. Dispositions below are **code-verified**; nothing is marked
resolved on intention. "Flag OFF" means the fix is merged but inert until the founder flips
the named flag. The Phase-0 table above is preserved as the audit snapshot.

| ID | Wave-1/2 disposition | Evidence | Residual |
|---|---|---|---|
| **SS-01** | **CLOSED in code.** Developer tab hidden for ordinary production users (`developerControlsAvailable()`); Unlock-All clamps LEGAL_GATED / INTERNAL_TIER / preview-restricted flags per build context; persisted `devMode=true` is inert in production. | #722, #726 (re-landed #727) | Founder prod-build spot-check remains prudent. |
| **SS-02** | **PARTIALLY CLOSED.** Server-side entitlement infrastructure now exists and enforces: `requireEntitlement()` middleware (fail-closed on unknown feature / non-entitling status / lookup failure / forged client state), applied to `POST /aforce/social/shield` (`recovery_mode_enabled`); `POST /voice/tts` now requires auth. | #728 | Enterprise/athlete endpoints (battles, circle, analytics, cruise) remain plan-ungated because the **client ships them ungated** — gating them server-side would remove live features; needs a founder policy ruling. Shopify web-entitlement rail is dead code (`aforce_users.email` written nowhere) — live revenue bug, founder decision. |
| **SS-10** | **PARTIALLY CLOSED.** `/smart-capture` requires auth (photo can no longer be posted anonymously); privacy policy corrected to disclose photo transmission (counsel-review marker in place); §42 claims scrub added to the AI response path. | #723, #732 | Image retention/minimization policy + feature-level consent + counsel sign-off still open. |
| **SS-15** | **UPDATED, not closed.** Server backstop landed: value bounds on both client-writable score paths (impact points ±100 — closes the score-minting hole; snapshot field caps), two-sided timestamp windows (future-dating closed), rate limits on the two previously-unthrottled write routes. `SCORE_PROTECTION_MODE` deliberately **unchanged** (off in prod): enforce would today block legitimate overnight-decay snapshots, collide with the sensor placeholder, and silently drop journal writes (client swallows 409s). | #729 | Phase-3B pre-flight now also requires: sensor-placeholder disposition (see W2-N3), client 409 surfacing, elapsed-time-aware evidence window. |
| **SS-04** | **NEEDS RE-AUDIT (row may be stale).** `api-server/src/routes/privacy.ts` and `accountDeletion.ts` now exist; whether they satisfy export/erasure end-to-end was not verified in these waves. | Wave-2 PR1 route inventory | Re-audit against GDPR/CCPA requirements. |

### New items surfaced by Waves 1–2 (open, founder decision required)

| ID | Sev | Item | Evidence |
|---|---|---|---|
| **W2-N1** | S2 | **Fabricated store seed persists on cold/offline launch.** `data/mockData.ts` seeds the live store (`complianceStreak: 5` → "Day 5", 5 invented history rows rendered in Protocol "Recent activity"; first-view score tuned to BALANCED 76). Production Protocol compliance itself is fixed (#731), but the seed class remains — fixing it changes Home + first-launch presentation. | Wave-2 PR4 audit |
| **W2-N2** | S2 | **§42 locale policy violated by runtime fallback.** `LOCALE-POLICY-REGISTRY` rule 4 says unvalidated locales may not emit new intelligence claims; runtime falls back to English for ~340 missing keys across all 10 non-English locales. Enforcing suppression would silence nearly all intelligence copy for non-English users — needs a founder ruling (validate the launch locales, or accept documented suppression). | Wave-2 PR5 audit |
| **W2-N3** | S2 | **Sensor snapshot placeholder (score 70 / BALANCED) pollutes real aggregates.** `spec_sensors` is ON in production defaults; an import writes placeholder scores that flow into `/journal/rollups` (avg score, band time-share, the Journal consistency KPI, and the new real Protocol compliance). Schema: `score`/`level` are NOT NULL and `level` is a 4-band contract — every honest fix (nullable columns, `NOT_COMPUTED` band, reason-filtered aggregates, or a separate provenance table) is a schema/data-model decision. **STOPPED per Wave-2 directive; founder approval required before implementation.** | Wave-2 PR7 disposition |
| **W2-N4** | S3 | **Tier-5/6 local keys remain global** after per-user isolation (#733): onboarding progress, analytics id + consent, cart. Consent is per-person and a shared analytics id across accounts is a distinct privacy defect — needs its own pass. | Wave-2 PR6 audit |

---

## 5. Re-audit — 2026-11-17 (`main@6bc3ee3f`)

Read-only static re-audit of every row above against current `main`, requested by Brandon ahead of
beta planning. Method: three independent code reads, then a direct spot-check of each headline
finding. **Nothing was fixed in this pass, no test was run, and no device, production database or
environment value was inspected.** "Production build" means the `production` EAS profile, which sets
neither `EXPO_PUBLIC_INTERNAL_TESTFLIGHT` nor `EXPO_PUBLIC_DEMO_MODE`, with `DEFAULT_FLAGS`. The
server-driven preview overlay and persisted flag overrides were not traced. Sections 1–4 are kept as
the historical snapshot; this section is the current state.

**Tally (30 rows):** Fixed 8 · Fixed for store builds only 1 · Partly fixed 11 · Still open 10. *(Updated 2026-11-18 after #1216–#1218: SS-18 fixed; SS-26 moved from open to partly fixed.)*

| ID | Sev | Verdict today | Evidence (current paths, app paths relative to `artifacts/aforce-os`) | What remains |
|---|---|---|---|---|
| **SS-01** | S1 | **Fixed for store builds.** Open by design in `internal`, `internal-social` and `demo` builds | `developerControlsAvailable()` = `dev \|\| internalTestflight \|\| demoMode` (`featureFlags/flags.ts:799-804`); tab filtered in `components/profile/profileKit.tsx:225-228`; Dev Mode inert (`services/devMode.ts:48`) | Internal profiles extend `production`; the only thing keeping the Developer tab out of the store is which profile is submitted. See RA-N1 for a second flag-flip path |
| **SS-02** | S1 | **Partly fixed** (unchanged since Wave 2) | `requireEntitlement` has one call site: `api-server/src/routes/aforce/social.ts:237`. Battles and circle are `requireAuth` only. Trainer routes are server-gated (`routes/trainer.ts`) | Clutch and Guardian are client-flag only (RA-N1). Founder policy ruling on plan-gating battles/circle still open |
| **SS-03** | S1 | **Still open** | Encryption key still optional (`api-server/src/lib/whoopFetchWorker.ts:180` `?? null`, same in oura/garmin/strava). With a key set, writes are dual: plaintext + `pgp_sym_encrypt` (`lib/db/src/whoopTokenStore.ts:335-344`). Plaintext columns `NOT NULL` for all four providers (`lib/db/src/schema/aforce.ts:795,912,991,1077`); no drop migration | Plaintext tokens are stored whether or not keys are set. Backfill, encrypted-only reads, column drop. Whether keys are set in production was not checked |
| **SS-04** | S1 | **Partly fixed** | `POST /api/account/delete-health-data` exists (`api-server/src/routes/accountDeletion.ts:157`): provider tokens, health records, concierge, spatial projects, sharing grants. Its header states it does not delete the account, intake history, referrals, circle membership or billing. `routes/privacy.ts` is share-scope only | No full account erasure (no Clerk user deletion); `aforce_recorded_drinks`, intake logs, score snapshots, scans and profile are left; **no client code calls the endpoint**; no data export anywhere. In-app account deletion is an App Store requirement |
| **SS-05** | S1 | **Still open** | BAC still computed (`services/socialModeEngine.ts:105-113`); "do not drive" commands still in the Home command authority (`utils/scoring/copy.ts:357`, `utils/scoring/commandEvidence.ts:376`); strings in all 11 locale files; three orphaned components remain | Drink-logging surfaces that feed it are dev/internal only, so a production member cannot reach it through the UI. Not traced: a member whose server state already holds drinks from an internal build |
| **SS-06** | S2 | **Fixed** | `DEFAULT_PRIVACY.scope = 'private'` (`data/mockCircleData.ts:42-48`, founder ruling 2026-08-27); server seed matches (`api-server/src/routes/privacy.ts`); sharing columns default false | DB column default is still `"circle"`; rows created before 2026-08-27 unchanged; all five field toggles default true once scope is widened |
| **SS-07** | S2 | **Fixed** | `global_leaderboard_enabled: false` (`featureFlags/flags.ts:46`); competition tab renders `CircleScreenV4`; `CompetitionScreenV2` has no importer. The live `/leaderboard` is the anonymous referral board | Dead code only; `city/state/team_competition_enabled` are still `true` with no mounted consumer |
| **SS-08** | S2 | **Still open** | `RelationshipStatus = 'pending' \| 'active' \| 'muted'` (`types/circle.ts:9`); no block, report or moderation code found; no minor gate | Exposure limited: `circle_membership_enabled` and `circle_sharing_enabled` are false and invitations return 503. Required before either goes on outside internal builds |
| **SS-09** | S2 | **Still open** | "PULL FROM ROTATION. Medical eval." (`utils/scoring/recommendations.ts:134,189`) rendered on `app/guardian.tsx` with the body risk map; no disclaimer in guardian/clutch/trainer-board | Flags default false, but the gate is the client `FeatureGate` (RA-N1) |
| **SS-10** | S2 | **Partly fixed** (no movement since Wave 2) | Photo still sent to the server for vision (`services/smartCaptureApi.ts:62` → `api-server/src/routes/smartCapture.ts`); auth required; no feature-level consent step in `components/SmartCaptureModal.tsx`; no retention setting | The original gate is wrong: Smart Capture is in the production scan screen regardless of `hydro_scan_2_enabled` (`components/scan/HydrationScanScreenV2.tsx:908-913`). See RA-N3 |
| **SS-11** | S2 | **Still open** | Canonical 90/75/60 (`utils/scoring/breakdown.ts`, `config/hydroStateModel.ts`); `theme/statusColor.ts` 5-band at 85/70/50/30; **live** `components/hydration/signalV3Presentation.ts:28-33` at 85/65/40 (also `components/journal/JournalDayCard.tsx`). The spoken PEAK-at-85 line is now dead code (`hooks/useScoreBandVoice.ts` unmounted) | At 85–89 Home says BALANCED while Performance Signal colours the same score PEAK. Second gap at 65–74. `statusColor.ts` is off-limits, so centralising needs a founder decision |
| **SS-12** | S2 | **Partly fixed** | Home hero label is now HYDROSTATE (`locales/en.json:170`) | Same number still called Readiness in the opening cinematic ("TODAY'S READINESS", `en.json:2495`), the hero accessibility label, Protocol, onboarding and evidence copy. Metabolic Readiness has no UI but remains a plan-feature name |
| **SS-13** | S2 | **Fixed** (as written) | `beverageCompetitors.ts` and `beverageComparisonEngine.ts` deleted; the only AForce sodium value is 25 mg (`services/sweatRateEngine.ts:130`) | Science/claims question only: the live scan `comparisonEngine` rewards a higher unitless electrolytes index |
| **SS-14** | S2 | **Partly fixed** | `data/pricing.ts` scrubbed; a claims lint now lists `data/pricing.ts`, `data/flavors.ts`, `data/products.ts` (`utils/__tests__/consumerCopyClaimsLint.test.ts`) | `data/flavors.ts:64-73` still says "Cellular reset", "detox support", "internal cleansing" (not rendered today). The lint vocabulary has no detox/cleansing/alkaline concept, so those pass. "cellular hydration" still rendered on the production scan (`utils/superfoodSignals.ts:115`) |
| **SS-15** | S2 | **Still open** | `SCORE_PROTECTION_MODE` defaults to `off` in production (`api-server/src/lib/scoreWriteGuard.ts:39-41`); `routes/aforce/journal.ts` persists the client score | Phase-3B pre-flight. One blocker cleared (W2-N3). Deployed env value not checked |
| **SS-16** | S2 | **Partly fixed** | No leaderboard on the competition tab; mock engine has no production importer | `/territory` still reachable by deep link on mock data (with a sample-data caption); mock engine and three competition flags remain |
| **SS-17** | S2 | **Partly fixed** | Speech is effectively opt-in: `DEFAULT_COACH_MODE = 'ambient'` (`services/coachMode.ts:49`) and `speak()` returns unless mode is `spoken` (`services/textToSpeech.ts:111-114`) | No clock quiet hours and no OS Do Not Disturb/Focus check once a member chooses Spoken. Silent default depends on `spec_coachV2` staying true (`voiceCoachEnabled` is still `true`) |
| **SS-18** | S3 | **Fixed in code 2026-11-18 (#1216, `main@695bcf88`)** | Profile, Leaderboard and Circle are each wrapped in `ScreenErrorBoundary` (`components/ScreenErrorBoundary.tsx`): a crash shows "This screen didn't load" with a retry and the rest of the app keeps running. Render test `components/__tests__/screenErrorBoundary.render.test.tsx` | Not run on a device. The babel React-Compiler workaround is still present and was left alone |
| **SS-19** | S3 | **Fixed** | `app/modules.tsx:193-196` redirects unless `developerControlsAvailable()`; the only link is gated the same way | Live in internal and demo profiles by design |
| **SS-20** | S3 | **Fixed** | `/social-legacy` redirects unless dev mode; `app/social-v2.tsx` is a redirect stub; one gated mount of the V2 screen | — |
| **SS-21** | S3 | **Still open** | "Heat Risk Prediction" and a "RISK" label render on `screens/HeatRiskScreen.tsx`; `app/heat.tsx` has no gate; the Profile → Cruise path to it is off in store builds since #1218 (2026-11-18), on in internal builds. "RISK" voice-scope pill and notification hints also live | The "injury risk reduction" marketing line is now unreachable (`spec_subscription` true) but still in the file |
| **SS-22** | S3 | **Partly fixed** (mostly open) | Home shows a confidence chip beside the HydroState readout | `Command` type has no verification-method or safe-alternative field; no decline/partial/adjust on the Home command |
| **SS-23** | S3 | **Partly fixed** | Home water and manual drinks ask for an amount; non-water drinks route to the `/drinks` log (`utils/hydration/drinkRoute.ts`) | Production scan screen still logs a scanned product and a replacement in one tap at an assumed full serving (`components/scan/HydrationScanScreenV2.tsx:346-371`); Cruise "log water" is one tap (Cruise is internal-only since #1218); no consumption ladder |
| **SS-24** | S3 | **Still open** | `unitsPerCycle: 2` vs `24` (`data/subscriptionPlans.ts:140,170`) | Both plans still dark (`LAUNCHED_PLAN_IDS` = core, athlete) |
| **SS-25** | S3 | **Still open** | "Take 1 RTD now. Sip 16 ounces of water…" (`locales/en.json:846`) in all locale files | Trigger needs an active social session, which is internal/demo only today. Founder ruling on ordering |
| **SS-26** | S1 | **Partly fixed: contained in store builds 2026-11-18 (#1217, `main@b1cb1da7`)** | Alcohol is removed from the drink picker, search results and Smart Capture corrections unless the build is dev or internal TestFlight (`utils/hydration/drinkAvailability.ts`; test `utils/__tests__/drinkAvailability.test.ts`) | Still no age or region check anywhere. The server still accepts an alcohol entry from any signed-in member (`api-server/src/routes/aforce/recordedDrinksContract.ts`), because internal builds share it. Age/jurisdiction eligibility is required before alcohol returns to a public build. Not run on a device |
| **W2-N1** | S2 | **Fixed** | Production seed is empty (`data/initialUserState.ts:85-88`); mock history only in demo builds | One labelled synthetic "yesterday" entry is still seeded and filtered on Home and Protocol |
| **W2-N2** | S2 | **Still open, larger** | `fallbackLng: 'en'` with no suppression (`services/i18nService.ts:229`); the locale policy gate has no runtime caller | Missing keys now about 476 (es/fr/de/pt/it) and 493 (ar/zh/ja/ko/hi) of 2,606, up from ~340. Founder ruling: validate, suppress, or ship English-only |
| **W2-N3** | S2 | **Fixed in code** | Sensor imports write `score: 0, level: "NOT_COMPUTED"` (`api-server/src/routes/aforce/sensors.ts:51-52`); rollups filter by level | No backfill found for rows written before the fix; database not inspected |
| **W2-N4** | S3 | **Partly fixed** | Analytics id and consent are per member (`analytics/consentAuthority.ts`) | Cart still device-global (`store/useCartStore.tsx`). See RA-N2 |

### New items surfaced by this re-audit (severity for founders to set)

| ID | Item | Evidence |
|---|---|---|
| **RA-N1** | **CLOSED in code 2026-11-17 (#1214, `main@d5754ae5`).** The control now renders and acts only where `featureGateSelfActivationAllowed` permits (`featureFlags/flags.ts`): never in a production build, never for a flag the unlock-all clamp restricts. Not run on a device; server entitlement (SS-02) and the Guardian copy (SS-09) are unchanged. *Original finding:* **`FeatureGate` "Activate Demo" has no build clamp.** Any member who reaches a locked gate can turn the feature on client-side. It wraps Guardian, Clutch, Trainer Board, trainer-athlete and Cruise. The Profile cards are hidden while the flags are false, but the routes exist and the app has a URL scheme, so a deep link reaches the button. This is what makes SS-02 and SS-09 live risks rather than dark code | `components/FeatureGate.tsx:37-40` `setFeatureFlags({ ...state.featureFlags, [flag]: true })` |
| **RA-N2** | **Per-user storage isolation is inert in production.** `per_user_storage_isolation_enabled` is false in `DEFAULT_FLAGS`, so every scoped key resolves to the shared device key (analytics outbox, coach mode, voice settings). Not in the internal-TestFlight overlay either | `featureFlags/flags.ts:70`; `services/userScope.ts:272` |
| **RA-N3** | **Privacy policy contradicts Smart Capture.** The policy says "We do not access your photo library", while Smart Capture offers upload from library and `app.json` declares the photo-library permission. The Wave-1 counsel-review marker is still in the policy | `legal/privacy-policy.md:37`; `components/SmartCaptureModal.tsx:123` |
| **RA-N4** | **CLOSED in code 2026-11-18 (#1218, `main@aebcc678`).** `cruise_mode_enabled` now defaults to `false`; internal TestFlight keeps it on through `CRUISE_INTERNAL_TESTFLIGHT_OVERLAY_FLAGS`; the Profile row is hidden when the flag is off (test `featureFlags/__tests__/cruiseStoreDefault.test.ts`). This is also the PA-08 decision. Not run on a device. `app/heat.tsx` itself still has no gate (SS-21). *Original finding:* `cruise_mode_enabled` was `true` in production defaults although the comment directly above it said it was off for the public binary; Cruise was linked unconditionally from Profile and led to the ungated Heat Risk screen (SS-21) and a one-tap water log (SS-23) | `featureFlags/flags.ts`; `featureFlags/internalTestflightOverlay.ts`; `components/profile/panes/PerformancePane.tsx` |

### Not covered by this pass

Device behaviour; production data and environment values (token encryption keys, `SCORE_PROTECTION_MODE`);
non-English locale wording; the hosted privacy policy; `aforce-site` and other artifacts; anything
outside the 30 rows above.
