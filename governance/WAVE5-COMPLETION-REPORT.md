# Wave 5 — Final Experience Pass

**Status:** Delivered · **Date:** 2026-08-12 · **Authorized by:** Founder (Wave-5 directive)
**Vocabulary:** VERIFIED = observed against a running system · VALIDATED = proven by behavioral
test · BUILT = exists and typechecks. Anything not observed says so.

---

## 1 · Final `main` commit

`chore/w5-ratchet-raw-color-baseline` merged state, plus PRs #777 and #778 pending. The last
verified-green commit on `main` at time of writing carries every Wave-5 round-1 and round-2
change (see §2). All content verified **by diff, not by GitHub status** — see §22.

## 2 · Phase-1 screens changed

| Screen | PR | Change |
|---|---|---|
| Home | #768, #772 | band-aware hero; "Completed today" deleted; WHY inline; first-launch baseline state |
| Performance Signal | #773, #777 | ~30 numerals → one; confidence chips wired; shaped loading |
| Week in Review | #770, #777 | fixed chart axis; back control; failed fetch no longer reads as a fact |
| Protocol | #774 | TODAY → NEXT → WHY → PROGRESS; 9 blocks → 7 |
| Moments | #774, #777 | one priority in UP NEXT; hydration-gated empty state |
| Circle | #769 | "LIVE" removed; ranks demoted; rows announce as one |
| Profile | #761, #775 | legal reachability (compliance blocker); named sections |
| Scan | #767 | simulate tray gated; pulse loops cleaned |
| Onboarding | #771 | location permission moved behind its explanation |
| Subscription | #759 | AA contrast on status; 44pt filter targets |
| Notifications | #757 | row-truth lock landed |

## 3 · Shared components changed

`AFCard` (the highest-leverage fix of the wave — see §12), `AFCommandCard`, `AFReadinessArc`,
`afPrimitives.logic.ts`, four new skeletons (`SignalSkeleton`, `WeeklyReportSkeleton`,
`MomentsSkeleton`, extended `HomeSkeleton`), and `homeBaselineState.ts` /
`HomeBaselineHero.tsx`. Existing `AFEmptyState` / `AFErrorState` / `AFInlineErrorRow` /
`AFSkeleton` / `ConfidenceChip` were **reused, not replaced** — no second design system.

## 4 · Accessibility defects fixed

- **`AFCard` discarded every composed VoiceOver label.** A React Native `View` is not an
  accessibility element on iOS without `accessible`. Fixed **in the primitive**, per directive,
  rather than across thirty screens. Unlabelled cards stay transparent on purpose — forcing
  `accessible` everywhere would flatten rich content into one unnamed node.
- Signal Red rendered as **9px text at ~3.1:1** on canceled subscriptions, while the token file
  documented that exact failure and shipped `af.redText` for it.
- Tab rows announced as **buttons**, not tabs; Circle's (36pt) and Subscription's (30pt) were
  under the 44pt minimum.
- Week in Review had **zero roles, zero labels, zero live regions**, a chart VoiceOver read as
  "Mon, Tue, Wed" with no data, and **no back control on a pushed route**.
- Home announced its hero **twice**; Circle rows announced as six loose fragments with "you"
  carried by green text alone; MomentDetail conveyed stage state by colour and icon tint alone.

## 5 · Visual hierarchy changes

The wave's method was **removal**, not restyling. Deleted outright: 21 metric chips, 7 band
pills, a whole "Weekly averages" section, a row rendering the same number a third time, a
Protocol day chip duplicating two other elements, a duplicate next-check stat, a 26pt streak
numeral, and three green checks claiming unearned product consumption.

## 6 · First-launch baseline treatment

`defaultUserState` seeds `unitsConsumedToday: 5 / ozConsumedToday: 45`, and Home rendered
`engine.score` from it — the source of "BALANCED 76" for a member AForce had never observed.

