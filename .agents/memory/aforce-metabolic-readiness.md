---
name: AForce Metabolic Readiness
description: How the Athlete-tier Metabolic Readiness estimates are built and the no-fabrication rule for optional signals.
---

# AForce Metabolic Readiness

Two display-only wellness ESTIMATES on Home (Muscle + Cognitive), gated behind
the AForce Athlete tier and a feature flag, READ-ONLY downstream of the
hydration + recovery engines (Score-Protection: never awards/mutates score).

## Required vs optional signals — the durable rule

Each metric has REQUIRED inputs and ONE OPTIONAL input:
- **Muscle** = required hydration + recovery; optional **workout fatigue**.
- **Cognitive** = required hydration + sleep; optional **HRV**.

**Rule:** when an OPTIONAL signal is absent/non-finite, DROP its term and
RENORMALIZE the required weights to sum to 1.0 (e.g. Muscle fatigue absent →
0.50·hyd + 0.50·rec; Cognitive HRV absent → (0.35/0.75)·hyd + (0.40/0.75)·sleep).
When a REQUIRED signal is absent → `{ hasEnoughData:false, score:null, band:null }`
and the card renders "Needs more data".

**Never** default an optional signal to its most-favorable value. The first
build defaulted absent workout fatigue to 0 (= full +0.20·100 freshness boost);
the architect flagged this as fabrication because users with no workout
provider got an inflated Muscle score for free.

**Why:** these are wellness estimates, not measurements — a missing data source
must not silently inflate the number. A CONFIRMED rest day (explicit
`workoutFatigue: 0`) legitimately earns the freshness term; *absent* data does
not. (Note: `deriveWorkoutFatigue(0,null)` returns `undefined`, so there is no
service path that turns a confirmed rest day into explicit 0 yet — add an
explicit `restDayConfirmed` input if that credit is ever wanted.)

**How to apply:** any future optional signal added to a metabolic metric must
follow the drop-and-renormalize pattern, not a favorable default. Bands reuse
the engine 4-band convention (PEAK≥90 / BALANCED≥75 / RECOVERING≥60 / DEPLETED)
with round-then-clamp at the boundary. Math is pure in `utils/metabolicScore.ts`
(type-only import from scoreBand); raw→normalized mapping lives in
`services/metabolicReadinessService.ts`; the store seam is
`components/home/MetabolicReadinessZone.tsx` (renders null when flag off).

## No insulin / glucose — this IS the insulin replacement

There is intentionally NO "Insulin Sensitivity" feature in the app. Metabolic
Readiness was specced as the *wellness-estimate replacement* for any blood-sugar
framing. Hard constraint: **never build glucose- or insulin-related features or
copy** (medical-claims liability) — every metric carries the always-visible
`Wellness estimate — not a medical measurement.` disclaimer. The only "insulin"
strings in the repo are two historical prompt archives in `attached_assets/`
stating "do NOT build anything glucose- or insulin-related"; those are negative
constraints, not feature references — do not rewrite them.

**Trademark-name mapping (owner "Mark Mendel additions"):** Metabolic Readiness™
is fully built; its two rows MUSCLE / COGNITIVE are the in-app analogs of
"Muscle Recovery™" / "Brain Energy™" (not standalone surfaces). Caffeine
Intelligence™ and Fuel Timing™ do NOT exist as named features (caffeine is only
a profile field feeding the gated demand engine).
