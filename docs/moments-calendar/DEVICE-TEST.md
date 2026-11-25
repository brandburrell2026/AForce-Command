# Connect calendars to Moments: device test

Status: **every row below is Not run.** Nothing here has been tested on a phone. The automated tests in the last sections use sample data and fake calendar reads only. They do not prove anything about iOS or Android calendar behaviour.

Build flag: `moments_calendar_enabled` must be switched on for the test build. It is off by default and is not in the internal TestFlight overlay. Do not release until DR-011 / PR-002 Legal and Privacy sign-offs are in.

How to record a result: replace `Not run` with `Pass`, `Fail` plus a note, or `N/A`, the date and the tester's initials. A row stays `Not run` until a person has done it on that phone.

Phones: iPhone (iOS version: ____), Google Pixel with Google Calendar (Android version: ____), Samsung Galaxy with Samsung Calendar (One UI version: ____).

## 1. Permission prompts

| Check | iPhone | Pixel (Google Calendar) | Galaxy (Samsung Calendar) |
|---|---|---|---|
| First tap on Connect shows the system calendar prompt | Not run | Not run | Not run |
| iPhone prompt wording says full access; the in-app line above it says AFORCE only reads | Not run | Not run | Not run |
| Android prompt is Calendar only (no contacts, no other group) | Not run | Not run | Not run |
| Allow: calendars list appears; events are not read until at least one calendar is turned on | Not run | Not run | Not run |
| Deny: the denied card appears and Open Settings goes to this app's settings | Not run | Not run | Not run |
| Turn access on again in Settings and return: the screen recovers without a restart | Not run | Not run | Not run |
| Revoke access in Settings while the app is open: suggestions disappear, no stale events remain | Not run | Not run | Not run |
| Built Android manifest does not contain WRITE_CALENDAR (check with `aapt dump permissions` on the APK/AAB) | Not run | Not run | Not run |
| Built Android manifest does contain READ_CALENDAR | Not run | Not run | Not run |
| Disconnect: prefs and prepared marks are cleared, the Moments calendar page shows no events | Not run | Not run | Not run |

## 2. Which calendars are listed

Turn the account on in the phone's own calendar settings first, confirm the events show in the phone's calendar app, then open Connect calendars. For each row record the account label AFORCE shows and whether every calendar of that account is listed.

| Source | iPhone | Pixel (Google Calendar) | Galaxy (Samsung Calendar) |
|---|---|---|---|
| iCloud calendars | Not run | Not run | Not run |
| Gmail / personal Google account | Not run | Not run | Not run |
| Google Workspace (work) account | Not run | Not run | Not run |
| Microsoft 365 / Exchange account | Not run | Not run | Not run |
| Outlook.com / Hotmail account | Not run | Not run | Not run |
| Samsung account calendars | Not run | Not run | Not run |
| Local / On this phone calendar | Not run | Not run | Not run |
| Yahoo calendar (iPhone only) | Not run | Not run | Not run |
| CalDAV account (iPhone only) | Not run | Not run | Not run |
| Subscribed calendar, e.g. holidays or a sports schedule (iPhone only) | Not run | Not run | Not run |
| Two accounts of the same kind (work and personal Google) are shown as two separate groups, each with its account name | Not run | Not run | Not run |
| Account label under each group matches the account in the phone's settings | Not run | Not run | Not run |
| Look again lists a calendar added after the screen was opened | Not run | Not run | Not run |

### When a calendar you expect is missing

Do not guess. For each missing calendar, work through this in order and write down which cause it is.

| Missing calendar | Shown in the phone's own calendar app? | Cause: unsynced / not exposed by the OS / blocked by workplace policy | Result |
|---|---|---|---|
| (fill in) | | | Not run |

How to tell the causes apart:

- **Unsynced:** the account is on the phone but Calendars sync is off (iPhone: Settings > Calendar > Accounts > the account > Calendars. Android: Settings > Accounts > the account > Account sync > Calendar). Turning it on and tapping Look again fixes it.
- **Not exposed by the OS:** the phone's own calendar app shows the events but AFORCE does not list the calendar. Note the account type and calendar name. This is the case that would need a direct connection (see the follow-up section).
- **Blocked by workplace policy:** the calendar is not in the phone's calendar app either, or it appears only inside a managed work app (an MDM or work profile keeps it out of personal apps). Only the employer's IT can change this.

