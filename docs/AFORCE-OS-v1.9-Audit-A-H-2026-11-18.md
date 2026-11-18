# AFORCE OS: Current-State Audit and v1.9 First Response (A–H)

**Date:** 2026-11-18 · **Code read at:** `main@e142f511` · **Author:** Engineering (Claude Code) for Brandon

**Status of the specifications:** v1.8.3 (amendment, task plan, hydration-loop and One Breath reviews)
and the v1.9 Master Development Directive are **PROPOSED**. Nothing in this document approves them.
C3 (no AI model in One Breath during beta) stands. No feature code was written for this audit.

**How this was produced.** Three read-only code audits (hydration, Moments / One Breath / calendar,
integrations and release plumbing) plus direct reads of the governance set and the five documents
added in this PR. Findings are from code, not from the specs. Nothing here was run on a device.
Items marked **UNVERIFIED** were looked for and not settled.

Paths: `A/` = `artifacts/aforce-os/`, `S/` = `artifacts/api-server/src/`.

---

## A. Current-state audit

Status words: IMPLEMENTED · PARTIAL · MISSING · BLOCKED · CONFLICTING · UNVERIFIED.

### A.1 Hydration

| Feature | Status | What the code does | Evidence |
|---|---|---|---|
| HydroState model version | IMPLEMENTED | `hydrostate-v2.0`, matching the model registry and change record | `A/config/hydroStateModel.ts:61`; `governance/reviews/CR-HYDROSTATE-V2-0.md` |
| Water counts 1:1 | IMPLEMENTED | Plain and bottled water count the entered ounces | `A/utils/hydration/drinkRoute.ts`; `A/utils/__tests__/drinkRoute.test.ts` |
| AFORCE counts as its mixing water | IMPLEMENTED | A stick logs 12 oz and scores exactly as 12 oz of water; canister 18 oz, bulk 16 oz. No low-score or heat bonus | `A/services/__tests__/realApi.intake.test.ts` ("AForce stick", "non-stick formats") |
| Other drinks saved, not counted | IMPLEMENTED | Coffee, tea, soda, juice, sports, energy, smoothie, custom and sparkling go to the drink log with no HydroState change | `drinkRoute.ts`; `S/routes/aforce/` `/drinks` |
| `hydrostate-v3.0` drink rules | MISSING | No v3.0, no retention-factor or water-content table. Old per-category coefficients remain in the catalog but no longer reach the score | `A/data/drinkCatalog.ts:10-31` |
| Milk class; caffeine in mg | MISSING | No milk category. Caffeine is a free-text note only | `drinkCatalog.ts:40-53,95` |
| In-app logging | IMPLEMENTED | One `logIntake` action used by home, scan, hydration, recovery | `A/store/app/actions.ts:121` |
| Water write idempotency | IMPLEMENTED | Client event id; server insert ignores a repeat; unique index | `S/routes/aforce/intake.ts:146-160`; `lib/db/src/schema/aforce.ts:209` |
| Non-water write idempotency | PARTIAL | A new random key per attempt, so a retry can save a duplicate | `A/services/realApi.ts:333` |
| Edit / delete of a drink | PARTIAL | Water: undo within 24 h only, no amended amount. Non-water: neither edit nor delete | `intake.ts:196-275` |
| Widgets, Siri / App Intents, Control Center, Apple Watch, Wear OS | MISSING | No native targets, no `@bacons/apple-targets`, no such plugins | `A/app.json`; no `A/targets/` |
| Phantom Band | PARTIAL | Logging path exists; Bluetooth library is not installed, so it runs on a mock; screen is flag-gated | `A/services/bleService.ts:4-10` |
| Health write-back (water) | MISSING | The app writes nothing to Apple Health or Health Connect; a test asserts DietaryWater is not requested | `A/services/appleHealth.ts:150-165` |
| Daily target | PARTIAL | Fixed 8 units / 96 oz for every member. A personal formula exists but nothing consumes it | `S/lib/aforceState.ts:111-112`; `hydroStateModel.ts:233-263` |
| "Why this target?" | MISSING | No screen explains the target or its inputs | — |
| Clinician fluid-limit setting | MISSING | Not found | — |
| Overdrinking rule (S53) | MISSING | No hourly or daily rule. Only input limits: 200 oz per event on the server, 64 oz on the scan screen | `S/routes/aforce/intakeSchema.ts:40` |
| Weather and freshness | IMPLEMENTED | OpenWeather on the server; stale or untimed readings are kept out of scoring | `S/lib/openWeather.ts`; `A/utils/environment/weatherFreshness.ts` |
| Heat index / WBGT in the score | MISSING | Dry temperature and humidity drive decay; heat index and WBGT appear only in other modules | `A/utils/scoring/breakdown.ts:268-295` |
| Sweat-rate test | PARTIAL | A sweat calculator screen exists; it does not feed the score or any plan | `A/components/sweat/SweatCalculatorScreenV2.tsx`; `A/services/sweatRateEngine.ts` |
| Urine self-check | IMPLEMENTED | Feeds the score (−20 to +8). No morning-specific "WUT" check | `breakdown.ts:128,190` |
| Active energy | PARTIAL | Read on Android (Health Connect), collected, not used in the target or score | `A/services/health/signalResolution.ts:184` |

