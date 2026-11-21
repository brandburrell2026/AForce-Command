# Connect calendars to Moments: decisions needed from Legal and Privacy

Context: DR-011 and PR-002 Appendix A (calendar data class). Legal and Privacy sign-offs are still pending. The feature stays behind `moments_calendar_enabled` (off by default) until they sign. Nothing below changes that.

## 1. A sealed plan keeps the event title and an event id

When a member taps Prepare for this and then seals, the saved Moment carries the event's **title** (as the Moment name the member reviewed and may have edited) and an **opaque link**: the calendar event id and the event's start time (`calendarSource {eventId, startAtIso}`). This lives in the member's own Moments store on the device. It is how AFORCE hides the matching suggestion and notices later that the event moved or went.

Appendix A says persisting event content affects the S1 classification. Please decide:

- Is the title, once reviewed and sealed by the member, acceptable at rest under S1, or must the sealed Moment keep only the member's own words and the opaque link?
- Is the event id plus start time acceptable at rest? It is not content, but it identifies an event on the device.
- Retention: today the plan keeps the title until the member deletes the Moment. Is that enough, or is a time limit needed?
- The in-app privacy line was changed because "Nothing is stored" was no longer true once a plan is sealed (see section 6).

Not stored: attendees, notes, locations, organizers, attachments, URLs, calendar names, or any event the member does not seal.

## 2. iPhone permission wording

iOS has no read-only calendar level. The system prompt will say AFORCE wants **full access** to calendars, although AFORCE only reads (`expo-calendar` never calls create, update or delete, pinned by `calendarBridge.scopes.test.ts`). The Connect screen says this in plain words before the prompt. Please confirm:

- the in-app sentence is acceptable: "iPhone has no read-only calendar level, so the iPhone prompt says AFORCE wants full access. AFORCE only reads."
- the App Store privacy answers match (calendar data read on device, not collected).

## 3. Widened eligibility (founder decision, 2026-11-21)

Work, training and performance calendar events can now be offered for preparation, as well as travel and social-word personal events. Recovery events and generic personal events are still not offered. Every existing refusal stays (masked, untitled, tentative or cancelled wording, already planned, low importance, Decision Guard).

Things Legal and Privacy should know:

- Work meeting titles can now reach the preparation screen and, if sealed, be stored (section 1). Previously only travel and social-word events could.
- `preparationProposalCandidate` is also used by the Social One Breath entry. Social is restricted to what it proposed before (travel and social plans); work, training and performance events are offered from the Moments calendar page only. Say so if Social should offer them too.
- Lead windows for the new types (work 24h, training 12h, performance 24h) are in `config/hydroStateModel.ts` and are a first choice for the founder to confirm.

## 4. Event ids and recurring events

Occurrences of a recurring event share one event id on both platforms (verified in the `expo-calendar` 15.0.8 source; on iOS it is the EventKit item identifier, not yet confirmed on a device). The app now keeps the prepared mark and the Moment id per occurrence, by id plus start time. The only new data kept is that `eventId@startTime` key in the existing prepared-marks record (no title or other content). No new storage key. Old marks keyed by bare id still work for single occurrences.

## 5. Other things found that may need a decision

- **Change notice after a calendar is switched off.** If a member turns a calendar off, a sealed plan linked to one of its events can read as "Calendar event changed", because the app cannot tell "removed from the calendar" from "calendar no longer read". Fixing this needs the calendar id stored on the sealed Moment (a new persisted field). Not done. Decide whether to accept the wording ("may have moved or gone") or approve that field.
- **Moves of more than 12 hours** are shown as "Calendar event changed" on the plan but the moved event can also reappear as a fresh suggestion, because the app does not read whether an event is part of a series (that would be a new field read). Decide whether reading the recurrence flag is acceptable, or the 12-hour limit stays.
- **Android `WRITE_CALENDAR`** is added by the `expo-calendar` library and the app never uses it. It is now blocked in `app.json`. `READ_CALENDAR` stays. Needs a real build to confirm the manifest.
- **Android account names.** On Android the calendar's account name is often an email address. The Connect screen shows it, on the phone only, so work and personal can be told apart. It is not stored or sent. Confirm that is acceptable.
- **Direct Google and Microsoft connections** would be new network data paths. Not built. See the follow-up section of `DEVICE-TEST.md`.

## 6. Member-facing wording changed

The privacy line on the Connect screen was changed from "Nothing is stored or sent anywhere." to "Events are read on this phone and are not sent anywhere. If you seal a plan, it saves that event's title and time, nothing else." Legal to approve before release. (It says "title and time" because the event id is not shown to members.)
