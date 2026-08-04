# Garmin — Engineering Readiness (Dormant)

**Last verified:** 2026-08-03
**Status: DORMANT.** No partner credentials exist. Garmin is not on the
`STAGE-LADDER.md` ladder at all — this directory tracks engineering
readiness only and makes **no validation claims**. Nothing here means
Garmin is closer to shipping; it means the plumbing has been proven to
work against documented (unverified) wire shapes so that activation is a
credentials-and-verification problem, not an engineering one.

## Why Garmin is separate from `docs/health/validation/`

The Phase-4 validation program (`docs/health/validation/`) exists to move
a provider from INTEGRATION-VALIDATED to DEVICE-VALIDATED using real
devices and real accounts. Garmin cannot enter that program yet — there is
no partner account, no verified endpoint, and per
`lib/health-core/src/contracts.ts`'s `HEALTH_PROVIDER_CAPABILITIES.garmin`,
`requiresExternalApproval: true`. Running a validation runbook against
unverified endpoints would produce evidence about a fiction, not a
provider — worse than no evidence, because it could be mistaken for real
validation later. This directory exists to keep Garmin's real progress
(engineering readiness) visible without contaminating the validation
program's evidence bar.

## What's proven today

`artifacts/api-server/src/lib/garminMock/` (lanes G1/G2) proves the
mapping → normalization → canonical-contract pipeline already works end to
end against documented Garmin wellness-summary shapes:

- `garminMock.fixtures.ts` — deterministic fixture payloads modeled on
  Garmin's documented `/dailies`, `/sleeps`, `/hrv` fields.
- `garminMockAdapter.ts` — a drop-in `GarminSnapshotFetcher` (the exact
  seam `RunGarminFetchOnceDeps.snapshotFetcher` expects) backed by
  fixtures instead of a live HTTP call, calling the REAL unmodified
  `fetchGarminSnapshot` — never a reimplementation of the mapping.
- `__tests__/garminMock.test.ts` — 9 contract tests in 4 groups confirming the
  known field-name drift (`hrvMs`, `stress`) survives correctly through
  `@workspace/health-core`'s `normalizeProviderSnapshot('garmin', ...)`
  onto the canonical `hrvRmssdMs` / `stressScore` fields, with zero
  Garmin-specific code changes needed at activation time.

See `MOCK-COVERAGE.md` for exactly what this does and does not prove.

## Everything in this directory

| Doc | Purpose |
|---|---|
| `README.md` | This file — scope and status |
| `MOCK-COVERAGE.md` | What `garminMock/` proves engineering-wise, and its explicit boundaries |
| `ENDPOINT-VERIFICATION-CHECKLIST.md` | Every unverified assumption in `garminSnapshot.ts` / `garminTokenManager.ts` that must be confirmed against the real Garmin Developer Program partner portal before writing a live fetcher |
| `WEBHOOK-ARCHITECTURE-PLAN.md` | The single highest-risk assumption in the current dormant code — Garmin's wellness API is documented as push/webhook-based, not poll-on-demand, meaning the current pull-shaped `fetchGarminSnapshot` may be the wrong integration pattern entirely |
| `ACTIVATION-GATES.md` | The three frozen gates (verbatim from `contracts.ts`) that must all be objectively true before Garmin can appear to any real user |

## The rule this directory exists to enforce

**No claim in this directory, or anywhere else in the codebase, may imply
Garmin is connected, verified, or available to users.** Garmin has zero
rollout cohort, zero device-validation evidence, and zero confirmed
endpoints. Any PR touching `garmin*` files that could be read as claiming
otherwise should be flagged for review rather than merged as-is — this is
exactly the kind of staleness this repo has already been burned by once
with retired-host documentation, and Garmin is dormant precisely because
premature claims here would be unusually hard to notice are wrong (no
partner account exists to disprove them against).
