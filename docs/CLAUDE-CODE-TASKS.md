# AFORCE OS: Claude Code Task Plan (v1.8.3)

## Before you start

**Setup (once):**
1. Copy `CLAUDE.md` to the repo root. Rules 15–32 then load automatically in every Claude Code session.
2. Copy `AFORCE-OS-Spec-v1.8.3-Amendment.md` and this file into `docs/`.
3. Commit the three files.

**How to run each task:**
1. Open a fresh Claude Code session at the repo root.
2. Paste the shared preamble below, then the task's prompt.
3. Review the PR against the task's acceptance criteria.
4. Merge only when the tests pass.

Each task is one PR on its own branch (`v183/<task-id>`).

**The order matters:**
- Phase 0 must be green before outside testers.
- Phase 1 is the hydration core.
- Phase 2 makes it personal.
- Phase 3 adds connections.

Tasks marked **[approval]** can be built and merged with the flag off. They go live only after the sign-off row in Spec §9 is filled in.

---

## Shared preamble (paste first, every task)

```
You are working in the AFORCE OS repo. Follow CLAUDE.md rules 1–32 exactly.
Read docs/AFORCE-OS-Spec-v1.8.3-Amendment.md (the section named in this task),
governance/AForce-Constitution.md and governance/AFORCE_OS_STOP_SHIP_REGISTER.md
before writing code. Read every file you will change and its tests first.
Work only on this task. New behavior goes behind a flag defaulting to false.
Tunable numbers go in config/hydroStateModel.ts with source, status:'proposed',
approvedBy:null. New strings go in locales/en.json. New personal data goes into
export and the deletion path in the same PR. Write tests. At the end, list:
files changed, tests added, anything marked [D]/[?] you could not verify,
and any conflict you found between spec and code.
```

---

## Phase 0: Must-fix before outside testers

### P0-1 Full account deletion and export (SS-04) · Spec §5

**Prompt:**
```
Task P0-1. Implement full account deletion and data export per Spec §5.
1. Create server/src/lib/memberDataRegistry.ts listing every table and column
   holding member data (search lib/db/src/schema for user_id/member_id FKs).
   It must include aforce_recorded_drinks, intake logs, score snapshots,
   sharing grants, aforce_circle_statuses, lessons, Replays, voice words,
   shortcuts and provider tokens. Add a test that fails if a schema table with
   a member FK is missing from the registry.
2. Extend server/src/routes/accountDeletion.ts to erase every registry table,
   delete the Clerk user, cancel any Stripe subscription, revoke Sign in with
   Apple tokens if present, and log a per-table result without personal data.
3. Add GET /api/account/export returning a JSON file of the same registry.
4. Add Profile → What AFORCE remembers → Delete account screen: what is
   deleted, what billing records are kept, how long it takes, confirm step.
5. Keep POST /api/account/delete-health-data working.
```
**Acceptance:**
- The registry test passes.
- An end-to-end test shows a seeded member is gone from every table, Clerk and Stripe (mocked).
- Export contains every registry table.
- The screen render test passes.
- Copy passes the claims lint.

### P0-2 Encrypt provider tokens (SS-03)

**Prompt:**
```
Task P0-2. In lib/db/src/whoopTokenStore.ts and every other provider token
store (WHOOP, Oura, Garmin, Strava), write encrypted-only. Add a migration that
backfills encrypted values from plaintext, then a second migration that drops
plaintext columns. Reads must fail closed if decryption fails. Add tests for
write, read, backfill and the failure path.
```
**Acceptance:** no plaintext token column remains. All existing token tests pass, plus the new ones.

### P0-3 Delete BAC and "do not drive" logic; gate alcohol (SS-05, SS-26)

**Prompt:**
```
Task P0-3. Find and delete all BAC estimation and "do not drive" logic,
routes, screens, strings and tests (rule 27). Then add an 18+ age check at
account creation (Clerk metadata, server-verified) and keep the alcohol drink
class hidden unless age_verified && alcohol_logging_enabled (default false).
```
**Acceptance:**
- `rg -i "bac|blood alcohol|do not drive"` finds nothing in app or server code.
- Age-check tests pass.
- Alcohol is hidden by default.