### A.2 Moments, One Breath, calendar, daily rhythm

| Feature | Status | What the code does | Evidence |
|---|---|---|---|
| Five-tab navigation | IMPLEMENTED | Home · Hydration · One Breath · Moments · Circles, in that order | `A/app/(tabs)/_layout.tsx:44-68,287-338` |
| Moments tab in a store build | PARTIAL | Redirects to Home unless the build is internal TestFlight | `A/app/(tabs)/moments-tab.tsx:8-9` |
| Profile from the member photo | UNVERIFIED | The Profile tab is hidden from the bar. Four searches found no visible button that opens it, only redirects. Needs a device check | `_layout.tsx:341-344` |
| Moment model | IMPLEMENTED | `Moment` and `MomentPreparation`, stored on the device only, keyed per member | `A/types/moments.ts:36-88`; `A/services/momentsStore.ts` |
| Loop stages | PARTIAL | Spot, Plan, Seal, Lock In, Return and Replay have screens (internal builds). "Today", "Before" and "Learn" as the specs describe them do not | `A/components/oneBreath/MomentPreparationScreen.tsx:96-106` |
| Confirmation window, read-back, Undo | IMPLEMENTED (internal) | Built to spec v1.8.2; device run not done | `A/utils/oneBreath/confirmationWindow.ts` |
| `MomentHydrationStep`; drink-to-Moment matching | MISSING | A "hydrate" ritual step copies the current command. No step object, no matching | `A/services/momentPreparation.ts:23-60` |
| Recurring Moments, "Same as last time" | MISSING | — | — |
| Obstacle question / if–then line | MISSING | — | — |
| Device calendar reading | IMPLEMENTED, flag off | Read-only; calendar picker; keyword classifier; masked private events; dismiss memory with "never"; change prompt. Events stay in memory | `A/services/calendarBridge.ts:81-141`; `A/services/momentClassification.ts`; flag `moments_calendar_enabled: false`, legal-gated |
| Calendar permissions | PARTIAL | iOS strings present. Android calendar permissions are not listed explicitly; whether the plugin adds `WRITE_CALENDAR` is UNVERIFIED | `A/app.json:131-134` |
| Morning / evening cards, Plan your week | MISSING | Only "Prepare My Day", a 7-day picker | `A/components/moments/PrepareMyDayScreen.tsx` |
| Replay and Learn | PARTIAL | Replay is a private Yes / Not really. "Learning" only tunes notification lead time. No lesson is kept or reused | `A/services/momentFeedback.ts` |
| AI model in One Breath | none (C3 holds) | Drafts are parsed by fixed rules | `A/services/oneBreathDraft.ts`; `A/types/moments.ts:81` |
| Quiet hours | PARTIAL | Fixed 22:00–07:00, a 60-minute gap, a daily cap, and silence during Lock In. No Focus / Do Not Disturb check | `A/services/momentNotifications.ts:86-142` |
| Lock-screen privacy | MISSING | The notification title includes the Moment title | `momentNotifications.ts:166-167` |
| Circle sharing of Moments | IMPLEMENTED, flag off | Shares id, title, start time; manual Moments only | `A/services/circleMomentSharingService.ts:20-26` |
| Streaks / leaderboards | PARTIAL | `/leaderboard` and `/achievements` have no flag gate and are linked from Profile panes | `A/components/profile/panes/AccountPane.tsx:172`, `PerformancePane.tsx:333` |

