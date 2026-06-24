---
name: AForce Performance Identity
description: Why Performance Identity ships as an INERT foundation — what is allowed vs forbidden until a classifier is explicitly approved.
---

# AForce Performance Identity — inert foundation

Performance Identity is the "what KIND of performer are you" archetype layer
(Operator / Warrior / Optimizer / Builder / Recoverer). It ships as a
**foundation only**: a stable archetype *vocabulary type* plus a pure
read-through that projects raw behavioural signals from
`UnifiedPerformanceMemory`. The classifier is deliberately **INERT**.

## The rule (do not break without an explicit new approval)
- `derivePerformanceIdentity` HARDCODES `archetype: null` and
  `confidence: null`. There is **ZERO** archetype-assignment logic: nothing maps
  a signal onto an archetype, nothing computes a confidence.
- `PERFORMANCE_ARCHETYPES` exists purely as the future target vocabulary and is
  **never referenced inside any derivation** — keep it that way.
- The internal readout card shows **raw signals, not verdicts**: the
  classification banner is unconditionally "NOT ASSIGNED (inert)" — it does not
  read `archetype`/`confidence`, so there is no display path that could ever
  render an archetype even if a derivation regressed.

**Why:** founder approved the *foundation + signal capture only* for beta and
explicitly required the verification report to be able to state "zero
archetype-assignment logic written." Activating the classifier is a separate,
explicitly-approved task — not an incidental edit.

**How to apply:** any future classifier work must come behind its own flag/review
and must keep the inert-path tests passing. The guardrails live in
`utils/__tests__/performanceIdentity.test.ts`: a strong-signal + permutation
sweep proving archetype/confidence stay null, plus a source-level structural
test that fails if an `archetype: 'Operator'|…` assignment string ever appears.

## Score-Protection & shape
Identity is observational like Performance Memory: pure core imports only types
(RN-free), no store/engine/dispatch, never reads-into/awards/mutates/fabricates
score. Signals are a faithful re-shape of the unified snapshot — empty sources
pass through as honest neutral values (0 / null / []), never invented.
