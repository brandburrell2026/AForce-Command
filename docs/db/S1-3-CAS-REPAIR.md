# S1-3 · `advanceConsent` compare-and-set repair

## The defect

`advanceConsent` is declared the single authority for `decision_seq`, and its
compare-and-set is what makes this true:

> a device holding a stale local state cannot re-grant consent the member
> revoked on another device

It was not a compare-and-set. `readConsentTx` took a plain `SELECT` with no
`FOR UPDATE`, and the `UPDATE`'s affected-row count was never inspected.

Reproduced deterministically on real PostgreSQL 18.4, default isolation
(`read committed`), replaying the exact statements the function issued:

```
seeded: m1 granted, decision_seq = 1
default isolation level: read committed

A reads decision_seq = 1  -> guard passes (expectedSeq 1)
B reads decision_seq = 1  -> guard passes (expectedSeq 1)
  ^ BOTH transactions are now past `current.decisionSeq !== args.expectedSeq`

A UPDATE rowCount = 1  (won)  -> A returns ok:true, seq 2
B UPDATE rowCount = 0  (lost) -> but the code NEVER INSPECTS rowCount,
                                 so B also returns ok:true, seq 2

state:    granted=false decision_seq=2
evidence: [{"action":"revoke","decision_seq":2,"n":2}]

VERDICT: both callers were told ok:true — 1 row actually changed.
         evidence rows written for seq 2: 2 (one describes a decision that
         never applied).
```

Under READ COMMITTED the loser's `UPDATE` blocks on the winner's row lock and,
when the winner commits, PostgreSQL **re-evaluates the WHERE clause against the
new row version** — so it matches nothing. The loser, never having looked,
returned success.

**Harm.** The success payload was built from the *request*, not re-read from
the row. Two devices at the same seq, one granting and one revoking: both are
told `ok: true`. If the revoker loses, its device is told the revoke succeeded,
the server still says granted, and on the next reconcile that device adopts
`granted: true` and resumes collecting — on a device where the member pressed
revoke and was told it worked. The opposite pairing is caught by the ingest
gate, which reads the real row. So the harmful direction is a **lost revoke**.

The evidence log — the legal artifact — also gained a row describing a
transition that never happened.

## Why the existing law did not catch it

`analyticsIdentityRepo.drizzle.test.ts`'s *"RACE · two concurrent decisions
from the same seq"* fires two `advanceConsent` calls under `Promise.all` and
hopes the loser's `SELECT` lands before the winner's `COMMIT`. Usually it does
not — the loser reads the already-committed value, the guard fires correctly,
and the law passes. It was green on the PR that introduced the defect and red on
main. A coin toss reported as a verdict.

## The repair

Two mechanisms. They are **not** redundant — they answer different questions,
and each is proven by its own assertion and its own mutant.

| Mechanism | Question it answers | Failure without it |
|---|---|---|
| `FOR UPDATE` on the decision read | **what the loser is told** | the loser reports the stale seq it read; a client reconciling against a stale seq retries the same losing expectation forever |
| affected-row check | **whether the loser is told it won** | the loser gets `ok: true` for a write that never happened — the original defect |

Specifics:

- **`lockConsentTx`** is a new, separate function. `readConsentTx` is deliberately
  left unlocked because it also serves `readConsent`, which answers
  `GET /analytics-consent`; making it lock would put a row lock on every read of
  a member's consent state, so an ordinary poll could block a decision. Locking
  belongs to the transaction that intends to write.
- **The CAS now lives in the `UPDATE`'s own `WHERE` clause**, with `RETURNING`,
  so the test and the application are the same statement and cannot disagree.
  The redundant pre-check against `expectedSeq` is gone.
- **The first-decision path** uses `insert … on conflict (user_id) do nothing
  returning …` — the insert itself is the test — matching the idiom already used
  by `resolveAnalyticsIdentity`. A refused insert re-reads under the lock so the
  loser still receives canonical state, instead of raising a primary-key
  violation and surfacing as a 500.
- **Evidence is appended only after the update is confirmed applied**, so the
  append-only log can never describe a transition that did not happen.

## Proof: the interleaving is forced, not raced

