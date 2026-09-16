# AF-SI-001A — Skin Intelligence Phase 1 internal approval

**Status:** approved for implementation in the internal TestFlight cohort only  
**Effective date:** 2026-09-16  
**Authority:** AF-SI-001A and its implementation amendment

## Permitted Phase 1 observations

Only these visible, non-medical observation identifiers may be emitted by the
internal pipeline:

- `VISIBLE_DRYNESS`
- `VISIBLE_FLAKING`
- `VISIBLE_REDNESS`
- `VISIBLE_SURFACE_SHINE`
- `VISIBLE_TEXTURE`

All other appearance, physiological, wellness, medical, diagnostic, scoring,
or clinical outputs are prohibited. This includes hydration, brightness,
fatigue, under-eye analysis, acne, pigmentation, wrinkles, skin age, disease,
and any appearance-derived wellness score.

## Internal implementation boundary

The internal TestFlight cohort may exercise the approved ephemeral pipeline:
capture, technical quality assessment, an observation pipeline, personal
baseline comparison, member UI, feature flags, privacy controls, and
privacy-safe telemetry. External beta, public beta, App Store release, public
demonstrations, and marketing claims remain prohibited.

Raw images are volatile-memory-only. They are never written to disk, uploaded,
backed up, retained, exported, used for training, or sent through analytics.
Only permitted derived observation records, quality metadata, timestamps, and
baseline-comparison metadata may be retained under the member-data policy.

## Member language and confidence

The internal member experience may use only approved visible-appearance
language, including comparisons to the member's recent baseline. The only
confidence bands are `HIGH`, `MODERATE`, `LOW`, and `UNABLE_TO_DETERMINE`; no
numeric confidence or score is displayed. Any insufficient-quality or
insufficient-confidence outcome returns a non-result.

## Release gate

Formal validation is required before any promotion beyond the internal
TestFlight cohort. The repository must contain the validation package covering
the approved device, lighting, Fitzpatrick I–VI, repeatability, quality,
false-positive, false-negative, and confidence-threshold evidence before an
external beta, public beta, App Store submission, or production release.
