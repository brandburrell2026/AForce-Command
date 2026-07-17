# Section 63 — Guardian, Clutch, Cruise Mode Compliance Pass

Status: **app-side pass complete** (this branch) · comparative surfaces and the
decay mechanic deferred with decisions recorded (see Risk Register §63 items).

§63 is "required revisions to existing specs, not new features." The three
required revisions and where each landed:

## (a) Recalibration framed as optimization, never correction
**Audit outcome: no violating user-facing copy found.** Profile recalibration is
already framed as calibration/optimization at the engine — see the comment at
`artifacts/aforce-os/config/hydroStateModel.ts:97` ("calibration — never
correction, never comparison"). The only "correction" strings in the app are the
hydration **Depletion Correction** protocol stage and a video-library tag — a
different domain (a protocol phase), not profile recalibration. No change made;
recorded so a future reviewer doesn't re-open a closed item.

## (b) Guardian & Clutch — the stated Principle 11 exception
Principle 11 (trust over attention) lives in the frozen Constitution and is not
edited here. This is the governing note the pass records: **Guardian and Clutch
are the one stated exception to Principle 11.** They serve a coach/staff safety
relationship in which active attention during a risk window is the explicit value
delivered. The exception applies **only** to Guardian and Clutch — never to
Cruise, and never as a general license for attention-seeking mechanics elsewhere.

## (c) Cruise streak mechanic → never threaten loss of a streak
Scope (Brandon's call): the never-threaten-loss rule applies to **every** streak
display, not Cruise-only — "a constitution rule that applies on one screen isn't
a constitution." Step-1 audit enumerated every surface rendering
`complianceStreak` / `streakDays`. Finding: the app had **no** explicit
break-the-chain or loss-threat copy today; the mechanic was gamified but the
language was mostly neutral counts and mild momentum framing.

Enforced this pass:
- Streak copy for the RN surfaces (Athlete Mode card, Journal StreakHero) moved
  to one testable source, `utils/streak/streakCopy.ts`. A missed day (streak 0)
  now reads as **"New cycle"**, never "0-day streak"; the active StreakHero state
  reads **"Carried forward from yesterday."** The milestone "days remaining" line
  is kept verbatim — aspiration, not threat.
- The next-week consistency nudge (`locales/en.json`) reframed from "build your
  streak" to "each day carries forward."
- A language guard — `utils/__tests__/streakCopy.test.ts` — asserts **no**
  loss-threat / break-the-chain framing across every streak string (component
  builders + the i18n bundle), so regressions can't reintroduce it.

Note: `ja.json` / `zh.json` mirror the English streak strings (currently English
fallback text). Re-translating the changed keys is a localization follow-up; the
guard runs against `en.json` (the source locale).

## Deferred, with decisions recorded (Risk Register)
- **Group 4 — comparative surfaces** (leaderboards, territory density, peer
  streak cards): implementation deferred to Phase 2 (these are §47–52,
  flag-gated, not in the launch binary). Design decided now so Phase 2 builds it
  right: **rank decouples from streak** (rank on a non-streak metric — active
  days / readiness), removing the loss vector at the source; neutral-comparative
  copy is the floor regardless of metric.
- **Group 3 — Athlete Mode decay mechanic**: the app receives `complianceStreak`
  already zeroed on a miss and cannot reconstruct carried-forward days from it, so
  the decay model (progress decays one day per missed day rather than emptying) is
  a **backend / streak-owner** change, specced as a §63 follow-up. Its
  performance-scientist review question: does a decay model read as momentum or as
  slow-motion loss — fallback is a single grace day per cycle.
