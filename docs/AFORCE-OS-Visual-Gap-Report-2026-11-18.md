# AFORCE OS: Visual Gap Report against the November 5 Design Specifications

**Date:** 2026-11-18 · **Code read at:** `main@e07f83f5` · **Author:** Engineering (Claude Code) for Brandon

**What this is.** A read-only comparison of the app's code with the Master Brief (Nov 5) and Screen
Upgrade v1.1, plus the implementation sequence. **No visual code was changed to produce it.**

**What it is not.** Nothing here was verified on a phone or in a screenshot. Every finding is from
reading code. A screen is not "done" until it has been looked at on a device.

**Approval recorded.** Brandon approved the visual direction on 2026-11-18, with these limits:
small reviewable pull requests; no indiscriminate search-and-replace; `statusColor.ts` protected
until every affected surface is listed and approval is explicitly recorded; orb gestures audited
separately; no change to HydroState, the backend, stored data or business logic.

Paths are under `artifacts/aforce-os/`.

---

## 1. Design sources

| Source | Where it is | State |
|---|---|---|
| Master Brief, Nov 5 | App Spec v1.8.2, Appendix F | Read in full |
| Screen Upgrade v1.1 | App Spec v1.8.2, Appendix G | Read in full |
| Circle Worlds v1.2 | App Spec v1.8.2, Appendix D | Present; not audited line by line here |
| Moment Link v0.2 | App Spec v1.8.2, Appendix E | Present; not built, out of scope for this pass |
| Social v0.4.1 | External prototype link; partial notes in `docs/social-v04/` | **Full spec not in the repo** |
| HydroScan v2 | External prototype link only | **Not in the repo** |
| App prototype ("every tab") | External link | **Not in the repo** |
| Manifesto video (90 s) | Supplied 2026-11-18 | Twelve frames sampled; marked "Prototype · Sample data" |
| World photos (`w/`, 116 files) | Named in the Master Brief | **Not in the repo** (the app has 25 asset files in total) |
| N–И vector asset | — | No asset file; a correct code component exists |

**Authority order used:** Master Brief → Circle v1.2 → Social v0.4.1 → Moment Link v0.2 → Screen Upgrade v1.1 → HydroScan v2 → prototypes.

---

## 2. Which screen each build shows

The same route renders different components depending on the build. This matters for every row below.

