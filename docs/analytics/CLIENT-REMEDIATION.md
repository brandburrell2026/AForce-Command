# Lane 2 — client analytics remediation

Six release blockers from the post-merge audit of #955, plus the law and
documentation repairs the audit's completeness critic found.

Three of the six **failed open** — they could leave a member collected after
asking not to be. Those are the ones that mattered.

---

## A · A failed delete-my-data now fails closed

**Before.** `deleteMyData` cleared local state in a `finally`, and
`forgetAnalyticsIdentity` throws on any non-2xx or transport failure. So:

```
delete requested → server failure → local state cleared (no ceiling left)
                 → next reconcile re-adopts the server's untouched grant
                 → collection resumes, switch visibly flips back ON
```

with no error shown, because the UI swallowed the throw. Reproduced: `emit`
returned `true` and the row rendered `{"status":"settled","granted":true}` for a
member who had asked to be erased. It was a **regression** — the previous
implementation's `finally` called `revokeConsent()`, which persisted a durable
local `{granted:false}` that was the operative gate.

**Now.** `requestErasureCeiling()` writes a durable pending REVOKE *before* the
request leaves — phase 1 synchronous, like `recordDecision`, so it is operative
against a concurrent emit immediately. The failure is not caught, so it reaches
the caller and the UI renders `delete_failed_note`. Local authority state is
dropped only on a **confirmed** erasure.

If the erase is never confirmed the record survives the restart, the gate stays
closed, and the revoke reaches the server on the next reconcile — which is what
the member asked for anyway. Proven across a simulated restart (**LAW R4**).

## B · An unreadable pending record is not permission

**Before.** `loadPending` returned `null` for a storage fault, a JSON error, and
a genuinely absent record alike — so unreadable bytes that might have said
"revoke" silently became "no ceiling", and the next reconcile re-adopted the
server's grant. `hydrate` then latched `hydratedFor`, so it was never re-read.

**Now.** `PendingLoad` is a discriminated result — `absent | record |
unreadable` — and `unreadable` sets a ceiling the gate honours
(`effectiveGranted(..., unreadable)`), surfaces a recoverable `unreadable` UI
state, and deliberately does **not** latch, so a transient fault recovers on the
next read. A real decision replaces the bytes and clears it (**LAW R5**, **R2**).

## C · `publishPending` has the guard `hydrate` always had

**Before.** It captured `p = pending`, awaited the POST, then wrote back
unconditionally — so a decision the member made during the round trip was
erased from memory *and* disk by the older snapshot's success handler. A
pending REVOKE could be wiped by an in-flight GRANT completing.

**Now.** `publishSeq` is captured after installing `inflight` and every
write-back is conditional on it. A superseded publication adopts whatever the
server said — that is still true — and leaves the pending record alone
(**LAW R6**).

## D · The consent deadlock

**Before.** `consentUiState` returned `unknown` whenever `adopted === null`,
which disabled the switch — and the switch is the only control that calls
`recordDecision`, which is the only thing that reaches the server and populates
`adopted`. A first-time member could never leave the state that was disabling
their only way out of it. Combined with the unmounted recorder (below), the
feature could not be turned on at all.

**Now.** That state is `unsynced` and is **actionable**: the switch is operable,
and `recordDecision` works with no adopted state because it bases its CAS on
`null` and reconciles from whatever the server answers. Nothing is auto-granted
or auto-revoked — asserted directly (**LAW R7**). The consent row also calls
`syncAnalyticsAuthority()` on mount, so the state usually resolves to `settled`
without the member doing anything. That is the consent screen refreshing its own
data, not a new app-wide lifecycle hook.

## E · The late-hydrate pseudonym clobber

**Before.** In `hydrate`, `pending` was guarded against a stale disk read and
`serverId`, one line below, was not:

```ts
if (pendingWriteSeq === writeSeqAtStart) pending = p;   // guarded
serverId = id;                                          // NOT guarded
```

A transient `signed_in_without_user_id` and recovery to the same member nulled
the hydrate latch without cancelling the in-flight read; with the isolation flag
off the generation never moves, so its token stayed valid and its stale `null`
landed on a live pseudonym. `hydratedFor` then latched, so the correct value on
disk was never read again. A granted member silently stopped emitting for the
rest of the process while the UI said analytics was on.

**This is the state the retracted M1/M3 "equivalent mutant" proof called
unreachable.**

**Now.** `setServerId` bumps `serverIdWriteSeq` and `hydrate` honours it. The
state `adopted.granted && serverId === null` with a valid id on disk is asserted
impossible after hydration settles (**LAW R3**).

## F · Suppression is terminal, and says so

**Before.** After a successful delete-my-data the member is suppressed
permanently, but `analytics_identity_suppressed` was routed to
`needs_resolution`, which renders a **"Try again" button that can never
succeed**.

**Now.** `identitySuppressed` is its own terminal state with its own copy and no
retry affordance; the switch is disabled because there is genuinely nothing to
decide; and `retryPendingDecision` refuses so a stale view cannot drive an
impossible request (**LAW R8**).

