# SkinIA build 101 quality-gate audit

**Status:** source-level engineering audit only, 2026-09-29. Not a validation result,
participant record, quality-threshold approval, or authorization for member findings.

## Scope and finding

Build 101 was built from `c20bb3c4ae21292e3f06e060b8fa248f18ff2765`.
The iOS `BLURRY` decision in
`artifacts/aforce-os/modules/skinia-image-features/ios/SkinIAImageFeaturesModule.swift`
is inherited from an earlier native engine revision; the build-101 interruption
change did not revise it. Android has the same numerical rule, but this audit
does not establish Android behavior on a physical device.

After Vision detects one sufficiently large, frontal face, the iOS module
resizes the image to at most 640 pixels on its long edge. It samples two fixed
cheek rectangles relative to the face box. For every second pixel in each
direction, it averages the absolute luminance difference from the right and
lower neighbors. The two cheek averages are averaged again; a result below
`2.5` returns only `BLURRY`. The quality state is produced before any
appearance candidate or member result is admitted.

This statistic measures local cheek contrast, **not optical focus directly**.
Skin detail, facial hair or occlusion, lighting, exposure, denoising, and
face-box placement can change it. A low value is not proof that a person moved
or that the camera was out of focus. Conversely, a high value alone cannot
prove a usable facial image. The fixed `2.5` threshold has no documented
device-, condition-, or skin-tone-stratified calibration. A single rejected
attempt followed by a pass does not establish a false rejection rate or justify
retuning it. The cause of any individual rejection is unresolved without an
approved, consented evaluation; raw images must not be retained to investigate.

## Current containment and test gap

- A non-`PASS` native state crosses the TypeScript bridge as a state only;
  unexpected metrics are discarded. The capture screen routes `BLURRY` to a
  non-result and releases the temporary picture reference before showing it.
- A successful technical capture still passes through the closed member-result
  admission gate. `OBSERVATIONS_NOT_ADMITTED` is not a skin finding.
- Existing TypeScript tests check the bridge, capture flow, and fail-closed
  behavior. They do **not** calibrate the native `2.5` threshold or measure
  its false-accept/false-reject rates on physical devices. This source audit
  does not verify on-device raw-image cleanup or native blur performance.

## Decision and next evidence

Do not lower or remove the blur threshold from one tester's outcome. Keep the
member observation gate closed. Before changing the quality rule:

1. Define focus, exposure, no-face, and ambiguous-reference outcomes
   separately. A `BLURRY` count is not an appearance-label error.
2. Create deterministic, non-personal synthetic image fixtures to exercise
   the native statistic and face-box sampling boundaries. Such fixtures test
   implementation, not fairness or clinical/appearance validity.
3. Obtain privacy-reviewed, consented, device- and condition-stratified
   technical QA counts under a frozen protocol. Report denominators, false
   rejects and false accepts, including unresolved cases; do not store frames.
4. Compare a focus-specific alternative against the current cheek-contrast
   rule using pre-registered criteria and independent review. Version any
   changed rule and re-test both iOS and Android before promoting a build.

The per-tester build-101 outcome belongs only in an **approved private QA
working record**. This repository contains no capture screenshot, face image,
individual observation, or small-cell result from that check. Use the
[blank private QA template](PRIVATE-TECHNICAL-QA-RECORD-TEMPLATE.md) only after
access, retention, backup, and deletion controls have been approved. Formal
study and release gates remain in
[`../validation/IOS-PILOT-READINESS.md`](../validation/IOS-PILOT-READINESS.md)
and [`../validation/REVIEW-AND-RELEASE-GATE.md`](../validation/REVIEW-AND-RELEASE-GATE.md).
