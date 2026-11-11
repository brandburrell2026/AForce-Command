# Device QA — Travel Intelligence 2.0 (T1–T3)

**Status:** OPERATIVE · **Created:** 2026-11-11
**Target:** an internal build that contains `main@deb9ef76` or later (PRs #1192 and #1193).
Earlier builds do not have the journey view. Confirm the build number before starting.

Run on real hardware. Simulator passes do not close a row here: VoiceOver, Dynamic Type, reduced
motion and airplane mode all behave differently on a device.

**Recording rule:** a row is closed by a screenshot or an explicit written observation. "Looked
fine" is not a result. Note the device, iOS version and build number once at the top of each pass.

---

## 0 · Setup

| # | Step | Result |
|---|---|---|
| 0.1 | **Build.** Use an internal TestFlight build (`EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true`) or a development build. The pilot cannot be reached in a public build, by design. Producing the build is a founder step; this script does not trigger one. | ☐ |
| 0.2 | Sign in. **Profile → Developer → "Travel · TravelGate pilot" on.** Moments must also be on. | ☐ |
| 0.3 | **Moments → "Add or manage a flight"** opens Travel Intelligence. The new journey view sits at the top, above "One journey. Every moment." | ☐ |
| 0.4 | **Test trip A, "Miami test":** any valid flight number (for example `AA1234`), **JFK → MIA**, today. Departure **10 minutes from now**; arrival **75 minutes after departure**. Save. | ☐ |
| 0.5 | **Test Moment:** in Moments, add a manual Moment ("Meeting") starting **3 hours after trip A's arrival**. It drives the LOCK-IN step in row 7. | ☐ |

Flight status does not need to be connected. Every row below works without TravelGate or FlightAware.

## A · The journey, in order

| # | State | What to check | Result |
|---|---|---|---|
| 1 | **Preview** (before departure) | The eyebrow reads day · time · **JFK to MIA**, the headline is **Miami** and the subline is *Your next destination awaits.* The rows are *Departs in* (Your itinerary), *Time difference: Same time as New York* (Computed), and *Temperature* / *Humidity* labelled **Forecast**, or *—* with **Unavailable**. No number may appear without a source label. | ☐ |
| 2 | Countdown | *Departs in* goes down within about a minute without leaving the screen. | ☐ |
| 3 | **LOCK-IN** (after departure time) | **LOCK-IN** appears in red on a dark field, with *Between cities. Never between standards.* There is a progress bar, captioned *Planned times from your itinerary · not live tracking*. The **only** action is *I've landed*. | ☐ |
| 4 | Quiet | While in LOCK-IN, Travel 2.0 sends **no notification**. The existing travel reminders and flight alerts only fire if you turned them on. Write down anything that arrives. | ☐ |
| 5 | Past planned arrival | Wait past the arrival time without tapping. It **stays** LOCK-IN and the subline changes to *Past your planned arrival. Confirm when you've landed.* It must **never** switch to "arrived" by itself. | ☐ |
| 6 | **Arrival** | Tap *I've landed*. The view fades in **once**, with *You've arrived · You confirmed*, **Miami**, *New city. Same standard.*, local time and **Live** weather in °F, plus the note *City photography coming · type-only view*. | ☐ |
| 7 | Arrival plan | Tap **Plan your Miami arrival**. The arrival Moment opens. Its goal reads *Your arrival plan: Pause … · Hydrate …: 12–16 oz … · Reset …: 10 min on your feet … · LOCK-IN …*, in **Miami time**. LOCK-IN is **15 minutes before** the test Moment from 0.5. Delete that Moment and LOCK-IN must disappear rather than be invented. | ☐ |
| 8 | Undo | Back on Travel, tap *I haven't landed yet*. It returns to LOCK-IN. Confirm again. | ☐ |
| 9 | **Ready** | Tap *I'm ready*. The view changes to *Miami · ready* and *Ready to perform.* | ☐ |
| 10 | Persistence | Force-quit and relaunch. The same state comes back. | ☐ |
| 11 | Account isolation | Sign out, then sign in with a second account. None of trip A's confirmations or journey view appear. | ☐ |

## B · Honest data

| # | Case | What to check | Result |
|---|---|---|---|
| 12 | **Offline** | With airplane mode on, open Travel. The weather rows show **—** and **Unavailable**, and **never** a number. Turn airplane mode off and reopen: they show **Live**. | ☐ |
| 13 | **Unsupported city** | Make a trip JFK → **LIS**. The headline is **LIS**, the note says type-only, weather is *Unavailable*, and the arrival plan has no weather wording (no electrolyte, no shade). | ☐ |
| 14 | **Big time shift** | Make a trip JFK → **HND**, two days out. *Time difference* reads **14h ahead of New York**, the headline is **Tokyo**, and there is **no sleep or light advice** anywhere. | ☐ |
| 15 | **No arrival time** | Make a trip with no arrival entered. In transit it shows *Planned arrival — · Not on your itinerary* and no progress bar. | ☐ |
| 16 | **Other devices** | If cloud sync is on, sign into the same account on a second device. Trips sync, but the **landed / ready confirmations do not**: they are stored on this device only, by design. | ☐ |

## C · Accessibility (beta gate)

| # | Check | How | Result |
|---|---|---|---|
| 17 | **VoiceOver** | The hero is read as one header and LOCK-IN is announced as "LOCK-IN". The progress bar announces a percentage. A cancellation or diversion alert, if one appears, is spoken. | ☐ |
| 18 | **Dynamic Type** | Set Larger Text to **XL and max**. The city name, rows and buttons reflow; nothing clips or shrinks to fit. | ☐ |
| 19 | **Reduced motion** | Turn Reduce Motion **on**, then repeat row 6. The arrival view appears **without** a fade. | ☐ |
| 20 | **Touch targets** | *I've landed*, *Plan your … arrival*, *I'm ready* and *I haven't landed yet* are all comfortably tappable (52pt). | ☐ |
| 21 | **Contrast** | Text is readable on every time-of-day background: morning, day, sunset and night. To see them all, make arrivals at about 8 AM, 1 PM, 6 PM and 10 PM destination time. | ☐ |

## D · Regression

| # | Check | Result |
|---|---|---|
| 22 | The existing Travel Intelligence screen below the journey view still works. Add, edit and finish a trip; check flight status; sync; reminder choices. | ☐ |
| 23 | Moments shows each flight's departure and arrival Moment **once**. An old manual "Flight to MIA" is not duplicated. | ☐ |
| 24 | Turn the travel pilot **off**. Travel redirects home and the journey view is gone. | ☐ |

---

**Out of scope for this pass:** licensed city photography (not shipped; the type-only view is
expected), the share card, sleep and light guidance (pending science review), and production
rollout.

---

## Pass log

| Pass | Date | Tester | Build | Device / iOS | Result |
|---|---|---|---|---|---|
| 1 | 2026-11-11 | Brandon | Internal TestFlight from `main@d352fc65` · build number **not recorded** | **Not recorded** | **Rows 0.1–24: all PASS**, plus the share card (tester-reported). Row 5 observed explicitly: stayed LOCK-IN past the planned arrival and never switched to arrived on its own. |

**Share card, pass 1:** confirmed by the tester. *Share your arrival* worked, and the shared
image carried no date or time. Fill in the build number and device/iOS for pass 1 if they are still
to hand.
