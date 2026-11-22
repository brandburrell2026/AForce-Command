# AFORCE mark Live Activity: device test list

Run on a physical iPhone. Results are filled in only from a recording or a tester's note. **Nothing below has been run on a phone.**

Result words: **Pass**, **Fail** (say what showed instead), **Blocked** (say what stopped the check).

Build tested: ______  ·  iPhone model: ______  ·  iOS: ______

## Before you start

- Settings › AFORCE OS › Live Activities is on (and Settings › Face ID & Passcode › Live Activities, for the Lock Screen).
- Signed in. An internal build (the conversation screen and Lock In are internal-only).
- Start a screen recording.

## The main recording

1. In One Breath, plan a Moment that starts about ten minutes from now and seal it.
2. Tap **Lock In**.
3. Swipe up to leave AFORCE.
4. Tap the N–И mark in the Dynamic Island.

| # | Check | Expected | Result |
|---|---|---|---|
| L1 | After Lock In, leave the app (iPhone with Dynamic Island) | The thin red N–И mark alone in the pill. No text beside it | Not run |
| L2 | Tap the mark | AFORCE opens on the same Moment, in Quiet: "QUIET", the ring, "LOCKED IN" | Not run |
| L3 | Press and hold the mark | Expanded view: the mark and "Moment in progress". Nothing else | Not run |
| L4 | Lock the phone | Lock Screen card: the mark and "Moment in progress". No title, place, time or score | Not run |
| L5 | Tap the Lock Screen card and unlock | AFORCE opens on the same Moment in Quiet | Not run |
| L6 | iPhone without a Dynamic Island | L4 and L5 hold. Nothing at the top of the screen | Not run |

## Launch states

| # | Check | Expected | Result |
|---|---|---|---|
| L7 | Warm: app in the background, tap the mark | The Moment in Quiet, at once | Not run |
| L8 | Cold: force-quit AFORCE, tap the mark | The app launches to the Moment in Quiet, with no welcome screen in the way | Not run |
| L9 | Force-quit, reopen from the app icon | Still one mark, not two | Not run |

## Ending

| # | Check | Expected | Result |
|---|---|---|---|
| L10 | Heading back → Made it back | The mark and the Lock Screen card go away | Not run |
| L11 | Plans changed → My plan is cancelled | The mark and the card go away | Not run |
| L12 | Lock In, then leave the phone alone past the expiry (6 hours after the Moment's start) | The card is gone the next time AFORCE opens; iOS removes it on its own by about 8 hours | Not run |
| L13 | Tap a card for a Moment that has since ended | AFORCE opens on Moments | Not run |

## Sign-in and settings

| # | Check | Expected | Result |
|---|---|---|---|
| L14 | Lock In, sign out, tap the mark if it is still showing | Sign-in opens; after signing in, the Moment (or Moments if it ended) | Not run |
| L15 | Sign out while locked in | The mark goes away | Not run |
| L16 | Live Activities off for AFORCE, then Lock In | Lock In works exactly as before. No mark, no error | Not run |
| L17 | Seal a plan without locking in | No mark | Not run |

## Privacy

| # | Check | Expected | Result |
|---|---|---|---|
| L18 | Read every surface (pill, expanded, Lock Screen, banner) | Only the mark and "Moment in progress". Never a Moment's name, place, time, HydroState or any number | Not run |
