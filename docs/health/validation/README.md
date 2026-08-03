# Health Platform — Phase 4: Real-Device Validation

**Last verified:** 2026-08-03
**Owner:** Documentation Engineer (docs), qa-automation-engineer + squad leads (execution), independent reviewer (sign-off)
**Status:** Phase 4 not started. Every provider is currently CODED → INTEGRATION-VALIDATED at best (see `STAGE-LADDER.md`). No provider is DEVICE-VALIDATED.

> **Naming note:** "Phase 4" here is this validation program's own phase numbering
> (Phase 0 mocks/contracts → Phase 1 canonical layer → Phase 2 server provider-kit
> → Phase 3 internal/beta rollout → **Phase 4 real-device validation**). It is
> distinct from `governance/Phase-Roadmap.md`'s Phases 0–4 (product/feature scope),
> which is a different numbering scheme for a different axis of the roadmap. Do not
> conflate the two when reading governance docs alongside this directory.

## Objective

Prove — on physical devices and real provider accounts, not mocks — that AForce
truthfully connects to, ingests from, normalizes, attributes, displays, and can
fully disconnect/delete data from every health provider it claims to support.
"Prove" means captured evidence against the [15 acceptance criteria](ACCEPTANCE-CRITERIA.md),
reviewed by someone who did not do the work, before any provider is labeled
DEVICE-VALIDATED.

This program exists because the codebase's current state (verified 2026-08-03
against `governance/AFORCE_OS_HEALTH_SOURCE_MATRIX.md` and
`lib/health-core/src/contracts.ts`) is: real canonical contracts, real
normalization, real deduplication, and honest presentation logic — all validated
so far only by **unit and integration tests against mocked provider payloads**.
None of that proves the OAuth flow survives a real WHOOP account's token
lifecycle, that a real iPhone's HealthKit permission sheet behaves the way the
architecture assumes, or that a real Samsung Health → Health Connect sync
doesn't silently drop a metric type. Only real devices and real accounts can
prove those things, which is the entire reason this phase exists as a
distinct, gated stage between "integration-validated" and "enabled for any
real user."

## The iron rule

**No provider may be labeled validated without real-device or real-account
evidence. Mocks alone never validate.**

This applies without exception:
- A green `focused-health` CI run (`lib/health-core`, `artifacts/aforce-os/services/health`,
  `artifacts/api-server/src/__tests__/whoopParity`, `artifacts/api-server/src/lib/garminMock`)
  is necessary but never sufficient for DEVICE-VALIDATED.
- A working demo-data toggle (`health_demo_data_enabled`) is a UI/QA convenience,
  never validation evidence.
- "The unit tests pass" is not a sentence that appears in any PASS verdict in
  this program without an accompanying evidence packet (`EVIDENCE-TEMPLATE.md`).

## The six squads

| Squad | Scope | Runbook |
|---|---|---|
| **A — Apple** | HealthKit on a physical iPhone: authorization, sync, product surfaces, disconnect | [runbook-apple-healthkit.md](runbook-apple-healthkit.md) |
| **B — Health Connect / Samsung** | Android Health Connect on a physical device, with Samsung Health as the upstream origin | [runbook-health-connect-samsung.md](runbook-health-connect-samsung.md) |
| **C — Oura** | OAuth cloud provider, real Oura account + ring | [runbook-oura.md](runbook-oura.md) |
| **D — WHOOP** | OAuth cloud provider, real WHOOP account; parity-fixture-constrained | [runbook-whoop.md](runbook-whoop.md) |
| **E — Cross-provider matrix** | Multi-provider accounts on one device: dedup, provenance, priority-then-freshness selection, aggregator double-counting | See §5 of each runbook + `ACCEPTANCE-CRITERIA.md` criteria 5–6 |
| **F — Privacy / security / a11y / release** | Disconnect, revocation, deletion, redaction, accessibility, error/offline states, release-note accuracy | [REDACTION.md](REDACTION.md), [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md), [ROLLBACK-CHECKLIST.md](ROLLBACK-CHECKLIST.md) |

Squads A–D each own one provider end-to-end (auth → sync → truthfulness →
privacy → product surfaces). Squad E owns the interactions *between* providers
that no single-provider runbook can exercise alone. Squad F is cross-cutting
and gates every squad's PASS verdict, not just its own scope.

## Everything in this directory

| Doc | Purpose |
|---|---|
| `README.md` | This file — program overview |
| `runbook-apple-healthkit.md` | Squad A validation flow + full test-case checklist |
| `runbook-health-connect-samsung.md` | Squad B validation flow + full test-case checklist |
| `runbook-oura.md` | Squad C validation flow + full test-case checklist |
| `runbook-whoop.md` | Squad D validation flow + full test-case checklist |
| `EVIDENCE-TEMPLATE.md` | The per-validation capture form every squad fills out |
| `VERDICT-DEFINITIONS.md` | PASS / PARTIAL / FAIL definitions and what each requires |
| `DEVICE-INVENTORY-TEMPLATE.md` | What hardware/accounts/credentials each squad needs, tracked by presence not value |
| `REDACTION.md` | What evidence must never contain, and how to redact it |
| `REVIEW-CHECKLIST.md` | What the independent reviewer checks before a PASS stands |
| `ACCEPTANCE-CRITERIA.md` | The 15 verbatim criteria for DEVICE-VALIDATED |
| `ROLLBACK-CHECKLIST.md` | Per-flip rollback rehearsal before any cohort expansion |
| `STAGE-LADDER.md` | CODED → ... → LIVE, per provider, with current-state table |

Garmin is dormant and tracked separately: [`docs/health/garmin/`](../garmin/) —
engineering-readiness only, no validation claims (Garmin has no partner
credentials; see `lib/health-core/src/contracts.ts`'s `garmin.activationGates`).

Cross-cutting engineering process rules (review-before-merge, no mock-only
activation, post-merge verification) live in
[`docs/ENGINEERING-PLAYBOOK.md`](../../ENGINEERING-PLAYBOOK.md) — this program
inherits them, it does not restate them.

## What "done" looks like for Phase 4

Every provider in `STAGE-LADDER.md`'s current-state table advances from
INTEGRATION-VALIDATED to DEVICE-VALIDATED, each with: a filled `EVIDENCE-TEMPLATE.md`
packet, a PASS verdict per `VERDICT-DEFINITIONS.md`, and independent reviewer
sign-off per `REVIEW-CHECKLIST.md`. Nothing in this phase authorizes rollout
past DEVICE-VALIDATED — cohort expansion (internal → beta → staged production)
is a separate, later gate governed by `STAGE-LADDER.md`'s cohort-stage table
and `ROLLBACK-CHECKLIST.md`.
