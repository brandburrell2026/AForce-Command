# AFORCE OS · Device checklist — iPhone build 164 and Android build 7

**Builds:** iPhone 164 (EAS `29aa931f`, TestFlight) · Android versionCode 7 (EAS `42c109c2`, APK) · both from `main@37fd3025`, profile `internal-social` / `internal-social-apk`.
**Purpose:** first device evidence for the bottom bar, the orb, warm-white buttons, One Breath sealing and hydration logging.

**Rules**
- A row is **Pass** only when a person ran it on that phone. Otherwise it stays **Unverified**.
- Record for each phone: model, OS version, build number, date, tester.
- A failed row gets a screenshot or screen recording and one line on what happened.
- Nothing here marks a Proof Tracker row as passed by itself; results are copied into `PROOF-TRACKER.md` with this evidence.
- Android: One Breath voice is iPhone-only today. Run voice rows **typed** on Android and mark the voice half "not available".

| | iPhone | Android |
|---|---|---|
| Model / OS | | |
| Build | 164 | 7 |
| Date / tester | | |

Mark each row **P** (pass), **F** (fail) or leave blank (unverified).

## 1. Navigation and the bottom bar (highest priority)

| # | Check | iPhone | Android |
|---|---|---|---|
| N1 | Five tabs show: Home, Hydration, the orb, Moments, Circle. Labels are sentence case and readable | | |
| N2 | The active tab is warm white with a thin red line above it; the others are grey | | |
| N3 | The Home icon is a house | | |
| N4 | Each tab opens its screen; going back and forth loses nothing typed | | |
| N5 | Nothing on any screen is hidden behind the bar or the orb, including the last row of a long list | | |
| N6 | The bar sits correctly above the home indicator (iPhone) and the system navigation buttons or gesture bar (Android) | | |
| N7 | Tap the member photo on Home: Profile opens, and sweat calculator, devices, Coach Mode and Travel are reachable from it | | |
| N8 | Long-press Hydration: the scan screen opens. A normal tap still opens Hydration | | |

## 2. The One Breath orb

| # | Check | iPhone | Android |
|---|---|---|---|
| O1 | The orb is round, red, raised above the bar, with the N–И mark centred; the second N is mirrored | | |
| O2 | The top of the orb is not cut off | | |
| O3 | **Tap the very top edge of the orb** (the part above the bar): One Breath opens. *Android is the risk here* | | |
| O4 | Tap the centre and each side of the orb: One Breath opens every time | | |
| O5 | Rest a thumb on the orb for 3 seconds: nothing records, nothing seals | | |
| O6 | On Home the orb breathes slowly; on other tabs it is still | | |
| O7 | Turn on Reduce Motion (iPhone) / Remove animations (Android): the orb is still on Home too | | |
| O8 | On the Seal step and the Quiet step the orb is hidden; it returns afterwards | | |

## 3. One Breath sealing

Run the full script in `governance/ONE-BREATH-DEVICE-QA.md` (28 rows). The rows below are the minimum.

| # | Check | Tracker | iPhone | Android |
|---|---|---|---|---|
| S1 | Type "Lift tomorrow at 6:30 AM, want my legs fresh": shows Morning lift and Goal: Legs fresh | V16 | | |
| S2 | Type "Lift at 6:30": asks morning or evening; nothing is created until answered | CB3 | | |
| S3 | During the read-back the strip says listening opens after the read-back | V13 | | |
| S4 | After the read-back a countdown of about 7 seconds shows | V13 | | |
| S5 | "Seal it" inside the window seals once | V1 | | |
| S6 | "Seal it" before the window or after it closes does nothing and says so | V14 | | |
| S7 | "Yes", "okay", "sounds good" never seal | V2 | | |
| S8 | "Make it 7" rebuilds the plan, reads it back, opens a new window, does not seal | V3, V15 | | |
| S9 | "No, Saturday" changes the day; the original words are unchanged | CB4 | | |
| S10 | Hold to seal works, including during the read-back | V1 | | |
| S11 | Undo appears for about 5 seconds after a spoken or typed seal and returns the Moment to awaiting seal | V4 | | |
| S12 | "Seal it" twice: one sealed Moment only | CB13 | | |
| S13 | Close and reopen the app after sealing: the Moment is still sealed, once | W-rows | | |
| S14 | Airplane mode, then seal: a clear message, nothing half-saved | CB10 | | |
| S15 | "Upper body at the gym tomorrow at 6 AM": timing-only plan, exercises "Not offered yet" | V17 | | |
| S16 | iPhone only, silent switch on: is the read-back heard? Record yes or no | V18 | | n/a |
| S17 | The primary buttons ("See what AFORCE heard", "Looks right") are warm white with black text; the hold-to-seal fill is red | — | | |

## 4. Hydration logging

| # | Check | Register | iPhone | Android |
|---|---|---|---|---|
| H1 | Log 8 oz of water: today's total goes up by 8, once | — | | |
| H2 | Log water in airplane mode, turn the network back on, retry: the drink appears **once** | RA-N5 | | |
| H3 | Tap the log button twice quickly: one entry | RA-N5 | | |
| H4 | Log a coffee: it is saved; HydroState and today's ounces do not change; the line says it will count once its rule is approved | RA-N6, V9 | | |
| H5 | Smart Capture a drink: you confirm drink and amount before anything is saved | V9 | | |
| H6 | The 96 oz target is described as a starting point, not a personal recommendation | RA-N8 | | |
| H7 | Close and reopen the app: the totals are unchanged | — | | |
| H8 | Alcohol is offered in this internal build only; note what you see | SS-26 | | |
| H9 | A Moment reminder on the lock screen does not show the Moment's title unless "Show titles" is on | RA-N11 | | |

## 5. Accessibility

| # | Check | iPhone | Android |
|---|---|---|---|
| A1 | Largest text size: bottom-bar labels, buttons and Home are readable, nothing overlaps or is cut off | | |
| A2 | VoiceOver / TalkBack: each tab is announced by name; the orb is announced as "One Breath" | | |
| A3 | VoiceOver / TalkBack: primary buttons are announced as buttons with their label; disabled ones say so | | |
| A4 | Warm-white buttons are easy to read in bright light and at lowest brightness | | |
| A5 | Every tappable control is comfortably tappable with a thumb (nothing tiny) | | |
| A6 | Reduce Motion on: no pulsing or sliding that cannot be avoided | | |
| A7 | Meaning is never carried by colour alone (states also have a word or shape) | | |

## 6. Regression sweep (5 minutes)

| # | Check | iPhone | Android |
|---|---|---|---|
| R1 | Sign out and sign in: both buttons are warm white and work | | |
| R2 | Open each of: Sleep, sweat calculator, Travel, Skin, Recovery Coach, Circle. Each loads; primary buttons are warm white; nothing is red except the orb, thin lines, dots and selected pills | | |
| R3 | No screen shows a crash or "This screen didn't load" | | |
| R4 | Screenshot every tab on both phones (spec build order, step 1) | | |

## Results

| Section | iPhone pass / fail / unverified | Android pass / fail / unverified |
|---|---|---|
| 1 Navigation | | |
| 2 Orb | | |
| 3 One Breath | | |
| 4 Hydration | | |
| 5 Accessibility | | |
| 6 Regression | | |

**Not covered here:** latency gates G1–G5 (30 timed runs each), the workout pilot rows, and anything not yet built (see the Proof Tracker).
