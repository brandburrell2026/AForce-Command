---
name: AForce Score-Protection illumination
description: Today-scoped home/ritual UI must illuminate from today-scoped behavior, never from persistent last-known state fields.
---

# Today-scoped illumination must use today-scoped signals

Daily-progress surfaces (Daily Ritual rail, Today's Protocol, anything that
"lights up" as the user completes behavior) must derive completion ONLY from
behavior recorded *today* (e.g. `unitsConsumedToday`, today's events).

**Never key a today-scoped "complete" state off a persistent last-known field.**
Concretely: the ritual PAUSE step was once `urineSignal > 0`. But `urineSignal`
is a persistent last-known value — server default is `2`, and its API schema is
`int min 1 max 8`, so it is *never* 0 in production. Result: PAUSE was
permanently lit on every fresh day with zero user action. A unit test "passed"
only because it injected `urineSignal: 0`, a value the store can never produce.

**Why:** This silently violates the Score-Protection / no-fabrication contract
("a step is complete only because the underlying behaviour is on record"). It is
cosmetic (no score awarded) but still pre-illuminates progress the user never
made, which is exactly what the lock forbids.

**How to apply:**
- For any new home/ritual/protocol surface, ask: "does this field reset each
  day, or is it a carried-over last-known value with a non-zero server default?"
  If the latter, do not use it to gate today's completion.
- Prefer `unitsConsumedToday`, today's event list, or an explicit
  signal-recorded-today timestamp.
- When writing tests for these, use realistic store values (e.g. urine signal
  1–8, never 0) so the test reflects what production can actually emit.

# Provider "demo / preview" data must be DISPLAY-ONLY

Any wearable provider's demo/preview mode must render in a clearly-labeled card
and must NEVER be written into the score-consumed biometrics map. In this store,
`setProviderBiometrics(id, snap)` feeds `UserState.biometrics[id]`, which the
multi-provider score aggregator reads immediately — so passing a demo snapshot
there *fabricates score*. (Garmin originally did exactly this via `seedGarminDemo`
→ `setProviderBiometrics('garmin', demo)`; architect flagged it CRITICAL.)

**The pattern that passed review:** keep demo data in a *local component* state
(e.g. `garminDemoSnapshot`) used only for rendering, and gate the score channel
through a pure function — `garminScoreSnapshot(uiState, measured)` returns the
measured snapshot ONLY when `uiState === 'connected'`, else `null`. Entering demo
then calls `setProviderBiometrics(id, garminScoreSnapshot('demo', demo))` =
`null`, which both keeps demo out of score AND clears any stale contribution.

**Why:** display-only demo lets investors/owners preview the surface without ever
violating the Score-Protection lock. **How to apply:** for any future provider
demo, never reuse the generic mocked `toggleProvider → buildDemoSnapshot →
setProviderBiometrics` path (that path *does* seed score and is the legacy
WHOOP/other behavior); special-case the provider row and route every score write
through a pure connected-only gate, with a regression test asserting
`gate('demo', SNAP) === null` and `gate('connected', SNAP) === SNAP`.
