# DR-015 — SkinIA controlled internal/TestFlight build

**Status:** approved by founder — 2026-09-16  
**Scope:** Advanced Visual Intelligence™ / member-facing **SkinIA Visual Check**

## Decision

Advanced Visual Intelligence / SkinIA Visual Check is authorized for controlled
internal/TestFlight implementation and testing under the approved observation
vocabulary and zero-persistent-raw-image policy. Public production exposure
remains prohibited pending separate founder release authorization.

This decision is additive. It does not erase the historical restriction in
`docs/AFORCE_OS_ARCHITECTURE_V1.md` §25; it supersedes that restriction only
for the controlled cohort and only within the boundaries below.

## PR 1 boundary

This change establishes governance and fail-closed feature/cohort containment.
It does **not** add camera capture, image selection, image processing, model
calls, uploads, storage, baseline comparison, or member results.

Access requires all of the following:

1. an internal TestFlight build;
2. the dedicated Advanced Visual Intelligence build flag; and
3. a live, server-resolved entitlement for the authenticated member.

Public release is represented by an immutable server-side denial. No client
toggle, demo profile, or member entitlement can override it.

## Authorized observation vocabulary for later implementation

Only baseline-relative, visible, non-medical observations are authorized:

- `VISIBLE_DRYNESS`
- `VISIBLE_FLAKING`
- `VISIBLE_REDNESS`
- `VISIBLE_SURFACE_SHINE`
- `VISIBLE_TEXTURE`

Required first-class non-result states are `UNKNOWN`,
`NOT_ENOUGH_INFORMATION`, `CAPTURE_QUALITY_INSUFFICIENT`, and
`NO_COMPARABLE_BASELINE`. No numerical or composite SkinIA score is allowed.
SkinIA does not diagnose conditions or measure hydration; it cannot generate
commands or RecoveryCommand changes.

## Raw image policy for later implementation

Raw SkinIA images have zero persistent retention. They may exist only in
ephemeral processing memory and must be deleted/zeroed on success, failure,
timeout, cancellation, consent withdrawal, or abandonment. They may never
enter application storage, object storage, databases, logs, analytics,
caches, backups, crash reports, observability payloads, training datasets, or
biometric/facial-recognition systems. Derived non-image observations may be
retained only under existing member-data policy.

## Design and release constraints

Use Figma node `5:218` for the future capture flow. Node `5:193` may provide
layout inspiration only; its score, hydration inference, exposure claims, and
image-derived recommendations are prohibited. The controlled cohort is
TestFlight-only. Public production remains locked until a later, explicit
founder release decision.