`lib/db/src/__tests__/advanceConsentCas.drizzle.test.ts` — real PostgreSQL, and
the contended window is reached on every run:

1. a third connection takes the row under `FOR UPDATE` and becomes the winner;
2. the loser's **real** `advanceConsent` is launched;
3. the harness polls `pg_stat_activity` until that backend is genuinely
   `wait_event_type = 'Lock'` — and **throws** if it never blocks, so a law
   whose window was not reached fails rather than passing for the wrong reason;
4. only then does the winner apply its transition and commit.

The loser therefore always resumes into exactly the window the old code got
wrong. Same verdict on every run, on any machine, at any speed.

### Founder-required cases

| Required case | Where | Result |
|---|---|---|
| grant vs revoke from the same seq | forced-interleave, `winner=grant loser=revoke` | pass |
| revoke vs grant | forced-interleave | pass |
| grant vs grant | forced-interleave | pass |
| revoke vs revoke | forced-interleave | pass |
| evidence row count matches applied state transitions exactly | every forced case asserts the full ordered log `["1:grant", "2:<winner>"]` | pass |
| non-concurrent positive control still works | `POSITIVE CONTROL` describe | pass |

Additional laws in the same file: two first decisions at once (the insert-path
race, also forced); a stale expectation refused with no contention at all; and
four genuinely-concurrent `Promise.all` pairs as an end-to-end check — kept, but
explicitly *not* the proof.

### Requirement coverage

| # | Requirement | Satisfied by |
|---|---|---|
| 1 | the decision transaction locks the operative row | `lockConsentTx`, `for update` |
| 2 | the CAS `UPDATE` result is checked | `applied.length !== 1` |
| 3 | a loser must not receive `ok:true` | asserted in all four forced pairs |
| 4 | a loser must not append evidence | `appendEvidence` moved after confirmation; asserted by the full ordered evidence log |
| 5 | exactly one applied decision | asserted in forced and unforced laws |
| 6 | the loser receives the canonical current state | `expect(result.current.decisionSeq).toBe(2)` |

## Mutation matrix

`scripts/mutate-cas.sh`. Positive control green first (50/50); every mutant
asserts its own patch applied; the exit code is captured as the first statement
after each run. The harness also records **which** assertion caught each mutant
— an independence check, because two barriers that mask each other prove
neither.

| # | Mutation | Result | Killed by |
|---|---|---|---|
| MA | `FOR UPDATE` removed from `lockConsentTx` | **KILLED** | *"the loser must receive the CANONICAL current state"* |
| MB | the CAS affected-row check removed (the original defect) | **KILLED** | *"a caller that lost the CAS must not receive ok:true"* |
| MC | the first-decision insert result not checked | **KILLED** | *"the losing first-decision must not report success"* |
| MD | evidence appended before the update is confirmed | **KILLED** | *"the append-only consent log must never describe a transition that did not happen"* |
| ME | **non-vacuity control** — `advanceConsent` refuses everything | **KILLED** | 21 laws including `POSITIVE CONTROL · an UNCONTENDED decision still applies` |

**5 killed, 0 survivors.** MA–MD were each killed by their *intended* assertion,
which is the result that matters: the lock and the row-check are independently
proven and neither is masking the other. ME is killed by 21 laws — the harness
flags it as "not the intended assertion" only because the parameterised cases
seed a decision first and that seed assertion fires before the named one; the
positive control does go red, which is the intended kill.

## Verification

| Check | Result |
|---|---|
| db-lane (real PostgreSQL 18.4) | 147 passed / 13 files (was 136 / 12) |
| full unit suite | 9,578 passed, 0 failed |
| typecheck — `lib/*`, api-server, aforce-os | clean |
| secrets guard / governance drift | pass |

## Blast radius

`advanceConsent` has one production caller, `POST /api/aforce/analytics-consent`,
and its return shape is unchanged: `{ok:true, state}` or `{ok:false, current}`,
which the route maps to 200 or a 409 carrying `current`. No schema change, no
migration, no DDL. The client's 409 handling now receives canonical state, which
is what makes its conflict re-issue terminate instead of looping.