### P0-4 Server entitlements (SS-02, RA-N1)

**Prompt:**
```
Task P0-4. For every enterprise/dark module route (Guardian, Clutch, Cruise,
Heat Risk, competition), add server-side entitlement checks, or remove the
route from the production binary if it is not planned for beta. Force
featureGateSelfActivationAllowed=false in every production EAS profile and add
a test that builds production flags and asserts it.
```
**Acceptance:** contract tests show a 403 for unentitled members, and the production-flags test passes.

### P0-5 One score band set and one name (SS-11, SS-12) **[approval: band choice]**

**Prompt:**
```
Task P0-5. Centralize HydroState bands in config/hydroStateModel.ts as
HYDROSTATE_BANDS and make every surface (Home hero, Performance Signal, Circle,
widgets later) read from it. Add a test that greps for literal band numbers
outside config and fails. Replace every user-facing "Readiness" that refers to
the HydroState number with "HydroState" in locales/en.json, including
en.json:2495, the hero accessibility label, Protocol, onboarding and evidence
copy. Leave the band VALUES as the current Home values and mark
status:'proposed' — the founders choose the final set.
```
**Acceptance:** the no-literal-bands test passes, and the "Readiness" string search is clean.

### P0-6 Claims cleanup (SS-14)

**Prompt:**
```
Task P0-6. Remove "Cellular reset", "detox support", "internal cleansing"
from data/flavors.ts:64-73 and "cellular hydration" from
utils/superfoodSignals.ts:115. Extend
utils/__tests__/consumerCopyClaimsLint.test.ts vocabulary with: detox,
cleanse/cleansing, alkaline, cellular, "more is better", "keep going",
"great job" (volume praise). Run it across locales/en.json and data/.
```
**Acceptance:** the lint passes, and it fails on a seeded bad string.

### P0-7 Heat Risk screen (SS-21)

**Prompt:**
```
Task P0-7. Delete app/heat.tsx and screens/HeatRiskScreen.tsx and their
routes/strings/tests. The replacement is Task P1-6. Confirm nothing links to
them.
```

### P0-8 Beta plumbing

**Prompt:**
```
Task P0-8. Add healthcheckPath to railway.toml pointing at an existing health
route (create GET /healthz if none). Turn on per_user_storage_isolation_enabled
for production behind a migration test that proves one member's cache is not
readable after sign-in as another. Update the privacy policy text
(routes/privacy.ts / policy.md) to describe Smart Capture photo-library access
accurately (RA-N3). Do not touch Clerk production migration — that is a
founder-run step; just verify the plan file is current.
```

### P0-9 Spec corrections · Spec §1

**Prompt:**
```
Task P0-9. Docs only. Apply Spec §1 corrections 1.1, 1.2, 1.6 and 1.7 to the
spec source files in governance/ and docs/. Re-render the Part 4 register as
one row per item in numeric order and append #50–#61 from Spec §8. Leave 1.3,
1.4, 1.5 and 1.8 as "Founder decision required" notes.
```

---

## Phase 1: Hydration core

### P1-1 Drink rules, hydrostate-v3.0 (#50) **[approval]** · Spec §2.1

**Prompt:**
```
Task P1-1. Implement Spec §2.1.
1. Add DRINK_RULES to config/hydroStateModel.ts: drinkClass → {waterContent,
   retentionFactor, counted, status, source, approvedBy}. Seed from the §2.1
   table. Only water_still and aforce are counted:true/approved (C1). All
   others status:'proposed'.
2. Refactor utils/hydration/drinkRoute.ts so countedMl = volumeMl ×
   waterContent × retentionFactor when counted && (approved || flag
   drink_rules_v3_enabled in non-production). Use HydroScan product water
   content when present.
3. Save caffeineMg as a separate field when known; never change HydroState with it.
4. Add the model registry row hydrostate-v3.0 and a release note draft.
5. Update the Log a drink sheet copy to "+12 oz coffee · counted as 12 oz of
   water" and add a Why? line per class.
6. Keep alcohol hidden (P0-3).
```
**Acceptance:**
- Table-driven tests cover every class.
- With the flag off, outputs are identical to v2.0 (golden test).
- With the flag on, sparkling water, coffee and tea count 1:1.
- Copy passes the lint.

