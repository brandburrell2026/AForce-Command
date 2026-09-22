# SkinIA Phase 1 validation evidence record — template

Copy this file for each frozen build/model revision. **This template contains
no validation evidence.** Put aggregate results in the copy only. Never attach
raw images, screenshots containing a face, base64, frame URIs, participant
identifiers, device identifiers, or individual appearance/biometric records.

## Identity and pre-registration

| Field | Entry |
| --- | --- |
| Packet ID / date | PENDING |
| Test build / commit / native module revision | PENDING |
| Internal cohort and feature-flag verification | PENDING |
| QA executor and independent reviewer (work roles) | PENDING |
| Protocol and rubric version | PENDING |
| Supported device models / OS / camera generations | PENDING |
| Planned sample and repeat counts by stratum | PENDING |
| Pre-registered exclusions and minimum acceptance criteria | PENDING |
| Proposed quality and confidence thresholds | PENDING |
| Private QA working-record location and approved retention owner | PENDING — link to policy, not personal data |

## Coverage and quality (aggregate counts only)

Copy rows as needed for each approved device family, camera generation, and
condition. Include denominators; a blank or zero-trial stratum is `PENDING`,
not `PASS`. Do not publish a small cell if it could identify a tester.

| Stratum (device family × light × Fitzpatrick coverage) | Attempts | Accepted | Correct rejects | False accepts | False rejects | Ambiguous/excluded | Issue refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| PENDING | — | — | — | — | — | — | — |

Required coverage checklist: supported iPhone models; supported Android
flagships; multiple camera generations; indoor, outdoor, warm, cool, and low
light; Fitzpatrick I–VI; age ranges; facial structures; facial hair,
cosmetics, tattoos, eyewear, occlusion, motion, and compression.

## Observation performance

Create an aggregate table for **each** approved label, overall and stratified
by device family, lighting, and Fitzpatrick coverage. State the reference
rating method and its limitations. Do not count ambiguous references as
negative examples.

| Label | Stratum | TP | FP | FN | TN | Ambiguous reference | Quality rejected | False-positive issue refs | False-negative issue refs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `VISIBLE_DRYNESS` | PENDING | — | — | — | — | — | — | — | — |
| `VISIBLE_FLAKING` | PENDING | — | — | — | — | — | — | — | — | — |
| `VISIBLE_REDNESS` | PENDING | — | — | — | — | — | — | — | — | — |
| `VISIBLE_SURFACE_SHINE` | PENDING | — | — | — | — | — | — | — | — | — |
| `VISIBLE_TEXTURE` | PENDING | — | — | — | — | — | — | — | — |

## Repeatability and capture equivalence

| Measure | Pre-registered criterion | Aggregate result | Issue / limitation |
| --- | --- | --- | --- |
| Within-condition repeated capture agreement | PENDING | PENDING | — |
| Cross-session agreement | PENDING | PENDING | — |
| Auto-exposure / white-balance equivalence control | PENDING | PENDING | — |
| By-device and by-skin-type stability | PENDING | PENDING | — |

Cross-session brightness or color comparisons stay blocked until equivalence
is demonstrated, regardless of pooled agreement.

## Confidence, privacy, and failure paths

| Check | Method / denominator | Aggregate result | Verdict / issue |
| --- | --- | --- | --- |
| HIGH / MODERATE / LOW / UNABLE_TO_DETERMINE calibration | PENDING | PENDING | PENDING |
| Held-out threshold evaluation by label and stratum | PENDING | PENDING | PENDING |
| No-face, multi-face, poor light, blur, and occlusion fail closed | PENDING | PENDING | PENDING |
| Permission, cancellation, interruption, timeout, and withdrawal cleanup | PENDING | PENDING | PENDING |
| Sandbox, network, logs, analytics, crash, cache, and backup raw-image check | PENDING | PENDING | PENDING |
| Older binary / missing native module fails closed | PENDING | PENDING | PENDING |

## Issues, limitations, and sign-off

- Open issues and severity: PENDING
- Exclusions and missing strata: PENDING
- Known reference-label or measurement limitations: PENDING
- QA executor verdict (`PASS`, `PARTIAL`, `FAIL`, or `PENDING`): PENDING
- Independent reviewer verdict and date: PENDING
- Privacy reviewer verdict and date: PENDING
- Product/claims reviewer verdict and date: PENDING
- Engineering owner verdict and date: PENDING
- §25.3 family-admission decision reference: PENDING
- Intended release-stage authorization reference: PENDING

No individual packet may authorize a release on its own. See the
[promotion gate](REVIEW-AND-RELEASE-GATE.md).
