# Black Issue restyle — audit and plan (Phase 1)

Status: **approved by the founder (Brandon) on 2026-10-06; Phase 2 in progress.** PR 1 (tokens,
primitives, tab bar, AFMasthead) merged as #1087 on 2026-10-06. The 27 reference screenshots live in
`docs/pr-evidence/black-issue/figma/` with the on-screen copy transcript
(`docs/pr-evidence/black-issue/figma-on-screen-copy.md`); per-PR evidence lives beside them.

### Decision record (founder, 2026-10-06)

| # | Ruling | Applied in |
|---|---|---|
| D1 | **Keep** Signal Red `#C1281B` for fills; red text/icons stay `af.redText` `#E4564A` (AA). The brief's `#E13B2A` is rejected for text (4.26:1 on cards) and pinned as rejected by `theme/__tests__/afTokens.test.ts`. | PR 1 |
| D2 | **Yes** — app display type is Inter 700 (`afType.displayScore/displayHero/title1–3`). Archivo Black stays loaded for the brand mark only (`Typography.roles.display` is unchanged; its two consumers are the monogram and wordmark). The brand table in `CLAUDE.md` ("Archivo Black — display") now describes the mark, not app type; amending that line is the founder's call. | PR 1 |
| D3 | **Yes** — status colours stay system-sourced; ivory-vs-amber mismatches are reported per screen, never overridden. | all |
| D4 | **Yes** — the live Home moves to the Black Issue card layout; the pressure-field signature is retired from Home. | PR 2 |
| D5 | **Yes** — `AFMasthead` is a new shared component (standalone; shares tokens with AFTopBar/AFSectionLabel rather than composing them). | PR 1 |
| D6 | **Yes** — gutter 32 pt standard / 24 pt at ≤375 pt wide (`afGutterAt` / `useAFGutter`). | PR 1 (+ PR 2 hook) |
| D7 | **Yes** — gated screens are captured with a local, uncommitted flag flip. Native captures depend on disk headroom (a Debug build needs ~6 GB; PR 1 shipped web renders). | PRs 2–7 |

Post-merge review of PR 1 (2026-10-06) raised one accessibility regression (selected tab told apart by
hue alone) and four should-fix items; all are addressed in PR 2's first commit and recorded in §7.

Source of truth: Figma file `VlcxuqlYiEEOeNKZuwi0WL` ("Black Issue Social Brief"), pulled through the
Figma MCP server on 2026-10-06. Every "phone screenshot" node is a flattened 390×844 PNG (iPhone
14/15 logical size); the 429×928 frame is the mount, not the image. There are no UI layers,
variables, or components to extract, so the design system below is derived from the pixels plus one
corroborating source found during the audit (§2.1).

---

## 1. Screen mapping

Legend — **Match**: an app screen renders this surface and can be restyled in place.
**Partial**: a screen exists but the screenshot shows elements the app does not have (restyle what
exists; the missing elements go to the gap report). **Gap**: no app screen renders this; nothing is
built. "Gate" is the flag and its `DEFAULT_FLAGS` value; gated screens are restyled in place and stay
exactly as gated.

