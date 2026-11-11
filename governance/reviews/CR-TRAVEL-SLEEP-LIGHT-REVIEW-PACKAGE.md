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
| T1 | Header | ~~*Your body is still on London time, where it's 12:10 PM.*~~ → *It's 12:10 PM in London. Miami is 5 hours behind.* | C1-adjacent (computed fact) | **Revised after pre-review (Part 8).** The original stated a physiological state, and by day 2 it is not literally true. |
| T2 | Plan | *Today, 4 PM – sunset · Outside in daylight.* Sub: *A walk on the beach or a late training block. Sunset today 5:33 PM.* | A (action only) | Direction correct. The window comes from the Part 4 model. |
| T3 | Plan | ~~*After 9 PM · Keep lights low.*~~ → *Evening · Normal indoor light until bedtime.* Sub: *Sleep on Miami time tonight.* | A | **Revised: the original timing was wrong.** For westward trips, the evening before the estimated body-clock low point is the most useful light window; dimming it works against the goal. |
| T4 | Plan | *If you wake before 6 AM · Stay in low light until 6.* ~~Sub: *Waking early is common on the first nights here.*~~ | A | **Revised:** the C5 sub-line is deleted. The time is computed per day (about 5 AM on day 1, 6 AM on day 2, 7 AM on day 3 for this trip). |
| T5 | Plan | *Naps · Under 30 minutes, before 3 PM.* Sub: *Optional.* | A | The exact figures are conventional ("plausible"), not from a primary source. |
| T6 | Footer | ~~*If your sleep is still off after a few days…*~~ → *If your sleep hasn't settled a week after you're back to your usual routine, check in with your doctor.* | Standing requirement §6.1 | **Revised:** "a few days" is too short for large shifts. Counsel to confirm. |
| T7 | Opt-out (new) | *Skip this plan if a clinician has given you sleep or light guidance.* | A | **Added after pre-review.** Covers light cautions without asking about diagnoses. Counsel to confirm. |

**Banned-vocabulary check (CLAIMS-REGISTER §1):** none of T1–T6 uses risk, injury, diagnosis,
prevent, treat, cure, deficiency or disorder. "Jet lag" itself does not appear in member copy.

## Part 4 — Draft timing rules (for the scientific pass)

All times are in destination local time. The draft below has been **revised after the internal pre-review (Part 8)**: every window is computed from an estimated body-clock low point, never from fixed clock times. The guiding rule: *any window that can land on the wrong side of the body-clock low point for some time difference fails review.*

**Model (all values are estimates; they live in `config/hydroStateModel.ts`).**
- Home wake time: an optional member field, defaulting to 07:00. The body-clock low point (Tmin) is estimated at **3h before home wake** (about 04:00 home time).
- On night *n*, Tmin in destination time = home Tmin converted to destination time, then moved toward local time by about **1h per day**.
- **Delay** (the clock needs to move later): seek light from Tmin − 5h to bedtime. Keep light low from waking until about Tmin + 6h.
- **Advance** (the clock needs to move earlier): keep light low before Tmin. Seek light from Tmin to Tmin + 4h, and keep evenings dim.
- Every window is clipped to waking hours.
- The time difference is computed from the time-zone database at the actual instant. London → Miami is 4h, not 5h, in the weeks when the UK and US clock changes don't line up.

| Rule | Revised draft | Status after pre-review |
|---|---|---|
| R1 · When it shows | A time difference of **3h or more**, on **days 1–3**, recomputed each day. **Short stays:** if the return leg departs within 72h of arrival, show the time difference only. | Supported with changes. Confirm the 72h rule against Waterhouse 2007. |
| R2 · Westward (destination behind) | The delay model. **London → Miami:** day 1, daylight 4 PM – sunset, then normal indoor light until bedtime, low light before about 5 AM; day 2, the same with low light until about 6 AM; day 3, the same with low light until about 7 AM. | Supported with changes. The draft's "lights low after 9 PM" was wrong. |
| R3 · Eastward, 3–9h | The advance model. Keep light low until about (04:00 + Δ) − (d − 1)h, then daylight for 3–4h; evenings dim. **London → Dubai (+4):** daylight 8–11 AM on day 1, 7–10 AM on day 2, 6–9 AM on day 3, clipped to wake time. **+7:** no bright light before about 11 AM on day 1, then daylight 11 AM – 2 PM. | Supported with changes. A fixed 8–11 AM window was wrong at the top of the range. |
| R4 · Eastward, 10h or more | Treated as a **westward delay of 24 − Δ**. **New York → Tokyo (+14, treated as −10):** Tmin about 18:00 Tokyo on day 1; daylight about 1–5 PM on day 1, 2–6 PM on day 2, 3–7 PM on day 3; evenings dim. | Supported with changes. The 10h cut-off is a judgment call for the human reviewer. |
| R5 · Naps | Under 30 minutes, before 3 PM local. | Supported as plausible. |
| R6 · Out of scope | No melatonin, supplements, sleep medication, caffeine timing or alcohol advice. The plan must never imply it is complete: melatonin has evidence behind it, but it is a different claims regime. | Supported. |
| R7 · Anchor | Optional "usual wake time" field (default 07:00). Copy may say "sleep on <city> time" but **never states a body-clock time**. | Supported with changes. |
| R8 · Who it doesn't run for (new) | Under-18s (per the app's age gate). Members without a regular home sleep pattern, such as shift workers. Back-to-back trips within about 7 days. Plus the T7 opt-out line. | Added after pre-review. |

