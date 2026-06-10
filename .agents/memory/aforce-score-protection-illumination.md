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
