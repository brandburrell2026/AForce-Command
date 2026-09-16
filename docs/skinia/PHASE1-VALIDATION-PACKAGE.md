# SkinIA Phase 1 internal validation package

**Status:** required evidence before external beta or production.  
**Scope:** Internal TestFlight only; no raw images may be attached to this repository.

## Release evidence matrix

Record aggregate pass/fail counts and issue references only. Store no image, face, member,
device identifier, or biometric record here.

| Dimension | Required coverage | Evidence status | Owner | Notes / issue |
| --- | --- | --- | --- | --- |
| iPhone support | Supported iPhone generations | Pending | QA | |
| Android support | Supported Android flagships | Pending | QA | |
| Lighting | indoor, outdoor, warm, cool, low light | Pending | QA | |
| Skin-tone coverage | Fitzpatrick I–VI | Pending | QA / privacy reviewer | Aggregate only |
| Repeatability | same tester, comparable capture conditions | Pending | QA | |
| Quality acceptance | unsuitable captures fail closed | Pending | Engineering | |
| False positives | review by approved observation family | Pending | Product / QA | |
| False negatives | review by approved observation family | Pending | Product / QA | |
| Confidence policy | HIGH, MODERATE, LOW, UNABLE_TO_DETERMINE | Pending | Product | |

## Internal test protocol

1. Confirm the tester is entitled to the Internal TestFlight cohort.
2. Confirm consent, permission, quality-failure, cancellation, and cleanup paths.
3. Record only aggregate outcome counts and issue references.
4. Verify no raw image, file, URI, analytics payload, or crash payload is created.
5. Verify an observation is shown only for an approved vocabulary item, with a personal
   baseline and a permitted confidence outcome.

## Promotion gate

Every row must be marked complete, reviewed, and linked to its retained evidence outside this
repository before external beta, public beta, App Store submission, or production release.
