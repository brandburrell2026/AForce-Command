# Provider Stage Ladder

**Last verified:** 2026-08-03
**Source for current state:** `governance/AFORCE_OS_HEALTH_SOURCE_MATRIX.md` §5,
`lib/health-core/src/contracts.ts` (`HEALTH_PROVIDER_CAPABILITIES`),
`artifacts/aforce-os/featureFlags/flags.ts` (all `health_*` flags default OFF).

## The ladder

Every provider climbs the same eight rungs, in order, with no skipping:

1. **CODED** — the provider's ingestion/normalization/presentation code
   exists in the codebase.
2. **UNIT-VALIDATED** — unit tests cover the provider's mapping,
   normalization, and dedup logic against fixture payloads.
3. **INTEGRATION-VALIDATED** — the provider's code is exercised end-to-end
   against realistic fixtures within the app/server (e.g. `focused-health`
   CI job, `whoopParity` suite, `garminMock` suite), still no real device or
   real account.
4. **DEVICE-VALIDATED** — all 15 `ACCEPTANCE-CRITERIA.md` criteria met with
   real-device or real-account evidence, independently reviewed. This is
   the gate this Phase-4 program exists to reach.
5. **INTERNAL-ACCOUNT ENABLED** — flag flipped on for founders' and
   employees' own accounts only, in production, under
   `ROLLBACK-CHECKLIST.md` rehearsal.
6. **LIMITED TEAM BETA** — flag flipped on for a small named cohort
   (10-person beta), still under rollback rehearsal per flip.
7. **STAGED PRODUCTION** — flag flipped on for progressively larger named
   cohorts (50-person beta, then Founding 250), each its own rehearsed flip.
8. **LIVE** — flag defaults ON for the general population.

A provider cannot skip a rung. A provider can be rolled back down the
cohort rungs (5–7) without losing its DEVICE-VALIDATED status (rung 4) if
the rollback was due to a cohort-specific or infrastructure issue rather
than a fundamental correctness gap — but any correctness gap found during
5–8 invalidates rung 4 until re-validated (see `VERDICT-DEFINITIONS.md`:
"a verdict is not permanent").

## Per-provider independent controls

Reaching a given rung is not one flag — it is eight independently gated
controls, and a provider can be ahead on some and behind on others. Track
each separately:

| Control | What it governs |
|---|---|
| Connection availability | Can a user even see the option to connect this provider (UI entry point present, not necessarily enabled) |
| Authorization | Does the OAuth/native-permission flow itself work |
| Ingestion | Does data actually arrive and get stored |
| Canonical normalization | Is the stored data correctly mapped to `CanonicalHealthRecord`/`ProviderSnapshot` shape, units, and HRV method |
| Product consumption | Do Connected Health / Home / Sleep / Weekly / Readiness / Evidence Engine read the canonical data (not a separate legacy path) |
| User-facing display | Does the presentation layer show truthful state (connected/stale/error/etc.) |
| Admin diagnostics | Can an admin/support engineer inspect this provider's sync health for a given user |
| Rollout cohort | Which cohort (if any) currently has this provider's flag on |

## Cohort stages (for the "rollout cohort" control, rungs 5–8)

```
founders → internal employees → 10-person beta → 50-person beta → Founding 250 → staged production
```

Each arrow is a separate flip, each flip requires a fresh
`ROLLBACK-CHECKLIST.md` rehearsal — a provider does not "graduate" through
these automatically just because the prior cohort had no incidents; each
step is a deliberate, evidenced decision.

## Current state — as of 2026-08-03

| Provider | Rung | Connection availability | Authorization | Ingestion | Canonical normalization | Product consumption | User-facing display | Admin diagnostics | Rollout cohort |
|---|---|---|---|---|---|---|---|---|---|
| Apple HealthKit | CODED → INTEGRATION-VALIDATED | native module present, `healthkit_native_enabled` OFF | not device-tested | not device-tested | canonical layer landed (1A); not device-verified | services/health consumers exist, integration-tested only | presentation logic tested against mocks only | not verified this pass | none |
| Health Connect / Samsung | CODED → INTEGRATION-VALIDATED | modeled `via_health_connect` only, `health_samsung_direct_enabled` OFF | not device-tested | not device-tested | canonical layer landed; HRV RMSSD-family mapping coded, not device-verified | integration-tested only | presentation logic tested against mocks only | not verified this pass | none |
| Oura | CODED → INTEGRATION-VALIDATED | token store + fetch worker present, `health_oura_enabled` OFF | OAuth2 flow coded, not device/account-tested end-to-end | fetch worker present | canonical layer landed; RMSSD attribution coded | integration-tested only | presentation logic tested against mocks only | not verified this pass | none |
| WHOOP | CODED → INTEGRATION-VALIDATED | token store + fetch worker present, `health_whoop_enabled` OFF (server-credential gating carve-out until PR 1B) | OAuth2 + PKCE flow coded; 27-test golden parity fixture pins the contract | fetch worker present | canonical layer landed; parity-fixture-pinned mapping | integration-tested only | presentation logic tested against mocks only | not verified this pass | none |

**None of the four active providers is DEVICE-VALIDATED.** All four
`health_*_enabled` flags are OFF in both the DEFAULT and DEMO flag sets,
locked by `featureFlags/__tests__/healthFlagsDefaultOff.test.ts` — no
provider has any rollout cohort today.

### Not on this ladder

| Provider | Status | Why excluded |
|---|---|---|
| Garmin | DORMANT | No partner credentials; endpoints unverified against partner portal. See `docs/health/garmin/` — engineering-readiness tracking only, this ladder does not apply until partner approval lands. |
| Strava | PARKED | `activationGates: ['PARKED: kept intact, not exposed', ...]` in `lib/health-core/src/contracts.ts` — code kept intact but deliberately not exposed; not in Phase-4 validation scope. |

## Updating this table

Every time a control advances for a provider (a new test suite lands, a
device-validation packet passes review, a cohort flip happens), update this
table in the same PR as the change that caused it — this table is a
snapshot of reality, not an aspirational roadmap, and a stale row here is
exactly the kind of stale documentation this program exists to prevent
elsewhere.
