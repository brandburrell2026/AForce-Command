# CR-T1 — Travel sleep and light guidance: science and claims review package

**Status:** ⏳ **NOT YET REVIEWED — reviewer not yet assigned.**
**Prepared:** 2026-11-11 · **Owner:** Brandon + performance-scientist (+ counsel)
**Governs by:** `docs/COMPLIANCE_FRAMEWORK.md` §2 (Observation, Never Diagnosis), §14 (Health
Disclaimers) · `governance/CLAIMS-REGISTER.md` §1–§2, §6 · `governance/proposals/PR-TRAVEL-INTELLIGENCE.md`
**Design reference:** board 07 of the Travel Intelligence mockup (Miami, day 2, London → Miami).

> **No scientific, compliance or legal approval exists for anything in this package.** It requests
> review and gives reviewers a complete worksheet. Nothing here ships, and no code for it is
> merged, until both the scientific and the claims passes record a disposition.

---

## Part 1 — What is being asked

Travel Intelligence 2.0 (T1–T3 and the share card, on `main` since 2026-11-11) shows a trip's time
difference but deliberately gives **no sleep or light-exposure advice**. The founder brief asks for
"evidence-informed sleep and light-exposure guidance when appropriate". This package asks two
reviewers to decide whether, and in what wording, that guidance may ship.

| Reviewer | Question |
|---|---|
| **performance-scientist** (scientific substantiation) | Are the timing rules in Part 4 supported by the evidence, for the trips they would run on? |
| **Claims / regulatory reviewer** (counsel) | Which claim class does each line fall into, and is Option A wording permissible? |

## Part 2 — The claim-class problem (read first)

The claims register allows observation (C1) and personal cause-and-effect (C2). It **prohibits**
population claims (C5) once personal data exists and health claims (C6) outright.

General jet-lag advice ("daylight in the evening helps your body clock shift") is a statement about
people in general: **C5**. Framed as reducing a symptom, it drifts toward **C6**. The guidance cannot
ship under the current register as ordinary explanatory copy.

### Options for the reviewers

| Option | What members see | Register impact |
|---|---|---|
| **A — Action-only (recommended)** | Times and actions only: *"4 PM – sunset · Outside in daylight."* No stated effect, no mechanism, no promise. | Reviewer rules whether a timing suggestion with no stated effect is a claim at all. If not, it can ship with the Part 6 safeguards. |
| **B — New approved class** | Actions plus a short reason: *"Evening daylight helps your body clock shift west."* | Founder + reviewer add a new class (for example *C7 — evidence-based travel timing guidance*) with approved phrasing, citations on file and a mandatory disclaimer. A governance change. |
| **C — Do not ship** | Time difference only, as today. | None. |

**Recommendation: A.** It delivers the useful part (when to get light, when to keep it low)
without asserting a physiological effect, and it keeps the register intact. B can follow if
reviewers want explanations and the evidence supports approved phrasing.

## Part 3 — Draft copy (Option A), as shown on board 07

Trip: London → Miami, Miami 5 hours behind. Day 2, 7:10 AM Miami time.

| # | Where | Draft wording | Class (proposed) | Notes for reviewer |
|---|---|---|---|---|
| T1 | Header | *Your body is still on London time, where it's 12:10 PM. Miami is 5 hours behind.* | C1-adjacent (computed fact) | "Your body is still on…" implies a physiological state. Alternative: *"It's 12:10 PM in London. Miami is 5 hours behind."* |
| T2 | Plan | *Today, 4 PM – sunset · Outside in daylight.* Sub: *A walk on the beach or a late training block. Sunset today 5:33 PM.* | A (action only) | Sunset from provider data. |
| T3 | Plan | *After 9 PM · Keep lights low.* Sub: *Sleep on Miami time tonight.* | A | |
| T4 | Plan | *If you wake before 6 AM · Stay in low light until 6.* Sub: *Waking early is common on the first nights here.* | **C5** as worded | The sub-line is a population statement. Remove it, or approve it under B. |
| T5 | Plan | *Naps · Under 30 minutes, before 3 PM.* Sub: *Optional.* | A | |
| T6 | Footer | *If your sleep is still off after a few days, check in with your doctor.* | Standing requirement §6.1 | Routes persistent symptoms to a physician. Confirm wording. |

