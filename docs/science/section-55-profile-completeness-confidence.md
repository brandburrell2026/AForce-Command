# §55 — Profile Completeness → Data Confidence (evidence note)

**Ruling by:** performance-scientist · **Date:** 2026-07-17 · **Status:** implemented (Step 2)

The basis for how Profile Completeness folds into the Data Confidence Layer, kept
here so the cap survives team turnover. Code: `artifacts/aforce-os/utils/profile/profileCompletenessConfidence.ts`.

## The question
The spec says "Completeness naturally improves HydroState Confidence over time."
Profile fields (weight, height, age, sex, activity, training level, primary goal,
sweat, goal weight) are **self-reported**. What confidence quality may a completeness
signal legitimately claim, and how do we prevent it from overstating certainty?

## The ruling
**Profile completeness is self-report *about* oneself, not a measurement *of* oneself.**
Under the Data Confidence Layer's own definitions, `verified` means "a real reading
from a trusted source" (the ≥ `VERIFIED_CONFIDENCE_THRESHOLD` / wearable line). A
filled-in form has no independent confirmation, so it **caps at `partial` and never
emits `verified`** — exactly like `performanceMemoryDataConfidence` (voice check-ins)
and the activity sub-score in `performanceAgeDataConfidence`.

Mapping (band-based, not ratio-based — a ratio gate would invite a future
`ratio >= 0.9 → verified`, the exact violation to prevent):

| Completeness | Signal quality | Why |
|---|---|---|
| sparse (`<0.34`) | `estimated` | near-empty profile ⇒ engine runs on population defaults |
| partial (`0.34–0.79`) | `partial` | real self-reported data present |
| rich (`≥0.80`) | `partial` | **still self-report**; richness ≠ verification |

## Why the cap holds (structural, not conventional)
`HIGH` requires `verifiedCount ≥ HIGH_MIN_VERIFIED` (2). Completeness never emits
`verified`, so it can never be the marginal signal that crosses a read into `high`.
A fully-filled but entirely self-reported profile with no sensor present reads
`medium`, never `high`. Enforced by the resolver's arithmetic and pinned in
`profileCompletenessConfidence.test.ts`.

## Shape
The adapter emits **one `DataSignalInput`** the consumer concatenates into its own
signal array before `assessDataConfidence` — not a standalone `DataConfidenceResult`.
This weighs completeness *against* the real sensor signals (it contributes its honest
`0.5` to coverage via `PARTIAL_WEIGHT`, can lift `low → medium`, but cannot manufacture
a `high`). The `rich` vs `partial` distinction remains fully available to non-confidence
consumers through `assessProfileCompleteness(...).ratio` / `.level`; it simply does not
buy a higher confidence quality.

## Strongest objection, and why it loses
*"Birth year, sex, height are stable near-objective facts — a rich demographic profile
is more trustworthy than one vague check-in, so it should earn `verified`."*
Loses because `verified` is defined by **source confirmation, not a fact's stability**.
A stable fact still only *typed by the user* has zero independent confirmation (users
mistype weight, round age, set aspirational goal weight). Granting `verified` would make
a completed form + one sensor resolve to `high` = "multiple verified signals" — telling a
surgeon "high confidence" when what happened is *the user filled out a profile*. That is a
measurement claim we did not make (brand + legal red line).

## Escalation
Raising the cap to `verified` is **not a tuning decision** — it converts a form into a
claimed measurement. It requires performance-scientist + counsel sign-off before shipping.