### A.3 Platform, integrations, release plumbing

| Area | Status | Notes | Evidence |
|---|---|---|---|
| Versions | — | Expo 54.0.35, React Native 0.81.5, expo-router 6.0.24, expo-calendar 15.0.8, drizzle-orm 0.45.2, Clerk Expo 3.2.2, Stripe 22.x | `A/package.json` |
| Apple Health | IMPLEMENTED, read-only, flag off | Reads heart rate, resting HR, HRV, steps, sleep, workouts | `A/services/appleHealth.ts:150-165` |
| Health Connect | IMPLEMENTED, read-only | Eight read permissions including active calories; `health_google_connect_enabled` is **true** by default | `A/featureFlags/flags.ts:445` |
| Providers | PARTIAL | WHOOP, Garmin, Oura, Strava routes mount only when credentials exist. WHOOP has no client flag | `S/routes/index.ts:258-414` |
| Analytics | PARTIAL | First-party, consent-gated on client and server, event types allow-listed. **Payload fields are not enforced**, so free text could be stored | `lib/analytics-contract/src/zod.ts:34`; `S/routes/aforce/analytics.ts:70` |
| Third-party tracking SDKs | none | No Sentry, PostHog, Segment, Amplitude, Mixpanel, Firebase | all `package.json` |
| Useful-days metric | MISSING | — | — |
| Locales | PARTIAL | 11 locales; parity test covers some key families only | `A/utils/__tests__/nonEnLocaleParity.test.ts` |
| Accessibility | PARTIAL | Ad-hoc label assertions in about 30 tests; no lint | — |
| CI | IMPLEMENTED | typecheck, tests-baseline, focused-health, db-lane (Postgres), governance-drift, integration (Docker) | `.github/workflows/` |
| Migrations | PARTIAL | `drizzle-kit push` plus 7 hand-applied SQL files. **No single list of what production has** | `lib/db/migrations/` |
| Feature flags | — | 128 flags, 38 default on | `A/featureFlags/flags.ts` |
| Railway health check | MISSING | `railway.toml` has no `healthcheckPath` | `railway.toml` |
| Account deletion | PARTIAL | Stages 1–2 of 5 merged; endpoint switched off | `lib/db/src/accountDeletionRegistry.ts`; `S/routes/accountDeletion.ts` |

### A.4 Defects found in what already ships (independent of the new specs)

1. **Smart Capture shows "{pct}% hydration credit"** for non-water drinks, which contradicts v2.0 (`A/components/SmartCaptureModal.tsx:400`, `A/locales/en.json:1365`).
2. **A retried non-water drink log can duplicate** (`A/services/realApi.ts:333`).
3. **No edit or delete for a logged drink.** The specs assume both.
4. **Analytics payloads are not allow-listed** on the server.
5. **Notification titles carry the Moment title** onto the lock screen.
6. **`/leaderboard` and `/achievements` are reachable without a flag**, against "no streaks, no leaderboards".
7. **Two test titles in `realApi.intake.test.ts` are stale** ("baseImpact = 10", "+2 depleted bonus"); the assertions are correct.
8. **The catalog header still says coefficients set score impact.** They do not.

---

## B. Specification reconciliation