| Route | Store build | Internal TestFlight build |
|---|---|---|
| Home | `EditorialHomeScreen` | `EditorialHomeScreen focused` (stripped down, PR #1144) |
| Hydration | `HydrationScreenV2` | same |
| HydroScan | `HydrationScanScreenV2` | `EditorialScanScreen` |
| One Breath | `OneBreathScreen` | `MomentPreparationScreen` |
| Moments | tab redirects to Home; `/moments` shows `EditorialMomentsScreen` | `EditorialMomentsScreen` as the tab |
| Circles | `CircleScreenV4` | same |
| Profile | `ProfileScreenV2` | same |
| Performance Signal | `PerformanceSignalV3` | same |

---

## 3. System-level gaps

### 3.1 Colour tokens

| Required | Current | Status |
|---|---|---|
| Black `#090A0A`, panel `#121313`, hairline `#292A2A` | Present in `theme/colors.ts`, `afTokens.ts`, `editorialTokens.ts` | Match |
| Warm white `#F7F4EF`, muted `#AEAAA3`, dim `#8A867F` | Present in `af` tokens. `Colors.text.secondary / muted` are alpha-white, not `#AEAAA3` | Partial |
| Signal Red `#E51E2A`, small red `#FF5A63` | `af.red` resolves to `#E51E2A`; `af.redText` is `#FF5A63`. **Comments in `afTokens.ts` still say `#C1281B` and `#0D0D0D`** | Match (comments stale) |
| Proof Blue `#2765FF`, small blue `#A9BEFF` | `Colors.accent.secondary` is `#2765FF`. No `af` blue text token | Partial |
| One token system | **Four:** `af` (159 files), `Colors` (100), `ed*` editorial (23), `preparationTokens` (6, all One Breath) | Mismatch |
| No retired values | `theme/DESIGN-TOKENS.ts` still holds red `#C1281B`, blue `#2F5BFF`, ink `#0D0D0D`, bone `#F5F0E8`, and the **orange "sun" orb ramp** the Master Brief retired | Mismatch |
| Orb gradients (red and blue ramps) | Not present anywhere. The One Breath orb is a flat red fill | Mismatch |
| No green, teal, amber, yellow, orange, navy | Green, teal, amber, violet tokens exist and are used: about 320 references to `af.green / amber / cyan` in 67 files and 190 to `Colors.states.*` in 41 files | Mismatch |
| No hard-coded colours | 423 hex/rgba literals in 84 component files. A ratchet test caps the count per file but does not ban off-palette values | Partial |

### 3.2 Protected status colours

`theme/statusColor.ts` is off-limits. It defines the band colours (reds, orange, yellow, greens). **Nothing in it was changed or bypassed.**

Direct importers (the complete list):

- `components/CommandConfidenceBadge.tsx`
- `components/ScanAICoachCard.tsx`
- `components/home/homePresentation.ts`
- `hooks/useAnimatedStatusColor.ts`
- `services/hydrationStatus.ts`
- `utils/homeCommand.ts`
- `utils/scoringEngine.ts` (also off-limits)

Separately, about 104 screen and component files colour things from `Colors.states.*` or `af.green / amber / cyan`, which are ordinary theme tokens, not the protected file. Those can be migrated without touching `statusColor.ts`.

**Needs an explicit decision before any work:** the spec says scores and labels are never red and no green, teal, amber or yellow appears anywhere. Meeting that for score bands means either changing `statusColor.ts` or ignoring its output on member-facing surfaces. Both need recorded founder approval.

### 3.3 Typography

| Required | Current | Status |
|---|---|---|
| Inter everywhere | Inter 300–800 loaded and used | Match |
| IBM Plex Mono only for tiny eyebrows and times | Also used for tab labels (9pt, uppercase) | Mismatch |
| No other display face | **Archivo Black** still used in the opening sequence monogram, `WelcomeHero`, the reset-password title and the investor demo overlay | Mismatch |
| Sentence-case buttons | The button component is sentence case, but there are 53 `textTransform: 'uppercase'` styles and about 388 all-caps strings in `locales/en.json` ("LOG {oz} OUNCES WATER", "CONTINUE", "ADD A MOMENT", "WHY THIS COMMAND") | Mismatch |

### 3.4 Primary button

| Required | Current | Status |
|---|---|---|
| Warm white fill, black text | `AFPrimaryButton` is `af.red` with white text (`components/ui/AFButton.tsx`). 23 call sites | Mismatch |
| Secondary outlined | Surface `#121313` with a `#292A2A` border | Match |
| Red only for the mark, orb, Lock In, urgency | 74 red background fills in total, including CTAs in Drink choice, Sleep mode, Recovery Coach, Circle members, One Breath, Edit profile, the notification banner | Mismatch |

### 3.5 The N–И mark

| Required | Current | Status |
|---|---|---|
| One component: Inter 300, mirrored second N, bar 0.4em × 0.056em | `components/oneBreath/PreparationMark.tsx` matches the construction | Match |
| Used everywhere the mark appears | Used in three places only. **Typed as a plain string** in the tab bar (Inter 700, 8pt) and twice in `OneBreathScreen` (Inter 800). The opening sequence builds it from Archivo Black | Mismatch |
| Signal Red on black, warm white inside an orb | The component's default colour is the retired `#C1281B` | Mismatch |
| Renders mirrored on a phone | **Unverified.** The mirror is a transform on a `Text`; a comment in `OpeningSequence.tsx` says native ignores transforms on `Text` | Unverified |

### 3.6 Bottom bar

| Rule | Current | Status |
|---|---|---|
| Home · Hydration · ◉ · Moments · Circles | Same order | Match |
| Home: thin-line house | Lightning bolt | Mismatch |
| Circles: two people | Two people | Match |
| Labels Inter 11pt, sentence case | IBM Plex Mono 9pt, uppercase, tracked | Mismatch |
| Inactive `#AEAAA3` | `#AEAAA3` | Match |
| Active warm white, 2px red bar, never red icons | Active is `#FF5A63`, so icon and label turn red; a 2px bar exists | Mismatch |
| Orb 64pt, raised 12pt, always Signal Red, warm-white mark, no text label | 30pt, not raised, grey when not selected, labelled "One Breath", typed mark | Mismatch |
| Screen-reader label "One Breath" | Comes from the tab title; the orb itself is hidden from the reader | Partial |
| Thin blue ring during a Social Moment | None | Mismatch |
| Hidden on HydroScan camera, Seal, Quiet | Not hidden | Mismatch |
| Breathes 6 s on Home only; still with Reduce Motion | Static everywhere | Mismatch |
| Tap = type, hold = speak | Tap opens One Breath; no hold gesture in the bar | Mismatch (see §5) |
| Long-press Hydration opens HydroScan | Not built | Mismatch |
| Haptics: light tick on tab change, medium on orb | Tab haptics were **deliberately removed** by an earlier founder rule ("do not vibrate frequently") | **Conflict, founder decision** |
| Profile from the member photo, every tab header | Home only (added today, #1229) | Partial |

### 3.7 Glow and motion

- **Glow:** about twelve glows on things other than the orb: the Profile segmented pill, `ScanAICoachCard`, `HeatPulse`, `JournalChart`, the Competition screen, `StreakCard`, `SocialModeV2Screen` and others.
- **Reduce Motion:** a shared hook exists and 20 of 33 animated files respect it. Thirteen do not, including `OneBreathScreen`, `CycleSuccessOverlay`, `SocialModeSheet`, `VoiceCheckInOverlay`.

---

## 4. Screen-by-screen gaps

Status: ✔ match · ◐ partial · ✘ mismatch.

### Home

| Required | Current | |
|---|---|---|
| "Good evening, Brandon." | "Welcome, {name}"; no time-of-day greeting | ✘ |
| Member photo top right | Present (#1229) | ✔ |
| HydroState is the only hero: ring + number | Number, state word and a flat red bar. No ring | ◐ |
| Limited evidence: "Collecting", neutral ring, no number | "Collecting" and "Starting point: log your first water." are shown with no number, but no ring. **After one logged drink the number and band word (which can be "Depleted") appear** | ◐ |
| "Your next move" + warm-white "Start" | Uppercase red kicker; no Start button; a red "Log water" at the foot | ✘ |
| "Why this?" small text link | "WHY THIS COMMAND" in a red-bordered pill | ✘ |
| No big red plan button | Store: none. Internal: a red-railed card with a red "Start One Breath" button | ◐ |
| Upcoming Moment near the top | Store: below the signals. Internal: in the top block | ◐ |
| One quiet list of secondary links | Store: four separate blocks. Internal: a link list plus other blocks | ◐ |
| Skin intelligence and Concierge behind flags | Both gated; both visible in the internal build | ✔ |
| No red eyebrows | Red captions in four places | ✘ |

### Hydration

| Required | Current | |
|---|---|---|
| Ring with logged, target, percent, last updated | Ring, percent, "x of y oz". **No last-updated time** | ◐ |
| "Scan a drink" primary (warm white), "Log manually" secondary | Right order; primary is red | ◐ |
| Recent intake from real drinks | Real entries; labels uppercase | ✔ |
| Hide Electrolytes and Recovery when empty | Both always shown | ✘ |
| Week dots warm white / outline | Filled dots are red | ◐ |

### Log a drink and its result

| Required | Current | |
|---|---|---|
| Number Inter Light ~64pt | 56pt Inter Bold, in the accent colour | ✘ |
| oz and mL together | oz only | ✘ |
| Warm-white "Log 16 oz" | "LOG {oz} OUNCES WATER" on red; title "LOG WATER" | ✘ |
| Calm result, "+16 oz water · counted." | A state ribbon (can read DEPLETED), the score, "RECORDED", "CONTINUE" | ✘ |
| No "Deficit closing. Keep moving." | Still the line shown for the Depleted band (`utils/scoring/copy.ts:593`) | ✘ |
| Undo on the result | None | ✘ |

### HydroScan

| Required | Current | |
|---|---|---|
| Scan → Identify → Set amount → Review and log → Logged | Not this flow in either build. No "Set amount", "Review and log", "Type it" or "Recent drinks" | ✘ |
| Identify with confidence, evidence, corrections | No "Wrong drink / Different size / Someone else's drink" | ✘ |
| Nothing changes until confirm | Internal build has a review step before recording. Store build not verified | ◐ |
| Done and Undo | Undo present (uppercase); no Done | ◐ |

### One Breath

| Required | Current | |
|---|---|---|
| "What matters tonight?" · "Hold to speak. Release when done." · "Type instead." | Store: "What's coming?" and "TAP TO TYPE". Internal: "What would make tonight go well?" and "Tap to speak · or type" | ✘ |
| Old strings and the paste form removed | Internal build still has "Review my moment", "Use reservation details" and the paste form | ✘ |
| One-line Mirror, "Looks right" / "Adjust" | Store has both buttons on a multi-block screen. Internal not verified | ◐ |
| Primary warm white; blue only for Social | Store: red. Internal: old blue `#2F5BFF` | ✘ |

### Moments

| Required | Current | |
|---|---|---|
| Now / Upcoming / Done | Today / Tomorrow / Next, in red captions | ✘ |
| Row: time · name · Sealed / Locked in / Done | States read "DO THIS", "DO THIS NOW", "DONE" | ✘ |
| No red "+ Plan a moment" | None; but "ADD A MOMENT" uppercase and a red "Start One Breath" in the internal hero | ◐ |
| Protocols section at the bottom | Travel entry near the top; no Recovery or Sleep section | ✘ |
| World photography with a black gradient | No imagery on the screen; the photos are not in the repo | ✘ |

### Performance Signal

| Required | Current | |
|---|---|---|
| Trend line + one sentence | Bar chart; the sentence is present | ◐ |
| Muted day list, no red "Depleted" | Band word is muted but "Depleted" still shows; the rail and score take the band colour | ◐ |

### Circles

| Required | Current | |
|---|---|---|
| No leaderboard, ranks, streaks, scores | None on this screen | ✔ |
| Start a Moment, invite, shared Moments, people, pending, controls | Invite, people, pending and "Share a Moment" present. No "Start a Moment". Buttons and kickers are red | ◐ |

### Profile

| Required | Current | |
|---|---|---|
| Title is the member's name | "PROFILE" / "Commander" | ✘ |
| No streak, aura, rank badges | "{n}-DAY STREAK", an aura chip, tier and team chips | ✘ |
| "Member since" line | Not present | ✘ |
| Body details private, collapsed | Height and weight always visible | ✘ |
| SkinIA behind its flag | Gated; an entitled internal member sees "INTERNAL TESTING" | ✔ |
| Segmented control, warm-white selected | Selected pill is red with a glow; labels uppercase | ✘ |

### Concierge and internal text

| Required | Current | |
|---|---|---|
| Hidden until live | Hidden in store builds; shown in internal | ✔ / ◐ |
| No "not set up on this build" | "The concierge's AI service isn't set up on this build." still exists and shows in the internal build | ✘ |

### Not audited in this pass

The nine Social screens, Seal / Lock In / Quiet / Return / Replay visuals, onboarding, the store build's scan logging steps, and the internal One Breath mirror. Social and HydroScan need their source specs in the repo first.

---

## 5. Orb gesture audit (tap to type, hold to speak)

**Question:** can the bar orb take "tap = type, hold = speak" without weakening the Seal approval or recording by accident?

**What exists today**

- **Hold already means "approve".** The Seal view seals on a press-and-hold of the seal ring (`MomentPreparationScreen.tsx`, `startHold` / `cancelHold`, recorded as `sealedByHold`). The store One Breath screen also uses a 900 ms hold to move a draft forward.
- **Voice can also approve.** Inside an open confirmation window, the spoken or typed words "seal it" seal the plan (`utils/oneBreath/confirmationWindow.ts`).
- **Voice capture** is `hooks/useOneBreathVoice.native.ts`: on-device recognition only, a 30-second cap, and it is started by a tap on a Speak control inside the screen. It is iPhone-only and internal-only (decision C6).

**Risks if hold-to-speak is added to the orb**

| Risk | Why |
|---|---|
| A hold on the orb while the Seal view is open | The same physical gesture approves a plan a few centimetres away |
| Speech captured by the orb reaching an open confirmation window | "Seal it" said while holding the orb could be heard as approval |
| Recording by accident | A resting thumb on a 64pt raised button at the bottom of the screen |
| First hold triggers the microphone permission prompt | The member did not expect a system dialog from a tab bar |
| Android and store builds | Voice is not offered there (C6), so "hold" would do nothing or behave differently |

**Conditions under which it is safe** (all needed)

1. The orb is **hidden on Seal, Quiet and the HydroScan camera**, as the spec already requires. This must ship before any gesture.
2. Orb speech feeds **only the Capture step's draft text**. It can never reach the confirmation window, and release never seals. A test must prove a "seal it" transcript from the orb does nothing.
3. A hold threshold (about 350 ms) with a visible "Listening" state and a haptic, and capture cancels if the finger slides off.
4. The orb never starts the mic while another capture or a read-back is running (the existing self-echo rule).
5. Where voice is not available, hold behaves exactly like tap.
6. Microphone permission is asked on the One Breath screen first, never from the bar.

**Recommendation:** build the orb's look first (size, raise, colour, mark, hiding rules) with **tap only**. Add hold-to-speak as its own pull request after conditions 1–6 are implemented and tested, and after C6 is revisited. Long-press Hydration → HydroScan has none of these risks and can ship with the bar.

---

## 6. Decisions and conflicts to settle

| # | Item | Why it needs you |
|---|---|---|
| 1 | **`statusColor.ts`** | Scores "never red", "no green/teal/amber" cannot be met without changing the protected file or ignoring its output (§3.2) |
| 2 | **Project `CLAUDE.md` brand section** | It still names Signal Red `#C1281B`, Cinematic Black `#0D0D0D`, and Archivo Black as the display face. The Master Brief and the code use `#E51E2A`, `#090A0A` and Inter. The file needs updating so the two do not conflict |
| 3 | **Tab-change haptics** | Screen Upgrade asks for a light tick; an earlier founder rule removed it |
| 4 | **Fourth tab name** | The spec lists "Moments vs Protocol" as open. The app already says Moments. Confirm |
| 5 | **Leaderboard and achievements** | Screen Upgrade recommends retiring the leaderboard entirely; a 27 Aug ruling keeps both screens live |
| 6 | **Destructive buttons** | The spec gives red four meanings; "delete" is not one. Warm white, outlined, or red? |
| 7 | **When the number first appears on Home** | Today it appears after one logged drink and can read "Depleted". The spec says a new member never sees that. Changing the threshold is behaviour, not styling |
| 8 | **"Deficit closing. Keep moving."** | The line lives in `utils/scoring/copy.ts`. Not the off-limits engine, but scoring copy: confirm before editing |
| 9 | **Hold-to-speak and C6** | Voice is internal-only today (§5) |
| 10 | **Missing sources** | Social v0.4.1, HydroScan v2, the prototype, the 116 World photos |
| 11 | **Ritual spelling** | The manifesto video uses "LOCK-IN"; the directives use "Lock In" |

---

## 7. Implementation sequence

Each line is one small pull request with tests, an accessibility check and before/after screenshots.
**Screenshots:** I can produce them from the web preview where a screen renders there; device
screenshots come from the founder's phone. Nothing is called done from tests alone.

| # | Pull request | Depends on | Risk |
|---|---|---|---|
| V1 | **Tokens.** Correct stale comments; add the missing semantic tokens (blue text, orb ramps); move the six One Breath files off `DESIGN-TOKENS.ts`; delete the retired values and the orange orb | — | Low. One Breath Seal screens change colour: needs a look on a phone |
| V2 | **The mark.** Promote `PreparationMark` to one shared component with Signal Red as the default; replace the three typed strings; verify the mirror on a device | V1 | Low |
| V3 | **Primary button.** Warm white with black text. Each of the 23 call sites and 74 red fills reviewed one by one; red kept for Lock In and real urgency | V1, decision 6 | Medium: touches every screen |
| V4 | **Bottom bar look.** House icon, Inter 11pt sentence case, warm-white active state with the 2px bar, 64pt raised red orb with the mark, hidden on Seal / Quiet / scan camera, breathing on Home only with Reduce Motion, long-press Hydration | V2 | Medium: layout and safe areas on small phones |
| V5 | **Eyebrows and glows.** Masthead breadcrumb and captions to muted; remove non-orb glows | V1 | Low |
| V6 | **Profile entry on every tab header** | — | Low |
| V7 | **Home.** Time-of-day greeting, ring hero, "Start", "Why this?" link, one quiet list | V3, V5 | Medium |
| V8 | **Hydration, log sheet, log result.** Last-updated time, hide empty rows, dots, 64pt light number, oz + mL, calm result with Undo | V3, decision 8 | Medium: Undo depends on the edit/delete work (RA-N7) |
| V9 | **Profile.** Name as title, remove streak and aura chips, "Member since", private body details, warm-white segmented control | V3 | Low |
| V10 | **Moments.** Now / Upcoming / Done, row states, protocols section | V3 | Medium. World photography waits on the assets |
| V11 | **One Breath copy.** Approved short prompt; remove the reservation paste form; primary not blue | V1, V3 | Medium: the paste form is a working entry path in the internal build |
| V12 | **Performance Signal.** Trend line, muted list | decision 1 | Low |
| V13 | **Uppercase and motion sweep.** Remaining all-caps strings, the 13 ungated animations, Archivo Black removal | — | Low, wide |
| V14 | **Status colours** | decision 1 recorded | High |
| V15 | **Orb hold-to-speak** | V4, §5 conditions, decision 9 | High |
| V16 | **HydroScan five-step flow** | HydroScan v2 source in the repo | High: a flow change, not styling |
| V17 | **Circles remaining items and the nine Social screens** | Social v0.4.1 source in the repo | High |

**Recommended start:** V1 and V2 together are the foundation and change the least behaviour. V3
and V4 are what will make the app visibly read as the new style.
