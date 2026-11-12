# Device QA — One Breath confirmation window and understanding (spec v1.8.2)

**Status:** OPERATIVE · **Created:** 2026-11-12
**Target:** an internal build from `main` that includes PRs #1202, #1203 and #1204 **and** the
self-echo fix that ships with this script (commit "fix(one-breath): the read-back can never seal
itself"). Earlier builds have no read-back, or can hear their own read-back. Confirm the build
number before starting.

Run on real hardware: one current iPhone and one Android phone. Simulator passes do not close a
row: the microphone, the silent switch, VoiceOver and font scaling all behave differently on a device.

**Recording rule:** a row is closed by a screenshot or an explicit written observation. "Looked
fine" is not a result. Note the device, OS version and build number once at the top of each pass.
Copy each closed row's result into `governance/PROOF-TRACKER.md` (Test evidence and Platform
columns) under the ID in brackets.

**What each platform can run:**
- **iPhone:** both typed and spoken replies. Voice uses on-device Apple recognition.
- **Android:** typed replies only. Voice input is iPhone-only in this build, so the Speak button
  should not appear. Record that as the expected result in row 0.5, then run every typed row.

---

## 0 · Setup

| # | Step | Result |
|---|---|---|
| 0.1 | **Build.** Use an internal TestFlight (or Android internal) build with `EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true` **and** `EXPO_PUBLIC_SOCIAL_V04=true`. Without both, the orb opens the older confirm screen and none of these rows can be reached. Producing the build is a founder step; this script does not trigger one. | ☐ |
| 0.2 | Sign in. Moments must be on (same as the Travel pass setup). | ☐ |
| 0.3 | **Profile → Devices → Coach Mode → Spoken.** Read-backs are only spoken in Spoken mode. Silent and Ambient show the read-back as text only, which is expected. | ☐ |
| 0.4 | Tap the **One Breath orb**. The screen with *Your moment* and *Review my moment* opens. | ☐ |
| 0.5 | **iPhone:** a mic option is offered and the first use asks for microphone and speech permission; allow both. **Android:** no Speak button anywhere in this flow (expected). | ☐ |

**Standard plan** used below: type `Team dinner today at 7:30 PM` (pick a time later today),
tap **Review my moment**, **Continue**, then **Review & seal**. That lands on the Seal view.

## A · The confirmation window

| # | [ID] | What to do | What must happen | Result |
|---|---|---|---|---|
| 1 | [V13] | Open the Seal view with the standard plan. | A **READ-BACK** block shows *Team dinner, today at 7:30 PM. Say 'seal it' to lock it in.* While it is being read, the strip says *Listening opens after the read-back.* | ☐ |
| 2 | [V1, V14] | During the read-back, type `seal it` and tap **Reply** (iPhone: also try saying it). | Nothing seals. A line reads *Heard 'seal it' outside the window · nothing happened.* | ☐ |
| 3 | [V13] | Wait for the read-back to finish. | *Confirmation window 1 · open* appears, and the strip counts down *Listening for 'Seal it' · 7s … 1s*. | ☐ |
| 4 | [V13, V14] | Let the countdown run out without replying. | The strip shows *Listening is closed. Hear it again to reopen.* and a line reads *Closed after 7 seconds · nothing heard*. Typing `seal it` now does nothing and shows the outside-window line. | ☐ |
| 5 | [V14] | Tap **Hear it again**. | A fresh read-back, then *Confirmation window 2 · open*. Nothing else reopens a window. | ☐ |
| 6 | [V2] | In an open window, type `yes`, then `okay`, then `confirm`. | Each one only gets *Say 'seal it' to confirm.* Nothing seals. The window stays open. | ☐ |
| 7 | [V2] | In an open window, type `not yet`. | *Closed · you said no* and *Nothing saved.* The plan is not sealed. | ☐ |
| 8 | [V1, CB13] | Tap **Hear it again**; in the window type `seal it`. | *Heard 'seal it' inside the window · sealed*, then the **SEALED** view (*Your plan is yours. Go perform.*). Open Moments: exactly **one** Team dinner. | ☐ |
| 9 | [V4] | Right after row 8, tap **Undo** within 5 seconds. | Back on the Seal view with *Seal undone · awaiting seal* and a new read-back. In Moments the dinner is no longer sealed. | ☐ |
| 10 | [V4] | Seal again by typing `lock it in` in a window, then wait 6 seconds without tapping anything. | The Undo button disappears after about 5 seconds and the plan stays sealed. | ☐ |
| 11 | [Part 8.1.8] | Start a new standard plan. **During** the read-back, press and hold the seal ring. | It seals by hold with no window needed. No Undo button is offered after a hold. | ☐ |

## B · Changes and questions