| # | Figma frame / shot | Route | Live component (production branch) | Gate (default) | Status |
|---|---|---|---|---|---|
| 01 | Home / Recovering · `1:2` / `1:6` | `app/(tabs)/index.tsx` | `components/editorial/home/EditorialHomeScreen.tsx` (flag-off branch: `components/home/HomeScreenV2.tsx`) | `editorial_home_enabled` (true) | Match — see D4 |
| 02 | Moments Calendar · `8:2` / `8:6` | `app/moments.tsx` | `components/editorial/moments/EditorialMomentsScreen.tsx` (flag-off: `components/moments/MomentsScreen.tsx`) | `editorial_moments_enabled` (true); device-calendar import stays behind `moments_calendar_enabled` (false, legal-gated) | Match |
| 03 | Protocol · Depletion Correction · `8:49` / `8:53` | `app/(tabs)/protocol.tsx` | `components/protocol/ProtocolScreenV2.tsx` (+ V3 sections); `EditorialProtocolScreen` only on internal TestFlight | `spec_protocol` (true), `protocol_v3_dashboard_enabled` (true), `editorial_protocol_enabled` (false) | Match |
| 04 | Circle · `8:25` / `8:29` | `app/(tabs)/competition.tsx` | `components/community/CircleScreenV3.tsx` | `circle_v3_dashboard_enabled` (true) | Match |
| 05 | Hydration · `8:73` / `8:77` | `app/(tabs)/journal.tsx` | `components/hydration/HydrationScreenV2.tsx` | `spec_hydration` (true) | Match |
| 06 | Environmental · `9:25` / `9:29` | `app/environment.tsx` | `screens/EnvironmentalScreen.tsx` | `environmental_surface_enabled` (false; on in internal TestFlight overlay) | Match (gated) |
| 07 | Cruise Mode · `9:2` / `9:6` | `app/cruise.tsx` | `components/cruise/CruiseModeView.tsx` via `screens/CruiseModeScreen.tsx`; `EditorialCruiseLandingScreen` on internal TestFlight | `cruise_mode_enabled` (true) | Match |
| 08 | Guardian · `9:96` / `9:100` | `app/guardian.tsx` | `LegacyGuardianScreen` (inline in the route) | `guardian_intelligence_enabled` (false) | Match (gated) |
| 09 | Clutch · `9:49` / `9:53` | `app/clutch.tsx` | `LegacyClutchScreen` (inline in the route) | `clutch_access_enabled` (false) | Match (gated) |
| 10 | Weekly Report · Week in Review · `4:49` / `4:53` | `app/weekly-report.tsx` | `components/editorial/weekly/EditorialWeeklyScreen.tsx` | `editorial_weekly_enabled` (true) | Match |
| 11 | Sleep · `4:2` / `4:6` | `app/(tabs)/sleep.tsx` (hidden tab) | `components/sleep/SleepModeView.tsx` | none (`sleep_mode_enabled` only toggles a preview banner) | Match |
| 12 | Scan (Skin intelligence · live scan) · `4:25` / `4:29` | `app/skinia.tsx` | `components/advancedVisual/SkinIACameraCaptureScreen.tsx` (DR-017 presentation exception) | `advanced_visual_intelligence_enabled` (false; internal TestFlight + cohort) | Match (gated) |
| 13 | AI Concierge · `4:97` / `4:101` | `app/concierge.tsx` | `components/concierge/ConciergeScreen.tsx` | `ai_concierge_enabled` (false; internal TestFlight overlay) | Match (gated) |
| 14 | AI Concierge · Briefing · `4:121` / `4:125` | `app/concierge.tsx` (opening state) | `components/concierge/ConciergeOpening.tsx` | `ai_concierge_enabled` (false) | Partial — no spoken-briefing player, no "One Voice" |
| 15 | Travel · In-flight protocol · `4:73` / `4:77` | — | — (closest: Moments `travel` type; `SmartModesBanner`) | — | **Gap** |
| 16 | Ritual · `7:2` / `7:6` | — | — (closest: Moment detail four-stage ritual `app/moment/[id].tsx`) | — | **Gap** |
| 17 | Pickleball · Match day · `7:98` / `7:102` | — | — | — | **Gap** |
| 18 | Performance Signal · Command history · `7:26` / `7:30` | `app/performance-signal.tsx` | `components/hydration/PerformanceSignalV3.tsx` | `signal_v3_dashboard_enabled` (true) | Match |
| 19 | Golf · Round day · `7:50` / `7:54` | — | — | — | **Gap** |
| 20 | Tennis · Match day · `7:122` / `7:126` | — | — (tennis exists only as a sweat-sport option and a `ring/session` sport type, `ring_enabled` false) | — | **Gap** |
| 21 | Basketball · Pickup · `7:74` / `7:78` | — | — (same as 20) | — | **Gap** |
| A | Social Mode · `9:72` / `9:76` | `app/(tabs)/social.tsx`, `app/night-out.tsx` | `screens/SocialModeV2Screen.tsx`, `NightOutCommandScreen` | `night_out_enabled` (false) + internal-preview cohort | Match (gated) |
| B | Sweat Calculator · `9:119` / `9:123` | `app/sweat-calculator.tsx`, `app/sweat.tsx` | `components/sweat/SweatCalculatorScreenV2.tsx` | none | Match |
| C | HydroScan · `50:26` / `50:30` | `app/scan.tsx`, `app/(tabs)/scan.tsx` | `components/scan/HydrationScanScreenV2.tsx` (HydroScan 2.0 parts behind `hydro_scan_2_enabled` false) | `editorial_scan_enabled` (false) selects the editorial branch | Match |
| D | Devices · `50:2` / `50:6` | `app/(tabs)/profile.tsx` → Devices pane | `components/profile/panes/DevicesPane.tsx` inside `ProfileScreenV2.tsx` (tabs Performance / Devices / Account already exist); `components/health/ConnectedHealthView.tsx` | per-provider `health_*_enabled` | Match |
| E | Phantom Band · `50:80` / `50:84` | `app/phantom.tsx` | `screens/PhantomBandScreen.tsx` | `phantom_wearable_enabled` (false) | Match (gated) |
| F | One Breath · `50:50` / `50:54` | `app/one-breath.tsx` | `components/oneBreath/OneBreathScreen.tsx` | none | Partial — text-first containment screen; no microphone, no listening state (§5) |

**Figma 12 vs. Figma C.** The brief's "Scan" (12) is the Skin Intelligence live scan ("Hold still. Let
the signal settle."), not the drink scanner. The drink scanner is frame C "HydroScan". They map to
different routes and both are listed above.

### 1.1 App screens with no screenshot

These get the new tokens and shared components so the app stays consistent; none gets a new layout.