| # | Conflict | Sources | Governing position today | Needed |
|---|---|---|---|---|
| B1 | `hydrostate-v3.0` counts coffee, tea, sparkling and later others | Amendment §2.1; directive §5.2 | **C1 / `hydrostate-v2.0`: water and AFORCE only** | Julius (science, D-09 §1.3) + both founders. Until then v3.0 may only exist flagged off |
| B2 | Bounded AI model inside One Breath | Amendment §1.4; One Breath review 2.1; directive §8 | **C3: no model in beta.** `AFORCE_OS_AI_VOICE_SPEC.md` limits AI to explaining fixed outputs | Founder decision #66, plus #41, #42, a data agreement and consent. Not to be built now |
| B3 | Proposed `CLAUDE.md` as rules 15–32 | Task plan setup step 1 | Repo `CLAUDE.md` and Build Rules 1–14; Rule 12 freezes new principles without both founders | Both founders adopt or decline. Saved as a proposal, not installed |
| B4 | Server path `server/src/...` | Task plan, proposed rules 25, P0-1, P1-7 | The server is `artifacts/api-server/src/` | Correct the documents before running tasks |
| B5 | P0-1 asks for a new registry at `server/src/lib/memberDataRegistry.ts` and to extend the deletion route | Task plan P0-1 | Already built differently: registry and executor in `lib/db`, endpoint `POST /api/account/delete`, switched off (PRs #1221, #1222) | Re-scope P0-1 to what is left: Clerk + Stripe, in-app screen, export, Sign in with Apple |
| B6 | Amendment §1.1 says spec v1.8.2 Part 1 states AFORCE is not counted | Amendment §1 | Code already counts AFORCE as mixing water. The amendment's correction matches the code | Docs-only fix (task P0-9) |
| B7 | Drink table includes milk and diet soda | Amendment §2.1 | Catalog has no milk or diet-soda category | Part of P1-1 if approved |
| B8 | Hydration step matches drinks in a fixed 4-hour window | Hydration-loop A.5 | The v1.9 directive §6 says do not use one universal window and separates daily intake, Moment preparation and during-Moment intake | Julius decides the attribution rule before OB-11 is built |
| B9 | Calendar events stay on the device | Hydration-loop B.3, B.6 | Code already does this; Circle sharing takes manual Moments only. A member could still copy a calendar title into a manual Moment and share it | Accept, or add a warning. Founder call |
| B10 | Calendar read window "now to +8 days", offers in a morning card | Hydration-loop B.3, B.5 | Calendar code exists with its own picker, classifier and dismiss memory; no morning card | OB-12 should extend the existing code, not rebuild it |
| B11 | Nudges and touches respect Focus and Do Not Disturb | Amendment §2.9; proposed rule 23; SS-17 | Code has clock quiet hours only | Device-capability check, then a decision on what "respect DND" means where the OS gives no signal |
| B12 | Ritual spelling "Lock In" | Directive header | Registry note uses "LOCK IN"; site and app prototype use "LOCK-IN" (founder preference recorded earlier) | Brandon picks one spelling |
| B13 | "Profile opened from the member photo" | Proposed rule 20; directive §11 | Not found in code (A.2, UNVERIFIED) | Device check; fix if confirmed |
| B14 | Phase names | Task plan Phases 0–3 and "OB"; directive Phases 0–3 | `governance/Phase-Roadmap.md` Phases 0–4 mean something else (Founder Build, Founding 200, …) | Rename the build phases in the new documents to avoid two meanings |
| B15 | P0-3 and P0-7 say **delete** BAC logic and the Heat Risk screen | Task plan; proposed rule 27 | Your instruction for this work: preserve what works; delete only with a verified reason. SS-05 and SS-21 are open stop-ship rows | Founder decision per item: delete vs keep gated |
| B16 | P0-5 centralises score bands and renames "Readiness" | Task plan P0-5 | Band definitions and status colours are off-limits files | Explicit founder approval for that edit, and the band choice (SS-11) |
| B17 | P0-8 turns on `per_user_storage_isolation_enabled` | Task plan P0-8 | The flag is `false` in defaults (`flags.ts:70`) and `true` in another set (`flags.ts:509`) | Confirm which builds have it on before changing anything |
| B18 | 18+ age check at account creation | Amendment §4; P0-3 | No age check exists | Founder + counsel |

---

## C. Stop-ship review

From `governance/AFORCE_OS_STOP_SHIP_REGISTER.md` §5 as updated today: 8 fixed, 1 fixed for store builds only, 11 partly fixed, 10 open.

**Blocking outside testers:**

| ID | State | What remains |
|---|---|---|
| Clerk | Open | Client and server are on the development instance. Migration plan unexecuted (founder step) |
| SS-03 | Open | Provider tokens can still be stored in plaintext. Needs encrypted-only writes, backfill, column drop |
| SS-04 | Partly | Deletion list and switched-off endpoint merged. Left: Clerk user + Stripe cancel, in-app screen, export. Needs Julius (K-3) and counsel on 14 flagged rows |
| SS-05 | Open | BAC and "do not drive" logic is still in the build (unreachable in store builds) |
| SS-26 | Partly | Alcohol hidden in store builds. No age check; server still accepts alcohol |
| SS-02 | Partly | One server entitlement check exists. Enterprise surfaces are client-flag only |
| SS-11 / SS-12 | Open / partly | Several band sets; "Readiness" still names the HydroState number in places |
| SS-14 | Partly | "Cellular reset", "detox support" in `data/flavors.ts:64-65` (not rendered today); "cellular hydration" in the scan signals |
| SS-21 | Open | `app/heat.tsx` has no gate (the Profile path to it is off in store builds) |
| RA-N2 / RA-N3 | Open | Storage isolation default; privacy policy vs Smart Capture photo access |
| New (this audit) | Open | A.4 items 1–6 |

**Not re-checked in this audit:** commerce proofs (Stripe test purchase, Shopify webhooks), CR-1 claims review booking, beta operations, the device run of `ONE-BREATH-DEVICE-QA.md`.

---

## D. Proposed v1.9 architecture

This describes how the pieces would connect **if approved**. It reuses what exists.

**One intake record.** Every surface (app, widget, watch, Siri, bottle) writes the same confirmed-drink record through the existing `logIntake` path with a client event id. Non-water logs get the same idempotency as water (fixes A.4 item 2). Edits and deletes become first-class and propagate to anything that references the log.

**One counting function.** `drinkRoute` grows into a rules lookup (`DRINK_RULES` in `config/hydroStateModel.ts`) that returns counted volume. HydroState, the ring, the Moment hydration step and Health write-back all call it. With the v3.0 flag off its output is identical to v2.0, proved by a golden test.

**Target as a list of lines.** A pure `computeTarget()` returns the total plus each line with its source and time, and a list of inputs left out. The "Why this target?" sheet renders that list. The clinician setting removes volumes everywhere.

**Safety layer on top.** Overdrinking rules and the clinician setting sit in the existing deterministic guard (`A/utils/intelligence/decisionGuard.ts`). Lessons, preferences and any future model cannot override them.

**Moments reference drinks; they do not own them.** A hydration step holds references to matching log ids and a computed sum. Daily intake is always the sum of logs, so a drink referenced by two Moments is still counted once. Three separate ideas: daily intake, Moment preparation (rule per Moment kind, B8), during-Moment intake.

**Calendar stays on the device.** Device calendar → normaliser → filter → keyword classifier → offer → member reviews → member seals. Only fields the member plans with enter a Moment. Nothing is created, sealed or shared automatically.

**Approval boundaries.**

| Action | Who can do it |
|---|---|
| Create, seal, share or materially change a Moment | The member only |
| Shift a sealed Moment's time after a calendar time-only change | Automatic, counts as one of 3 touches (C7), member told once |
| Count a drink toward HydroState | Fixed rule with an approval row; never a model |
| Suggest a volume | Playbook value, capped by the safety layer; never under the clinician setting |
| Interpret free text in One Breath | Fixed rules today (C3). A bounded model only after #66 |

---

## E. Prioritised development backlog

Owners: **B** Brandon, **J** Julius, **S** scientific approver (currently Julius), **C** counsel. "Flag off" means built and merged dark.

### E.0 Release integrity (first)

| ID | Task | Depends on | Main files | Done when | Approval |
|---|---|---|---|---|---|
| R-1 | Fix shipped defects A.4 items 1, 2, 7, 8 | — | `SmartCaptureModal.tsx`, `realApi.ts`, `drinkCatalog.ts`, tests | "% hydration credit" gone for uncounted drinks; a retried drink log is saved once (test) | B |
| R-2 | Account deletion stage 3: Clerk user + Stripe cancel (fakes only) | #1222 | `S/routes/accountDeletion.ts` | End-to-end test: member gone, subscription cancelled, order safe on failure | B, J (K-3), C |
| R-3 | Account deletion stage 4: in-app screen | R-2 | Profile panes, `locales/en.json` | Render test; copy passes claims lint | B |
| R-4 | Export (stage 5) from the same registry | #1221 | new route | Export contains every registry table (test) | B, C |
| R-5 | SS-03 encrypted-only tokens, backfill, drop plaintext | — | `lib/db/src/*TokenStore.ts`, migrations | No plaintext column; fail-closed read test | B (touches production data: founder runs the migration) |
| R-6 | Analytics payload allow-list on the server | — | `lib/analytics-contract`, `S/routes/aforce/analytics.ts` | An undeclared field is rejected (test) | B |
| R-7 | Lock-screen privacy: generic notification title by default | — | `momentNotifications.ts` | Title shows "Your 10 AM Moment" unless the member opts in | B, J |
| R-8 | Gate or remove `/leaderboard`, `/achievements` | — | Profile panes, routes | Not reachable in a store build (test) | B, J |
| R-9 | Server entitlements for enterprise routes (SS-02) | Founder policy | `S/routes/` | 403 contract tests | B, J |
| R-10 | BAC / "do not drive" and Heat Risk: delete or keep gated | Decision B15 | per decision | per decision | B, J, C |
| R-11 | Age check and alcohol gate (SS-26) | Decision B18 | Clerk metadata, server | Server-verified; alcohol hidden by default | B, C |
| R-12 | Claims cleanup (SS-14) and lint vocabulary | — | `data/flavors.ts`, `superfoodSignals.ts`, lint test | Lint fails on a seeded bad string | B |
| R-13 | Railway health check; production migration ledger | — | `railway.toml`, new governance doc | Health route answers; one list of applied migrations | B |
| R-14 | Docs corrections (B4, B6, B14) | — | the five documents | Paths and phase names corrected | B |
| R-15 | Clerk production migration | — | founder-run | — | B |

### E.1 Hydration foundation (flag off until approved)

| ID | Task | Depends on | Done when | Approval |
|---|---|---|---|---|
| H-1 | Drink edit and delete, with propagation | R-1 | Edit and delete tests for both rails | B |
| H-2 | `DRINK_RULES` and v3.0 counting behind `drink_rules_v3_enabled` | H-1 | Flag off = identical to v2.0 (golden test); table-driven tests per class | J, S (#50) |
| H-3 | Target contract, "Why this target?", clinician setting | — | Tests for every line, clamp, missing input; no volume anywhere under the clinician setting | J, S (#51) |
| H-4 | Overdrinking rules S53 | H-3 | Each rule tested; a lesson cannot raise the ceiling | J, S (#53) |
| H-5 | iOS widgets, App Intent, Control Center | H-1 | Queue reconciliation and duplicate tests; device checks marked | B (#56); new dependency needs approval |
| H-6 | Health write-back | H-1, H-2 | Mapping and dedupe tests; device checks marked | B (#58) |
| H-7 | Heat index and WBGT | H-3 | Matches published NWS values; fallback when solar data is missing | J, S (#54) |

### E.2 Moments and daily intelligence (flag off)

| ID | Task | Depends on | Approval |
|---|---|---|---|
| M-1 | Recurring Moments and "Same as last time" | — | B, J (#63) |
| M-2 | `MomentHydrationStep` using the H-2 function | H-2, M-1, decision B8 | J (#69) |
| M-3 | Extend the existing calendar code: 8-day window, offers, series, change handling; lint against calendar writes; Android permission check | M-1 | B, J, C (#70; flag is legal-gated) |
| M-4 | Morning and evening cards, Plan your week | M-1, M-3 | B, J (#62) |
| M-5 | Obstacle question; hydration experiments | M-2 | J (#65, #68) |
| M-6 | Useful-days measure | R-6 | J (#67) |

### E.3 Personal intelligence (later)

Sweat-rate test and profiles (#52, D5a), active energy input (#61), behind-pace nudges (#57), morning check (#55), watch and Wear OS, direct Google / Microsoft calendars (#71), .ics links (#72), bounded One Breath model (#66), smart bottles and sweat sensors.

---

## F. Risk register

| Area | Risk | Mitigation |
|---|---|---|
| Science | Drink factors come from one study of 72 fasted men drinking 1 L in 30 minutes | Factors stay 1.0, marked proposed; reviewer approves each class; copy says "counted as", never a prediction |
| Science | A hydration step implies timing or volume advice | Fixed playbook values, capped by S53, timing-only under the clinician setting |
| Safety | No overdrinking rule exists today; adding widgets makes logging (and volume prompts) easier | Build H-4 before or with H-5 |
| Privacy | Calendar titles and free text are sensitive | Device-only calendar; generic lock-screen titles (R-7); analytics allow-list (R-6) |
| Privacy | New personal data without a deletion path | The registry test already fails when a table is missing; add export the same way |
| Security | Plaintext tokens (SS-03); client-only entitlements (SS-02) | R-5, R-9 before outside testers |
| Legal | Health Breach Notification Rule, Washington My Health My Data, age | Counsel review; no claim of compliance from engineering |
| Technical | Widgets, watch and App Intents need native targets the project has never built | One dependency (`@bacons/apple-targets`) proposed in its own PR; device-only verification |
| Technical | No list of which migrations production has | R-13 before any new migration |
| Technical | The deletion endpoint, if switched on early, leaves a subscription running | It stays off until R-2 ships |
| UX | Five new daily surfaces risk the "calm by default" promise | Touch-budget test: none adds an automatic touch |
| Delivery | 30+ tasks across two proposed specs with most approvals unsigned | Release integrity first; everything else merged dark |
| Governance | Running tasks from documents with wrong paths or superseded scope | R-14 first |

---

## G. Founder decision register

**Both founders (Build Rule 12 or a [JB] item):**

1. Adopt, amend or decline v1.8.3 and v1.9 as specifications.
2. Adopt the proposed build rules 15–32 (B3).
3. K-3: full account deletion scope. Brandon decided on 2026-11-18; Julius's sign-off is not recorded.
4. D5a (measured sweat profile may set an in-Moment amount) and the Constitution #4 annotation.
5. #66: a bounded model in One Breath (reverses C3). Not for beta.
6. #62, #63: daily rhythm; recurring Moments.
7. Coach personas vs one voice (amendment §1.3).
8. Delete vs keep-gated for BAC logic, Heat Risk and the dark modules (B15).
9. SS-11 band set, and approval to edit the off-limits band and colour files (B16).
10. SS-02 policy: which surfaces need a server entitlement.

**Julius (science, D-09 §1.3):** #50 drink rules and each class; #51 target values and floor/ceiling; #53 S53 values and wording; #54 heat bands; #52 sweat test values; #55 morning check; #69 hydration playbook lines and the attribution rule (B8); #73 Replay wording; #67 cohort targets; #60 AFORCE product facts.

**Brandon:** #56 logging surfaces and the new native dependency; #58 write-back; #64 / #70 calendar in beta; #71, #72 later tiers; ritual spelling (B12); who runs the Clerk and token migrations and when; whether a copied calendar title in a shared Moment needs a warning (B9).

**Counsel:** the 14 flagged deletion rows; age check and alcohol gate; breach runbook; consumer health data policy; calendar consent copy; privacy policy vs Smart Capture; any data agreement for a model provider.

---

## H. Initial implementation plan

**Recommended first pull request: R-1, the shipped-defect fixes.**

- Remove "% hydration credit" from Smart Capture for drinks that do not count.
- Give non-water drink logs a stable client event id so a retry cannot duplicate.
- Correct the two stale test titles and the catalog header comment.

**Why first.** It needs no new approval, because it brings shipped behaviour into line with a decision already made (C1, v2.0). It touches the hydration accounting that every later task builds on. It is small and changes no score.

**How it is verified.** A unit test that a retried drink log is saved once; a render test that Smart Capture shows no credit for a recorded drink; the v2.0 golden outputs unchanged; typecheck and the app suite. Nothing in it needs a device, though Smart Capture should be looked at on a phone before the next build.

**Second:** R-14 (document corrections), then R-2 (deletion stage 3) once Julius signs K-3 and counsel has the 14 rows.

**Not started, by instruction:** anything from v1.8.3 or v1.9 that needs an approval row.
