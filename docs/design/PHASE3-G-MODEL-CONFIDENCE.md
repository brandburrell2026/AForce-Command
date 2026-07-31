# Phase 3 · G — Model and Confidence Design

**Status:** DESIGN ONLY — nothing implemented. **Updated:** 2026-07-22

How confidence is derived, how uncertainty is expressed, and how conclusions are revised.
**All thresholds live in `config/hydroStateModel.ts`** (Build Rule 13).

---

## 1. Confidence principles

| # | Principle |
|---|---|
| 1 | **Confidence is derived, never asserted.** It follows from evidence count, distribution, consistency, and freshness. |
| 2 | **Absence is not evidence.** Missing data yields insufficient-data, never a favorable default. |
| 3 | **Contradictions reduce confidence; they are never discarded.** |
| 4 | **A claim that cannot state its confidence is not emitted.** |
| 5 | **Confidence is comparable only within a model version.** |
| 6 | Reuse the existing `utils/confidence/*` definitions — no parallel notion of freshness or signal quality (A16). |

## 2. Graph relationship confidence (§38)

Inputs: supporting observation count · contradiction count · distinct-day distribution ·
observation-period span · source freshness · signal quality.

Shape (coefficients in config):

```
raw          = support / (support + contradictions)
volumeFactor = min(1, support / CONFIG.fullConfidenceSampleSize)
spreadFactor = min(1, distinctDays / CONFIG.fullConfidenceDistinctDays)
confidence   = raw × volumeFactor × spreadFactor × freshnessFactor × qualityFactor
```

**Properties:** thin evidence cannot reach high confidence regardless of ratio; evidence clustered
in one day is penalized (`spreadFactor`) so a single unusual day cannot mint a pattern;
contradictions bite directly; staleness decays confidence without deleting the relationship.

The `BASELINE_CONFIDENCE` lifecycle in existing config (initial-after-recalibration,
per-observation gain, ceiling) is the established precedent this follows — deliberately, so
confidence behaves consistently across the OS.

## 3. Living Performance Model completeness (§61)

The LPM answers "how well does the OS know this person?" Completeness is **descriptive, not a
score** — Principle 2 forbids a competing hero metric, so completeness is never rendered as a
headline number.

Dimensions: category coverage (how many response categories have ready entries) · observation depth
· time span · source diversity · recency.

Feeds the **Confidence Journey** (§61) — the history of how confidence in the relationship has
grown, which is the mechanical expression of Principle 12.

## 4. Prediction confidence (§39)

Gates from `DR-003`, all config-driven: ≥7 days usable history · ≥5 comparable observations ·
≥3 distinct days · fresh context · sufficient signal quality · confidence ≥ floor.

### 4.1 State resolution

```
gates unmet, no context basis        → insufficient_data
gates unmet, context basis available → context_only        (MUST be labeled context-based)
gates met, confidence < calibrated   → emerging
gates met, confidence ≥ calibrated   → calibrated
```

**Collapsing `context_only` into a personal state is a trust breach** — it claims the OS learned
something about the person that it did not. Enforced by copy tests (Output J) and the §42 gate.

### 4.2 Calibration from outcomes

`aforce_prediction_outcomes` records `matched` / `diverged` / `unresolved`. Per prediction type,
observed match rate adjusts a stored calibration factor.

**Calibration adjusts future predictions only.** An issued prediction is never retroactively
edited — accountability requires the original stands as issued.

**Guard:** calibration must never inflate confidence past what evidence supports. It may only
**tighten** — a type that historically over-predicts gets damped; a well-calibrated type does not
get boosted beyond its evidence-derived ceiling.

## 5. Uncertainty expression

| State | User-facing register |
|---|---|
| `insufficient_data` | "Not enough data yet to say." — valid, expected, non-failure |
| `context_only` | Labeled context-based, explicitly not personal learning |
| `emerging` | Carries its emerging status |
| `calibrated` | Full confidence + provenance |

Uncertainty is **stated, never hidden**. A hedge that reads as certainty is worse than silence
(Principle 6: silence is itself a form of trust).

## 6. Performance DNA lifecycle (§40)

```
                    evidence accumulates
   (none) ──► Emerging ──► Observed ──► High-Confidence
                 │            │              │
                 │            ▼              ▼
                 │       Recalibrating ◄─────┘   contradictions accumulate
                 │            │
                 ▼            ▼
              Retired / Superseded
```

| Transition | Requires |
|---|---|
| → Emerging | Minimum evidence floor |
| → Observed | Evidence + distinct-day spread + confidence above threshold |
| → High-Confidence | Sustained across many observations **and varied contexts** |
| → Recalibrating | Contradiction rate crosses threshold |
| → Retired | Evidence gone/invalidated, sustained contradiction, or **user dismissal** |
| → Superseded | A better-evidenced pattern replaces it |

**Hysteresis is mandatory.** Promotion and demotion thresholds differ, so a pattern near a boundary
cannot oscillate. A single contrary day never flips a High-Confidence Pattern (validation D-5).
Every transition writes to `aforce_dna_pattern_history`.

## 7. Contradiction handling

| Rule |
|---|
| Contradictions are **counted and stored**, never discarded |
| **Always displayed** with the pattern — never suppressed (Founder Decision 4) |
| They reduce confidence and can trigger Recalibrating |
| Sustained contradiction retires the pattern |
| A pattern shown without its counter-evidence is a confidence claim the data does not support |

There will be pressure to hide this (`OPEN-RISKS.md` R-10). It stays.

## 8. Recalibration triggers

| Trigger | Effect |
|---|---|
| Major profile change | Baseline-relative conclusions invalidated; re-derive |
| Baseline recalibration | Confidence re-evaluated against the new baseline |
| Sustained contradiction | Pattern → Recalibrating |
| Major model version bump | Re-derive or retire — **never silently reinterpret** |
| Source deletion | Cascade (Output F §4) |
| User dismissal | Retire; does not silently return |

## 9. Model versioning

Per `governance/MODEL-VERSION-REGISTRY.md`: **major** = not comparable (re-derive or retire),
**minor** = comparable refinement. Every derived record stores its `model_version`; a record
without one is retired, never reinterpreted.

**If a major bump retires patterns a user has already seen, that is a surface change requiring
founder approval** — a pattern vanishing without explanation is a trust breach under Principle 10.
