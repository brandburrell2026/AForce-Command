# Moments calendar: rendered with sample events (2026-11-21)

Rendered in a desktop browser at 390 x 844 from the real screen components on
`feat/moments-calendar-prepare`, in the app's local capture mode. **Not a phone
and not a real calendar.** `moments_calendar_enabled` was switched on only in
the memory of the local test page; the app default is unchanged (off).

| File | What it shows |
|---|---|
| `moments-calendar-sample-events.jpg` | Moments calendar with four events, each labelled SAMPLE EVENT, and "Prepare for this". "Board Meeting" is the app's own capture-mode sample; the other three were added by the test page. |
| `connect-calendars-sample.jpg` | Connect calendars with the app's synthetic calendars (labelled DEMO PREVIEW), grouped by account, with the account-kind label. |

## Differences seen (not fixed here)

- Connect calendars still has the old look: all-caps heading "CONNECT CALENDAR" (singular) and "AForce" spelling, against the new style used on the Moments calendar.
- "Missing a calendar?" body text is larger than the body text above it, and its card touches the Work calendar group above.
- "Look again" reads as a heading, not a button.
- On the Moments calendar, Sunday's events are listed while Saturday is selected (by design: the list covers the next two days), which may read as a mismatch with the selected day.

## Not rendered

- "Calendar event changed" on a sealed plan (needs a calendar snapshot).
- Permission-off, read-failed and no-calendars states.
- Anything on a phone.