**Banned-vocabulary check (CLAIMS-REGISTER §1):** none of T1–T6 uses risk, injury, diagnosis,
prevent, treat, cure, deficiency or disorder. "Jet lag" itself does not appear in member copy.

## Part 4 — Draft timing rules (for the scientific pass)

All times are in destination local time and use provider sunrise and sunset (Open-Meteo, already
fetched by T2). Inputs: origin and destination time zones (from the trip's legs), the arrival
instant, and the day of the stay.

| Rule | Draft | Question for the performance-scientist |
|---|---|---|
| R1 · When it shows | Only when the time difference is **3 hours or more** (`TRAVEL_BIG_SHIFT_HOURS`), on **days 1–3** after arrival. | Is 3h the right floor? Should very short stays (under 48h) keep home time instead? The trip model knows a return leg when one exists. |
| R2 · Westward (destination behind) | Daylight **late afternoon to sunset**; lights low **after 9 PM**; if waking before 6 AM, low light until 6. | Are these windows right for shifts of 3–7h? How should they scale with the size of the shift? |
| R3 · Eastward, 3–7h | Daylight in the **morning after waking** (roughly 8–11 AM); lights low in the evening. | Confirm the window and how it moves day by day. |
| R4 · Eastward, 8h or more (for example New York → Tokyo, +14h) | Treated as a large shift: avoid bright light **before about 10 AM** on day 1, then daylight late morning to early afternoon; or treated as a westward shift of 24 − Δ hours. | Which approach? Early-morning light after a large eastward shift may push the body clock the wrong way. Exact windows needed. |
| R5 · Naps | Under 30 minutes, before 3 PM local. | Confirm. |
| R6 · Out of scope, always | No melatonin, supplements, sleep medication, caffeine timing or alcohol advice. No pre-flight shifting plans. | Agree these stay out of scope. Supplement and drug advice would be a different claims regime. |
| R7 · Defaults | Bedtime is not known; the guidance says "sleep on <city> time" rather than inventing a bedtime. | Is a default bedtime needed, or should members set one? |

## Part 5 — Evidence to verify (performance-scientist)

The scientific pass verifies these sources and that each rule matches them. They are listed as
starting points; the reviewer confirms citations against the originals before anything is relied on.

- Eastman CI, Burgess HJ. How to travel the world without jet lag. *Sleep Medicine Clinics.* 2009.
- Waterhouse J, Reilly T, Atkinson G, Edwards B. Jet lag: trends and coping strategies. *The Lancet.* 2007.
- Roach GD, Sargent C. Interventions to minimize jet lag after westward and eastward flight.
  *Frontiers in Physiology.* 2019.
- Khalsa SBS, et al. A phase response curve to single bright light pulses in human subjects.
  *Journal of Physiology.* 2003.
- Sack RL, et al. AASM review of circadian rhythm sleep disorders, Part I (jet lag section).
  *Sleep.* 2007. Cited for evidence only: its title term is banned in member copy.

## Part 6 — What ships if approved (engineering, after review only)

Nothing below is built until Part 7 records a disposition.

1. A pure rule engine in `utils/travel/` (rules R1–R5), with every window in `config/hydroStateModel.ts`.
2. Copy keys for the approved wording only, under the §42 language gate, with the **mandatory
   banned-term test** (CLAIMS-REGISTER §6.4) covering every emitted key.
3. A new flag, default **OFF**, separate from the travel pilot, so the guidance can be turned off
   without touching Travel.
4. The footer routing persistent symptoms to a physician (§6.1) is always shown with the plan.
5. English only (`LOCALE-POLICY-REGISTRY`); other locales show the time difference only.
6. The device QA script gains rows for the guidance (the 3h floor, westward, eastward, a large shift,
   days 1–3 only).

## Part 7 — Dispositions

| Item | Scientific pass | Claims pass | Decision |
|---|---|---|---|
| Option (A / B / C) | — | — | — |
| T1 | — | — | — |
| T2 | — | — | — |
| T3 | — | — | — |
| T4 | — | — | — |
| T5 | — | — | — |
| T6 | — | — | — |
| R1–R7 | — | — | — |

Reviewer name, date and notes go here. An empty row is not an approval.