- Profile (`ProfileScreenV2` — Account and Performance panes; Devices is frame D), Developer pane
- Auth: sign-in, sign-up, reset-password (`components/auth/*V2`)
- Onboarding (`OnboardingScreenV2`), `OpeningSequence`, `WelcomeHero`
- Subscription, Manage subscription, Store, Cart, `RecoveryModePaywall` (plan tiers outside
  `LAUNCHED_PLAN_IDS` stay exactly as gated)
- Moment detail (`/moment/[id]`), Prepare my day (`/moments-plan`), Calendar settings
- Notifications, Achievements, Science, Share, Urine check, Heat / Heat Guardian
- Leaderboard, Sensors, Health connected, Cruise sub-screens (`(hidden)/cruise/*`), Cruise console,
  Guardian console, Clutch console
- Recovery coach, Ring, Territory, Trainer board / athlete, Skinia results, Modules (internal index)
- Legal (privacy, terms, health disclaimer), `+not-found`
- Dev-only surfaces (`ui-gallery`, `(hidden)/gallery`, `editorial-sheet`, `motion-demo`) are left alone
  except where they host the primitives being restyled

---

## 2. Derived design system

### 2.1 Where the screenshots come from

The 27 PNGs are the same assets the marketing site ships as
`aforce-site/assets/aforce-os/black-issue-*.png`. The site's own CSS for the matching callouts
(`aforce-site/aforce-os/index.html` lines 168–174) states the language in words: *"drawn in the OS's
own language: card #141414, hairline, mono label, red signal"*, with ink `#EDEAE3`, quiet label
`#A19C91`, hairline `#2D2A25`, signal `#E13B2A`. Pixel sampling across the 27 shots agrees with that
to within rounding. No HTML/CSS source for the full screens exists in the repo, so the numbers below
are sampled, then snapped to the existing token where one already matches.

The palette is also, almost value for value, the app's existing **Editorial OS** token layer
(`theme/editorialTokens.ts`: ivory `#EDEAE3`, rule `#2B2925`, quiet `#8D897F`, Inter 700 statements,
IBM Plex Mono caps furniture). The Black Issue is the Editorial OS language applied to card-based
screens. That is the main reason this restyle is tractable.

### 2.2 Palette (sampled)

| Role | Sampled | Notes |
|---|---|---|
| Canvas | `#0D0D0D` | Brand Cinematic Black; already `af.canvas` |
| Card surface | `#141414` | neutral, not the current navy `#141420` |
| Raised / pressed surface, dim bars | `#1C1C1C` – `#242424` | |
| Hairline / card border | `#2D2A25` | warm; solid, not alpha white |
| Ink (primary text, big numerals, bone bars) | `#EDEAE3` | = `edInk.ivory` |
| Quiet text (labels, meta) | `#A19C91` | |
| Muted mono furniture | `#7D7B78` / `#6B665C` / `#5A5852` | the last two fail AA for text (3.4:1 and 2.7:1) — decorative only |
| Signal red (wordmark, eyebrows, active tab, CTA fill, live nodes) | `#E13B2A` (fills render `#DF3B2A`) | **not** the frozen brand `#C1281B` — see D1 |
| Red-tinted alert card | bg `#231716`–`#2D1917`, border `#7A271F`–`#872A20` | depleted / critical rows (Guardian, Clutch, Signal "Saturday") |
| Positive | none used on-screen | PEAK green only appears as a system status color |

### 2.3 Typography (sampled)

- **Display / statements**: Inter Bold, sentence case, tight tracking ("Recovering.", "Three days.",
  "Command the team."). ≈34 pt on 390 wide. **Archivo Black appears nowhere** in the 27 shots.
- **Hero numerals** (69, 72, 82, 5): Inter Bold, ≈96 pt, tracking ≈ −4 %.
- **Metric values** (63%, 7H 24M, 58 MS, 24 OZ): Inter SemiBold/Bold ≈20 pt, caps where the source copy
  is caps.
- **Eyebrows / breadcrumbs** ("HOME / HYDROSTATE", "YOUR NEXT MOVE"): IBM Plex Mono ≈10–11 pt, tracked
  ≈ +1.6, red for section eyebrows, quiet grey for meta.
- **Micro furniture** (tab labels, "0–100 · RECOVERING BAND", pill text): IBM Plex Mono ≈9 pt, tracked.
- **Body**: Inter Regular ≈15–16 pt, quiet grey for explanations.
- **Wordmark**: "AFORCE" Inter Bold ≈15 pt, red, top-left of every screen.

### 2.4 Layout, shape, components (sampled)

- Screen gutter **32 pt** at 390 wide (current `afLayout.screenPaddingX` is 24).
- Cards: fill `#141414`, 1 px `#2D2A25` border, radius **≈12**, padding ≈16–20.
- Primary CTA: full-width red fill, radius ≈10, height ≈48–52, label Inter SemiBold 17 left-aligned
  with a "+" glyph flush right. Secondary button: `#141414` fill, hairline border, same shape.
- Pills / chips: 1 px outline, radius 999, mono micro caps; red outline for red states, grey otherwise;
  filled red for the active segment.