### P1-2 Overdrinking safety rule (#53) **[approval: values]** · Spec §2.5

**Prompt:**
```
Task P1-2. Create utils/hydration/intakeSafety.ts implementing S53.1–S53.6 as
pure functions, wired into the deterministic safety layer
(utils/intelligence/decisionGuard.ts). Values from config
(inMomentCeilingMlPerH, rapidIntakeMl, dailyExcessFactor, scaleNoiseKg), all
proposed. If a value is proposed and the build is production, use the most
conservative behavior: no in-Moment volume suggestions above the playbook
default, and show S53.2/S53.3 lines only in internal builds. Prove lessons
and preferences cannot override the result. Flag: intake_safety_enabled.
```
**Acceptance:**
- Unit tests cover each rule.
- An override test shows a lesson can't raise the ceiling.
- The rolling-window test is deterministic across midnight.

### P1-3 Target contract and clinician limit (#51) **[approval]** · Spec §2.2

**Prompt:**
```
Task P1-3. Create utils/hydration/dailyTarget.ts: computeTarget(inputs) →
{targetMl, lines:[{label, ml, source, at}], excluded:[{label, reason}]}
per Spec §2.2. Inputs: baselineChoice (2200/3000/custom), pregnancy/lactation
(optional, member-entered in Profile → Hydration with consent), heat_ml (stub
0 until P1-6), activity_ml (stub 0 until P2-1), moment_ml. Clamp to
floor/ceiling. Build the "Why this target?" sheet from lines. Add Profile →
Hydration → "My clinician sets my fluid limit": when on, ring shows intake
only, no target, no volume plan lines, no nudges. Ask for the starting point
in context on first Hydration tab open (no signup field, D11). Existing
members keep their current target labeled "starting point" until they choose.
Flag: target_contract_enabled.
```
**Acceptance:**
- Unit tests cover every modifier, the clamp and missing-data exclusion.
- A render test covers the Why sheet.
- The clinician-limit test checks that no volume appears anywhere: ring, plan lines and widgets.

### P1-4 Logging everywhere: phone (#56) · Spec §2.8

**Prompt:**
```
Task P1-4. Add iOS extensions with @bacons/apple-targets (Expo SDK 53+):
1. targets/widget: small/medium Home Screen widgets and Lock Screen
   circular/rectangular accessories showing ring + "42 of 96 oz · as of 2:41 PM".
   Medium shows up to 3 saved drinks as interactive buttons (AppIntent).
2. An App Intent "LogDrinkIntent(drink, amountMl)" + App Shortcuts phrases
   ("Log a drink in AFORCE", "Log 16 ounces of water in AFORCE"); used by
   Siri, Action Button and an iOS 18 Control Center control "Log my usual".
3. Shared App Group storage: the app writes today's totals and saved drinks;
   the extension queues logs; the app reconciles the queue on launch/foreground
   and posts to the existing /drinks route. Undo: the widget shows "Logged ·
   Undo" for 5 s; undo removes the queued item.
4. Android: propose a library for a Glance home widget and Quick Settings tile
   in the PR before adding it.
No HydroState color on the Lock Screen. Flag: logging_shortcuts_enabled.
```
**Acceptance:**
- Unit tests cover queue reconciliation, including duplicate protection and the Undo window.
- Mark device verification as [D].
- Widget strings are localized.

### P1-5 Watch logging (#56)

**Prompt:**
```
Task P1-5. Add a watchOS target (via @bacons/apple-targets) with a
complication and a quick-log screen using the same LogDrinkIntent and App
Group/WatchConnectivity queue. Propose the Wear OS tile approach in the PR.
Flag: watch_logging_enabled.
```

### P1-6 Health write-back (#58) · Spec §2.10