Fixed with a **presentational gate**. No seed, scoring, band or threshold file touched. Three
states: `pending` (not known yet — holds the arc's shape, claims nothing), `building` (BUILDING
YOUR BASELINE), `established` (today's Home, unchanged). **`pending` is the load-bearing one** —
it stops the gate collapsing "not known yet" into "none" and calling a veteran a beginner.

Costs **zero network**: both signals were already in the store. An earlier draft fetched journal
rollups on mount; my own verification caught that it would fire on **every cold open for anyone
who had not logged in 24h** — a quiet morning, not a first launch — which is exactly the extra
refetching Wave 4 ruled out.

## 7 · Home — final hierarchy

**Before:** a 240pt **alarm-red** arc (red at every band, so PEAK read as "something is wrong")
→ state word and trend *also* red → 32pt command title with WHY behind a tap → a 26pt streak
numeral competing with the arc → three green checks claiming products a tap-water drinker never
consumed.

**After:** the arc in the **band's** colour (Signal Red only at DEPLETED) → state and trend in
the same tint, reading as one statement → the command card answering all four north-star
questions without a tap → quiet signal tiles → nothing else. **The only large numeral on the
screen is the score.**

## 8 · HydroState — final treatment

The hero is band-aware and animated (it draws itself — see §17), and it is the **only** dominant
number. The game-score vocabulary that competed with it (26pt day streak, "pts" phrasing) is
gone. When evidence does not exist, it is not rendered at all.

## 9 · Command — final treatment

One card, one primary action, and **WHY inline** — the fourth north-star question no longer
costs a tap. The full rationale remains behind the disclosure.

## 10 · Moments

UP NEXT went from *N* identical dense cards to **one full card plus quiet later rows** — the
brief asks for the next moment, singular. Moments stays visually subordinate to the Command.
Recommendation authority unchanged. **Calendar gating untouched.**

## 11 · Performance Signal

~30 numerals across four competing layers → **one dominant number**, a trend, and seven
three-element rows, with everything else one tap deeper. Evidence quality now reads through
`ConfidenceChip` — machinery that **already existed and was tested**, wired rather than
reinvented (a new metric would have breached the scope lock).

## 12 · Week in Review

The Performance Age chart auto-ranged to its own data, so a **0.3-year wobble filled the chart
edge to edge** under a health-adjacent number. Now a fixed, stated axis: a small change looks
small. No computed value changed.

Its rollup fetch caught failure into an empty array, making an unreachable server
indistinguishable from a quiet week — tiles read "0 wins" about a week the member had lived.
Now em dashes plus a degraded row and retry. **The legacy report already did this correctly;
V3 had regressed it.**

## 13 · Circle

The cohort **stays** (founder ruling #712 — verified: `MOCK_INDIVIDUALS`/`CITIES`/`STATES`/
`TEAMS` intact). What changed is what the screen *claims*: "SPORT MODE · LIVE" → "SPORT MODE",
the sample caption promoted out of being the faintest text on screen, and the four fabricated
ranks demoted so the member's real score dominates.

## 14 · Profile

From "a miscellaneous feature warehouse" to named sections. **The compliance blocker:** Terms,
Privacy, Health Disclaimer and Contact Support were assigned to the `developer` tab, which is
stripped in every production build — so they were **unreachable to every real member**. That
fails App Store review. Privacy and Notifications now have their own headed homes.

## 15 · Onboarding

`AppProvider` requested iOS location in a mount-once effect wrapping the whole route tree — the
system dialog appeared essentially **at launch**, before any copy explained why. Moved behind
its explanation in onboarding, with **no new step**. Denial is a first-class outcome, not an
error. Onboarding otherwise **did not receive the experience pass** (§21).

## 16 · Loading / empty / error

Most degraded states were **already honest** (Protocol, Circle, Profile, Subscription, Home's em
dashes) and were left alone. Six genuine gaps closed: three bare-spinner/blank surfaces
(including a Moment deep link rendering `return null`), two cases of a failed fetch presented as
a measurement, and an empty state that told a member with a full day that their day was empty.
Skeletons deliberately do **not** outline the Performance Age card — it only renders with a real
baseline, and shaping it would promise a section some members never receive.

## 17 · Motion + haptics

The inventory found the product **exactly backwards**: decorative loops ran all day while the
moments that should feel like something were **dark** (`elite_home_experience_enabled` is false
in `DEFAULT_FLAGS` and gated the arc reveal).

**Four** signature moments, not five — the brief says "no more than", and the remaining
candidates needed new functionality: **HydroState reveal** (the arc draws itself, so the number
reads as measured rather than printed), **command reveal** (one 220ms beat later, so state→action
is felt), **hydration completion** (flash + one success haptic — the only Phase-1 moment where
the member changed something about their own body), **ritual progression** (the ring advances
with one light tick; it previously redrew silently, so the thing the screen exists to say never
registered).

Everything else went **calm** — loops, pulsing, shimmer and bounce removed rather than tuned
down. All surviving motion respects reduced motion, cancels on unmount, and costs nothing per
second idle.

## 18 · Performance regression results

**No regressions.** The Wave-4 TICK_TIMER win is intact (facade re-renders 60/min → 0), verified
by its lock on every round. One regression was **caught and eliminated before shipping** — the
first-launch gate's mount-time fetch (§6). The raw-color ratchet caught Profile's improvement
and was lowered 28 → 25 so slack cannot hide a future regression (#776).

## 19 · Device QA — **NOT EXECUTED**

The app is a managed Expo project: no `ios/` or `android/` directory exists, so a simulator
matrix requires a full prebuild + native build, and **no Android build target is configured at
all**. Small/standard/large iPhone and Android layout QA is therefore **not done**.

The real path is **TestFlight build 59**, already uploaded to App Store Connect. It predates all
Wave-5 work, so a fresh build is required for meaningful device QA. That is the recommended
immediate next action once #777/#778 merge.

## 20 · Final automated test count

**7,117 passing / 71 skipped (7,188 total) across 466 files**, 0 failures. The 71 skips are
exactly the gated DB lane. Both typechecks 0. Up from 6,660 at Wave-5 entry.

## 21 · Remaining UI blockers

1. **Two design languages ship side by side** — the largest single drag. 12 components use the
   refined `AFScreen` chrome; **42 still use `GradientBackground`**, including 16 nominally
   redesigned V2/V3 screens.
2. **Scan** is the weakest operational screen (5.8) and fails both the three-second and
   one-action tests: 1355 lines, old chrome, three co-equal entry paths — and it is a core loop.
3. **Subscription** (5.3, lowest) was untouched by the experience pass and sits on the money
   path: three plan families, no recommended default, maximum competition.
4. **Home's evidence threshold is one event.** `resolveHomeEvidence` returns `established` at
   `> 0`, so a single logged drink produces a full-confidence score with no confidence
   affordance. The gate closes the zero-evidence fabrication but **not the one-event
   over-claim**.
5. **Circle's roster still uses the visual grammar of a real leaderboard** — the caption says
   sample, but nothing else does.
6. **Onboarding** never received the experience pass; **Profile** remains 3,498 lines.

## 22 · Screens intentionally left unchanged

`CommandStack`, `PrimaryCTA`, `SignalsZone` — scored low but are **orphaned** (imported by
nothing); they need a founder delete-or-restore decision, not restyling. Protocol's, Circle's,
Profile's and Subscription's already-honest degraded states were deliberately left alone.

## 23 · Process note — a merge failure worth recording

PRs #762–#766 were **reported MERGED by GitHub while their commits never reached `main`**: they
were stacked, and when the parent merged and its branch was deleted, GitHub auto-closed the
children. Caught by verifying **content, not status** — `main` still had the alarm-red hero.
Re-landed as five independent PRs (#767–#771). Stacking was my choice and caused this; round 2
onward used independent branches with a shared locale snapshot instead.

This is the second such incident in this repo (the first was #726). Content verification is now
standing practice.

## 24 · Scores

**Wave-5 experience score: 68 / 100** (entry: 54).

| Screen | Before | After |
|---|---|---|
| Performance Signal | 4.0 | **8.2** |
| Home | 5.5 | **8.0** |
| Protocol | 4.5 | **8.0** |
| Moments | 5.5 | **7.8** |
| Circle | 4.0 | **7.2** |
| Hydration / journal | 5.5 | **7.2** |
| Week in Review | 5.0 | **7.1** |
| Notifications | 5.5 | 6.1 |
| Profile | 3.5 | 6.0 |
| Onboarding | 5.5 | 6.0 |
| Scan | 4.5 | 5.8 |
| Subscription | 5.0 | 5.3 |

**Three-second test:** passes on 8 of 12. Fails on Scan; marginal on Hydration and Week in
Review. **One-action test:** passes on 3 of 5 operational screens; Hydration renders two
equal-weight primaries. **Trust test:** substantially repaired — two residuals (§21 items 4–5).

**Revised beta-readiness: 72 / 100.** Correctness and truthfulness are strong; what remains is
chrome inconsistency, two un-passed screens on core loops, and unexecuted device QA.

## Founder actions — still outstanding, no evidence

1. **Shopify webhooks — still ZERO** (re-queried this session). The web purchase → entitlement
   path cannot fire. Admin UI only; API-registered hooks are signed with a secret Railway will
   never match.
2. **Railway Stripe env** — unverifiable externally by design (Wave-3 fixed the error body
   specifically so config state cannot be probed).
3. **Additive DB push** — unverifiable externally.
4. **#756 `baseline-override` label** — until it merges, CI still measures against the retired
   45/18 ceiling.
