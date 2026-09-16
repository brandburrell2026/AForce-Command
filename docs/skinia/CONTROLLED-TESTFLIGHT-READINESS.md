# SkinIA Visual Check — controlled TestFlight readiness

**Status:** engineering-readiness checklist only. This is not validation evidence, a public
release decision, or authorization to emit a live observation.

**Canonical name:** Advanced Visual Intelligence™  
**Member-facing label:** SkinIA Visual Check

## What is presently implemented

- A server-resolved, controlled-TestFlight cohort gate; public access fails closed.
- Consent, privacy, guidance, permission-denied, quality-insufficient, no-baseline, and
  consent-withdrawn UI shells.
- A static internal presentation fixture; it is not connected to a member route or data source.
- Pure quality, baseline, and ephemeral-cleanup contracts that default to non-results.

No shipped component in this scope requests camera permission, opens a camera, accepts visual
data, creates a file, stores a raw image, invokes a model, sends a network request, or emits a
live SkinIA observation.

## Required controlled-TestFlight configuration

The release owner verifies all of the following in the intended internal build and server
environment. Never put member IDs or any secret in client-visible configuration.

| Control | Required state |
| --- | --- |
| `EXPO_PUBLIC_INTERNAL_TESTFLIGHT` | `true` only for the internal TestFlight build |
| `advanced_visual_intelligence_enabled` | enabled only in that internal build overlay |
| `SKINIA_INTERNAL_TEST_BUILD_ENABLED` | `true` in the server environment used for the cohort |
| `SKINIA_INTERNAL_TEST_COHORT_MEMBER_IDS` | server-side allowlist of approved authenticated member IDs |
| Public-release server decision | locked / denied |

The member must satisfy every gate. A client flag, a demo profile, or a local UI state must never
override the server decision.

## Current QA checklist

Record the build number, device, tester, date, and outcome in the approved test record. Do not
attach raw images, screenshots containing raw imagery, device identifiers, or member data to the
record.

- [ ] A non-TestFlight build cannot enter SkinIA.
- [ ] An internal TestFlight build with the feature flag off cannot enter SkinIA.
- [ ] An internal TestFlight build with a non-entitled member cannot enter SkinIA.
- [ ] An entitled internal tester sees the consent and privacy explanation.
- [ ] Consent acknowledgement does not request an OS permission or start a check.
- [ ] Permission-denied, quality-insufficient, no-comparable-baseline, and consent-withdrawn
      surfaces remain plain-language non-result states.
- [ ] The static results fixture is unreachable from member navigation.
- [ ] Accessibility labels, readable contrast, and non-color-only state cues work with the
      supported screen reader and larger text settings.

## Live-observation admission blockers

Live capture and live observations remain blocked until every applicable requirement in
`docs/AFORCE_OS_ARCHITECTURE_V1.md` §25.3 has recorded evidence and approval, including:

1. a written definition for each candidate visible observation;
2. a named region, quality criteria, and capture-equivalence control that survives device
   auto-exposure and auto-white-balance;
3. calibration evidence across the required lighting, hardware, skin-tone, age, cosmetics,
   occlusion, motion, and compression conditions;
4. a stated confidence qualification, claims approval, and recorded validation status; and
5. independent review of the evidence before any observation family is admitted.

Until then, the only honest outcome is a non-result. The approved non-result states are
`UNKNOWN`, `NOT_ENOUGH_INFORMATION`, `CAPTURE_QUALITY_INSUFFICIENT`, and
`NO_COMPARABLE_BASELINE`.

## Public-release blockers

Public production remains prohibited until a separate explicit founder decision authorizes it.
That decision must follow the evidence and approval record above and confirm the final privacy,
claims, store-review, accessibility, incident-response, and rollback posture. This checklist does
not replace legal or scientific review and does not change the public-release lock in DR-015.

## Evidence hygiene

Raw images have zero persistent retention. They must not enter storage, databases, logs,
analytics, caches, backups, crash reports, observability, training, or identity/biometric systems.
For every success, failure, timeout, cancellation, consent withdrawal, or abandonment path, a
future implementation must delete the temporary raw image immediately and produce no result until
the relevant admission gate is met.