**Prompt:**
```
Task P1-6. Write each confirmed drink to HealthKit dietaryWater (mL,
HKMetadataKeyWasUserEntered, HKMetadataKeySyncIdentifier=drink id,
HKMetadataKeySyncVersion) and Health Connect HydrationRecord
(clientRecordId=drink id). Edits replace, deletes delete. On read, ignore
samples whose source is AFORCE. Add a separate write-permission step in
Profile → Devices and apps. Flag: health_writeback_enabled.
```
**Acceptance:** unit tests for the mapping and dedupe pass. Device checks are marked [D].

### P1-7 Heat index and WBGT (#54) **[approval: bands]** · Spec §2.4

**Prompt:**
```
Task P1-7. Create utils/environment/heatIndex.ts implementing the NWS
Rothfusz regression with both adjustments and the Steadman simple formula
below ~80°F, exactly as published by NOAA WPC. Create
server/src/lib/wbgt.ts wrapping the Liljegren (2008) outdoor WBGT model
(port of the open-source C, keep the Argonne license notice) with inputs:
temp, RH, wind, solar irradiance, pressure, lat/lon, time. If solar or wind is
missing, return {available:false} — never estimate. Add HEAT_BANDS
(heat index and WBGT) to config as proposed. Replace the ≥82°F air-temp trigger
for "Start water two hours before, not one" with "heat index or WBGT ≥ first
band" behind flag heat_model_v2_enabled; feed heat_ml into P1-3.
```
**Acceptance:**
- The heat index matches published NWS table values within 1°F across a test grid.
- WBGT matches reference outputs from the C code.
- A test shows the fallback when solar data is missing.

---

## Phase 2: Personal

### P2-1 Active energy input (#61) **[approval: k, baseline]** · Spec §2.3

**Prompt:**
```
Task P2-1. Add read permission for HealthKit activeEnergyBurned and Health
Connect ActiveCaloriesBurnedRecord. Do not read steps. Compute activity_ml =
k × max(0, activeKcal − baselineKcal), excluding energy inside planned Moment
windows. Feed it into dailyTarget lines with source and time. Never render
active energy as its own value outside the Why sheet. Update the Devices
table copy. Flag: active_energy_target_enabled.
```
**Acceptance:**
- Unit tests show the Moment-window exclusion.
- A UI search test finds active energy only in the Why sheet.
- Active energy is included in export and deletion.

### P2-2 Sweat-rate test (#52) **[approval: D5a + values]** · Spec §2.6, §3.1

**Prompt:**
```
Task P2-2. First, audit services/sweatRateEngine.ts and report what it does,
where it is called, and whether it matches the NATA formula. Then implement
Spec §2.6:
1. Schema: sweat_tests(id, member_id, moment_id, activity_type, started_at,
   ended_at, pre_kg, post_kg, pre_source, post_source, fluid_ml, urine_ml
   nullable, heat_index_f, wbgt_f nullable, sweat_l_per_h, mass_change_pct,
   valid, invalid_reason, model_version) and sweat_profiles(member_id,
   activity_type, heat_band, n, median_l_per_h, low, high, updated_at). Add
   both to the registry (P0-1).
2. Pure function computeSweatTest() with the formula, validity checks and
   urine-unknown label, all values from config.
3. Moment loop: a declinable Plan line (eligibility per §2.6), Before-the-
   Moment weigh-in card, weigh-out + drinks + bathroom inside the single
   Return card (no extra touch), Replay sentence variants, profile in What
   AFORCE remembers (view/edit/delete).
4. Plan use: only when d5a_sweat_profile_enabled and n≥3, planned_ml_per_h =
   min(median × replaceFraction, inMomentCeilingMlPerH) via intakeSafety.
5. Weight-gain result triggers S53.4.
Flags: sweat_test_enabled, d5a_sweat_profile_enabled.
```
**Acceptance:**
- Formula tests cover NATA examples.
- Validity tests cover every rejection reason.
- A touch-count test shows the Moment still uses 3 or fewer automatic touches.
- A safety-cap test shows plan amounts never exceed the ceiling.
- The deletion test covers the new tables.