## Part 5 — Evidence to verify (performance-scientist)

DOIs were checked against the DOI registry on 2026-11-11, and all resolve. The human reviewer still confirms each claim against the full text.

- Eastman CI, Burgess HJ. How to travel the world without jet lag. *Sleep Med Clin.* 2009;4(2):241–255. doi:10.1016/j.jsmc.2009.02.006
- Waterhouse J, Reilly T, Atkinson G, Edwards B. Jet lag: trends and coping strategies. *Lancet.* 2007;369(9567):1117–1129. doi:10.1016/S0140-6736(07)60529-7
- Roach GD, Sargent C. Interventions to minimize jet lag after westward and eastward flight. *Front Physiol.* 2019;10:927. doi:10.3389/fphys.2019.00927. *An opinion article: cite it as expert opinion.*
- Khalsa SBS, Jewett ME, Cajochen C, Czeisler CA. A phase response curve to single bright light pulses in human subjects. *J Physiol.* 2003;549(Pt 3):945–952. doi:10.1113/jphysiol.2003.040477
- St Hilaire MA, Gooley JJ, Khalsa SBS, Kronauer RE, Czeisler CA, Lockley SW. Human phase response curve to a 1 h pulse of bright white light. *J Physiol.* 2012;590(13):3035–3045. doi:10.1113/jphysiol.2012.227892. *Added: the closest match to a realistic 1–2h outdoor session.*
- Daan S, Lewy AJ. Scheduled exposure to daylight: a potential strategy to reduce "jet lag" following transmeridian flight. *Psychopharmacol Bull.* 1984;20(3):566–568. *Added: the origin of scheduled light exposure and avoidance. Bibliographic details confirmed; full text not read.*
- Sack RL, Auckley D, Auger RR, Carskadon MA, Wright KP Jr, Vitiello MV, Zhdanova IV. Circadian rhythm sleep disorders: part I. *Sleep.* 2007;30(11):1460–1483. doi:10.1093/sleep/30.11.1460. *Cited for evidence only: its title term is banned in member copy.*

## Part 6 — What ships if approved (engineering, after review only)

Nothing below is built until Part 7 records a disposition.

1. A pure rule engine in `utils/travel/` (rules R1–R5), with every window in `config/hydroStateModel.ts`.
2. Copy keys for the approved wording only, under the §42 language gate, with the **mandatory
   banned-term test** (CLAIMS-REGISTER §6.4) covering every emitted key.
3. A new flag, default **OFF**, separate from the travel pilot, so the guidance can be turned off
   without touching Travel.
4. The footer routing persistent symptoms to a physician (§6.1) is always shown with the plan.
5. English only (`LOCALE-POLICY-REGISTRY`); other locales show the time difference only.
6. The device QA script gains rows for the guidance:
   - the 3h floor and days 1–3 only;
   - westward, eastward +4, +8, +10 and +14;
   - a 72h return;
   - a week when the UK and US clock changes don't line up.

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
| T7 | — | — | — |
| R1–R8 | — | — | — |

Reviewer name, date and notes go here. An empty row is not an approval.

## Part 8 — Internal scientific pre-review (AI-assisted, 2026-11-11)

**This is not the scientific pass Part 7 asks for, and it records no approval.** The
performance-scientist agent reviewed Parts 3–5 against the human light phase-response evidence
(Khalsa 2003; St Hilaire 2012) and returned findings only. Parts 3–5 above now reflect them.

| Finding | Effect on this package |
|---|---|
| Fixed clock windows can fall on the wrong side of the body-clock low point for some trips. | Part 4 now uses a Tmin-based model. |
| T3 "lights low after 9 PM" removed the most useful delay window for westward trips. | T3 revised. |
| T1 stated a physiological condition; T4's sub-line was C5. | T1 revised; T4 sub-line deleted. |
| An eastward fixed 8–11 AM window is wrong at +7. | R3 computed per Δ and per day. |
| Eastward 10h or more is better treated as a westward delay. | R4 revised. The cut-off is for the human reviewer. |
| "A few days" is short for large shifts. | T6 revised. |
| Light cautions apply for some people without asking about diagnoses. | T7 opt-out line and R8 added. |
| All five original citations exist; two added. | Part 5 has full references; DOIs checked against the DOI registry. |

**For the human reviewer:** the 10h cut-off in R4, the 72h short-stay rule in R1, the T6 and T7
wording, and whether the Tmin estimate (3h before habitual wake, about 1h per day of adjustment)
should be shown as "plausible" anywhere members can see it.

