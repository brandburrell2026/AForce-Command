# Hydration in the Loop and Calendar Connections

**Adds to:** the v1.8.3 amendment (new §2.13 and §2.14, register #69–73) and the One Breath daily-use review (tasks OB-11 to OB-14).
**Date:** Nov 18, 2026. All values are marked proposed; Julius approves (D-09 §1.3).

---

## Part A. Hydration Connected Through the Whole Loop (register #69)

### A.1 The idea

Today, hydration is mostly a separate daily ring. Moments only touch it in two places:
- They add `moment_ml` to the day's target (amendment §2.2).
- Heat Moments get the approved copy "Start water two hours before, not one."

The addendum keeps them apart: "A hydration log never triggers Return."

**The change:** every eligible Moment carries one **hydration step**. It moves through every stage of the loop, so the coffee at 8 AM, the AFORCE at 4:30 and the sports drink during the game all visibly count toward the 7 PM plan. Logs still never trigger Return; they only fill in the step.

### A.2 All drinks count, by the same rules as the ring

The step uses the **drink rules in amendment §2.1 (hydrostate-v3.0)**. There's no separate "water only" logic, so a drink counts in the Moment exactly as it counts on the ring.

| Drink class | Counts toward the step | Basis |
|---|---|---|
| Still and sparkling water, AFORCE | Yes, at counted volume | §2.1 (C1 for water and AFORCE) |
| Coffee, tea | Yes, about 99% water content. Caffeine is saved separately and shown only in "Why?" | Beverage Hydration Index: coffee and tea not different from water ([Maughan et al. 2016](https://hero.epa.gov/reference/3213206/)); caffeinated drinks count toward total water ([National Academies](https://www.nationalacademies.org/news/report-sets-dietary-intake-levels-for-water-salt-and-potassium-to-maintain-health-and-reduce-chronic-disease-risk)) |
| Soda, diet soda, juice, sports drink, milk | Yes, by label or class water content | §2.1 second approval. Milk and oral rehydration solution retained more than water in the BHI study; the retention factor stays 1.0 unless the reviewer raises it |
| Energy drink, smoothie, other | Logged and shown, **not counted yet** ("rule pending") | §2.1 |
| Alcohol | Hidden until the age and region gate exists | SS-26 |
| Water from food | Not counted (the target is a beverage target) | §2.2 |

Rules:
- The step fills from **counted volume** (water content × retention factor), the same number the drink sheet shows: "+12 oz coffee · counted as 12 oz."
- A drink class goes live in the step on the same day it goes live on the ring. The step never runs ahead of the drink-rule approvals.
- **Recommendation:** approve the "first approval" classes (sparkling, coffee, tea) before the hydration step ships. Otherwise members will log a morning coffee and see it ignored.
- No bonuses, penalties or "better drink" claims in the step (#40). AFORCE is named in a step line only after the product facts (#60) are approved.

### A.3 The hydration step at each stage

| Stage | What the member sees | Rule |
|---|---|---|
| Spot (calendar or typed) | The draft already includes one hydration line: "Hydrate by 4:30 PM" | Picked deterministically from the playbook (A.4). Free text never sets it |
| Plan / Seal | A normal plan line: editable, removable, sealed with the rest. The member can name a drink ("AFORCE by 4:30") or leave it open | No extra approval. Seal stays one deliberate action |
| Today (ring) | A "by" marker on the ring: "16 oz by 4:30 · Game 7 PM" | Fills from any counted drink. Shown only for sealed Moments. Under the clinician limit: timing only, no volumes |
| Morning / evening card | "Lift 6:30 AM: hydrate when you wake" | Inside the existing card slot. Not a notification |
| Before (lock-screen card, 30 min) | "Hydration step: 14 of 16 oz · coffee, AFORCE" or "Not logged yet · Log a drink" (one tap opens the drink sheet with all classes) | Part of the existing Before touch. It is not a new touch |
| During (Lock In / Quiet) | Log any drink from the watch and widgets | No prompts during Quiet. During-Moment drinks feed the sweat test (§2.6 "What did you drink?") |
| Return | One chip row inside the single Return card: "Hydration before: on time / late / skipped." Prefilled from logs, with the drinks listed; the member confirms | Skip implies nothing |
| After (long or hot Moments) | Recovery line only if a valid sweat test exists: "Rehydrate slowly over the next few hours," with any drink counting | No body-weight math outside the sweat test |
| Replay | "Hydration step on time before 3 of your last 4 lifts." | Counts only, no cause words, no drink rankings. Minimum sample (#7) |
| Learn | Hydration experiments (#68): "Start hydrating 30 min earlier next time?" or "Bring AFORCE to evening games?" | Timing and item lines only. Never lowers playbook amounts, never overrides heat, S53 or clinician rules (spec line 2871) |
| Weekly Command | "Hydration steps on time: 5 of 7 Moments (from your logs)" | Denominator always shown |

### A.4 Which hydration line a Moment gets (deterministic playbook)

| Moment type | Proposed line | Basis |
|---|---|---|
| Workout or sport, ≥ 45 min, or outdoor in a heat band | "Hydrate by {start − 4 h}. More by {start − 2 h} if it's hot." Optional volume: "about 16 oz" | Drink slowly at least 4 h before, and more about 2 h before if needed. The ACSM position stand says "water or sport beverage" ([ACSM 2007](https://journals.lww.com/acsm-msse/fulltext/2007/02000/exercise_and_fluid_replacement.22.aspx)). Consider 16–20 fl oz 4 h before ([ACSM Health & Fitness Journal](https://journals.lww.com/acsm-healthfitness/Fulltext/2013/07000/Exercise_and_Fluid_Replacement__Brought_to_you_by.3.aspx)) |
| Long or hot sessions (≥ 60 min, or a high heat band) | Adds an optional item line: "Bring an electrolyte drink." It names AFORCE only after #60 | ACSM discusses electrolyte drinks for prolonged sweating (amendment §2.12). Reviewer approves the wording |
| Early-morning workout (start before 8 AM) | "Hydrate when you wake" | Same basis. Uses the earliest awake time |
| Performance Moment (pitch, interview, exam, presentation) | "Have a drink before you leave" | Habit and timing only. No performance claim |
| Travel or flight | "Bottle in your bag" (item line) | Existing "add item" template |
| Clinician limit on | Timing line only, no volume | Amendment §2.2 |

Volume rules:
- No body-weight volumes. Members don't give their weight at signup (D11), so the 5–7 mL/kg form isn't used.
- Volumes are fixed, reviewer-approved playbook values, capped by the overdrinking rules S53.1–S53.6.
- Copy says "hydrate" or "drink," not "water," except in the approved heat copy until Julius updates it.

### A.5 Data

- `MomentHydrationStep { momentId, lineId, dueAt, volumeMl?, namedDrinkClass?, status: pending | partial | logged | confirmed_on_time | confirmed_late | skipped, matchedLogIds[], countedMl }`
- `countedMl` is the sum of the counted volume of matched logs, computed by the same function the ring uses (`utils/hydration/drinkRoute.ts`). There is no second formula.
- A log matches if it falls between `dueAt − window` and the Moment start (window proposed at 4 h, in `config/hydroStateModel.ts`).
- `namedDrinkClass` is optional. If the member planned "AFORCE by 4:30" but drank tea, the step still fills, and Replay just reports what was logged.
- Logs that aren't counted (rule pending) appear in the list as "logged, not counted yet" and don't fill `countedMl`.
- `matchedLogIds` are references, so editing or deleting a log updates the step.
- Steps are included in export and deletion (rule 22).

---

## Part B. Calendars From Email Accounts Load Into Moments (register #70–72)

### B.1 What "connect my email calendar" means

People's calendars live on their email servers: Google (Gmail and Workspace), Microsoft (Outlook.com, Microsoft 365, Exchange), iCloud, Yahoo and CalDAV servers. **AFORCE connects to the calendar only. It never reads email.** Reading email would need far broader permissions, and it isn't needed.

### B.2 Three connection paths

| Tier | Path | Covers | When |
|---|---|---|---|
| 1 | **Phone calendar** (device calendar store) | **iPhone:** any account added in Settings → Calendar → Calendar Accounts, which supports iCloud, Google, Microsoft Exchange and Yahoo, plus CalDAV and subscribed calendars ([Apple Support](https://support.apple.com/guide/iphone/change-calendar-settings-iphc37be2016/ios), [Apple CalDAV](https://support.apple.com/en-az/guide/iphone/iph3d1110d4/15.0/ios/15.0)). **Android:** Google accounts, system Exchange accounts, and Outlook for Android's "Sync calendars," which works for Microsoft 365, Outlook.com and hybrid Exchange ([Microsoft Support](https://support.microsoft.com/en-us/office/how-do-i-sync-my-outlook-calendar-to-the-default-calendar-app-s-26c02128-c72f-4f49-90c8-3eafc3ecd581), [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5828484/how-to-sync-microsoft-outlook-calendar-with-androi)) | **Beta.** This is calendar spotting (#35) as approved |
| 2 | **Direct "Connect Google" / "Connect Microsoft"** | Members whose work calendar is blocked from the phone calendar. For example, an organization can turn off Outlook calendar sync through Intune policy ([Microsoft Learn](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/outlook-for-ios-and-android/outlook-for-ios-and-android-configuration-with-microsoft-intune)). Also members who don't want to add the account to the phone | Phase 2, after Google verification |
| 3 | **Calendar link (.ics URL)** | Team schedules, league and school sports, gym class calendars | Phase 2 |

### B.3 Tier 1 details (beta)

- **Library:** `expo-calendar`. Both `getEventsAsync(calendarIds, start, end)` (legacy) and `calendar.listEvents(start, end)` (new API) work on iOS and Android ([Expo docs](https://docs.expo.dev/versions/latest/sdk/calendar/), [Expo migration guide](https://docs.expo.dev/guides/sdk-libraries-migration/calendar/)). Pin the SDK version in use and code to that API.
- **iOS permission:** iOS has no read-only calendar permission. Reading events needs full access, `requestFullAccessToEvents`, and the `NSCalendarsFullAccessUsageDescription` key ([Apple: Accessing the event store](https://developer.apple.com/documentation/eventkit/accessing-the-event-store)). AFORCE must therefore promise in code and in copy that it never writes, edits or deletes:
  - Usage string: "AFORCE reads your calendar to spot Moments you might want to plan. It never adds, changes or deletes events."
  - Lint test: no calls to calendar write methods anywhere in the app.
- **Android permission:** declare `READ_CALENDAR` only, never `WRITE_CALENDAR`. Query `CalendarContract.Instances` by time range, so recurring events arrive as one row per occurrence ([Android Developers](https://developer.android.com/identity/providers/calendar-provider)).
- **Calendar picker:** after permission, the member picks which calendars to use, for example "Work (Outlook)" and "Personal (Google)." Birthdays, holidays and subscribed calendars are unselected by default.
- **When it reads:** on app open, on the morning-card refresh, and on an OS background refresh. The window is now to +8 days.
- **Stays on the device:** this is the existing #35 rule. Only fields the member chooses to plan with go into a Moment.

### B.4 Tier 2 details (Phase 2)

| | Google | Microsoft |
|---|---|---|
| Permission | `calendar.events.readonly` ("View events on all your calendars") ([Google](https://developers.google.com/workspace/calendar/api/auth)) | `Calendars.ReadBasic`, the least-privileged permission for `calendarView` ([Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0)) |
| Review | Reading events is a sensitive scope. Public apps need Google verification, which can take up to 10 days, and Workspace admins can block untrusted apps ([Google verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)) | Delegated, user consent. Some work tenants require admin consent; say so in the copy |
| Endpoint | `events.list` with `singleEvents=true` over a time window | `GET /me/calendarView?startDateTime=…&endDateTime=…` returns occurrences, exceptions and single instances |
| Flow | OAuth 2.0 + PKCE from the app. Tokens in Keychain / Keystore | MSAL public client. Tokens in Keychain / Keystore |

**Privacy design for Tier 2:**
- Make the API calls **from the device**, not from AFORCE's servers. That keeps the #35 "stays on the device" rule, and the servers never hold calendar tokens.
- No webhooks in Phase 2. Refresh on open and on background refresh.
- Never request write scopes. Google's `calendar.events` and `calendar` scopes would bring the restricted-scope security assessment ([Nylas guide](https://developer.nylas.com/docs/cookbook/calendar/events/list-events-google/)).
- Never request mail scopes.

### B.5 From calendar event to Moment

1. **Normalize** every source into one shape: `CalendarEventRef { source: device | google | microsoft | ics, calendarId, eventId, instanceStart, end, title, location?, allDay, status, isRecurring, availability }`.
2. **Filter.** Skip:
   - all-day events
   - cancelled or declined events
   - "free" or transparent events
   - birthdays and holidays
   - events shorter than 10 minutes (proposed)
3. **Spot.** A deterministic, on-device classifier maps titles to Moment kinds. Examples:
   - "lift," "gym," "run," "practice," "game," "match," "spin," "yoga" → workout or sport
   - "pitch," "interview," "presentation," "demo," "exam," "review" → performance
   - "flight," "airport" → travel

   The keyword list lives in config. The language model is used only inside a One Breath session the member opens.
4. **Offer.** At most one offer per event occurrence, shown in the morning card and in Moments → "From your calendar":
   - "Investor meeting 10 AM · Plan it?"
   - For a recurring event: "Lift Mon/Wed/Fri · Plan every one?" This creates a recurring Moment series (OB-7).

   A dismissed event never comes back, and "Never for this event" covers the whole series.
5. **Draft.** The draft fills in the title, time and place, plus the hydration step (Part A) and the playbook lines. The member reviews and seals. **Calendar never creates, seals or shares a Moment by itself** (#35).
6. **Link.** The sealed Moment stores `calendarLink { source, calendarId, eventId, instanceStart, lastModified }`.
7. **Watch for changes:**
   - **Time-only change:** the existing Part 6.4 automatic shift applies. All steps move together, including the hydration step's `dueAt`, and the member is told once.
   - **New place, or a change from indoor to outdoor:** needs review and a new seal (V10).
   - **Event cancelled or deleted:** "Your calendar event was removed. Keep this Moment?"
8. **Deduplicate.** If the same event arrives from two sources (for example, the phone calendar and a direct Google connection), match on iCalUID, or on title, start and end, and keep one.

### B.6 Privacy rules

- Event titles can be sensitive ("Oncology follow-up"). Lock-screen cards hide titles by default and show "Your 10 AM Moment."
- Circles never see calendar data.
- Calendar fields are excluded from analytics. The only events logged are `calendar_offer_shown`, `calendar_offer_accepted` and `calendar_offer_dismissed`, with no content.
- **Disconnect** removes tokens, cached events and pending offers. Sealed Moments keep only what the member put in them.
- Export includes `calendarLink` references, not the full calendar.
- The privacy policy and consumer health data notice list calendar access as optional (amendment §4).

---

## Part C. New Register Items

| # | Item | Owner | Safe behavior until decided |
|---|---|---|---|
| 69 | Hydration step through the loop (Part A): all counted drink classes, playbook lines, electrolyte line, proposed 4 h window | Julius | Heat copy only |
| 70 | Phone-calendar connection, picker, spot rules and change handling (Tier 1, extends #35) | Julius, Brandon | Off until the member turns it on |
| 71 | Direct Google / Microsoft calendar connection (Tier 2), Google verification, device-side calls | Brandon + counsel | Not offered |
| 72 | .ics calendar link (Tier 3) | Brandon | Not offered |
| 73 | Replay and Weekly Command hydration counts wording (no cause words, no drink rankings) | Julius | Not shown |

---

## Part D. Claude Code Tasks

Place OB-11 and OB-12 right after OB-7 (recurring Moments). OB-13 and OB-14 are Phase 2.

### OB-11 Hydration step through the loop (#69)
```
Task OB-11. Read config/hydroStateModel.ts, utils/hydration/drinkRoute.ts,
services/momentsStore.ts and the Return card first. Add MomentHydrationStep
(spec: Hydration-Loop-and-Calendar-Connections.md A.5). The step fills from
ANY counted drink using the exact counted-volume function the ring uses
(drinkRoute / hydrostate-v3.0 drink classes); do not write a second formula
and do not special-case water. Classes that are "rule pending" show as
"logged, not counted yet" and add 0. Alcohol stays hidden (SS-26).
Generate exactly one hydration line per eligible Moment from a deterministic
playbook table in config/hydroStateModel.ts (status 'proposed', approvedBy
null): workout/sport >=45 min or heat band -> "Hydrate by {start-4h}",
>=60 min or high heat -> optional "Bring an electrolyte drink" item line
(AFORCE named only when #60 approved), early workout -> "Hydrate when you
wake", performance -> "Have a drink before you leave", travel -> bottle
item. Optional namedDrinkClass; any counted drink still fills the step.
No body-weight math (D11). Volumes optional, capped by S53, hidden under the
clinician limit. Match logs in [dueAt-window, start]; logs never trigger
Return. Surfaces: ring "by" marker, Before card ("14 of 16 oz · coffee,
AFORCE" / "Log a drink" opening the full drink sheet), one Return chip row
listing the drinks (member confirms), Replay and Weekly Command counts with
denominators, no cause words, no drink rankings, minimum sample #7.
Calendar time-only shifts move dueAt.
Tests: coffee, tea, milk, sports drink, AFORCE and sparkling each fill the
step by the same amount they add to the ring; a pending class adds 0; a class
not yet approved on the ring is not counted in the step; touch budget
unchanged; S53 and clinician-limit precedence; a lesson can never reduce a
playbook amount; export and deletion include steps.
Flag: moment_hydration_step_enabled.
```

### OB-12 Phone calendar into Moments (#70, extends #35)
```
Task OB-12. Use expo-calendar (pin the SDK version in package.json and use
its API). iOS: NSCalendarsFullAccessUsageDescription with the copy in B.3;
add a lint test that fails on any calendar write/delete call. Android:
declare READ_CALENDAR only, never WRITE_CALENDAR; read occurrences by time
range. Build: calendar picker (birthdays/holidays/subscribed off by
default); CalendarEventRef normalizer; filter (all-day, cancelled, declined,
free, <10 min); on-device keyword classifier with keywords in config;
offers in the morning card and Moments -> "From your calendar" (one per
occurrence, dismiss is permanent, "Never for this event" per series,
recurring -> "Plan every one?" -> MomentSeries from OB-7); draft prefill
including the OB-11 hydration step; calendarLink on seal; change detection
(time-only -> Part 6.4 shift, place/indoor-outdoor -> new seal, removed ->
"Keep this Moment?"). Calendar data stays on device except fields the
member plans with. Lock screen hides titles by default. Analytics: three
content-free event types only. Disconnect clears cache and offers.
Flag: calendar_spotting_enabled.
```

### OB-13 Direct Google and Microsoft calendars (#71, Phase 2)
```
Task OB-13. Add "Connect Google" (OAuth 2.0 + PKCE, scope
calendar.events.readonly only) and "Connect Microsoft" (MSAL public client,
Calendars.ReadBasic only). Tokens in Keychain/Keystore via expo-secure-store;
all API calls from the device, none through server/src. Google: events.list
with singleEvents=true over now..+8 days. Microsoft: GET /me/calendarView.
Feed results into the OB-12 normalizer and dedupe against phone-calendar
events by iCalUID, else title+start+end. Refresh on open and background
refresh; no webhooks. Handle revoked or expired grants with one quiet
"Reconnect" row, never a notification. Never request write or mail scopes
(add a test that asserts the exact scope strings). Disconnect revokes
tokens and clears the cache. Flag: calendar_direct_connect_enabled.
Do not ship before Google sensitive-scope verification passes.
```

### OB-14 Calendar link (.ics) (#72, Phase 2)
```
Task OB-14. Let the member paste a webcal/https .ics URL. Fetch on device,
parse VEVENT with RRULE/EXDATE expansion over now..+8 days, feed the OB-12
normalizer. Treat the URL as a secret (secure store, never logged). Size and
timeout limits; reject non-https except webcal rewrite. Flag:
calendar_ics_enabled.
```

**Updated OB order:** OB-0, OB-1, OB-7, OB-11, OB-12, OB-3, OB-8, OB-9, OB-2, OB-4, OB-5, OB-10, OB-6. OB-13 and OB-14 come after the 4-week cohort. Finish Phase 0 first.
