# DR-005 — Data Retention Classes

- **Status:** ACCEPTED — settled. Closes **K-2**.
- **Date:** 2026-07-22 · **Decider:** Brandon (founder)
- **Note:** initial **product-policy defaults**, subject to legal, privacy and beta review
- **Related:** `DR-002`, `DR-004`, `governance/DATA-CLASSIFICATION-MATRIX.md`

---

## Decision

**Purpose-limited retention classes, not one universal retention period.**

| Class | Covers | Default retention |
|---|---|---|
| **R0** Transient computation | Temporary calculation inputs, in-memory prediction features, intermediate graph-building data | **Memory / job lifetime only.** Do not persist unless another approved class requires it. |
| **R1** High-frequency raw signals | Granular wearable samples, high-frequency sensor observations, temporary environmental samples, raw sync payloads after successful normalization | **90 days** |
| **R2** Normalized personal events | Workout / sleep summary, hydration intake, caffeine event, alcohol event, completed command, recovery event, daily environmental context, outcome observation | **24 months** |
| **R3** Daily/periodic derived features | Daily sleep feature set, hydration-response summary, heat-load summary, comparable-condition feature vector, privacy-minimized model input summary | **36 months** |
| **R4** Knowledge graph & model history | Graph relationships, confidence history, LPM snapshots, baseline/profile version references, pattern lifecycle history, model-change records | **Active while the account is active**; superseded versions **24 months** unless required longer for an active explanation, dispute, or model-validation process |
| **R5** Predictions & outcomes | Prediction record, predicted range, confidence, contributing factors, actual outcome, calibration result | **24 months** |
| **R6** User-facing insight history | Performance DNA patterns, Weekly Report insights, Your Body's Manual discoveries, user challenges/dismissals/feedback | **Active account lifetime** for current insights; retired/superseded **24 months** |
| **R7** Privacy, consent & security records | Consent version, permission decision, deletion request, export request, security event, key-rotation record | **TBD — LEGAL AND PRIVACY POLICY REQUIRED** |

## Class rules

**R1** — retain only when necessary for validation, reconciliation or model calibration; normalize
or summarize before expiration when longer-term learning is justified; **do not retain duplicate
vendor payloads merely because storage is available.**

**R3** — derived summaries must contain **less detail** than the raw source; provenance must
identify the source period and transformation version; summaries are invalidated or recalculated
when supporting source data is deleted. *This class exists so high-frequency raw records need not
be retained indefinitely merely to support model rebuilds.*

**R4** — a relationship without valid supporting evidence **may not remain active**; deleted
evidence must trigger invalidation, recalculation, or removal; historical records **must not be
used operationally** after their retention period expires.

**R5** — user-facing expired predictions may be removed sooner while retaining a minimized
calibration record where permitted.

**R6** — a dismissed pattern may remain internally marked as dismissed only where needed to respect
the user's preference and prevent immediate resurfacing.

**R7** — until approved, store the **minimum necessary metadata and no sensitive payload
contents**. **Do not assign a multi-year legal-retention period without counsel review.**

## Deletion override

**User deletion overrides ordinary retention**, except where a narrowly defined legal obligation
requires preservation.

```
source deletion
  → provenance review
  → graph relationship invalidation or recalculation
  → Living Performance Model recalculation
  → prediction review
  → Performance DNA review
  → Evidence Engine refresh
  → affected user-facing output withdrawal or correction
```

**No active derived record may survive when all of its supporting evidence has been deleted or
invalidated.**

## Account deletion

Phase 4 design and implementation must add an **account-wide deletion workflow**.
`POST /analytics/forget` is **not sufficient**.

Coverage required: canonical events · graph records · model snapshots · predictions · outcomes ·
patterns · **local encrypted caches** · exports in progress · pending synchronization records ·
derived data · provider identifiers where deletion is supported · deletion audit metadata
containing **no sensitive payload**.

## Open

**R7 retention remains unset pending counsel review.** This is the one class that cannot be
implemented to a fixed window today; until it is ruled, minimum-metadata-only applies.