- Section headers: red mono eyebrow with a hairline underneath and a right-aligned mono meta.
- List rows: hairline-separated rows, Inter Medium title left, mono meta right (times in red when "next").
- Timelines / step rails: filled dot (done), red ring (active), hollow (upcoming), hairline connector.
- Charts: bone `#EDEAE3` bars, dim `#242424` bars for empty slots, red bar for depleted days.
- Masthead on every screen: "AFORCE" red wordmark left, mono meta right (city · temp · time), then a
  mono breadcrumb eyebrow ("CRUISE MODE / SEA DAY"), then the statement, then a quiet one-line body.
  Detail screens prefix the breadcrumb with a circular "‹" back button.
- Tab bar: solid `#0D0D0D`, 1 px hairline top, five items **Home · Hydration · Protocol · Circle ·
  Profile** (identical set and order to the app's `app/(tabs)/_layout.tsx`), outlined circular
  icons, mono micro caps labels, red active icon + label, grey inactive.
- Icons: thin outlined, single weight. The app's SF Symbols (`bolt.circle`, `drop.circle`,
  `list.bullet.circle`, `trophy`, `person.circle`) are the closest existing set; no icon pack change.

### 2.5 Compared to the existing theme

| Token (file) | Today | Screenshot | Proposal |
|---|---|---|---|
| `af.canvas` | `#0D0D0D` | `#0D0D0D` | keep |
| `af.canvasElevated` | `#101018` | `#0D0D0D`/`#141414` | `#101010` (drop the blue cast) |
| `af.surface` | `#141420` | `#141414` | `#141414` |
| `af.surfaceRaised` | `#1A1B22` | `#1C1C1C` | `#1C1C1C` |
| `af.surfacePressed` | `#212230` | `#242424` | `#242424` |
| `af.textPrimary` | `#F4F2ED` | `#EDEAE3` | `#EDEAE3` (= `edInk.ivory`; 16.2:1 on canvas) |
| `af.textSecondary` | `#A6A5A1` | `#A19C91` | `#A19C91` (7.1:1 canvas, 6.7:1 card) |
| `af.textTertiary` | `#85868C` | `#7D7B78`–`#6B665C` | `#8D897F` (= `edInk.quietOnBlack`, 5.6:1). The sampled darker greys fail AA and are not adopted for text |
| `af.textDisabled` | `rgba(244,242,237,0.34)` | `#5A5852` | `#5A5852` (decorative/disabled only) |
| `af.divider` / `af.border` | `rgba(255,255,255,0.10/0.16)` | `#2D2A25` | `#2B2925` solid for both (= `edRule.onBlack`, 2 units off the sample, invisible; pins equality with the editorial layer); `af.borderStrong` → `#3A3732` |
| `af.red` (fills) | `#C1281B` | `#E13B2A` | **keep `#C1281B`** — D1 |
| `af.redText` (red text/icons on dark) | `#E4564A` | `#E13B2A` | keep `#E4564A` — D1 (the sampled red is 4.26:1 on cards, below AA for 11 pt eyebrows) |
| `af.redDim` / `af.redHairline` | alpha red | `#231716` / `#872A20` | add `af.surfaceAlert '#231716'` and `af.borderAlert '#7A271F'` (solid, matched to the shots) |
| `afType.displayHero` | Archivo Black 44/48 | Inter Bold | Inter 700 44/48 −0.9 (= `edType.display`) — D2 |
| `afType.displayScore` | IBM Plex Mono 600 76/80 | Inter Bold ≈96 | Inter 700 84/84 −3.4 (tabular lining figures via `fontVariant`) — D2 |
| `afType.title1` | Inter 600 32/38 | Inter 700 ≈34 | Inter 700 34/38 −0.7 |
| `afType.title2` / `title3` | Inter 600 26 / 21 | Inter 700 | weight 700, tracking −0.5 / −0.35 |
| `afType.eyebrow` | IBM Plex Mono 500 11/14 +1.6 | same | keep; add `afType.micro` IBM Plex Mono 400 9/13 +1.8 (= `edType.micro`) |
| `afLayout.screenPaddingX` / `Compact` | 24 / 20 | 32 | 32 / 24 (compact on ≤375 wide) |
| `afLayout.radiusCard` / `radiusHero` / `radiusButton` | 18 / 24 / 16 | 12 / 14 / 10 | 12 / 14 / 10 |
| `afLayout.buttonHeight` | 56 | ≈48–52 | 52 (keeps the 44 pt floor with margin) |
| `Colors.tabBar` | blur + `rgba(0,0,0,0.95)`, active `#C1281B`, inactive white 30 % | solid `#0D0D0D`, hairline, red active, grey inactive | background `af.canvas`, top line `af.divider`, active `af.redText`, inactive `af.textTertiary`, labels mono micro caps |
| `Typography.fonts.display` | Archivo Black | — | leave the font loaded (brand mark / site); stop using it in app type roles — D2 |

Not changed: `Colors.states.*`, `statusColor.ts`, `scoringEngine.ts`, `hydroStateModel.ts`, any flag
default, any route, any API call.