## 3. Events

Make the events in the phone's own calendar app, on a calendar that is turned on in AFORCE. Use titles such as "Investor call", "Track session", "Flight to Denver", "Team dinner".

| Check | iPhone | Pixel (Google Calendar) | Galaxy (Samsung Calendar) |
|---|---|---|---|
| A work event in the next two days appears under From your calendar with its title, date and time | Not run | Not run | Not run |
| A training event appears | Not run | Not run | Not run |
| A performance event (e.g. Race day) appears | Not run | Not run | Not run |
| A travel event appears | Not run | Not run | Not run |
| A personal event with a social word (Dinner) appears; a plain personal event (Personal time) does not | Not run | Not run | Not run |
| An untitled or private event does not appear as a suggestion | Not run | Not run | Not run |
| An all-day event does not appear | Not run | Not run | Not run |
| A tentative or cancelled-titled event does not appear | Not run | Not run | Not run |
| The same invitation on two calendars (same title and start) appears once | Not run | Not run | Not run |
| A weekly recurring event: each occurrence in the next two days is its own suggestion | Not run | Not run | Not run |
| Prepare for this on one occurrence of a recurring event does not mark the other occurrences prepared | Not run | Not run | Not run |
| Mark one occurrence I'M READY: the next occurrence is still not prepared (confirms the occurrence-specific mark on a real device) | Not run | Not run | Not run |
| iOS and Android: record whether occurrences of one series share the same event id (the app assumes they do) | Not run | Not run | Not run |
| Reschedule an event before sealing: the suggestion shows the new time after pulling to refresh | Not run | Not run | Not run |
| Cancel / delete an event before sealing: the suggestion disappears after pulling to refresh | Not run | Not run | Not run |
| Pull to refresh on the Moments calendar page re-reads at once (not after 60 seconds) | Not run | Not run | Not run |
| Opening the page re-reads at once | Not run | Not run | Not run |
| Airplane mode: the page still lists calendar events (on-device read) and shows no network error | Not run | Not run | Not run |
| Change the phone's time zone (travel): times shown follow the new zone; no event is duplicated or lost | Not run | Not run | Not run |
| Event on the night of a daylight-saving change: shown at the correct local time before and after | Not run | Not run | Not run |
| A far-future event (more than two days) is not listed | Not run | Not run | Not run |

## 4. Prepare for this, review, seal

| Check | iPhone | Pixel (Google Calendar) | Galaxy (Samsung Calendar) |
|---|---|---|---|
| Prepare for this opens One Breath on that event's own screen with the title and time filled in | Not run | Not run | Not run |
| Nothing is saved until Seal (check the Moments list after backing out) | Not run | Not run | Not run |
| Review shows the event time in the phone's current time zone | Not run | Not run | Not run |
| Seal saves the plan; the suggestion no longer appears on the calendar page; the plan appears once | Not run | Not run | Not run |
| Tapping Seal twice quickly saves one plan (idempotent) | Not run | Not run | Not run |
| Moving the event while the review screen is open shows the 'Calendar details changed' message and asks for a new review | Not run | Not run | Not run |
| Cancelling the event while the review screen is open stops the review honestly | Not run | Not run | Not run |
| Backing out of the review, then Prepare for this again, works | Not run | Not run | Not run |

## 5. A change after seal

Seal a plan from a real event, then change the event in the phone's calendar app.

| Check | iPhone | Pixel (Google Calendar) | Galaxy (Samsung Calendar) |
|---|---|---|---|
| Move the event by 1 hour: the plan shows 'Calendar event changed' on the Moments calendar page after refresh | Not run | Not run | Not run |
| Move the event by about a day: the plan shows 'Calendar event changed'; record whether the new time also appears as a new suggestion (known limit: moves over 12 hours can) | Not run | Not run | Not run |
| Cancel the event: the plan shows 'Calendar event changed' | Not run | Not run | Not run |
| The saved plan's time, steps and seal are unchanged after any of the above | Not run | Not run | Not run |
| Tapping the plan opens the Moment so the member can review it | Not run | Not run | Not run |
| A moved event that belongs to a sealed plan does not also appear as a fresh suggestion | Not run | Not run | Not run |
| Leave the event unchanged: no notice appears | Not run | Not run | Not run |
| Turn the event's calendar off in Connect calendars: record what the page shows for the sealed plan (known limit: it can read as changed) | Not run | Not run | Not run |
| Disconnect all calendars: no notice appears for any plan | Not run | Not run | Not run |

