# SkinIA Visual Check — controlled TestFlight readiness

**Status:** experimental on-device image-feature engine for internal engineering/QA only.
This is not validation evidence, a public release decision, or authorization to emit a
member-facing observation.

**Canonical name:** Advanced Visual Intelligence™  
**Member-facing label:** SkinIA Visual Check

## What is presently implemented

- A server-resolved, controlled-TestFlight cohort gate; public access fails closed.
- Consent, privacy, guidance, permission-denied, quality-insufficient, no-baseline, and
  consent-withdrawn UI shells.
- A static internal presentation fixture; it is not connected to a member route or data source.
- Pure quality, baseline, and ephemeral-cleanup contracts that default to non-results.
- A controlled native capture surface for the entitled internal cohort. It requests camera permission
  only after the member acknowledges the consent explanation and explicitly chooses
  to enable the camera.
- A metadata gate checks capture dimensions and aspect ratio. A local Swift/Kotlin module consumes
  Expo Camera's in-memory picture reference, detects a single frontal face, checks basic lighting
  and sharpness, and computes small derived cheek/forehead/nose/chin appearance metrics. iOS uses
  Apple Vision; Android bundles ML Kit face detection, so there is no first-use model download.
- A relative feature comparison can generate **LOW-confidence experimental candidates** from the
  five approved Phase 1 labels. These unvalidated probes cannot pass the member-result gate;
  they are neither findings nor a skin-analysis model. No candidate label or numeric metric is
  shown to the member. The first accepted scan establishes only an in-memory session reference.
- The camera flow now passes its internal outcome through an explicit member-result admission
  gate. Because §25.3 admits no live observation family, this gate remains closed even for a
  HIGH-looking synthetic input; the scan result shows only the exact AF-SI-001A non-result copy.
  The static presentation fixture remains unreachable from member navigation.

The controlled capture surface does not create a file, URI, base64 payload, EXIF record,
persistent image, upload, network request, analytics payload, or live member SkinIA observation.
Raw image data stays in volatile native memory. A temporary native capture reference is explicitly
released in a `finally` block before review or quality-insufficient UI appears. Derived metrics
are kept only for the current screen session and cleared on unmount. The feature probes are
unvalidated and cannot substitute for a selected/validated observation model.

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
- [ ] The OS camera prompt appears only after the entitled tester chooses **Enable camera**.
- [ ] A successful capture releases the temporary native buffer before the review state appears;
      the state says that no member-facing visual observation was created.
- [ ] A capture with unsuitable technical metadata releases the same buffer and reaches
      `CAPTURE_QUALITY_INSUFFICIENT` rather than a review or observation state.
- [ ] A capture with no face, multiple faces, an off-angle/too-small face, poor lighting, or
      blur reaches a non-result and releases the buffer.
- [ ] The experimental second-scan comparison never bypasses the LOW-confidence result gate.
- [ ] An accepted scan shows only “We couldn’t make a reliable observation from today’s image.”
      and never shows candidate counts, labels, metrics, or a confidence score.
- [ ] An older TestFlight binary without the native module fails closed as unavailable.
- [ ] Permission-denied, quality-insufficient, no-comparable-baseline, and consent-withdrawn
      surfaces remain plain-language non-result states.
- [ ] The static results fixture is unreachable from member navigation.
- [ ] Accessibility labels, readable contrast, and non-color-only state cues work with the
      supported screen reader and larger text settings.

## Member-observation admission blockers

Internal engineering/QA inference is allowed by the AF-SI-001A amendment. Member-facing live
observations remain blocked until every applicable requirement in
`docs/AFORCE_OS_ARCHITECTURE_V1.md` §25.3 has recorded evidence and approval, including:

1. a written definition for each candidate visible observation;
2. a named region, quality criteria, and capture-equivalence control that survives device
   auto-exposure and auto-white-balance;
3. calibration evidence across the required lighting, hardware, skin-tone, age, cosmetics,
   occlusion, motion, and compression conditions;
4. a stated confidence qualification, claims approval, and recorded validation status; and
5. independent review of the evidence before any observation family is admitted.

The [Phase 1 validation package](PHASE1-VALIDATION-PACKAGE.md) contains the
physical-device protocol, aggregate evidence template, and independent review gate. All
measurement and release evidence in that package is still pending.

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
The controlled capture implementation uses a native temporary capture reference only; it has no
serialized image representation and is released after feature extraction. On success and failure,
the app must delete the temporary raw image immediately by releasing that reference. Future paths
for timeout, cancellation, consent withdrawal, or abandonment must provide the same immediate
release guarantee and produce no result until the relevant admission gate is met.