Why `af.*` and not `editorialTokens.ts`: `components/__tests__/editorialFoundation.test.ts` forbids
every production file outside a short allow-list from importing the editorial layer. The AF*
primitives and most screens already consume `af.*`, so updating `af.*` values restyles the whole app
(including the screens with no screenshot) without touching that lock. Where an `af.*` value now
equals an `ed*` value, a new test pins the two equal so they cannot drift.

---

## 3. Shared components to update (PR 1)

Existing, in `components/ui/` unless noted:

- `AFScreen` — canvas, gutter 32/24, drop gradient canvas (`GradientBackground` flattened to solid canvas).
- `AFCard` — `#141414` fill, `#2B2925` 1 px border, radius 12; new `alert` variant (red-tinted depleted/critical card); `warning` keeps its amber caution edge.
- `AFPrimaryButton` / `AFSecondaryButton` / `AFTextButton` — shape, height 52, left-aligned label with
  optional trailing glyph (the "+" in every CTA).
- `AFSectionLabel` — red mono eyebrow + hairline underline + right meta (the section-header pattern).
- `AFTopBar` — becomes the masthead treatment (red wordmark, right mono meta, optional circular back).
- `AFStatusBadge` — outlined mono micro pill (grey / red / filled-red tones).
- `AFSegmentedControl` — pill rail, filled-red active, hairline inactive.
- `AFListRow` — hairline rows, mono trailing meta.
- `AFMetric` / `AFStatPair` — mono label over Inter value.
- `AFTimeline` — node rail (filled / red ring / hollow) with hairline connector.
- `AFChart` — bone bars, dim empties; status colors stay system-sourced (D3).
- `AFProgressRing` / `AFReadinessArc` — hairline track + red progress.
- `AFCommandCard` — "YOUR NEXT MOVE" eyebrow, Inter Bold command, quiet reason, "Lock in." + "WHY THIS?" pill.
- `AFDisclosureSheet`, `AFModal`, `AFEmptyState`, `AFErrorState`, `AFSkeleton` — tokens only.
- `components/Icon.tsx` — no new icons; tab icons keep SF Symbols / Lucide, tinted by the new tokens.
- `app/(tabs)/_layout.tsx` (`ClassicTabLayout`) — solid canvas, hairline, mono caps labels, red active.
  `NativeTabLayout` stays off (`native_tabs_enabled` false) and untouched.
- Per-feature kits that roll their own styles: `components/profile/profileKit.tsx`,
  `components/sweat/sweatKit.tsx`, `components/scan/scanKit.tsx`, `components/cruise/CruiseShared.tsx`
  — re-pointed to the tokens in the PR that restyles their screen.

Proposed **new** shared component (needs your OK, per the working agreement on new shared files):

- `AFMasthead` — the one pattern on all 27 screens: wordmark + right meta, breadcrumb eyebrow,
  statement, one-line body. A standalone component on the same tokens as `AFTopBar` / `AFSectionLabel`
  (built in PR 1).

No new fonts. No icon pack change. No Tailwind.

---

## 4. Per-screen change list (presentation only)

Each entry: what changes visually; what is explicitly **not** changed. Values stay bound to today's
data sources; nothing from the screenshots is hardcoded.

1. **Home** — masthead (AFORCE · city/temp · date/time from existing weather + clock sources);
   "HOME / HYDROSTATE" eyebrow; state word as statement; hero numeral + "READINESS · 0–100 · band"
   mono meta with a red progress hairline; command card ("YOUR NEXT MOVE" / command / "Lock in." /
   WHY THIS? pill); four-metric row (Water % · Recovery · Sleep · HRV — Water is red); "TODAY'S SIGNALS"
   card; "NEXT MOMENTS" section with hairline rows; full-width "Log N oz" CTA. Not changed: engine
   output, moment source, the sheet behind WHY THIS?, the status color of the state word (D3), and
   the copy law tests in `editorialHomeLaw.test.ts` (restyle must keep passing them — D4).
2. **Moments Calendar** — "MOMENTS / 3-DAY VIEW" eyebrow, "Three days." statement, day groups as red
   mono section headers with right meta (date · city), time column in mono, hydrate/prep/cabin tags
   as mono meta, footer summary line. Not changed: moment data, the `moments_calendar_enabled` gate.
3. **Protocol** — "Today" + "Last known data" quiet line, stage name as statement, hero numeral "5 HRS"
   with "NEXT RECHECK" / "SIGNALS REFRESH" meta, "PROTOCOL STEPS 1/4" rail with the four node states,
   two-up hydration / recovery-signals footer. Not changed: step derivation, counts, recheck time.
4. **Circle** — masthead, "CIRCLE / COMMUNITY" eyebrow, "Circle." statement, You card (avatar initials,
   city · state word, four rank stats, Score red), filter pills (Rank filled red), weekly-challenge
   card with hairline progress, standings rows with rank / avatar / name / streak / score / delta,
   pinned red-outlined You row. In-screen title stays "Circle." only if that is the current string;
   the tab label stays "Circle" (RC-L1). Not changed: cohort source, PRIVATE toggle wiring, the
   status color of "Depleted" (D3).
