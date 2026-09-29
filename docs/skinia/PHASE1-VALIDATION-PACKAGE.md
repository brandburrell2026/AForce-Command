# SkinIA Phase 1 validation package

**State:** `PENDING — ACCURACY EVIDENCE NOT COLLECTED`

**Scope:** controlled internal engineering/QA testing only

**Authority:** [AF-SI-001A](../../governance/approvals/AF-SI-001A-phase1-internal-testflight.md) and its implementation amendment

**Last updated:** 2026-09-28

This is the source-of-truth index for the Phase 1 validation deliverable. It is a
collection plan, **not** a finding that SkinIA is accurate, fair, or ready to
show observations. The build 100 capture path derives versioned QA-only pixel
probes; it does not compute a label-specific score or emit a skin observation.
The admitted observation set in
[architecture §25.3](../AFORCE_OS_ARCHITECTURE_V1.md) remains empty.

## Current build and evidence status

| Item | Current state | Evidence still needed |
| --- | --- | --- |
| iOS internal build | Build 100 (AForce OS 1.0.0), EAS build `2707b256-3f5d-4452-9764-d2641c17e03b`, came from merged [PR #1065](https://github.com/brandburrell2026/AForce-Command/pull/1065) (`d4aec50c`). The tester-reported iPhone 17 Pro capture displayed `Capture check passed` and `OBSERVATIONS_NOT_ADMITTED`; `Back to SkinIA` returned to the overview. This is one device-flow QA observation, **not** a skin-accuracy result. | Frozen device/OS/light support cell, independent live reference, aggregate accuracy and quality evidence across the planned strata |
| Android module | Source implemented; native build/device behavior unverified | Build and physical-device records on supported Android devices |
| Image quality | Basic single-face, frontal, eye, exposure, and blur checks implemented | Acceptance/rejection performance by condition and skin type |
| Observation candidates | Five authorized labels, but no label-specific candidate is emitted by build 100's capture path; its pixel probes are QA-only and not member-visible | Reference-label protocol, versioned label-specific score, accuracy and repeatability evidence |
| Capture equivalence | Not established | Evidence that comparisons survive auto-exposure and auto-white-balance |
| Privacy | Volatile-image design and tests | Device/log/network/crash inspection on all exit paths |
| Confidence thresholds | No approved release thresholds | Pre-registered thresholds, calibration, and independent approval |
| Release decision | `BLOCKED` | Completed packet and separate authorized promotion decision |

No entry in this table is a substitute for the evidence described below. Build
success and unit tests are engineering checks, not validation.

## Review status and next decision

As of this update, the product/claims review records **changes required before
approval**. The independent-method and privacy forms still say **UNSIGNED
REVIEW FORM** and have no explicitly selected approval decision. The
independent-method form leaves the build, method, support list, sample,
exclusions, rubric, and threshold fields blank. The separate pre-registration
revision packet calls itself a draft, not a frozen protocol. Do not interpret
typed names, a merged PR, or build 100 as an approved enrollment or observation
decision. Privacy must approve and verify the exact coded-record, access,
retention, backup/version, and deletion controls before enrollment.

The next bounded study decision is whether two blinded live reviewers can
reliably judge **visible flaking** in a prospectively specified, diffuse-indoor
light iPhone 17 Pro setup without retaining face images. That is a proposal for
reference feasibility, not a finding that the existing bright-edge probe
detects flakes. Before any participant enrollment, obtain explicit decisions
on the narrow cue and region rule, reviewer training, ambiguity versus
capture-quality exclusions, consent/privacy controls, exact sample and
acceptance targets, and the immutable build/method version. A separate,
versioned baseline-free candidate score and untouched evaluation are needed
before algorithm accuracy can be assessed. Other cues, devices, lighting
conditions, baseline comparisons, and member-visible results stay blocked.

## Required packet

1. [Capture and review protocol](validation/CAPTURE-AND-REVIEW-PROTOCOL.md):
   preconditions, sampling, reference labels, quality challenges, repeatability,
   analysis, and privacy-preserving execution.
2. [Evidence record template](validation/EVIDENCE-RECORD-TEMPLATE.md): one
   completed packet per build/model revision, containing aggregate counts,
   methods, exclusions, issues, and threshold proposals. Keep raw images and
   participant-level records out of this repository.
3. [Independent review and promotion checklist](validation/REVIEW-AND-RELEASE-GATE.md):
   reviewer decisions and the fail-closed release gate.
4. [iPhone pilot readiness](validation/IOS-PILOT-READINESS.md): starting-device
   inventory, analysis-method decision requirements, and pre-enrollment checks.
   This is planning, not validation evidence.

## Coverage ledger

Every row is pending until a completed evidence record links a reviewed result.
Record the exact supported models and OS versions in that record; do not infer
that one successful build covers a device family.

| Required coverage | Status | Record / issue |
| --- | --- | --- |
| Supported iPhone models and multiple camera generations | PENDING | Build 100: one tester-reported iPhone 17 Pro technical capture; no accuracy or multi-generation coverage |
| Supported Android flagships and multiple camera generations | PENDING | — |
| Indoor, outdoor, warm, cool, and low-light conditions | PENDING | — |
| Fitzpatrick I–VI coverage (voluntary, consented classification) | PENDING | — |
| Age ranges and facial structures | PENDING | — |
| Facial hair, cosmetics, tattoos, eyewear, occlusion, motion, and compression challenges | PENDING | — |
| Within-condition and cross-session repeatability | PENDING | — |
| Image-quality acceptance and false acceptance | PENDING | — |
| False positives and false negatives for each approved label | PENDING | — |
| Confidence calibration and approved thresholds | PENDING | — |
| Zero raw-image retention and failure-path cleanup | PENDING | — |
| Independent privacy, product/claims, and engineering review | PENDING | — |

The only Phase 1 candidate labels are `VISIBLE_DRYNESS`, `VISIBLE_FLAKING`,
`VISIBLE_REDNESS`, `VISIBLE_SURFACE_SHINE`, and `VISIBLE_TEXTURE`. No hydration,
diagnostic, physiological, attractiveness, or wellness score is in scope.

## Promotion rule

The internal engineering/QA cohort may run inference behind the approved gate
while evidence is collected. No member-facing live observation, expanded cohort,
external beta, public beta, App Store release, or production release follows
from this package alone. A row may become `REVIEWED` only when its aggregate
record and method are attached, a reviewer other than its executor signs it,
and open failures are resolved or explicitly rejected. Overall status remains
`BLOCKED` until every applicable row is reviewed, §25.3 admission is separately
approved, and the founder authorizes the intended release stage.

Raw images must never be attached here or elsewhere in the repository. Do not
add image files, base64, frame URLs, face boxes, participant IDs, device IDs,
or row-level biometric/appearance data to evidence records, issues, logs, or PRs.
