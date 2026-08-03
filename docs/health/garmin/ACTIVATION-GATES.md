# Garmin Activation Gates

**Last verified:** 2026-08-03
**Source of truth:** `lib/health-core/src/contracts.ts`'s
`HEALTH_PROVIDER_CAPABILITIES.garmin.activationGates` — **verbatim, frozen
contract.** This file restates them for discoverability; if the two ever
disagree, `contracts.ts` wins and this file is stale and needs a PR to fix.

## The three gates (verbatim)

1. `DORMANT: partner credentials granted`
2. `endpoints verified against partner portal`
3. `health_garmin_enabled`

## What "all three objectively true" means

A Garmin row may not go user-visible, appear as a connect option, or be
described as available in any product surface, release note, or external
communication until **all three** gates are independently, objectively
true — not "probably true" or "true enough to demo":

1. **Partner credentials granted** — a real Garmin Developer Program
   partner account exists with usable client credentials. Presence
   confirmed the same way every other provider's credentials are tracked
   in `DEVICE-INVENTORY-TEMPLATE.md`: presence/absence only, never the
   credential value itself.
2. **Endpoints verified against partner portal** — every item in
   `ENDPOINT-VERIFICATION-CHECKLIST.md` is confirmed, including the
   webhook-vs-poll delivery-model question in
   `WEBHOOK-ARCHITECTURE-PLAN.md`. A green `garminMock/` test suite does
   NOT satisfy this gate — see `MOCK-COVERAGE.md`'s explicit list of what
   the mock does not prove.
3. **`health_garmin_enabled`** — the feature flag itself, which per
   `artifacts/aforce-os/featureFlags/flags.ts` is OFF in both DEFAULT and
   DEMO flag sets today, locked by
   `featureFlags/__tests__/healthFlagsDefaultOff.test.ts`.

## Relationship to `STAGE-LADDER.md`

Garmin is explicitly **not on the stage ladder** — see
`docs/health/validation/STAGE-LADDER.md`'s "Not on this ladder" table.
Clearing all three activation gates above doesn't put Garmin at
DEVICE-VALIDATED; it makes Garmin eligible to **enter the ladder at
CODED/UNIT-VALIDATED**, after which it climbs the same eight rungs every
other provider does, including its own full Phase-4 validation runbook
(which does not exist yet — write it once gate 2 is genuinely satisfied,
using the four existing runbooks in `docs/health/validation/` as the
template, not before).

## Who owns unblocking each gate

- Gate 1 (partner credentials) is a founder/partner-relations action, not
  an engineering task — tracked in `DEVICE-INVENTORY-TEMPLATE.md`'s Garmin
  section ("Partner-application state").
- Gate 2 (endpoint verification) is engineering work, but it cannot start
  meaningfully until gate 1 is at least in a state that provides sandbox
  or portal access.
- Gate 3 (the flag) is a one-line flip once gates 1 and 2 are both true —
  it is listed last because it is trivial, not because it is important
  last; flipping it before gates 1–2 are true would be the exact
  "mocks/documentation-only readiness mistaken for real readiness" failure
  this whole directory exists to prevent.
