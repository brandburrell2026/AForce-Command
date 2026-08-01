# AForce OS — Activity & Sport Matrix (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Verified against:** `52986ece` (2026-08-01). Source: Phase 0E. Data: `data/sweatSports.ts`.

> Records the current activity/sport model. **Two governance invariants hold and are confirmed:**
> (1) sports use sport-appropriate measures (sweat-rate L/h + MET), **not** fake "steps";
> (2) activity/steps **do not directly increase HydroState** — they feed demand/target/timing only
> (`utils/scoringEngine.ts:49` has no activity term; demand adder is `spec_demand_engine`-gated, off).

---

## 1. Present: Sweat sport registry (Live, `spec_sweat`)

`SWEAT_SPORTS` — 11 sport-appropriate types with per-sport mean L/h + MET (`data/sweatSports.ts:64-153`):

Distance Running · Soccer · Basketball · American Football · Tennis · Cycling · Triathlon ·
CrossFit/HIIT · Hot Yoga · Ice Hockey · General Gym.

Engine (`services/sweatRateEngine.ts`): ACSM measured path (`(pre−post)+fluid−urine`) + Baker sodium
bands + climate/acclimatization factors. Per-sport citations reconciled 2026-07-31 (ER-5 closed).
**Gap:** zero automated tests lock the formula/units/boundaries (required coverage); the Sweat Calc
screen shows L/h only, not the app-canonical oz.

## 2. Missing: canonical ActivitySession lifecycle — **Proposed (not built)**

No `PLANNED → ACTIVE → COMPLETED → RECOVERY_CLOSED` lifecycle exists anywhere (grep across
services/types/store/components found only `sleepStateMachine` for sleep). The Sweat screen is a
**stateless one-shot form**; the only "lifecycle" is `deriveAutopilot` recheck cadence + a fixed 4h
window (`sweatRateEngine.ts:494-498`). Sessions aren't fully persisted
(`store/useAppStore.tsx:596` "future work can plumb the underlying SweatSession").

### Registry coverage vs the prompt's target set
| Covered (sweat-rate) | Not modeled as sessions |
|---|---|
| running, soccer, basketball, football, tennis, cycling, triathlon, CrossFit/HIIT, hot yoga, ice hockey, general gym | walking/steps, hiking, swimming (solo), rowing, stair, elliptical, strength (as session), circuit, baseball/softball, pickleball, boxing/kickboxing/MMA/BJJ/judo/Muay Thai, dance, adaptive movement, long work shift, competition/event, custom |

Sport-appropriate measures (duration/distance/laps/sets/rounds/workload/HR zones) beyond sweat-rate are
**not** modeled. Manual/device/provider session creation, pause/resume/end, active-session restoration,
planned-vs-completed, workout→hydration command linkage, and post-workout recovery closure are all
**Proposed** (build items, Plan P6).

## 3. Competition integrity — **Internal Preview**

Blended formula rewards verified consistency, not raw volume:
`competition_score = perf×0.35 + compliance×0.25 + consistency×0.20 + recovery×0.20`
(`services/competitionEngine.ts:8-13`). **But:** opponents are mock (`MOCK_CITIES/STATES/TEAMS/
INDIVIDUALS`), and the "You" row derives from **unverified client-self-reported intake** (SS-16). No
server-authoritative leaderboard or anti-cheat — today it is a single-player simulation. Competition
must reward verified consistency/command-completion, not raw HydroState/water volume, and must not
expose private state (see SS-07).

## 4. Status summary
Sweat sport registry = **Live** (11 sports, cited). ActivitySession lifecycle + broader activity
registry = **Proposed**. Competition = **Internal Preview** (needs server verification before any real
ranking). Invariants (no fake steps; activity never raises HydroState directly) = **confirmed clean**.
