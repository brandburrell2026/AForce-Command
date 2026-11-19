# Demo vs app — every tab

**Date:** 2026-11-18 · **Demo:** "Every tab, one system." (version `1794374401-aafd`) · **App:** `main` plus the two open pull requests named below.
**Rule (founder, 2026-11-18):** each screen must look like the demo, and anything not in the demo must not be there.

Read this as the list of what is left. "Seen on a phone" is **no** for every row unless stated; my images are browser renders of the real components.

Legend: ✔ matches · ◐ differs for a stated reason · ✘ missing.

## Bottom bar

| Demo | App | |
|---|---|---|
| Five items: Home · Hydration · Breath · Moments · Circles | Same order and labels | ✔ (bar PR) |
| Icons: ring with a dot, outline drop, three lines, two overlapping rings | The demo's own drawings | ✔ (bar PR) |
| Orb 46pt, raised 22pt, black ring, red glow, "Breath" under it | Same | ✔ (bar PR) |
| Active tab: warm white, thin red mark above | Same | ✔ |
| Blue dot on Moments and blue ring on the orb during a Social Moment | Not built | ✘ feature |
| Hold the orb to speak | Tap only | ◐ needs the accidental-recording safeguards |

## Home

| Demo | App | |
|---|---|---|
| Mark + date, greeting, member photo | Same | ✔ |
| Next Moment: when, name at 42pt, status | Same, from real Moments | ✔ |
| World photograph behind it, slow drift | None | ✘ no licensed photography |
| One panel: status line, ring, "Your next move", intake + update, two buttons, "Why?", source | Same | ✔ |
| Ring reads intake as a percentage ("44%") | Reads the HydroState score ("44") | ◐ decision: which number is HydroState on Home |
| "Log a drink" | "Log water" | ◐ the sheet logs water only |
| Panel is translucent over the photo | Solid | ◐ follows the photo |
| Nothing under the panel | Nothing under the panel (Travel card, Concierge entry and the quiet list are removed) | ✔ (Home PR) |
| No confidence line | Moved inside "Why?" | ✔ (Home PR) |
| "Before the Moment" card ahead of a sealed Moment | Built: shows within 12 hours of a sealed Moment that is not yet locked in — "Your preparation is set.", when it was sealed and the next reviewed step. Opens the Moment | ◐ says nothing about "what changed since you sealed": the app does not check that. No re-seal offer. No capture yet |
| "Return" card after a Moment | Built: shows for 24 hours once the member has recorded they are back and the replay is unanswered — "Back from …", "Replay · 1 question", Skip | ◐ never inferred from the clock; Skip hides it until the app is next opened. No capture yet |

## Hydration

| Demo | App | |
|---|---|---|
| Member photo; "Hydration · today"; ounces at 96pt; "of 96 oz starting target · logged" | Same | ✔ |
| Status line | Same; hidden when nothing is planned | ✔ |
| Ring card, percentage, "Estimated from what you logged · time", "How the target works" | Same | ✔ |
| "Scan a drink" · "Log manually" | Same | ✔ |
| Recent, up to four rows | Same ("Today" capitalised) | ✔ |
| History: Week / Month bars | Same, from real daily totals. **Not confirmed on a phone**: the section is skipped if the totals cannot be loaded | ◐ check |
| Red Moment marks above the bars | None | ✘ data |
| "Shortcut" card | None | ✘ feature |
| No Gentle hydration card | Moved to Profile | ✔ |
| Log sheet: 64pt light number, oz and mL, "Log 16 oz" | Built: title and Close, round steppers, 64pt light number with "fl oz · mL", pill amounts, "Log N oz". No status colour. Used by Hydration and Home | ◐ titled "Log water" and has no drink chips (AFORCE, coffee, other): it logs water only. Steppers are 44pt, not 40 (touch target). Not checked on a phone |
| Log result: calm confirmation with Undo | Older result screen | ✘ not rebuilt; Undo needs the edit/delete decision |

## Breath (One Breath)

| Demo | App | |
|---|---|---|
| Mark + status word, round Close | Same | ✔ |
| Orb in a ring of ticks, "Tap to talk" | Same | ✔ |
| Prompt, example chips, talk-or-type bar | Same layout; the prompt and chips name only what One Breath can do | ◐ truthful |
| "Spoken replies" button, sources row, "Operations" log | None | ✘ conversational engine and voice output are off for beta |
| Conversation: "What I heard", plan card with times at the left | Same headings ("What I heard", "Your plan"), time-left plan rows; small labels blue only in a Social Moment | ◐ still separate step screens, not one conversation thread; no harness or device capture yet |
| Seal: 150pt ring that fills while held, "Release early to cancel", 7-second window | Same ring and note; hold time, 7-second window and approval logic untouched | ◐ no capture yet; the demo's "Seal with one tap instead" was deliberately not added (approval rule) |
| Lock In: centred, large orb | Centred, 170pt orb | ◐ no capture yet |
| Quiet, Return, Replay | Older screens | ✘ not rebuilt |

## Moments