5. **Hydration** — "HYDRATION / TODAY" eyebrow, "Hydration." statement, intake card with ring %,
   "WATER LOGGED" / "ELECTROLYTES" / "RECOVERY" stack, red "Scan a drink" + secondary "Log manually",
   "RECENT INTAKE" rows, "THIS WEEK" seven-dot strip, "Performance signal" row. Not changed: intake
   store, scan/log actions.
6. **Environmental** — masthead with city · temp, "ENVIRONMENTAL / INSECT ACTIVITY" eyebrow, statement
   + body, red-outlined activity card (HIGH, index, radius, standing water), four-metric row, "PEAK
   WINDOW" hour bars (red peak), next-move block, five-metric footer row, "Plan around the peak" CTA.
   Not changed: data providers, the `environmental_*` gates.
7. **Cruise Mode** — back button + "CRUISE MODE / SEA DAY" breadcrumb, statement + body, "GUEST
   READINESS" hero numeral with red progress hairline and "Steady · High confidence", next-move block,
   conditions line, "Log water" CTA. Not changed: readiness source, cruise sub-flags.
8. **Guardian** — breadcrumb "GUARDIAN / PHASE · team", statement, red-outlined risk card (numeral,
   CRITICAL, composite line), locked body-map line, "ROSTER MONITORING · STARTING FIVE" rows (left
   accent bar, name · position, hydration meta, action line, chips, status pill), "View full roster"
   CTA. Not changed: roster data, Guardian flags, the Guardian purple token (still available for
   tier UI elsewhere).
9. **Clutch** — breadcrumb, "Command the team." statement, "LIVE COMMAND GRID · n of m", two-column
   player cards (position mono, name, numeral, state word, action line, chips), red-outlined cards
   for depleted/recovery. Not changed: command generation, Clutch flags.
10. **Weekly Report** — "‹ date" + "WEEKLY REPORT · range" eyebrow, "Week in Review." statement,
    three-numeral row, three key/value rows, "PERFORMANCE AGE™" block (numeral → numeral, four-week
    bars) — rendered only where `performance_age_enabled` already renders it, "WEEKLY TIMELINE" card
    with day bars and dots, "WHAT AFORCE NOTICED" block, CTA. Not changed: rollups, Performance Age
    gate and its disclosure.
11. **Sleep** — "SLEEP / RECOVERY" eyebrow, statement + body, "SLEEP READINESS" numeral + state word,
    red progress hairline, Duration / Quality / Wake metric row, "TONIGHT" card, "Plan tonight" CTA.
    Not changed: sleep data source (incl. the honest-absence rendering).
12. **Skin Intelligence live scan** — "SKIN INTELLIGENCE / LIVE SCAN" eyebrow, statement + body,
    viewfinder card (corner brackets, LIVE SCAN / QUALITY pills, frame/align/light/dist mono corners,
    guide ellipse), Light / Angle / Motion metric row, "SIGNAL STABLE · CAPTURE READY" line, "Capture
    scan" CTA. Only the five DR-017 files may import editorial tokens; everything else uses `af.*`.
    Not changed: capture pipeline, cohort gate.
13. **AI Concierge** — "AI CONCIERGE / ASK AFORCE" eyebrow, statement, context pill row, user bubble
    (right, `#141414`), AForce reply card (red avatar, mono context line, bold headline, timed steps,
    SOURCES line, ADD TO MOMENTS / OPEN PROTOCOL pills), "ASK NEXT" chips, "RECENT" rows, input bar
    with mic + red send. Not changed: §64 behavior, grounding rules, tool actions.
14. **Concierge opening (Briefing)** — "AI CONCIERGE / MORNING BRIEFING" eyebrow, greeting statement,
    briefing card (avatar, mono meta, bold summary, bullet rows with red eyebrows, "YOUR NEXT MOVE"),
    "ASK A FOLLOW-UP" chips, "SOURCES" rows, input bar. The spoken-briefing player is **not** built
    (gap). Not changed: opening logic.
18. **Performance Signal** — "HYDRATION / COMMAND HISTORY" eyebrow, "Performance signal." statement,
    summary card (numeral, "7-DAY AVG", delta, seven bars), day rows (left accent, name · date, mono
    meta, status pill, numeral), red-outlined depleted row, "WEEKLY AVERAGES" footer. Bars and pills
    keep system status colors (D3).
- **A Social Mode** — "SOCIAL MODE / NIGHT OUT" eyebrow, statement + body, "TONIGHT" block, next-move
  block, "PACE" progress line, "Tomorrow's recovery protocol is set" row, "Log 12 oz water" CTA +
  "Log a drink" text button. Not changed: session rules (18 h expiry), consent, gates.
