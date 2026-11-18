# AFORCE OS Spec v1.8.3 Amendment: Hydration Core, Safety and Cleanup

**Status:** Proposed. Each section takes effect only when its sign-off row in Section 9 is filled in.
- Product sections need Julius and Brandon.
- Science sections also need the scientific approver (D-09 §1.3, currently Julius).
- Constitution and D-decision changes need both founders (Build Rule 12).

**Applies to:** App Spec v1.8.2 (Nov 11, 2026), compiled Nov 18 from main@f57be7dc.
**Companion files:** `CLAUDE.md` (build rules 15–32) and `CLAUDE-CODE-TASKS.md` (the build sequence).

Every number marked **proposed** goes into `config/hydroStateModel.ts` with `status: 'proposed'` and cannot be used in production until approved (Build Rule 18). Sources are linked inline.

---

## 1. Corrections to v1.8.2

Each fix below replaces existing spec text. None of them changes shipped behavior unless noted.

| # | Where | Problem | Replacement |
|---|---|---|---|
| 1.1 | Part 1 "Log a drink" sheet; Part 6.3 | Says only water moves HydroState and AFORCE is "saved to your log." C1 (PR #1207, hydrostate-v2.0) already counts AFORCE as its mixing water and Phantom Band sips as water | "Water and AFORCE (as its mixing water) move HydroState 1:1. Phantom Band sips count as water. Other drinks follow the drink rules in Section 2.1 once approved. Until then they are saved with 'Saved to your log. It counts once its drink rule is approved.'" |
| 1.2 | Part 2 Home row; Appendix G ("Log 16 oz," "Start with water · 20 oz now") | Pre-Nov 6 "Log water" wording | Use "Log a drink" everywhere. Plan lines name the drink only when the playbook specifies water |
| 1.3 | Architecture §64 vs Part 8.5 / #47 | Four coach personas (Rock, BB, Surge, Sage) vs one calm, low male voice | **Founder decision required.** Recommended: one voice in beta (#47), with a voice choice in Profile → Voice as a Phase 2 accessibility item. Remove persona names from §64 until then |
| 1.4 | §64 "AI speaks first"; Part 7 conversational model; C3 "no AI model in beta" | Three conflicting rules | Revised Nov 18 (see One-Breath-Addendum-Review-Daily-Use.md, 2.1): adopt the One Breath addendum's bounded model. A schema-validated proposal adapter runs only inside sessions the member explicitly opens; no tool calls; deterministic code computes all values; the AI never opens an open chat and stays within 3 automatic touches per Moment. Before enabling: decide #41/#42, sign a DPA, and update the health-data consent (#66). |
| 1.5 | Constitution #4 vs Appendix B §10.4 / D5 | "Personal baseline outranks population," but personal learning is frozen | Keep the freeze for lessons. Add the narrow unlock in Section 3.1 (D5a) for measured sweat profiles only |
| 1.6 | Hydration tab ("42 of 96 oz," week dots "goal met") | Target undefined | Defined in Section 2.2. The week dot means "logged beverages reached that day's target" |
| 1.7 | Part 4 register rows #30–#49 | Rendered as one run-on cell; rows out of order (#25, #35, #36, #26…) | Re-render as one row per item in numeric order, then append #50–#61 |
| 1.8 | Phase Roadmap | Dark modules (Guardian, Clutch, Cruise, Performance Age, Meridian, SkinIA, Sun Exposure, Metabolic Readiness) are the source of most open stop-ship rows | Run the quarterly test ("would we build this again?") before beta. Delete the BAC / "do not drive" logic and the ungated Heat Risk screen (Section 8) |

---

## 2. New and Changed Product Sections

### 2.1 Drink rules: hydrostate-v3.0 (register #50)

**Evidence.** The Beverage Hydration Index measured fluid retention against still water. Cola, diet cola, hot and iced tea, coffee, lager, orange juice, sparkling water and a sports drink were not different from water. Oral rehydration solution and full-fat and skimmed milk retained about 50% more ([Maughan et al., AJCN 2016](https://hero.epa.gov/reference/3213206/)). Caffeinated drinks count toward total water intake ([National Academies](https://www.nationalacademies.org/news/report-sets-dietary-intake-levels-for-water-salt-and-potassium-to-maintain-health-and-reduce-chronic-disease-risk)).

**Rule.** Each drink counts by its **water content** times a **retention factor**. Every factor starts at 1.0 unless approved otherwise.

| Drink class (`drinkClass`) | Water content (proposed default) | Retention factor (proposed) | Rollout |
|---|---|---|---|
| `water_still` | 100% | 1.0 | Live (C1) |
| `water_sparkling` | 100% | 1.0 | First approval |
| `aforce` | Mixing water (C1) or label volume for ready-to-drink | 1.0 (a higher factor only after #60) | Live (C1) |
| `coffee`, `tea` | ~99% | 1.0 | First approval |
| `soda`, `diet_soda` | ~89–100% (label) | 1.0 | Second approval |
| `juice` | ~88% | 1.0 | Second approval |
| `sports_drink` | ~93% | 1.0 | Second approval |
| `milk` | ~88–91% | 1.0 (reviewer may raise toward the BHI) | Second approval |
| `energy_drink`, `smoothie`, `other` | — | Not counted; "rule pending" | Later |
| `alcohol` | — | Not counted; hidden until the age and region gate exists (SS-26) | Gate first |

**Rules:**
- No bonuses, no penalties and no claims about any drink (#40 stands). The drink sheet shows "Counted as 15 oz of water," never "hydration score."
- Exact water-content values come from the HydroScan product record when available, otherwise from the class default.
- Caffeine is saved as a separate field. It is shown only in "Why?", never as a warning. The caffeine conversion stays outside the engine boundary until a reviewed rule exists.
- This is a major bump (D-09 §1.4): `hydrostate-v2.0 → v3.0`, with one release note. Members see their numbers change once.

**Copy:**
- Sheet confirmation: "+12 oz coffee · counted as 12 oz of water."
- "Why?": "Coffee counts like water. Studies found it hydrates about the same. Caffeine is saved separately."

### 2.2 Daily target contract (register #51)

**Definition.** The target is a **beverage** target. It excludes water from food, which is about 20% of total water ([National Academies DRI](https://www.nationalacademies.org/read/10925/chapter/6)).

```
target_beverage_ml =
    baseline_ml
  + pregnancy_ml or lactation_ml        (if the member chooses to tell us)
  + heat_ml(heat band, Section 2.4)
  + activity_ml(active energy, Section 2.3)   (excluding Moment time)
  + moment_ml(planned Moments today, Section 2.6)
  clamped to [target_floor_ml, target_ceiling_ml]
```

| Input | Proposed value | Source |
|---|---|---|
| `baseline_ml` options | About 2,200 mL (~74 oz) or about 3,000 mL (~101 oz), the NASEM beverage portions for women and men. Members can also set their own. No sex question at signup (D11): the member picks a starting point in context | [National Academies DRI](https://www.nationalacademies.org/read/10925/chapter/6) |
| `pregnancy_ml` / `lactation_ml` | +300 / +700 | [EFSA DRV](https://www.efsa.europa.eu/sites/default/files/2017_09_DRVs_summary_report.pdf) |
| `target_floor_ml` / `target_ceiling_ml` | Proposed, reviewer sets | — |
| Older adults | No volume change. "Why?" notes that thirst can be a weaker cue with age | [ACSM HFJ](https://journals.lww.com/acsm-healthfitness/Fulltext/2019/03000/Principles_of_Hydration.4.aspx) |

**What the member sees:**
- The ring shows "42 of 96 oz." The "96" opens **Why this target?**, which lists each line with its source and time, for example:
  - "Your starting point · 74 oz · you chose this"
  - "Heat · +8 oz · heat index 91°F at 2 PM · Apple Weather"
  - "Activity · +6 oz · 410 active cal · Apple Health · 3:10 PM"
- A modifier with no fresh data is left out and shows as "not used: no recent data." It is never guessed.

**My clinician limits my fluids.** Profile → Hydration → "My clinician sets my fluid limit." When it's on:
- The ring hides the target and shows intake only.
- Nudges (2.9), heat additions and sweat-based amounts turn off.
- Plan lines never suggest volumes.
- One line: "AFORCE won't suggest amounts. Follow your clinician's plan."

### 2.3 Active energy as a read-only target input (register #61)

- **Reads:** `activeEnergyBurned` from HealthKit and `ActiveCaloriesBurnedRecord` from Health Connect ([Android Developers](https://developer.android.com/reference/androidx/health/connect/client/records/Record?authuser=1)). Steps are not read.
- **Use:** only `activity_ml` in 2.2. The proposed form is `activity_ml = k × max(0, activeKcal − baselineKcal)`, with both `k` and `baselineKcal` proposed for the reviewer. EFSA's 1 mL/kcal water–energy relationship is a reference point, not an approved factor ([EFSA DRV](https://www.efsa.europa.eu/sites/default/files/2017_09_DRVs_summary_report.pdf)).
- **No double counting:** energy recorded during a Moment's planned window is excluded, because Moment amounts already cover it.
- **Never:** shown as its own number or screen (D2), counted as intake, or shared to a Circle.
- **Devices table update:** add "Active energy (used only to adjust your target)" to the Apple Health and Health Connect "Reads" column.

### 2.4 Heat: heat index and WBGT replace the 82°F dry-temperature rule (register #54)

- **Daily target and indoor or shaded Moments:** use the **heat index**, computed with the NWS Rothfusz regression and its documented adjustments. Below about 80°F, use the simple Steadman formula ([NOAA WPC](https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml)).
- **Outdoor Moments with vigorous activity:** use **outdoor WBGT**. NWS says heat index assumes shade, while WBGT includes sun, wind and cloud cover ([NWS](https://www.weather.gov/ict/WBGT)). Compute it server-side with the Liljegren et al. (2008) model, which is the model behind OSHA's referenced calculator ([OSHA Technical Manual](https://obis.osha.gov/dts/osta/otm/otm_iii/otm_iii_4.html); [open-source C code](https://github.com/mdljts/wbgt/blob/master/src/wbgt.c)).
  - Inputs: air temperature, relative humidity, wind speed, solar irradiance, pressure, latitude, longitude and time.
  - If solar irradiance or wind is missing, do not compute WBGT. Fall back to heat index and say so in "Why?"
- **Altitude:** add as a target input once a reviewed rule exists (HidrateSpark and Nix both use it).
- **Bands:** heat index and WBGT bands live in config as proposed values, seeded from NWS guidance ([NWS heat tools](https://www.weather.gov/media/safety/Heat-Tools-2026.pdf)). Each band maps to one reviewed plan line and to `heat_ml`.
- **Kept:** the line "Start water two hours before, not one." Its trigger becomes "heat index or WBGT at or above the first band," replacing "air temperature ≥ 82°F."

### 2.5 Overdrinking safety rule (register #53)

This sits in the deterministic safety layer and cannot be overridden by lessons, preferences or AI output.

**Evidence:**
- Drinking more than you sweat is the primary cause of exercise-associated hyponatremia (Evidence A). ACSM gives 0.4–0.8 L/h as a starting range when sweat rate is unknown ([ACSM 2007](https://journals.lww.com/acsm-msse/fulltext/2007/02000/exercise_and_fluid_replacement.22.aspx)).
- NATA: do not drink more than body-mass losses ([NATA](https://www.ncbi.nlm.nih.gov/pmc/articles/5634236)).

| Rule | Behavior | Value |
|---|---|---|
| S53.1 In-Moment ceiling | Planned amount per hour ≤ min(measured sweat rate, `inMomentCeilingMlPerH`) | Ceiling proposed at the top of ACSM's starting range |
| S53.2 Rapid intake | If logged water-equivalent in a rolling 60 minutes exceeds `rapidIntakeMl`, show one reviewed line. No praise. The ring still updates | Proposed |
| S53.3 Daily excess | If logged beverages exceed `dailyExcessFactor` × target, show one reviewed line, at most once a day | Proposed |
| S53.4 Weight gain after a Moment | Sweat test (2.6) shows a gain: "You drank more than you lost. Next time, a little less is fine." | Any gain above scale noise (`scaleNoiseKg`, proposed) |
| S53.5 Copy | Never "more is better," "keep going" or volume praise. The claims lint adds these phrases | — |
| S53.6 Symptom line (reviewer must approve wording) | Shown with S53.2 and S53.3: "If you've had a lot to drink and feel confused, very nauseous or have a bad headache, get medical help." | — |

The clinician-limit setting (2.2) suppresses all volume suggestions. S53 lines still show.

### 2.6 Sweat-rate test in the Moment loop (register #52)

**Eligibility:** workout or outdoor Moments of at least `sweatTestMinMinutes` (proposed 45). Off when the clinician limit or pregnancy is set, unless the reviewer approves otherwise.

| Loop stage | What happens | Rules |
|---|---|---|
| 5 Plan | One plan line the member can decline: "Want to learn your sweat rate? Weigh in before, weigh out after." | Counts as part of the plan, not an extra touch |
| 2 Before the Moment | "Weigh in" card: from Apple Health / Health Connect if a weight was recorded in the last `weighInWindowMin` (proposed 60) minutes, otherwise typed | Never stored as a profile field (D11). The tip says "Same scale, minimal clothing, after using the bathroom" |
| 7–8 Lock In / Quiet | Nothing new | Drinks logged during the Moment are captured as usual |
| 9 Return | Inside the single Return card: "Weigh out" plus "What did you drink?" (prefilled from logs, editable) plus optional "Used the bathroom?" (amount unknown is allowed) | Skip implies nothing. If the member skips, no result is saved |
| 10 Replay | Saves the result and shows one sentence (below) | — |
| Learn | Builds the sweat profile (3.1) | — |

**Formula** ([NATA](https://www.ncbi.nlm.nih.gov/pmc/articles/5634236)):
```
sweat_L      = (pre_kg − post_kg) + fluid_L − urine_L
sweat_L_per_h = sweat_L / duration_h
mass_change_pct = (post_kg − pre_kg) / pre_kg × 100
```
If urine is unknown, compute with `urine_L = 0` and label the result "may read high."

**Validity checks.** Reject the test and say "Let's retake this one" when any of these is true (values proposed):
- The weights are more than 60 minutes from the Moment's start or end.
- The duration is under 45 minutes.
- The sweat rate is outside 0–4 L/h.
- The two scales differ (source mismatch).

**Replay lines:**
- Normal: "About 1.1 L an hour in 84°F heat index running. You lost 1.4% of your weight. Your plan covered most of it."
- Loss over 2%: "You lost about 2.6%. That's more than you drank. Next time, plan a little more during."
- Gain: the S53.4 line.
- Recovery (reviewed): "Over the next few hours, drink about 1.5 times what you lost." This follows ACSM's ~1.5 L per kg lost guidance ([ACSM 2007](https://journals.lww.com/acsm-msse/fulltext/2007/02000/exercise_and_fluid_replacement.22.aspx)).

**Profile:**
- Results are grouped by `activityType` and heat band.
- One result is labeled "first reading." Three or more become "your sweat rate," shown as a range (min–max or median ± spread) because daily variation is real ([GSSI](https://www.gssiweb.org/en/sports-science-exchange/article/gx-sweat-patch-and-app-for-personalized-hydration)).
- The profile is viewable, editable and deletable in "What AFORCE remembers."

**Plan use** (needs D5a):
- `planned_ml_per_h = min(profile_median_L_per_h × replaceFraction, inMomentCeilingMlPerH)`.
- `replaceFraction` is proposed so the expected loss stays under 2% and intake never exceeds loss.

### 2.7 Morning WUT check (register #55)

The check is optional and off by default. Profile → Hydration → "Morning check." It takes about 10 seconds and appears once per morning on Home as the existing single card slot, not an extra touch.

- **W, weight:** a change of more than 1% from the member's own 7-day morning average (Apple Health / Health Connect). It's skipped if there's no weight data.
- **U, urine:** an 8-chip color scale. Darker than chip 5 counts as a marker ([HPRC](https://www.hprc-online.org/nutrition/nutrition-fundamentals/are-you-dehydrated)).
- **T, thirst:** a 1–9 slider. 5 or higher counts as a marker.
- **Result:** 0–1 markers: "Looks fine." 2 markers: "You may be a little low. Start with water this morning." 3 markers: "You're likely low. Start with water now and check again later." ([PMC 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10918520/)).
- **Labeling:** "A self-check, not a diagnosis." It is never shared, and it feeds HydroState only through a reviewed rule (proposed: shown beside HydroState, not mixed into it, in v3.0).

### 2.8 Logging everywhere (register #56)

The same rules apply on every surface: drink and amount, read-back, then a 5-second Undo shown in place.

| Surface | Platform | Behavior |
|---|---|---|
| Home Screen widget (small / medium) | iOS 17+, Android | Ring, "42 of 96 oz," up to 3 saved drinks as buttons. Interactive logging via App Intents on iOS |
| Lock Screen widget (circular / rectangular) | iOS 16+ | Ring and ounces. Tap opens Log a drink |
| Control Center control | iOS 18+ | "Log my usual" (member-chosen drink and amount) |
| Action Button / App Shortcut | iOS | Same intent as the control |
| Siri / App Intent | iOS | "Log a drink in AFORCE," "Log 16 ounces of water in AFORCE." Asks for the drink if missing, reads back, offers Undo |
| Watch | watchOS, Wear OS | Complication or tile with the ring and quick-log buttons. **Moved ahead of Moment Link in the build order** |
| Quick Settings tile | Android | "Log my usual" |

Widgets show estimates with "as of 2:41 PM." They never show HydroState color states on the Lock Screen (privacy).

### 2.9 "Only when behind" nudges (register #57)

Nudges are off by default. Profile → Hydration → "Remind me when I'm behind."

- **Fires only when both are true:** logged intake is behind the member's pace (the target spread across their waking window) by more than `behindPaceMl`, **and** nothing has been logged for `quietGapMin`.
- **Limits:** at most `nudgesPerDay` (proposed 3). Never during quiet hours, Focus, DND or a Moment's Quiet stage. Never within 60 minutes of a Moment touch.
- **Copy:** "A glass of water now keeps you on track for [next Moment / tonight]." No streaks, guilt or counts of misses.
- **Evidence:** reminders raised fluid intake by about 240 mL/day in a 4-week trial ([World Nutrition Journal](https://scholar.ui.ac.id/en/publications/effect-of-smartphone-application-with-reminder-on-total-fluid-int/)). Forgetting was the top barrier in a smart-bottle RCT ([PubMed](https://pubmed.ncbi.nlm.nih.gov/35283036/)).
- **Constitution check:** silence stays the default, and the member opts in, so Principle 11 is respected.

### 2.10 Write-back to Apple Health and Health Connect (register #58)

- **Format:** one sample per confirmed drink, at the drink's logged time, as water-equivalent mL. iOS writes `HKQuantityTypeIdentifier.dietaryWater` ([Apple](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/dietarywater)). Android writes `HydrationRecord` ([Android Developers](https://developer.android.com/reference/androidx/health/connect/client/records/HydrationRecord?authuser=7)).
- **Metadata:** iOS sets `HKMetadataKeyWasUserEntered`, plus `HKMetadataKeySyncIdentifier` = drink id and a sync version so edits replace the sample. Android sets `clientRecordId` = drink id.
- **Edits and deletes:** editing or deleting a drink updates or deletes its sample.
- **Dedupe:** on read, ignore samples whose source is AFORCE. Outside water keeps the existing "shown, counted after you confirm" rule.
- **Consent:** a separate write permission screen. Off until the member turns it on.

### 2.11 Smart bottles and sweat sensors (Phase 2)

- **HidrateSpark:** sips arrive as "Bottle recorded · 14 oz," and one tap confirms a batch (the C1 Phantom Band rule extended) ([HidrateSpark](https://hidratespark.com/products/32-oz-hidratespark-pro-2)).
- **Sweat sensors (Gx, Nix, Epicore, FLOWBIO):** import sweat rate and sodium concentration as profile readings, with source and time ([Charlotte Observer](https://www.charlotteobserver.com/living/wellness/article317100178.html)). These never count as intake.

### 2.12 AFORCE product facts (register #60)

- Confirm the per-serving nutrition panel with operations, including sodium (the code holds one value, 25 mg, in `services/sweatRateEngine.ts:130`). Do this before any plan line suggests AFORCE for long or hot Moments. ACSM discusses electrolyte drinks (about 20–30 mEq/L sodium) for prolonged sweating ([ACSM 2007](https://journals.lww.com/acsm-msse/fulltext/2007/02000/exercise_and_fluid_replacement.22.aspx)).
- Optional: commission a Beverage Hydration Index study of AFORCE. Its retention factor stays 1.0 until a result is approved.

### 2.13 Hydration through the Moment loop (register #69)

Every eligible Moment carries one deterministic **hydration step**. It appears in the draft, the ring, the morning and evening cards, the Before card, one Return chip row, Replay counts, hydration experiments and Weekly Command.

- **All counted drinks fill it.** That includes water, AFORCE, coffee, tea, milk, juice, soda and sports drinks, through the same §2.1 counted-volume function the ring uses, with no water-only logic.
- **Not-yet-counted drinks** ("rule pending") show as "logged, not counted yet." Alcohol stays hidden until the age and region gate exists.
- Drink logs never trigger Return.
- There are no body-weight volumes (D11). The overdrinking rules (S53) and the clinician limit win, and lessons change timing and items only.
- Long or hot sessions can add an optional "Bring an electrolyte drink" line. It names AFORCE only after #60 is approved.

Full design: Hydration-Loop-and-Calendar-Connections.md, Part A.

### 2.14 Calendar connections (register #70–72)

- **Tier 1 (beta):** the phone calendar via expo-calendar. On iPhone this covers iCloud, Google, Exchange, Yahoo and CalDAV accounts. On Android it covers Google, Exchange and Outlook "Sync calendars." It's read-only by rule, with a calendar picker. Calendar data stays on the device.
- **Tier 2 (Phase 2):** direct Google (`calendar.events.readonly`) and Microsoft (`Calendars.ReadBasic`) connections, with API calls made from the device and no mail scopes.
- **Tier 3:** .ics links.
- Calendar never creates or seals a Moment. Time-only changes use Part 6.4; anything else needs a new seal.

Full design: Hydration-Loop-and-Calendar-Connections.md, Part B.

---

## 3. Decision and Constitution Amendments (both founders)

### 3.1 D5a: narrow unlock for measured sweat profiles

> "Replay lessons remain non-baseline (D5). Exception: a sweat profile built from at least 3 valid sweat-rate tests for an activity type and heat band may set the planned in-Moment amount for comparable Moments, always capped by S53.1. The member can see, edit or delete the profile, and 'Why?' names it."

### 3.2 Constitution #4 clarification (annotation, not a new principle)

> "In v1, 'learns the individual' means measured personal data the member can see: sweat profile, chosen starting point, and confirmed logs. Inferred personal baselines remain frozen per §10.4."

### 3.3 §64 personas and "AI speaks first"

Adopt the 1.3 and 1.4 recommendations, or record a different decision.

---

## 4. Privacy, Legal and Age

- **FTC Health Breach Notification Rule:** AFORCE is a health app outside HIPAA. Add `governance/BREACH-RESPONSE-RUNBOOK.md`, which must include: detection, owner, assessment, notifying members and the FTC within 60 days (at the same time for 500+ affected), and media notice where required ([FTC](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule); [Federal Register](https://www.federalregister.gov/documents/2024/05/30/2024-10855/health-breach-notification-rule)).
- **Washington My Health My Data Act:**
  - Publish a separate Consumer Health Data Privacy Policy, linked from the site homepage and from Profile → Privacy.
  - Get consent before collecting more than what's needed for a requested feature.
  - Get a separate consent before sharing.
  - Never sell ([WA Legislature](https://lawfilesext.leg.wa.gov/biennium/2023-24/Htm/Bills/House%20Bills/1155.htm)).
  - Every new feature in Section 2 has its own consent toggle.
- **Age:** adults only (#9). Add an age check (18+) at account creation. The alcohol class stays hidden until an age and region gate exists (SS-26).
- **Privacy policy (RA-N3):** remove "we do not access your photo library," and describe Smart Capture accurately.
- **Counsel:** AWG Law to review the runbook, the MHMDA policy and other state sensitive-data consent rules.

---

## 5. Account Deletion and Export (SS-04, register amendment to Part 9)

Approve the Part 9 five-stage plan with these specifics, following Apple 5.1.1(v) ([Apple](http://www.developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)):

1. **Registry** of every table holding member data. It must include `aforce_recorded_drinks`, intake logs, score snapshots, sharing grants, Circle statuses, lessons, Replays, voice words, shortcuts, sweat tests and profiles, WUT checks and provider tokens.
2. **Server endpoint** performing full erasure in one transaction where possible, with a per-table result log kept without personal data.
3. **Clerk user deletion, Stripe subscription cancel,** and Sign in with Apple token revocation when SIWA is enabled ([Apple news](https://developer.apple.com/news?id=12m75xbj)).
4. **In-app screen:** Profile → What AFORCE remembers → Delete account. It must explain what's deleted, what billing records are kept and how long it takes.
5. **Export:** a "Download my data" JSON file covering the same registry.

---

## 6. Must-Fix Before Outside Testers

| ID | Required outcome |
|---|---|
| SS-04 | Section 5 shipped and tested end to end on TestFlight |
| SS-03 | Tokens are written encrypted only, existing rows are backfilled and the plaintext columns are dropped (`lib/db/src/whoopTokenStore.ts`) |
| SS-05 | The BAC / "do not drive" code, routes, strings and tests are deleted |
| SS-26 | An age check exists. Alcohol stays hidden until the gate exists |
| SS-02 / RA-N1 | A server-side entitlement exists for every enterprise route, or the routes are removed from the public binary. `featureGateSelfActivationAllowed` is false in every production profile |
| SS-11 | One band set in `config/hydroStateModel.ts`, used by every surface. **Founder chooses** between 90/75/60, 85/70/50/30 and 85/65/40 |
| SS-12 | "Readiness" is replaced with "HydroState" in `locales/en.json`, including the opening cinematic (`en.json:2495`), the hero accessibility label, Protocol, onboarding and evidence copy |
| SS-14 | "Cellular reset," "detox support" and "internal cleansing" are removed from `data/flavors.ts:64-73`. "Cellular hydration" is removed from `utils/superfoodSignals.ts:115`. The lint adds detox, cleanse, alkaline, cellular and the S53.5 phrases |
| SS-21 | `app/heat.tsx` and `screens/HeatRiskScreen.tsx` are deleted, or gated server-side and replaced by Section 2.4 |
| SS-15 | Score-protection decision recorded |
| RA-N2 | `per_user_storage_isolation_enabled` is on in production after a migration test |
| RA-N3 | Privacy policy fixed (Section 4) |
| Beta | Production Clerk migration executed. `healthcheckPath` set in `railway.toml`. `aforce_recorded_drinks` is in the deletion path. A device QA run is logged |

---

## 7. Build Order Change

| Step | v1.8.2 | v1.8.3 |
|---|---|---|
| 0 | — | Must-fix (Section 6) and spec corrections (Section 1) |
| 5 | Representative flows incl. hydration | Hydration core runs **in parallel** with the workout pilot: 2.1, 2.2, 2.5, 2.8 (phone widgets and Siri), 2.10 |
| 6 | — | 2.4 heat, 2.3 active energy, 2.6 sweat test, 2.9 nudges, 2.7 WUT |
| 7 | Watch, Live Activities, Moment Link | Watch logging moves into step 5. Live Activities and Moment Link stay here |

---

## 8. New Register Items

| # | Item | Section | Safe behavior until decided |
|---|---|---|---|
| 50 | Drink rules (hydrostate-v3.0) | 2.1 | Water and AFORCE (C1) only |
| 51 | Target contract and clinician-limit setting | 2.2 | Intake shown. Current target kept but labeled "starting point" |
| 52 | Sweat-rate test in the Moment loop | 2.6 | Not offered |
| 53 | Overdrinking safety rule | 2.5 | No in-Moment volume above the reviewed default |
| 54 | Heat index / WBGT | 2.4 | Current 82°F rule |
| 55 | Morning WUT check | 2.7 | Not offered |
| 56 | Logging everywhere | 2.8 | In-app logging only |
| 57 | "Only when behind" nudges | 2.9 | Off |
| 58 | Health write-back | 2.10 | Read only |
| 59 | Breach runbook, MHMDA policy, age check | 4 | No outside testers in WA until reviewed |
| 60 | AFORCE facts and optional BHI study | 2.12 | No AFORCE-specific claim |
| 61 | Active energy target input | 2.3 | Not read |
| 62–68 | Daily rhythm, recurring Moments, calendar spotting in beta, obstacle question, bounded model, useful-days measure, hydration experiments | One Breath review | See that file |
| 69 | Hydration step through the loop (all counted drinks) | 2.13 | Heat copy only |
| 70 | Phone-calendar connection (extends #35) | 2.14 | Off until the member turns it on |
| 71 | Direct Google / Microsoft calendar | 2.14 | Not offered |
| 72 | .ics calendar link | 2.14 | Not offered |
| 73 | Hydration counts wording in Replay and Weekly Command | 2.13 | Not shown |

---

## 9. Sign-Off

| Section | Product (Julius) | Product (Brandon) | Science (D-09 §1.3) | Counsel | Date |
|---|---|---|---|---|---|
| 1 Corrections | | | — | — | |
| 2.1 Drink rules | | | | — | |
| 2.2 Target | | | | — | |
| 2.3 Active energy | | | | — | |
| 2.4 Heat | | | | — | |
| 2.5 Overdrinking | | | | — | |
| 2.6 Sweat test | | | | — | |
| 2.7 WUT | | | | — | |
| 2.8 Logging everywhere | | | — | — | |
| 2.9 Nudges | | | — | — | |
| 2.10 Write-back | | | — | — | |
| 3 D5a and Constitution notes | | | | — | |
| 4 Privacy and legal | | | — | | |
| 5 Deletion and export | | | — | | |
