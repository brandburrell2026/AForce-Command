---
name: AForce once-ever analytics emits
description: Idempotency ordering for once-ever / once-per-window analytics dispatcher emits (first_win_confirmed, session_started) in analytics/event_dispatcher.ts
---

# Once-ever analytics emit idempotency

Client analytics emits that must fire at most once (per identity, or per day)
gate on a persistent AsyncStorage flag in `analytics/event_dispatcher.ts`. The
flag must be burned **only after the event is durably enqueued**, never before.

**Rule:**
- `emit()` returns a boolean = "was the envelope durably written to the outbox?"
  (no consent / no analyticsId / failed storage write ⇒ `false`).
- A once-ever emitter (`emitFirstWinConfirmed`) sets its flag ONLY when `emit()`
  returned `true`. If `false`, leave the flag unset so a later trigger retries.
- Use a synchronous module-level in-flight latch set **before the first `await`**
  to collapse same-tick concurrent calls (the win recorder fires on every win).

**Why:** the original pre-burn ordering (set flag, then emit) loses the milestone
*forever* if analyticsId isn't ready yet / consent just toggled / the app dies
between the set and the enqueue — and a once-EVER milestone never gets another
chance. Server-side `min(occurred_at)` dedupes funnel *reach*, but that can't
recover a client event that was never sent.

**How to apply:** any new once-ever (or once-per-window) dispatcher emit.
NOTE: `emitSessionStarted` still uses the weaker pre-burn pattern, but its flag
is per-CALENDAR-DAY so a drop self-heals the next day; first-win is once-ever so
it got the durable ordering. Do NOT copy emitSessionStarted's ordering for a
once-ever event.
