# WHOOP golden parity fixtures (lane W1)

## Purpose

This directory pins the CURRENT (2026-08-03) hand-rolled WHOOP integration's
observable contract with exact-value assertions against the **real** modules
— never a reimplementation or a mock of the mapping logic itself. It exists
so the later kit-backed migration (W3 — replacing `whoopSnapshot.ts` /
`whoopPkce.ts` / `whoopTokenManager.ts` with `@workspace/health-core`'s
provider-kit plumbing) has a byte-parity target: replay
`whoopParity.fixtures.ts` through the new implementation and diff against
`whoopParity.test.ts`'s expectations.

**A red run here BEFORE W3 starts means the fixtures are wrong — investigate
before editing them.** A red run once W3 lands means W3 regressed something;
that is exactly the failure mode this suite is designed to catch.

## Files

- `whoopParity.fixtures.ts` — exported consts only, no test framework
  imports. Golden WHOOP wire payloads (nested `score` shape AND the
  flattened v2 variant), OAuth/PKCE constants, token-endpoint response
  shapes, and the hand-computed expected normalized snapshot.
- `whoopParity.test.ts` — the assertions. Organized by surface: PKCE,
  snapshot fetch/normalization, token manager, route contract.
- This README.

## Coverage pinned here

| Surface | What's pinned |
|---|---|
| PKCE | `state` length EXACTLY 8, `verifier` length EXACTLY 43, S256 challenge derivation, exact authorize param key set, exact scope string, authorize/token/API-base endpoint URLs |
| Snapshot | `/developer/v2/{recovery,cycle,activity/sleep}` with `limit=10`; selection predicate is `score_state==='SCORED' \|\| score!=null` (an OR — a PENDING_SCORE record WITH a non-null `score` IS selected, it is not excluded by label), **array-first** (first record in the collection matching the predicate — no recency/timestamp comparison, despite the source's "freshest" wording), UNSCORABLE (or any record failing the predicate everywhere) → all-null snapshot; **flattened-shape tolerance** — a v2 response with no `score` wrapper maps identically to the nested shape; field mapping (`recoveryPct`/`strain`/`hrvSdnn` ← `recovery_score`/`strain`/`hrv_rmssd_milli`; sleep hours = `max(0, inBed − awake) / 3.6e6`, awake defaults to 0 when absent, clamped ≥0 when awake > inBed); `num()` rejects non-finite/non-number values (string, NaN) → null; a `records` key absent entirely is tolerated; per-endpoint failure isolation; blank-token short-circuit (zero fetches) |
| Token manager | Refresh body includes `scope=offline`; the 60s skew boundary (`expiresAt − now === skew` refreshes, `skew + 1` does not); WHOOP's refresh-token-omitted-on-refresh behavior (keeps the prior one); null-on-failure |
| Route contract | `GET /whoop/status` returns exactly `{credentialsConfigured, connected, expiresAt}`; `GET /whoop/oauth/callback` tolerates unrecognized extra query params (schema is deliberately non-`.strict()`); state is single-use end-to-end (route level) and at the store level |

## Running

```
npx vitest run artifacts/api-server/src/__tests__/whoopParity
```

**Environment note (pre-existing, not introduced by this lane):**
`@workspace/db`'s module entrypoint (`lib/db/src/index.ts`) throws at
**import time** — not connection time — if `DATABASE_URL` is unset,
because it's the same package that provides `createInMemoryWhoopTokenStore`.
This suite never opens a real connection (`pg.Pool` construction is lazy),
but the import guard fires regardless. Every existing WHOOP test file that
imports `@workspace/db` (`whoopTokenManager.test.ts`, `whoopOAuth.test.ts`,
etc.) has the identical requirement — confirmed by running
`whoopTokenManager.test.ts` with `DATABASE_URL` unset (fails identically)
and with a dummy value set (passes, 17/17, no network). Set any
syntactically-valid dummy value before running:

```
DATABASE_URL="postgresql://user:pass@localhost:5432/db" \
  npx vitest run artifacts/api-server/src/__tests__/whoopParity
```

This suite is otherwise pure: no real DATABASE_URL is required to be
reachable, and no live network call is made — every HTTP boundary is
stubbed via each module's existing `fetchImpl` seam.

## Discoveries worth flagging (as of 2026-08-03)

- **`/whoop/status` and the callback's non-strict query tolerance had zero
  prior test coverage.** `routes/__tests__/whoopOAuth.test.ts` exercises
  `/oauth/start` and `/oauth/callback` thoroughly but never asserts the
  `/whoop/status` response shape or feeds the callback an unexpected extra
  query param. Both are now pinned here.
- The flattened-vs-nested v2 shape tolerance (`score ?? record` in
  `scoreSourceOf`) was previously tested only for a single provider
  (recovery-shaped) case inside `whoopSnapshot.test.ts`; this suite pins it
  across all three collections (recovery/cycle/sleep) against one shared
  expected-value fixture, which is the form W3 needs for a real diff.
- **The selection predicate is not "skip PENDING_SCORE" — it's an OR.**
  `scoreSourceOf`'s test at `whoopSnapshot.ts:91` is
  `r.score_state === "SCORED" || r.score != null`. A record whose
  `score_state` is `PENDING_SCORE` (or anything else) but which carries a
  non-null `score` object IS selected. The original test title and this
  README both previously described the behavior as "skips PENDING_SCORE",
  which is only true in the specific fixture where that record's `score` is
  also null — it is not a rule the source code encodes. Fixed here; see
  `WHOOP_RECOVERY_PENDING_WITH_SCORE_FIXTURE` and the dedicated predicate
  describe block in the test file.
- **Selection is array-first, not "freshest."** Despite whoopSnapshot.ts's
  comment describing `scoreSourceOf` as taking "the freshest SCORED record,"
  the function is a plain `for...of` loop with an early return on the first
  match — there is no date/timestamp comparison anywhere in it. If WHOOP
  ever returned a SCORED record out of chronological order, this code would
  silently take the wrong one. Pinned via a two-SCORED-record fixture where
  the first (not the numerically larger/"newer-looking") value wins.
- **`GET /whoop/status` with `CLERK_SECRET_KEY` set but no `clerkMiddleware`
  upstream returns 500, not 401/503.** `requireAuth` calls `@clerk/express`'s
  `getAuth(req)`, which throws when `clerkMiddleware()` hasn't run earlier in
  the pipeline. The real app (`src/app.ts:101`) always mounts
  `clerkMiddleware()`, so this never fires in production; this suite's
  router-only harness (matching every other test here) doesn't, so this
  specific combination surfaces as an unhandled-exception 500 with a leaking
  Clerk stack-trace HTML page. Separately: `requireAuth`'s `IS_PRODUCTION`
  constant is captured once at module-import time, before this test file's
  own `NODE_ENV` assignment runs — so the real fail-closed 401/503 paths
  cannot be exercised from any test in this file at all, under any
  `CLERK_SECRET_KEY` value, without a separate process pinned to
  `NODE_ENV=production` before import. See the dedicated test's comment for
  the full branch-by-branch trace.
