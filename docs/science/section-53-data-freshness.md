# §53 — Data Freshness™ (design ruling)

**Ruling by:** ml-engineer · **Date:** 2026-07-17 · **Status:** implemented (headless layer) · **Windows: performance-scientist SIGNED OFF (1 change)**

> **PS sign-off (2026-07-17):** Windows signed off with one change — `hydration_verification`
> fresh-until tightened **6h → 4h**. Rationale: `fresh` = uncapped `excellent`; HydroScan is a
> point-in-time optical reading and the most exertion-volatile signal, while the freshness layer is
> activity-blind. Body-water turnover ~5–10%/day means a 6h window can span a full hydration-category
> change (~1.25–2.5% body mass) while reading fully current; 4h keeps drift sub-category (~0.8–1.7%).
> All other windows approved as conservative. No health claim in vocabulary or copy.

Basis for how §53 grades recency. Code: `artifacts/aforce-os/utils/confidence/dataFreshness.ts`;
windows in `config/hydroStateModel.ts`.

## Where §53 sits
The fourth confidence-input layer: §54 grades SOURCE, §55 grades COMPLETENESS,
§53 grades RECENCY. All feed the single aggregator (`assessDataConfidence`).

## Rating + mapping
Vocabulary `fresh | aging | stale | expired`, a pure function of AGE:
- undated (no/NaN timestamp) → **stale** (present but currency unconfirmable — the
  conservative middle, never expired; offline-first: old context beats none).
- future timestamp (age ≤ 0) → **fresh** (clock skew).
- age ≤ freshUntil → fresh; ≤ staleAfter → aging; beyond expireAfter (when defined)
  → expired; otherwise → stale.

## Per-signal windows (in config; pending PS sign-off)
| Signal | fresh-until | stale-after | expire-after | Reasoning |
|---|---|---|---|---|
| weather | 1h | 3h | 12h | heat/humidity shift within hours; >12h is noise → climate normal |
| sleep | 12h | 36h | — | "last night"; usable into a 2nd day; never expired |
| hydration_verification (HydroScan) | 4h | 24h | 48h | optical point-in-time, most exertion-volatile; >48h → logs carry (PS: 4h) |
| profile | 90d | 180d | — | body model changes slowly; old → refresh nudge, never absent |
| camera_baseline | 30d | 90d | — | optical calibration drifts over weeks; stale → recalibration nudge |
| wearable_sync | 6h | 24h | 72h | last biometric pull; >72h stream is dark → phone/manual fallback |

Hard `expireAfter` only where a truly-old value is worse than none (weather,
HydroScan, wearable sync). Slowly-changing context degrades to `stale` and stays.

## Composition — the anti-double-count ruling (key deliverable)
§53 does **not** emit its own confidence signals. Doing so would count one signal
twice and could let a single fresh reading trip the ≥2-verified HIGH band alone.
Instead freshness **downgrades** the §54 rating via a floor, before the bridge:

```
effective = min(sourceRating, freshnessCeiling(freshness))
```

Ceiling: fresh→excellent (no cap), aging→good, stale→limited, expired→unavailable.
So a **stale Phantom reading (excellent source) reads as `limited`** — capped for
age, counted once. `min` guarantees freshness can only lower, never promote.

## Boundary / off-limits
Reads timestamps only; never the source id (§54) or profile fields (§55). No
`scoringEngine.ts` touch, no score reweighting. Pure/deterministic; `now` passed in.

## Sign-offs owed
- **performance-scientist** signs off the fresh/stale/expire windows (physiological
  currency) before they're relied on — biased conservative because too-loose is the
  dangerous direction (stale data reading fresh → overconfidence on old data).
- **cybersecurity-engineer** confirms `fetchedAt` handling at WIRING time (the pure
  layer collects/transmits nothing — the collection surface is the future consumer).