| # | [ID] | What to do | What must happen | Result |
|---|---|---|---|---|
| 12 | [V3, V15] | In an open window, type `make it 8 PM`. | *Closed · you corrected the plan*, *Updated from your correction*, a new read-back *Team dinner, today at 8:00 PM …*, then *Confirmation window 2 · open*. **Not sealed.** | ☐ |
| 13 | [CB4, V15] | In an open window, type `No, Saturday` (choose a Saturday that isn't today). | The read-back moves to Saturday (or *tomorrow* if Saturday is tomorrow) with *Updated from your correction*. Not sealed. | ☐ |
| 14 | [V15, Part 8.1.7] | In an open window, type `What should I eat before?` | *Closed · you asked something else*, then *I don't have a reviewed answer for that yet. Your plan is still waiting for you to seal it.* and a fresh read-back with a new window. Not sealed. | ☐ |
| 15 | [V3] | In an open window, type `make it 12` (no AM/PM). | Goes back to the edit view with *Change the day or time below, then review again.* Not sealed. | ☐ |

## C · Voice (iPhone only)

| # | [ID] | What to do | What must happen | Result |
|---|---|---|---|---|
| 16 | [CB12] | Repeat rows 6, 7, 8 and 12, **saying** the words instead of typing. Tap **Speak**, say the phrase, stop. | Same results as typed. Only the finished phrase counts: saying "No, Saturday" never cancels on the word "No" alone. | ☐ |
| 17 | [V1] | With Coach Mode on Spoken, tap **Speak**, then tap **Hear it again**. | Listening stops when the read-back starts, so the phone never hears its own *Say 'seal it'*. Tap Speak again to reply. Nothing seals by itself. | ☐ |
| 18 | [V18, partial] | With the ring/silent switch **on silent**, open the Seal view in Spoken mode. | Write down whether the read-back is heard. (The spec requires it to be; this build does not set the audio category, so a silent result is a known gap, not a failure of this script.) | ☐ |
| 19 | [V2] | Mumble or speak from across the room in an open window. | Low-confidence speech never seals. *I didn't catch that.* or no effect. | ☐ |

## D · Understanding

| # | [ID] | What to type on the first screen | What must happen | Result |
|---|---|---|---|---|
| 20 | [V16] | `Lift tomorrow at 6:30 AM, want my legs fresh` | Mirror: Moment **Morning lift**, Goal **Legs fresh**, tomorrow 6:30 AM. The plan shows *Not offered yet · the workout playbook isn't reviewed yet …* (not *lower-body*). The read-back has **no** *Updated from your correction*. | ☐ |
| 21 | [V17] | `Upper body at the gym tomorrow at 6 AM, build strength` | Goal **Build strength**. The plan shows *Not offered yet · the upper-body playbook isn't reviewed yet, so I won't suggest any.* No exercises anywhere. | ☐ |
| 22 | [CB3] | `Lift at 6:30` | One question: *6:30 in the morning or evening?* with **6:30 AM** and **6:30 PM**. Nothing is saved before you pick; picking fills the time. | ☐ |
| 23 | [CB3] | `Lift at 6:30 AM` and `Maybe lift at 6:30` | No question for either (AM said; uncertain wording leaves the time for you to enter). | ☐ |

## E · Durability and accessibility

| # | Check | What must happen | Result |
|---|---|---|---|
| 24 | **Restart** | Seal a plan, force-quit, relaunch. The Moment is still sealed once. Undo is not offered after a restart. | ☐ |
| 25 | **Background** | Open a window, send the app to the background for 10 seconds, return. The window has closed; nothing sealed. | ☐ |
| 26 | **VoiceOver / TalkBack** | The read-back is read and **Hold to seal** can still be activated by double-tap. Android TalkBack announces the countdown strip as it changes; iOS VoiceOver may not, so write down what you hear. | ☐ |
| 27 | **Large text** | At the largest text size, the read-back, strip, lines, Reply and Undo reflow; nothing clips. | ☐ |
| 28 | **Regression** | The Social (night out) flow still seals by hold and its field still reads **Priority**, not Goal. | ☐ |

---

**Out of scope for this pass:** the AI understanding layer (not built; register #41 and conflict
C3), spoken replies other than the read-back (#47, C4), safety mentions such as recent surgery or
pregnancy (needs expert-reviewed wording; R9, CB14), sending and sharing with the 5-second delay
(V5, V6, CB9; not built), Siri / Google Assistant shortcuts (V12), and HydroState and drink
logging (V9, CB5, CB6; blocked on C1).

**Known gaps to record, not fail:**
- The window opens after an estimate of how long the read-back takes (2.5 words per second), not when audio actually ends.
- Saying "undo" works in code, but the SEALED view has no mic button, so Undo is the button.

---

## Pass log

| Pass | Date | Tester | Device + OS | Build | Rows passed | Rows failed / notes |
|---|---|---|---|---|---|---|
| | | | | | | |