---

## Also repaired

**Disclosure-version blindness.** `conflictSatisfiesIntent` compared only the
boolean, so the day `DISCLOSURE_VERSION` is bumped a member re-granting under
the new disclosure would be short-circuited as already-satisfied, never POSTed,
and the server's evidence would permanently record the old text. It now compares
intent **and** disclosure version (**LAW R9**).

**Invented disclosure versions.** A record whose `disclosureVersion` was missing
or non-numeric was restamped with the current constant and POSTed as evidence —
the sentinel the server contract forbids. It is now `unreadable` (**LAW R10**).

**LAW C2 was certifying nothing.** It source-grepped for `subscribeUserScope(`
— a token that matches inside a comment, naming a listener that fires **zero
times** on an account switch while the isolation flag is off. `privacy_manager`
and `event_dispatcher` were stamped "resets its RAM on a scope change" on the
strength of a subscription that never ran. Both now use `subscribeScopeState`,
the law strips comments before matching, and the behavioural claim is driven end
to end in the production configuration.

**Three one-sided cache assertions.** With `saveServerId` stubbed to a no-op the
whole suite stayed green: nothing asserted the pseudonym cache was ever written
or read back, while three laws appeared to be about it. **LAW R1** writes it,
restarts the process with the server unreachable, and reads it back.

---

## Mutation matrix — 14 killed, 0 survivors

`scripts/mutate-lane2.sh`. Positive control green first (88/88); every mutant
asserts its patch applied; exit code captured first; the harness records which
assertion caught each.

| # | Mutation | Result |
|---|---|---|
| L1 | E — the `serverId` staleness guard removed | **KILLED** |
| M1 | **M1 made reachable again** (E guard removed + local mint) | **KILLED** |
| M3 | **M3 made reachable again** (E guard removed + placeholder id) | **KILLED** |
| L4 | C — `publishPending` stale-write guard removed | **KILLED** |
| L5 | B — a corrupt record read as "nothing pending" | **KILLED** |
| L6 | B — the gate ignores the unreadable ceiling | **KILLED** |
| L7 | 10 — a missing disclosure version restamped | **KILLED** |
| L8 | A — delete-my-data clears local state in a `finally` | **KILLED** |
| L9 | D — a first-time member renders `unknown` again | **KILLED** |
| L10 | F — suppression no longer renders terminally | **KILLED** |
| L11 | 9 — conflict ignores the disclosure version | **KILLED** |
| L12 | 2 — an unreadable read latches and never retries | **KILLED** |
| L13 | LAW C2 — `privacy_manager` reverts to the inert listener | **KILLED** |
| L14 | **non-vacuity** — the gate refuses everything | **KILLED** |

### On M1 and M3

They are recorded as **real, previously-uncovered paths** — the equivalence
claim is retracted in `CLIENT-TRANSITION-MUTATIONS.md`. Lane 2 fixes the
condition at its source rather than only detecting it, so a bare
synthesise-fallback is no longer reachable *because the guard exists*. Their
lethal mutations are therefore the composites above: remove the guard and the
fallback becomes live again, and the laws go red. **L1 kills the guard's removal
on its own**, so the guard is proven independently of the fallback.

No unreachable branch is claimed as proven anywhere in this lane.

---

## `initAnalytics` — the product consequence, returned rather than wired

`useAnalyticsRecorder` has **zero call sites**, and `git grep` on `45a1bcf2^`
confirms it had none before the client transition either. It is
**pre-existing**, not introduced here.

Its only caller would be `initAnalytics()`, which is the sole launch-time
`reconcile()` + `flush()`. The complete set of production callers that reach
`reconcile()` is now:

| caller | when |
|---|---|
| `AnalyticsConsentRow` → `syncAnalyticsAuthority()` | the member opens the analytics settings row |
| `recordDecision` / `retryPendingDecision` | the member makes or retries a decision |
| `initAnalytics()` | **never — its hook is unmounted** |

**The exact consequence.** `adopted` and `serverId` live in module memory and
are deliberately not cached on disk, so nothing is collected until a reconcile
populates them. With the recorder unmounted, that happens only when the member
opens the analytics settings row. So:

> analytics collect **only during a session in which the member visits the
> analytics settings row**, and nothing at all on any other launch. The outbox
> is never flushed at launch either — only opportunistically by `emit`.

This is fail-closed: no privacy risk, no data collected without consent. It is
purely a product-completeness gap.

**No lifecycle component was mounted.** Blocker D is satisfied without it — the
consent flow is reachable because the switch is operable and the row syncs
itself. Wiring the recorder is a separate decision with real runtime
consequences (a launch-time network call, a foreground hook, and account-switch
behaviour to design and test), and the ruling was to return the consequence
before wiring it. **Awaiting that decision.**

---

## Verification

| Check | Result |
|---|---|
| new remediation laws | 19 |
| full analytics + storage suites | 88 passed |
| mutation matrix | 14 killed, 0 survivors |
