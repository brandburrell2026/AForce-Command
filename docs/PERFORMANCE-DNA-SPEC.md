# §40 — Performance DNA™ Specification

**Status:** Architecture Only · Phase 2+ surface · **§42 gate blocking**
**Authorized by:** Founder Decisions 1, 4 and 5 · **Updated:** 2026-07-22
**Implementation status:** **Not implemented.** Phase 2 is documentation-only.

---

## 1. Purpose

Performance DNA™ is a **qualitative personal-pattern and insight system**. It surfaces the
durable, slow-moving patterns the §38 graph has established about this person — the stable signal
underneath day-to-day variation.

The name is metaphorical. **Performance DNA™ makes no genetic claim of any kind.**

## 2. Absolute prohibitions (Founder Decision 4)

Performance DNA™ must **never** produce:

- a single DNA score;
- a competing 0–100 score;
- a genetic interpretation;
- a fixed identity classification;
- a medical label;
- a biologically deterministic claim.

**HydroState™ remains the only hero metric** (Constitution Principle 2). This is the acute risk
for this system — a memorable single number would compete with HydroState directly. Tracked as
`OPEN-RISKS.md` **R-02**, severity S1, launch-blocking.

**Enforcement is structural, not editorial:** no numeric output type exists in the specification,
so there is nothing to render as a score (`INTELLIGENCE-VALIDATION-MATRIX.md` D-1).

## 3. Pattern states — the only permitted outputs

| State | Meaning |
|---|---|
| **Emerging Pattern** | Early signal; insufficient evidence to rely on |
| **Observed Pattern** | Repeatedly seen; usable with stated confidence |
| **High-Confidence Pattern** | Sustained across many observations and varied contexts |
| **Recalibrating Pattern** | Contradictory evidence accumulating; under revision |
| **Retired / Superseded Pattern** | No longer supported, or replaced by a better-evidenced pattern |

A pattern moves between states as evidence accumulates. States are **slow by construction** —
one contrary day never flips a High-Confidence Pattern, and the surface must not flicker.

## 4. Mandatory fields — every pattern, always

Founder Decision 4 requires all eight. A pattern missing any of them is not emitted.

| Field | Purpose |
|---|---|
| `supportingObservations` | The evidence for |
| `contradictoryObservations` | **The evidence against — never suppressed** |
| `confidence` | Derived, never asserted |
| `observationPeriod` | The window observed |
| `evidenceCount` | How many real observations |
| `lastEvaluation` | When it was last re-checked |
| `plainLanguageExplanation` | Principle 3, in the user's own data |
| `userControls` | Challenge and dismissal |

### 4.1 Contradictory evidence is non-negotiable

Showing evidence *against* a pattern is uncomfortable and there will be pressure to hide it
(`OPEN-RISKS.md` **R-10**). It stays. A pattern presented without its counter-evidence is a
confidence claim the data does not support, and it breaches Principle 10 — every recommendation
must make the next one *more* trusted.

### 4.2 User challenge and dismissal

The user can challenge or dismiss any pattern. This is a first-class control, not a settings
toggle. Principle 13: *your body teaches AForce OS* — the OS is never the one claiming to know
best, so the user must be able to say "that isn't me."

A dismissed pattern is retired and does not silently return.

## 5. Language

Register is **"your body taught us"**, inherited from §61.

| ✅ Approved | ❌ Prohibited |
|---|---|
| "Observed pattern: you respond strongly to early hydration." | "Your DNA score is 78." |
| "Emerging pattern — still gathering evidence." | "You are a heat-intolerant type." |
| "Recalibrating: recent days disagree with this pattern." | "Genetically, you…" |
| "Based on 34 observations over 90 days; 5 disagree." | *(hiding the 5)* |

Banned vocabulary and the §42 gate apply in full.

## 6. Hard constraints

| # | Constraint |
|---|---|
| 1 | **No numeric output type exists.** Not a score, not a grade, not a rank, not a percentile. |
| 2 | **Score Protection.** Advisory-only. |
| 3 | **No user-to-user comparison, ever.** Patterns are personal and are never ranked against others. |
| 4 | **Evidence Engine™ mandatory.** |
| 5 | **§42 gate blocking** before any user-facing output. |
| 6 | **No new navigation.** |
| 7 | Pure, RN-free, config-driven. |

## 6.1 Exposure sequence — settled by `DR-003`

Approved order. Each step is separately approved; reaching step *n* does not authorize step *n+1*.

| # | Surface |
|---|---|
| 1 | **Founder Mode inspector** (internal only, never Production) |
| 2 | **Weekly Performance Report beta** |
| 3 | **Profile → Your Body's Manual** (§61) |
| 4 | **AI Coach explanations** (§64) |
| 5 | **Selected Home insight card, behind a feature flag** |

**Hard rules:**

- **Never during onboarding.** A pattern requires accumulated evidence; onboarding has none, so any
  onboarding appearance would necessarily be fabricated.
- **Never merely because the backend exists** (Founder Decision 1).
- A pattern surfaces **only when its minimum evidence, observation-period, confidence and
  compliance gates are all satisfied** — per-pattern, not per-surface. A surface being live does
  not entitle an under-evidenced pattern to appear on it.

## 7. Reads

§38 edges over time. Nothing else. Performance DNA™ is a *view* of the graph's durable structure,
not an independent inference engine.

## 8. Validation

`INTELLIGENCE-VALIDATION-MATRIX.md` — universal V-1…V-8 plus D-1…D-7. **D-1 (no numeric output
type) is the Principle 2 gate.** All currently not started.