## 6. Privacy checks

| Check | iPhone | Pixel (Google Calendar) | Galaxy (Samsung Calendar) |
|---|---|---|---|
| With a proxy or network inspector running, opening the page, pulling to refresh and tapping Prepare for this sends no calendar title, time or id to any host | Not run | Not run | Not run |
| No event title appears in the device log while using the feature (iOS: Console; Android: logcat) | Not run | Not run | Not run |
| App storage holds only the calendar prefs and the prepared marks (no titles, no times) before sealing | Not run | Not run | Not run |
| After sealing, storage holds the plan with that event's title and an opaque event id and start (expected; see DECISIONS-NEEDED) | Not run | Not run | Not run |

## What passed with sample data

Only what the automated tests prove. These ran on a computer with fake calendar reads and sample events. They say nothing about a real phone.

- Recurring occurrences get separate Moment ids and prepared marks; an old bare-event-id mark still applies to a single occurrence only (`services/__tests__/calendarOccurrence.test.ts`, `calendarMomentsOccurrences.test.ts`).
- The same invitation on two calendars collapses to one suggestion while both event ids are kept for change detection.
- A moved event updates its suggestion; a cancelled event disappears on the next read; a failed read keeps no snapshot and claims nothing.
- A sealed plan whose event moved (within 12 hours) or went is detected without editing, cancelling or re-sealing it; unsealed, cancelled, finished or unlinked Moments are ignored; an empty read, no read, or an event outside the read window makes no claim.
- A moved event that belongs to a sealed plan does not reappear as a fresh suggestion; other occurrences of the series and unrelated events still do.
- A device time-zone change does not change any occurrence's identity; a one-hour shift at a daylight-saving boundary is treated as a move, and the two occurrences either side of the change stay distinct.
- Work, training, performance, travel and social-word personal events are eligible; masked, untitled, tentative, cancelled, declined, already prepared, already planned, low-importance, too-soon, already-started, recovery and Decision-Guard-blocked events are refused (`services/__tests__/calendarPrepareSuggestions.test.ts`).
- The Moments calendar page shows suggestions with Prepare for this opening One Breath with `momentId` and `proposal=1`, the changed-event notice with a way to open the Moment, and the loading, not-connected, no-access, error and empty states (`components/__tests__/momentsCalendarSuggestions.render.test.tsx`).
- The Connect calendars screen labels each account and kind, states that only chosen calendars are read, shows setup help and Look again (`components/__tests__/connectCalendarPicker.render.test.tsx`).
- In a sample build a sample event walks Calendar, Prepare for this, One Breath review, and stops with "This is a sample event. It cannot be sealed." Continue is off and nothing is saved (`components/__tests__/momentPreparationSample.render.test.tsx`).
- `WRITE_CALENDAR` is blocked in `app.json`; no new storage key; no network, analytics or log call in any calendar file (`components/moments/__tests__/calendarPrepareLaws.guard.test.ts`, `calendarSurfaceNoEgress.guard.test.ts`).

Not proven by any test here: iOS or Android permission prompts, which calendars a real phone lists, real recurring-event ids on a device, the Android manifest in a built binary, real time-zone or daylight-saving behaviour of the OS calendar, or how the screens look and feel on a phone.

## Follow-up if device testing shows gaps

Only needed if section 2 finds calendars that are not exposed by the OS (for example some Microsoft 365 or Google Workspace calendars). **None of this is built.**

- **Direct read-only Google Calendar connection.** Needs a Google OAuth consent screen using the read-only calendar scope, Google's OAuth app verification (restricted or sensitive scope review), a privacy policy and data-handling disclosure, token storage, and a change to the data-minimisation contract (the bridge is the only device path today). Workspace admins may need to allow the app.
- **Direct read-only Microsoft 365 connection.** Needs a Microsoft Entra app registration with the read-only calendar permission, a consent flow, and, for many workplaces, admin consent from the employer's tenant before any member can connect. Personal Outlook.com accounts need separate handling.
- Both would send event data through a network path, which today's design forbids. They need a new Legal and Privacy decision (PR-002 Appendix A amendment), an updated store privacy label, and Security review before any build work starts.
