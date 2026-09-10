# Client analytics transition — mutation matrix

Every safety boundary in the lane, mutated in the production source, with the
result of running the law suites against the mutant.

Harness: `scripts/mutate-client-analytics.sh` (recorded verbatim at the bottom of
this file). Suites driven:

- `analytics/__tests__/clientAnalyticsTransition.test.ts` (the lane's laws)
- `analytics/__tests__/analyticsIdentityIsolation.test.ts`
- `analytics/__tests__/event_dispatcher.{territory,firstWin,perfAge,receiptScanned}.test.ts`

**Positive control**: the unmutated source is green before any mutant runs. The
harness aborts if it is not — a red baseline makes every MISSED meaningless and
every KILLED a false positive.

**Harness safety**: each mutant asserts that its patch actually changed the file,
and the exit code is captured as the FIRST statement after the run. Both guards
exist because both failure modes bit this program before: a `local` declaration
resetting `$?` in the PG18 lane, and — in this lane's first pass — a patch string
that omitted a trailing comment, so the mutant never applied and scored MISSED.

## Result: 23 KILLED / 2 MISSED (both classified EQUIVALENT, see below)

| # | Mutation | Result |
|---|---|---|
| M1 | The gate mints an id locally when the server has not issued one | **MISSED** — equivalent, see below |
| M2 | The gate ignores consent and returns the id regardless | KILLED |
| M3 | The gate emits under a placeholder id | **MISSED** — equivalent, see below |
| M4 | A pending revoke no longer restricts (client becomes a pure renderer of server state) | KILLED |
| M5 | The ceiling becomes symmetric — an unconfirmed offline GRANT opens collection | KILLED |
| M6 | The revoke ceiling is applied after an `await` rather than synchronously | KILLED |
| M7 | The pending decision is stored under one device-global key | KILLED |
| M8 | The server pseudonym is cached under one device-global key | KILLED |
| M9 | The account-switch barrier after the identity round trip is deleted | KILLED |
| M10 | The scope-change reset is deleted | KILLED |
| M10b | The reset regresses to `subscribeUserScope` (inert while isolation is off) | KILLED |
| M11 | A temporary session loss (401) is classified terminal | KILLED |
| M12 | A permanent refusal is classified transient — the infinite-retry mutant | KILLED |
| M13 | `needs_resolution` is auto-retried by `reconcile` | KILLED |
| M14 | The 409 re-issue bound is removed | KILLED |
| M15 | A never-decided server row satisfies an explicit revoke | KILLED |
| M16 | The decision is persisted only AFTER the request (a crash loses it) | KILLED |
| M17 | A refused batch (`{inserted: 0}`) stays queued and is retried forever | KILLED |
| M18 | A refusal is settled silently, with no count distinguishing it from delivery | KILLED |
| M19 | Legacy (foreign-id) envelopes are no longer filtered before sending | KILLED |
| M20 | The flush barrier is deleted — the outbox is settled after an account switch | KILLED |
| M21 | The legacy locally-minted id is adopted as the member's pseudonym | KILLED |
| M22 | A refused or suppressed member keeps a cached pseudonym | KILLED |
| M23 | `hydrate` clobbers a newer in-memory decision with the disk value | KILLED |
| M24 | **Non-vacuity control** — the gate refuses everything, always | KILLED |

## The two survivors are equivalent mutants, and here is the proof

M1 and M3 both add a fallback to the emission gate:

```ts
if (!effectiveGranted(adopted, pending)) return null;
return serverId ?? <something synthesised>;   // ← the mutation
```

The fallback is unreachable, because reaching it requires the state
`adopted.granted === true && serverId === null`, and no code path produces it.
Every assignment to either field, exhaustively:

| Site | `serverId` | `adopted` |
|---|---|---|
| `resetForScopeChange` | `null` | `null` |
| `hydrate` (disk) | from disk | *untouched* — stays `null` on a cold start |
| `reconcileOnce`, resolve OK | the server's id | the server's consent |
| `reconcileOnce`, terminal refusal | `null` | `{granted: false}` |
| `publishPending`, POST OK | *untouched* (already non-null) | the server's consent |
| `publishPending`, 409 stale | *untouched* (already non-null) | the server's current state |
| `clearLocalAuthorityState` | `null` | `{granted: false}` |

`adopted.granted === true` is only ever set by the two `publishPending` /
`reconcileOnce` success paths, and both of those run only after a successful
identity resolve, which sets `serverId` non-null in the same synchronous block.
Every path that nulls `serverId` sets `adopted.granted` to `false` in the same
block. So the fallback is dead code, and no behavioural law can reach it.

This is an argument about the code as it stands, and arguments like that expire
silently. So the coupling itself is now a law — *"the pseudonym and the adopted
consent are set and cleared TOGETHER"* — which drives a successful reconcile
followed by a deterministic refusal and asserts that the refusal clears **both**.
If a later change decouples them, that law goes red and M1/M3 stop being
equivalent.

Reported the same way the S1-3 `FOR UPDATE` survivor was: honestly, as
defence-in-depth that no test can reach, not as a covered boundary.

## What the matrix found

Two mutants exposed real defects in the implementation rather than gaps in the
laws, and both were fixed before this matrix was final:

1. **`reconcileOnce` read the member id and the scope generation at two
   different points**, straddling an `await`. An account switch in between
   produced a reconcile that authenticated as member B and wrote **B's pseudonym
   under A's storage key**, with the barrier reporting "still valid" because it
   was comparing against B. The member id now comes *from* the captured token,
   and the token is captured synchronously when the reconcile is *requested*.

2. **`flush` captured its token after the gate**, so the same switch could pair
   member A's pseudonym with member B's token. The token is now captured before
   the gate and re-validated after it.

Both are the recurring shape this repo keeps finding: two places deciding one
thing.
