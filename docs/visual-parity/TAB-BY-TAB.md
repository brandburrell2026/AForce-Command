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
| "Before the Moment" and "Return" cards when they apply | Not built | ✘ feature |

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
| Log sheet: 64pt light number, oz and mL, "Log 16 oz" | Older sheet | ✘ not rebuilt |
| Log result: calm confirmation with Undo | Older result screen | ✘ not rebuilt; Undo needs the edit/delete decision |

## Breath (One Breath)

| Demo | App | |
|---|---|---|
| Mark + status word, round Close | Same | ✔ |
| Orb in a ring of ticks, "Tap to talk" | Same | ✔ |
| Prompt, example chips, talk-or-type bar | Same layout; the prompt and chips name only what One Breath can do | ◐ truthful |
| "Spoken replies" button, sources row, "Operations" log | None | ✘ conversational engine and voice output are off for beta |
| Conversation: "What I heard", plan card, "Seal it" strip, 7-second window | Older step screens (Mirror, Plan, Seal) with warm-white pill buttons; the 7-second window exists | ✘ not rebuilt |
| Lock In, Quiet, Return, Replay | Older screens | ✘ not rebuilt |

## Moments

| Demo | App | |
|---|---|---|
| Mark + "Moments", photo; hero for the next or live Moment | Same, no photograph | ◐ photography |
| Status line; "Plan a Moment · say it" | Same | ✔ |
| Upcoming and Done rows with pills | Same | ✔ |
| Calendar and Protocols card | Same | ✔ |
| "uses 1 lesson" on a row | None | ✘ learning loop |
| Moment screen, Replay, Calendar, Protocols pages | Older screens | ✘ not rebuilt |

## Circles

| Demo | App | |
|---|---|---|
| Mark + "Circles", photo; "Your people. Your Moments." | Same, no photograph | ◐ photography |
| Status line; "Start a Moment" · "Invite someone" | Same; Start opens One Breath, Invite opens the form in place | ◐ the demo's picker and invite screens are not built |
| People rows; Pending rows | Same; tap a person to remove | ◐ no member screen |
| "Available" pill | None | ✘ no data |
| "Choose what your Circle can see" card | Same | ✔ |
| "Your Moments" card | None | ✘ gallery not built |

## You (Profile) — not rebuilt

| Demo | App |
|---|---|
| "Back" and "Profile"; an 84pt photo; the name at 34pt; "city · member since"; "Add a photo" | The older Profile: a long screen with chips, tabs and many cards |
| Three pills: Performance · Devices · Account | Different tabs |
| Performance: status line, "Your Moments" strip, "What AFORCE remembers", "How AFORCE works" | Not built |
| Devices: one row per source with On / Off / Check, "Manage devices and apps" | Device controls exist in a different layout |
| Account: Plan, Settings, Shop; Privacy; Download data; Delete account | Exist in a different layout; account deletion is switched off |

Profile holds working features that have no place in the demo's layout (sweat calculator, Coach Mode, developer controls, the Travel pilot switch, Gentle hydration). Rebuilding it means deciding where each of those goes, so it needs a plan from you before I remove anything.

## Sign in and opening

| Demo | App | |
|---|---|---|
| Opening promise screen with photograph, "Create account", "I have an account" | An older opening sequence | ✘ not rebuilt |
| Sign in: "Welcome back", Apple and Google pills, fields, "Forgot password?", Sign in | Same, without Apple and "Back" | ◐ Apple sign-in and the promise screen are not built |

## Decisions that block an exact match

1. **Photography.** May internal builds use the demo's AI sample photos? This is the largest visible gap on Home, Moments and Circles.
2. **The Home ring:** intake percentage (demo) or HydroState score (app)?
3. **"Log a drink":** rename now, or after the drink-choice sheet is built?
4. **Profile:** where do the features with no place in the demo go?
5. **"Use reservation details":** delete its code, or restore it?