| Demo | App | |
|---|---|---|
| Mark + "Moments", photo; hero for the next or live Moment | Same, no photograph | ◐ photography |
| Status line; "Plan a Moment · say it" | Same | ✔ |
| Upcoming and Done rows with pills | Same | ✔ |
| Calendar and Protocols card | Same | ✔ |
| "uses 1 lesson" on a row | None | ✘ learning loop |
| Calendar page: month, 14-day strip with dots, Moment rows | Same layout at `/moments-calendar`, with the member's own Moments; always linked from the tab | ◐ no photographs on rows; no harness or device capture yet |
| "Spot Moments on my calendar" (reads the phone's calendar: Outlook, Gmail, iCloud accounts on the device) | Built, read-only, OFF: `moments_calendar_enabled` is blocked until Legal and Privacy sign PR-002 Appendix A (DR-011) | ✘ blocked on sign-off, not on engineering |
| Moment screen, Replay, Protocols pages | Older screens | ✘ not rebuilt |

## Travel (a Moment page, opened from Moments — internal pilot)

The demo marks this page "Design review · gated · sample data". The app's Travel page was built earlier to its own approved Travel mockup and passed a device check, so only additions that do not conflict with that were made.

| Demo | App | |
|---|---|---|
| "‹ Moments" and "Travel" | Same, as "Travel · Private pilot" | ✔ |
| Route line: JFK 9:05 — LAX · −3 h 12:20 | Built, from the member's itinerary, each time in that airport's local time, labelled "Planned times from your itinerary" | ✔ no capture yet |
| Title "New York to Los Angeles" | The destination city ("Los Angeles"), per the earlier Travel mockup | ✔ decided: keep the destination city (Brandon, 2026-11-19) |
| World photograph | Daypart tone, type only | ✘ no licensed photography |
| "Your plan" timeline (leave, boarding · Lock In, in the air, land · Return) | Rows for countdown, time difference, weather; the plan lives on the arrival Moment | ✘ not rebuilt |
| "From Travel Gate" and "Time-zone plan" concept cards | Not shown | ✘ Travel Gate not connected; sleep/light advice awaits review (CR-T1) |
| Nothing else | Trip entry form, flight status and reminders sit below the journey view | ◐ working pilot controls, kept |

## Circles

| Demo | App | |
|---|---|---|
| Mark + "Circles", photo; "Your people. Your Moments." | Same, no photograph | ◐ photography |
| Status line; "Start a Moment" · "Invite someone" | Same; Start opens One Breath, Invite opens the form in place | ◐ the demo's picker and invite screens are not built |
| People rows; Pending rows | Same; tap a person to remove | ◐ no member screen |
| Empty Circle: two rings, "Prepare with the people you trust.", Invite someone, privacy note | Same card; the action opens the invite form in place | ◐ wording shortened: the app has no per-Moment or time-limited invite; no capture yet |
| Member screen: what they see, Pause sharing, Remove, Block or report | Remove only, in the row | ✘ pause, block and report have no server support |
| "Available" pill | None | ✘ no data |
| "Choose what your Circle can see" card | Same | ✔ |
| "Your Moments" card | None | ✘ gallery not built |

## You (Profile) — header, pills and all three sections rebuilt

| Demo | Rebuilt header |
|---|---|
| ![](profile/reference-profile.jpg) | ![](profile/rebuilt-profile-header.jpg) |

| Demo | App | |
|---|---|---|
| "Back" and "Profile" | Same | ✔ |
| 84pt photo with a warm-white ring; name at 34pt; "city · member since" | Same, from the member's own photo, name, city and join date | ✔ |
| "Add a photo · optional" | "Edit profile" (opens the existing editor; photo upload is not built) | ◐ feature |
| Three pills: Performance · Devices · Account | Same, sentence case, the selected one warm white. Internal builds add a fourth, Developer | ◐ internal only |
| No rank, streak or aura chips | Removed | ✔ |
| Performance: status line, "Your Moments" strip, "What AFORCE remembers", "How AFORCE works" | Rebuilt as the demo's list: status line, "Private. No counts, no streaks.", What AFORCE remembers · How AFORCE works · Modes and checks. Rows open the same cards as before | ◐ no "Your Moments" strip (gallery not built); "Modes and checks" is extra, kept so its tools stay reachable; "What AFORCE remembers" shows target, body weight and wake time, not lessons; no capture yet |
| Devices: one row per source with On / Off / Check | Rebuilt as the demo's list: source, what it reads, state, pill (On · Check · Demo · Later · Off), the note and "Manage devices and apps". Manage holds the same device cards as before | ◐ no last-updated time on rows (the list has none to show); Phantom sits on Manage, not in the list; no capture yet |
| Account: Plan, Settings, Shop; Privacy; Download data; Delete account | Rebuilt as the demo's list: Plan · Settings; Privacy (What your Circle can see · Body details · Your data); Help. Each row opens a view holding the same controls as before | ◐ no "Shop AFORCE"; "Your data" instead of "Download or delete your data" — the app has no in-app download or account deletion; no capture yet |

Nothing was made unreachable. Account views: Plan (subscription, Clutch/Guardian entries when on, invites) · Settings (notifications and voice, language, coach, units, sign out, Gentle hydration, internal Skin) · Body details · Your data (analytics consent, memory controls) · Help (terms, privacy, health disclaimer, support, build line). A test checks every block has exactly one view.

## Sign in and opening

| Demo | App | |
|---|---|---|
| Opening promise screen with photograph, "Create account", "I have an account" | An older opening sequence | ✘ not rebuilt |
| Sign in: "Welcome back", Apple and Google pills, fields, "Forgot password?", Sign in | Same, without Apple and "Back" | ◐ Apple sign-in and the promise screen are not built |

## Decisions that block an exact match

1. **Photography.** May internal builds use the demo's AI sample photos? This is the largest visible gap on Home, Moments and Circles.
2. **The Home ring:** intake percentage (demo) or HydroState score (app)?
3. **"Log a drink":** rename now, or after the drink-choice sheet is built?
4. **Profile sections:** the header and pills match; the cards inside each section are still the old design. Features with no place in the demo (sweat calculator, Coach Mode, developer controls, Travel switch, Gentle hydration) are kept under Account for now.
5. **"Use reservation details":** delete its code, or restore it?
