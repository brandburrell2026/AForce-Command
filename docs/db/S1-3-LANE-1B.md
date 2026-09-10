# S1-3 Lane 1b — the erase path's ledger invariant, and a law that flaked

Two narrowly scoped server-side corrections, both found while re-verifying
canonical main after the Lane 1 CAS repair merged.

---

## Item 1 · `forgetAnalyticsForMember`

### Root cause

Step 3 of delete-my-data — "record the consent state change through the single
sequence authority" — was the same defect `advanceConsent` had just been
repaired for, in the sibling path, untouched by that repair.

`analyticsIdentityRepo.ts:416-425` before:

```ts
const current = await readConsentTx(tx, userId);          // ← UNLOCKED read
if (current !== null && current.granted) {
  const nextSeq = current.decisionSeq + 1;
  await tx.execute(sql`
    update … set granted = false, decision_seq = ${nextSeq}, updated_at = now()
     where user_id = ${userId} and decision_seq = ${current.decisionSeq}`);  // ← CAS
  await appendEvidence(tx, userId, "suppress", current.disclosureVersion, nextSeq);
}                                                          // ↑ UNCONDITIONAL
```

Three faults compounding:

1. the read did not lock, so the sequence it returned could be stale by the
   time the update ran;
2. the update is a compare-and-set on `decision_seq`, and under READ COMMITTED
   PostgreSQL re-evaluates its `WHERE` against the new row version once the
   blocking transaction commits — so it can match zero rows;
3. nothing inspected the affected-row count, and evidence was appended
   regardless.

**Reachable in production**: a member taps delete-my-data on one device while a
consent decision lands from another.

### Observed, on real PostgreSQL 18.4

| | consent state | evidence ledger | identity |
|---|---|---|---|
| **contended (pre-repair)** | `granted: TRUE`, seq 4 | `…"4:grant", "4:suppress"` | suppressed, `analytics_id: NULL` |
| uncontended (control) | `granted: false`, seq 5 | `…"5:suppress"` | suppressed, `analytics_id: NULL` |

Collection still failed closed — a suppressed identity holds no pseudonym, so
the writer gate returns null regardless. This was never a leak. It was a **false
compliance record**: the ledger said a member was opted IN at the moment of
their own erasure, and claimed a revocation that never became operative, at a
duplicated `decision_seq`.

### The invariant

> The evidence ledger may never claim consent was revoked unless that
> revocation actually became operative in the authoritative consent state.

Executable as `assertLedgerHonest()` in the law file: no duplicated sequence,
sequences monotonic, and — whenever the ledger contains a `suppress` row — the
operative state is actually revoked **and** its `decision_seq` equals the
evidenced one.

### The repair, and why it is correct

```ts
const current = await lockConsentTx(tx, userId);          // ← takes the row
if (current !== null && current.granted) {
  const nextSeq = current.decisionSeq + 1;
  const applied = rowsOf<{ decision_seq: number }>(await tx.execute(sql`
    update … set granted = false, decision_seq = ${nextSeq}, updated_at = now()
     where user_id = ${userId} and decision_seq = ${current.decisionSeq}
    returning decision_seq`));
  const row = applied[0];
  if (applied.length !== 1 || row === undefined) throw new Error(…);
  await appendEvidence(tx, userId, "suppress", current.disclosureVersion, row.decision_seq);
}
```

**Linearizability.** `lockConsentTx` takes `FOR UPDATE` on the member's consent
row. Every writer of that row now serialises on it: `advanceConsent` (both
paths) and this erase. Once acquired, PostgreSQL guarantees no other
transaction can modify the row until this one ends, so the sequence read under
the lock is the committed truth and the CAS below cannot be stale. The
transaction's effect on the consent row is therefore atomic with respect to
every other writer, and the order of any two operations is the order in which
they acquired the lock.

**Evidence describes what actually happened.** The sequence written to the
ledger is the one `RETURNING` handed back — the value the database wrote — not
one computed in advance.

**Fail-closed.** A violation aborts the whole transaction: the member is not
suppressed, no evidence is written, and the caller is told it failed. An
inconsistent record is worse than a retryable failure.

**Monotonic `decision_seq`.** Every writer derives `nextSeq` from a value read
under the lock, so sequences increase by exactly one per applied transition and
never repeat. Asserted directly.

**`readConsentTx` is now reachable from exactly one place** — `readConsent`, the
read-only public path behind `GET /analytics-consent`. Every write path locks.
It is deliberately left unlocked: locking it would put a row lock on every read
of a member's consent state, so an ordinary poll could block a decision.

### Lock ordering and deadlock

This is the only transaction in the file that locks two tables: **identities,
then consent state**. Nothing acquires them in the opposite order —
`advanceConsent` touches consent state alone; `resolveAnalyticsIdentity` and
`rotateAnalyticsIdentity` touch identities alone. No cycle, so no deadlock.

Asserted rather than trusted: 12 rounds of erase-vs-decision on the same member
plus a two-erase race, all under `Promise.allSettled`, asserting no rejection
matches `deadlock|40P01`. **No deadlock observed.**

### Laws — real PostgreSQL, interleaving FORCED

`lib/db/src/__tests__/forgetConsentLedger.drizzle.test.ts`, 8 laws. A second
connection holds the consent row; the erase is launched and **observed to block
on a live database lock** (`pg_stat_activity.wait_event_type = 'Lock'`) before
the decision is allowed through. `waitForBlocked` **throws** if nothing blocks,
so a law whose contended window was not reached fails rather than passing for
the wrong reason.