- **B Sweat Calculator** — back + "SWEAT INTELLIGENCE / CALCULATOR" breadcrumb, statement + body,
  result card (numeral + unit, three sub-metrics, mono method line), Quick/Precision/Estimate segmented
  control, "INPUTS" card with hairline rows and unit suffixes, formula strip, "Recalculate" CTA. Not
  changed: the calculation.
- **C HydroScan** — "‹ date" + "AFORCE · THE TOOL / HYDROSCAN" eyebrows, "Scan." statement + "BARCODE
  READER" meta, viewfinder card with brackets and red scan line, "DETECTED" card, explanatory body,
  "ADD A DRINK MANUALLY" / "HYDRATION CHECK" rows, "Log this drink" CTA. Not changed: scanner, catalog.
- **D Devices** — "PROFILE / DEVICES" eyebrow, "Devices." statement + "n ready · n soon" meta (from
  existing provider availability), Performance / Devices / Account pills (filled red active),
  "CONNECTED DATA" card with provider rows (icon tile, name, mono signals line, outlined status pill),
  footer line, "Manage permissions" CTA. Provider names, statuses, and the pill labels come from the
  existing provider registry — the screenshot's "Approval pending" for Garmin is sample data.
- **E Phantom Band** — "DEVICES / PHANTOM BAND" eyebrow, statement + body, product card (PAIRED pill,
  battery meta, image, caption), "LIVE SIGNALS" four-metric row, four key/value hairline rows, "Sync
  band" CTA. The product render is the app's existing asset. Not changed: `phantom_wearable_enabled`.
- **F One Breath** — "YOUR NEXT MOMENT" eyebrow, statement + body, draft area and review state restyled
  in the same language; the listening/waveform state is **not** built (§5).

---

## 5. Gap report

Needs a product or design decision; nothing in this list is built by the restyle.

1. **Six screens with no app surface**: 15 Travel · In-flight protocol, 16 Ritual, 17 Pickleball,
   19 Golf, 20 Tennis, 21 Basketball. These are new features (flight tracking, a daily ritual
   schedule, live scorekeeping per sport). Not built. The four sport screens share one layout
   (venue · score card · intake/last sip/heat index · next move · event rail · Log CTA), so if they
   are ever approved they are one component with four data adapters.
2. **14 Concierge Briefing**: spoken-briefing player ("One Voice · 0:42 · Calm under pressure") has no
   TTS/audio pipeline in the app. Not built. The text briefing restyle lands on `ConciergeOpening`.
3. **F One Breath**: the screenshot is a press-and-hold listening state with a live waveform and
   "Release to review / Type instead". The app has no microphone or speech pipeline and the screen's
   own header says it never represents itself as listening; the frame's product-rules block (node
   `50:68`) requires a deliberate press-and-hold and no passive listening. Only the typed draft and
   review states are restyled. Labels that would claim listening are not adopted.
4. **Status colors (rule 4)**: the screenshots render state words in ivory (Recovering, Steady,
   Stable, Platinum) and red only for Depleted; Performance Signal bars are bone with one red bar;
   pills are grey outlines. The app's status system (`statusColor.ts`, `Colors.states`) renders
   Recovering amber, Balanced cyan, Peak green, Depleted red. The restyle keeps the system colors.
   Affected: Home state word, Circle "Depleted", Performance Signal bars + day pills, Clutch state
   words, Weekly timeline, Sleep "Restorative", Protocol accents. Reported, not overridden.
5. **Brand red**: see D1.
6. **Guardian / Clutch names**: the shots carry real athlete and program names as sample data; the app
   screens keep their existing data sources. Nothing to build; noted because the brief's "Before you
   post" frame says these two stay internal.
7. **Home "Welcome Julius · New York · 72°F · SAT · AUG 29 · 9:41 AM"**: city/temp come from the
   existing weather source and user name from the profile; where a source is absent the masthead shows
   the existing absence treatment, never a placeholder value.
8. **Devices "1 ready · 3 soon"** and per-provider statuses derive from the provider registry; the
   screenshot's set (Apple Health, Garmin, Health Connect, Oura, Samsung, Strava, WHOOP) overlaps but
   does not equal the registry, and the registry wins.
9. **Moments "10 moments · 4 flagged · protocol synced · Ready"**: "protocol synced" has no source
   today; the summary line shows only what the Moments store can state.

---

## 6. Decisions needed before PR 1 (as asked — answered in the decision record at the top)

- **D1 Red.** The shots use `#E13B2A` for every red (wordmark, eyebrows, CTA fill, active tab). Brand
  v2.2.0 freezes Signal Red at `#C1281B`, and the 2026-07-20 ruling rejected a brighter spec red once
  already. Contrast: `#E13B2A` as text is 4.50:1 on the canvas and **4.26:1 on cards** (fails AA at
  eyebrow sizes); ink on an `#E13B2A` fill is 3.60:1 (fails AA for the 17 pt CTA label), white on
  `#C1281B` is 5.85:1. **Recommendation: keep `af.red = #C1281B` for fills and `af.redText = #E4564A`
  for red text/icons.** Visual delta vs. the shots is small; accessibility and the frozen brand both
  hold. Adopting `#E13B2A` needs Julius + Brandon per the Constitution.
