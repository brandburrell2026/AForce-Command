---
name: AForce Analytics Layer
description: Internal, no-UI analytics that powers the engine; the durable rules behind it.
---

AForce analytics is INTERNAL and has NO user-facing surface (build lock:
no tab/nav/dashboard). It exists to power the engine, honoring "Powerful
underneath. Simple on top." It mirrors the dailyWins/explainability
split: a PURE metrics module + a thin persisted recorder service.

**Durable rules (not derivable from a quick read):**

- Keep ALL analytics math in the pure metrics module. The persistence
  service and the recorder hooks import RN/AsyncStorage, which the vitest
  setup here cannot transform (same failure mode as the orbReasons test),
  so anything in those files is effectively untestable. Pure module = the
  only testable seam.
- Metrics map ONLY to real observed signals — never fabricate. Onboarding
  completion is recorded at the actual finish moment and is deliberately
  NOT backfilled, so users from before the feature shipped read as
  not-completed. That under-counting is intentional honesty, not a bug to
  "fix" with a backfill.
- Reminder "slots" are the Day 0/1/3/7 cadence slots, NOT calendar days.
  Response rate counts only responses to slots that were actually shown
  (intersection), so the rate stays within [0,1] even with stray or
  truncated events.
- The visible win banner and the analytics recorder MUST read the SAME
  win from the shared top-win hook. Do not reintroduce inline win
  derivation in the banner — divergence would mean "the win recorded" ≠
  "the win shown".

**Concurrency invariant (the subtle one):** every persisted append is a
read-modify-write and MUST go through the single in-module write queue.
**Why:** the home recorder fires multiple recorders on mount and the
notification banner can fire concurrently; without serialization they
read the same snapshot and clobber each other, silently dropping events
and corrupting every derived metric. Any new recorder must reuse the
queued append path, never write storage directly. This holds only under
the single-JS-runtime assumption; a background/multi-process runtime
would need a storage-level transaction instead.

**Emit-exactly-once-when-shown (the effect-fired variant):** an event
that must fire at most once the first time a surface is SHOWN — emitted
from a React effect — needs an in-memory in-flight/once latch IN ADDITION
to the persisted (AsyncStorage) dedupe key. React 18 strict-mode
double-invokes effects and the get-then-set dedupe is not atomic, so two
near-simultaneous calls both read "not yet emitted" and double-fire. The
persisted key handles cross-session dedupe; the in-memory latch handles
same-tick concurrency. Consent is checked INSIDE the guarded attempt and
the key is burned only after emit, so a pre-consent call doesn't lock out
a later consented emit. The once-per-DAY "reach" variant (e.g. the Territory
open signal) is the same rule with the dedupe key set to today's date string
instead of a permanent flag. **Caution:** older per-day emitters can use a
WEAKER pre-burn form that sets the key before confirming emit() queued and
has no in-flight latch — do NOT copy that template; it undercounts reach on a
failed write and double-fires under strict mode.

**Scope boundary:** the layer only records + derives and exposes a
metrics getter for the engine to read. Active consumption (e.g. adaptive
reminders reacting to response rate / time-to-first-win) is a later phase.

**Server-side emit path (Phase-1 backend events):** events the server
owns (receipt_verified/activated, subscription_started) are minted with a
DETERMINISTIC eventId (`evt_<sha256(seed)>`) seeded from a stable domain
key (the subscription id, scan id, etc.), NOT a random id. **Why:** that
is the only thing making them idempotent across Stripe webhook redelivery
and created-vs-updated double-fires — dedupe is `ON CONFLICT DO NOTHING`
on eventId, so a non-deterministic id would store duplicates. Subscription
emission listens to BOTH `customer.subscription.created` AND `.updated`
(an SCA/3DS sub is born `incomplete` and only flips active on a later
update); the deterministic id collapses both to one row.

**Pseudonymity guard at INGRESS, not just at insert (the privacy
trap):** the `anon_` analytics_id must be validated the moment it enters
the server (`analyticsIdFromHeader` rejects anything not matching
`^anon_[a-z0-9]+_[a-z0-9]+$`), because the checkout path writes it into
Stripe subscription metadata BEFORE any DB insert ever runs. Relying only
on the contract schema at insert time would let a hand-crafted request
park a Clerk `user_...` id in Stripe metadata. The header is the single
trust boundary — guard there.
