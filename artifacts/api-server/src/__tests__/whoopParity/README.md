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
| Snapshot | `/developer/v2/{recovery,cycle,activity/sleep}` with `limit=10`; `score_state` SCORED-selection (skips `PENDING_SCORE`); **flattened-shape tolerance** — a v2 response with no `score` wrapper maps identically to the nested shape; field mapping (`recoveryPct`/`strain`/`hrvSdnn` ← `recovery_score`/`strain`/`hrv_rmssd_milli`; sleep hours = `max(0, inBed − awake) / 3.6e6`); per-endpoint failure isolation; blank-token short-circuit (zero fetches) |
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