| Law | Result |
|---|---|
| contended with a real `advanceConsent` — still revokes, ledger honest | pass |
| **regression** — the exact pre-repair interleaving no longer forges evidence | pass |
| uncontended erase: revokes, advances seq by one, evidences once | pass |
| member who never consented — no invented evidence | pass |
| member already revoked — no second suppression row | pass |
| erase is idempotent — a second call adds no ledger row | pass |
| erase vs decision, 12 rounds — no deadlock | pass |
| erase vs erase — no deadlock, exactly one suppression evidenced | pass |

**These laws fail deterministically on the pre-repair code.** Restoring
`ed6dcb1c`'s `analyticsIdentityRepo.ts` (Lane 1 merged, erase still broken) and
running three times gave an identical `2 failed | 6 passed` every time:

```
AssertionError: pre-repair this was TRUE — a member left opted in at their own erasure
AssertionError: the ledger contains a duplicated decision_seq:
                ["1:grant","2:revoke","3:grant","4:revoke","4:suppress"]
```

---

## Item 2 · the pseudonym-minter law

### The defect in the old law

```ts
const a = mintAnalyticsId(), b = mintAnalyticsId();
let common = 0;
while (common < a.length && a[common] === b[common]) common++;
expect(common).toBeLessThanOrEqual(5);
```

`anon_` is exactly five characters, so the assertion reduced to *"the next hex
digit must differ"* — a 1-in-16 coin flip. Measured directly over 200,000
trials: **6.30% failure** (theory 6.25%), histogram
`{5: 187396, 6: 11810, 7: 751, 8: 37, 9: 5, 11: 1}`. That is why `db-lane` went
red on main at random.

It also did not test the property it named. Two random ids sharing a prefix is
evidence of nothing, and a timestamp-derived scheme with a coarse clock would
pass it whenever the clock happened to tick between the two mints.

### The replacement, and why it cannot flake

It does not sample the output at all, so there is no distribution to be unlucky
with. It removes the clock from the environment — `Date` (constructor, `now`,
`parse`, `UTC`), `process.hrtime`, `performance.now` all throw — and mints 200
ids. **An identifier that encodes mint time must read a clock to do so, and
every way of reading one throws here.** Pass and fail are decided by control
flow, not by chance: the false-failure probability is exactly zero.

A **control law** runs the actual previous client minter,
`anon_${Date.now().toString(36)}_${…}`, through the same trap and asserts it is
caught — so the law is proven non-vacuous rather than merely asserted to be.

Production behaviour is unchanged: `mintAnalyticsId` was not touched.

### Demonstration that the failure mechanism is gone

200 invocations of each law through the **identical** harness. The old law is
the control — "0/200" only means something if the harness can detect flake at
all:

| law | 200 runs |
|---|---|
| **new** — the minter never reads a clock | **0 / 200 failed — 0.00%** |
| **old** — common prefix ≤ 5 | **20 / 200 failed — 10.00%** |

P(0 failures in 200 | p = 0.0625) ≈ 2.5 × 10⁻⁶. The control's 10% is consistent
with the 6.30% direct measurement within binomial noise at n = 200; the 200,000-
trial figure is the precise one.

---

## Mutation matrix

`scripts/mutate-lane1b.sh`. Positive control green first (59/59); every mutant
asserts its own patch applied; the exit code is captured as the first statement
after each run; the harness records **which** assertion caught each mutant.

| # | Mutation | Result | Killed by |
|---|---|---|---|
| F1 | the erase reverts to the UNLOCKED read | **KILLED** | the affected-row guard's own throw — *"consent revocation did not apply; refusing to record evidence…"* |
| F2 | the evidence gate removed, lock still present | **survives** | — unreachable under the lock; see below |
| F3 | **composite** — lock AND gate removed (the pre-repair code) | **KILLED** | *"the ledger contains a duplicated decision_seq"* |
| F4 | evidence names a sequence that is not the operative one | **KILLED** | *"the evidenced suppression must name the sequence that is operative"* |
| F5 | **non-vacuity** — the erase never revokes consent | **KILLED** | the uncontended and regression laws |
| P1 | the minter replaced by a TIMESTAMP-derived scheme | **KILLED** | *"CLOCK ACCESSED"* |
| P2 | **non-vacuity** — the clock trap disabled | **KILLED** | the control law |

**6 killed, 1 survivor, and the survivor is labelled rather than explained
away.**

F2 is unreachable: while this transaction holds `FOR UPDATE` on the row,
PostgreSQL guarantees no other transaction can modify it, so a zero-row update
cannot occur. That claim rests on a **database guarantee**, not on enumerating
application code paths — which is exactly how it differs from the M1/M3
"equivalent mutant" argument this program published and had to retract.

F1 and F3 together show the gate is not dead weight. With the lock removed:

- gate present (F1) → the transaction **aborts loudly**, nothing is written, no
  corruption;
- gate removed (F3) → **silent** corruption, the pre-repair behaviour.

So the lock prevents the condition, and the gate guarantees that if the lock is
ever removed the failure is loud rather than silent. That is the whole claim
made for it.

---

## Verification

| Check | Result |
|---|---|
| db-lane (real PostgreSQL 18.4) | **156 passed / 14 files** (was 147 / 13) |
| full unit suite | **9,578 passed, 0 failed** |
| typecheck — `lib/*`, api-server, aforce-os | clean |
| secrets guard | pass (2,692 files) |
| governance drift | pass |
| new minter law, 200 runs | 0 failures |
| deadlock probes | none observed |

## Blast radius

`forgetAnalyticsForMember` has one production caller,
`POST /api/aforce/analytics-identity/forget`, and its return shape
(`{deleted, status}`) is unchanged. `mintAnalyticsId` is untouched. **No schema
change, no migration, no DDL.**