### P2-3 "Only when behind" nudges (#57) · Spec §2.9

**Prompt:**
```
Task P2-3. Implement behind-pace nudges: pace = target spread across the
member's waking window; fire only if behind by behindPaceMl AND no log for
quietGapMin; max nudgesPerDay; never in quiet hours, Focus/DND, a Moment's
Quiet stage or within 60 min of a Moment touch; never when clinician limit is
on. Opt-in toggle in Profile → Hydration. Schedule locally; recompute on every
log. Flag: hydration_nudges_enabled.
```
**Acceptance:** scheduler unit tests cover each suppression rule, and the copy passes the lint.

### P2-4 Morning WUT check (#55) · Spec §2.7

**Prompt:**
```
Task P2-4. Add the optional morning check: weight change vs own 7-day morning
average (skip if no data), 8-chip urine color, 1–9 thirst. Markers: weight
>1%, urine >5, thirst ≥5. Result copy per §2.7, labeled "A self-check, not a
diagnosis." Shown in the existing single Home card slot once per morning.
Store in wut_checks (registry, export, deletion). Shown beside HydroState,
not mixed into it. Flag: wut_check_enabled.
```

### P2-5 Legal artifacts (#59) · Spec §4

**Prompt:**
```
Task P2-5. Docs plus small UI. Create governance/BREACH-RESPONSE-RUNBOOK.md
(FTC HBNR: detection, owner, assessment, 60-day notices, 500+ rule) and a
Consumer Health Data Privacy Policy page linked from Profile → Privacy and the
website footer. Add one consent toggle per new data feature (target inputs,
active energy, sweat test, WUT, write-back) in Profile → Privacy, each off by
default. Mark both docs "Draft for counsel review."
```

---

## Phase 3: Connections and Brand

### P3-1 Smart bottle import (HidrateSpark), Spec §2.11

Bottle sips arrive as "Bottle recorded." The member confirms them in a batch, following the C1 Phantom Band rule. They never count until confirmed. Flag: `smart_bottle_enabled`.

### P3-2 Sweat-sensor import (Gx, Nix, Epicore, FLOWBIO)

Import sweat rate and sodium as profile readings with source and time. They never count as intake. Vendor approval and OAuth are needed first.

### P3-3 AFORCE product facts (#60)

Operations supplies the verified nutrition panel. Replace the single 25 mg value in `services/sweatRateEngine.ts:130` with the product record. Do not run the optional BHI study until Julius approves it.

---

## Phase OB: One Breath and Daily Rhythm (Nov 18 addendum)

Use the One Breath addendum for OB-0 to OB-6. Prompts for OB-7 to OB-10 are in One-Breath-Addendum-Review-Daily-Use.md, Section 8.

Prompts for OB-11 to OB-14 (hydration step, phone calendar, direct Google/Microsoft, .ics) are in Hydration-Loop-and-Calendar-Connections.md, Part D.

Order: OB-0, OB-1, OB-7 (recurring Moments), OB-11 (hydration step through the loop, all drinks), OB-12 (phone calendar into Moments), OB-3, OB-8 (daily rhythm), OB-9 (obstacle and hydration experiments), OB-2, OB-4, OB-5, OB-10 (useful-days metric), OB-6 (pilot plus 4-week cohort). OB-13 (direct Google/Microsoft) and OB-14 (.ics) come after the cohort. Finish Phase 0 first. OB-2's model path stays off until #66 is decided.

## Definition of Done (every task)

- [ ] Tests added and passing; the existing suite is green.
- [ ] New behavior is behind a flag set to false in production profiles.
- [ ] Tunables are in config with source and status.
- [ ] Strings are in `locales/en.json`, and the claims lint passes.
- [ ] Accessibility labels and Dynamic Type are in place.
- [ ] New data is in the registry, export and deletion.
- [ ] Spec amendment and Proof Tracker rows are updated.
- [ ] The PR lists [D] / [?] items and any spec–code conflicts.