- **D2 Display face.** The shots use Inter 700 for every statement and numeral; Archivo Black is
  absent. The Editorial OS v1 sign-off (2026-08-29) already approved Inter as the display voice in
  principle. Proposal: `afType.displayHero` / `displayScore` move to Inter 700; Archivo Black stays
  loaded for the brand mark and the site. Confirm, and whether the brand doc's typography table should
  be amended.
- **D3 Status colors.** Confirm the restyle keeps `statusColor.ts` / `Colors.states` and reports the
  ivory-vs-amber mismatch (as rule 4 requires), rather than pausing for a status-color ruling.
- **D4 Home.** The live Home is the E2 Editorial Home (pressure field, И state word, no cards). The
  Black Issue Home is a card-and-list layout. Restyling Home to the shot retires the pressure-field
  and И signatures from the live Home. Confirm that is intended. `editorialHomeLaw.test.ts` and
  `editorialTruthParityLaw.test.ts` stay green as written; if any assertion is about a retired
  signature rather than truth/accessibility, that test edit will be called out in the PR for sign-off.
- **D5 New shared component** `AFMasthead` (§3). Yes/no.
- **D6 Gutter** 32 pt (as sampled) vs. keeping 24. Proposal: 32 standard / 24 compact.
- **D7 Evidence capture.** Gated screens (Environmental, Guardian, Clutch, Skin scan, Concierge, Social
  Mode, Phantom) can only be screenshotted with a local, uncommitted flag flip and `EXPO_PUBLIC_DEMO_MODE`
  per the existing capture workflow. Confirm that is acceptable for PR evidence.

---

## 7. Proposed PR sequence

Every PR: branch off clean `main`; typecheck (`pnpm --filter @workspace/aforce-os run typecheck`),
vitest (`pnpm exec vitest run`, CI baseline), `git diff --stat main -- '**/scoringEngine.ts'
'**/statusColor.ts' featureFlags/flags.ts` must be empty; simulator capture at 390×844 beside the Figma
PNG in `docs/pr-evidence/black-issue/`; differences listed in the PR body. One PR open at a time; no
stacking.

| PR | Scope | Screens |
|---|---|---|
| 1 | `af.*` token values, `afType`, `afLayout`, `Colors.tabBar`; AF* primitives; tab bar; `AFMasthead`; `GradientBackground` flattened; token tests (WCAG lock, ed-equality pin, `rawColorBaseline.json` ratchet) | none (app-wide shift via tokens) |
| 2 | Screens 01–04 | Home, Moments, Protocol, Circle |
| 3 | Screens 05–09 | Hydration, Environmental, Cruise, Guardian, Clutch |
| 4 | Screens 10–14 | Weekly, Sleep, Skin scan, Concierge, Concierge opening |
| 5 | Screen 18 + A–C | Performance Signal, Social Mode, Sweat Calculator, HydroScan |
| 6 | D–F + first no-screenshot batch | Devices, Phantom Band, One Breath; Profile (other panes), Auth, Onboarding |
| 7 | Second no-screenshot batch | Subscription / Store / Cart / paywall, Moment detail, Prepare my day, Notifications, Achievements, Science, Share, Urine check, Heat, Leaderboard, Sensors, Health connected, Cruise sub-screens, consoles, Recovery coach, Ring, Territory, Trainer, Legal |
| — | Final report | matched / partial / gaps / uncertainties |

PR 1 review follow-ups (folded into PR 2, commit "review fixes"): B2 tab selection gets a 2 pt mark +
filled iOS symbols (locked by `components/__tests__/blackIssueTabBarCue.test.ts`); S1 tracking yield
wired on every new mono text and `afType.micro` tracking aligned with `eyebrow`; S2 `useAFGutter`
hook (AFScreen, AFDisclosureSheet, AFEditorialHero; remaining direct `screenPaddingX` readers migrate
in their own screen PR); S3 status-badge label at the 11 pt floor; S4 Sleep/Cruise CTAs use
`minHeight`; nits (masthead comment, button label `flexShrink`). `expo-blur` is now unused by the app
and is left for a cleanup PR.

Screens 15, 16, 17, 19, 20, 21 are not in any PR (gap §5.1).

---

## 8. Things I was unsure of

- Whether the internal-TestFlight-only editorial branches (`EditorialProtocolScreen`,
  `EditorialCruiseLandingScreen`) should be restyled alongside their production counterparts or left
  on the editorial look. Plan assumes: tokens only (they inherit the shared shift), no layout work.
- The exact display sizes: the shots are 1× renders, so sizes are ±1 pt estimates. Dynamic Type scaling
  stays on everywhere (no `allowFontScaling={false}`), so exact points matter less than ratios.
- Tab labels: the shots show mono caps; the i18n strings are sentence case. Caps will be applied with
  `textTransform` in the tab bar, which is outside the editorial layer's `textTransform` ban.
