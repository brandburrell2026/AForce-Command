# §54 — Signal Quality™ (design ruling)

**Ruling by:** ml-engineer · **Date:** 2026-07-17 · **Status:** implemented (headless layer)

Basis for how §54 grades signal quality, kept so the mapping survives team
turnover. Code: `artifacts/aforce-os/utils/confidence/signalQuality.ts`.

## Where §54 sits
Four orthogonal layers, four questions:

| Layer | Question |
|---|---|
| Signal Hierarchy | which source's value do we use? |
| Verification Layer | how much confidence in that source's tier? |
| Data Confidence | how much verified data behind an engine's whole read? |
| **§54 Signal Quality** | **per individual signal, how good is its source right now?** |

§54 is the per-signal grader; Data Confidence is the aggregator. §54 **feeds** it
(via `ratingToQuality` → `asDataSignals` → `assessDataConfidence`) and does not
reimplement it.

## Mapping (tier-driven, recency-free)
Rating is a pure function of the **tier of the winning source**. Rank-within-ladder
and multi-source agreement do NOT cross a tier boundary (corroboration is capped
below phantom, so corroborated wearables stay Good, annotated, never promoted).

| Winning tier | Rating |
|---|---|
| phantom | Excellent |
| wearable (whoop / oura-via-apple / apple_watch / samsung_watch / garmin / platform aggregators / HydroScan `urine_intelligence`) | Good |
| phone (voice_checkin / manual / hydration_logs) | Limited |
| none (`resolveSignal` → null) | Unavailable |

Environmental kinds (weather, climate_profile, environmental_pressure) have no
wearable tier → a separate provenance rubric with **ceiling Good** (measured-live →
Good; regional / default → Limited; absent → Unavailable). `environmental_pressure`
is derived → rated as the **floor** of its inputs.

## Scope boundary (load-bearing)
§54 grades SOURCE identity only. Data **recency** is §53 (never reads a timestamp —
a stale Phantom reading is still Excellent-*source*); profile **completeness** is
§55. The three compose at the display layer, never inside one another.

## Redistribution / never-fail
Already satisfied upstream: `resolveSignal` walks to the best-available source;
`assessDataConfidence` renormalizes over what's present. §54 **exposes and asserts**
this graceful degradation — it implements no new weighting and touches no scoring.

**Off-limits boundary (stated plainly):** §54 may claim "we always select the best
available source and report honest per-signal quality," and surface the fallback
chain. It must NOT claim the *score itself* is reweighted — that is `scoringEngine.ts`'s
contract, which is off-limits and unread. Nothing in §54 as specified needs the
scoring weights changed. If score-level reweighting must be formally asserted, that
is a read-only finding for Brandon to request, not part of this build.

## Dependency flag
`hrv` is not yet in `signalHierarchy`'s `SignalKind` union. The §54 headless layer
grades HRV from whatever source a caller supplies (taxonomy includes it), but
WIRING HRV needs an HRV ladder added to `signalHierarchy.ts` (mirror heart-rate) —
an in-domain Signal Hierarchy extension, NOT a scoring change. Until then, callers
pass no HRV source and it grades Unavailable.

## Invariants (unit-tested, not accuracy — this layer is deterministic)
(a) rating monotonic in tier; (b) `assessDataConfidence(asDataSignals)` never
contradicts the ratings (any Good+ ⇒ band ≥ medium); (c) environmental never
Excellent; (d) a derived kind never rates above its weakest input.
