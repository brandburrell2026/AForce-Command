# SkinIA live sample-zone alignment audit v0.1 — proposal

**Status:** DRAFT for engineering, privacy, and independent-method review.
Not implemented or authorized for tester use. This does not freeze a study,
enroll participants, validate a skin label, or admit member-visible findings.

## Why this check is needed

Build 102 reached `Capture check passed` on two tester-reported iPhone 17 Pro
flows. Synthetic tests cover image orientation, Vision-box conversion, and the
five production face-box rectangles. Neither result proves that those fixed
rectangles land on unobstructed forehead, cheek, nose, or chin skin on a live
face. A rectangle can include hair, beard, eyewear, cosmetics, or background
while the technical capture still passes.

The existing capture callback releases its `PictureRef` before displaying a
result and sends no image, thumbnail, URI, face box, or landmarks to JavaScript.
A live visual audit would deliberately keep a capture in memory longer and
show it on the device. That is a **new privacy surface**, not an extension of
the already-approved capture smoke check.

## Proposed implementation boundary — not yet approved

1. Add a separate, default-off internal-QA entry point. Require the existing
   internal TestFlight entitlement, explicit QA opt-in, and a versioned flag.
   The normal SkinIA capture and result path must remain unchanged.
2. On the native side only, render the same upright in-memory `CGImage` used by
   Vision. Draw the five rectangles from the shared
   `SkinIAFrameCoordinates.qaSampleRect` geometry against that exact image,
   not against the mirrored or aspect-filled live camera preview. Display the
   capture and overlay only in a native, transient review view.
3. Label every rectangle as a **face-box QA zone**, not an observed skin area.
   Permit a trained internal tester to mark each zone `ALIGNED`, `MISALIGNED`,
   or `UNASSESSABLE`, with a bounded reason category: hair/beard, eyewear or
   other occlusion, background, framing/geometry, lighting, or other. These are
   engineering placement judgments, not skin findings or reference labels.
4. Keep `UIImage`, pixel buffers, face box, and landmarks inside the native
   process. Return at most a versioned set of non-image QA categories; do not
   log or persist per-attempt results in app storage, analytics, crash data, or
   the repository. Any approved private working record and later aggregates
   need their own access, retention, backup, and deletion controls.
5. On cancel, completion, timeout, interruption, lock/background, or failure,
   blank the review view and release the capture. Do not restore it after the
   app returns to foreground. Do not offer save, share, export, or upload.
   Test the app-switcher snapshot, caches, logs, network, backups, and crash
   paths; a UI statement alone does not prove zero persistence.
6. Do not request or retain screenshots, screen recordings, or face photos as
   audit evidence. The app cannot guarantee that an iOS screenshot is
   impossible, so tester instructions and privacy review must address that
   residual risk explicitly.

## Audit separation

| Event | Record category | Meaning |
| --- | --- | --- |
| Native capture rejected | `CAPTURE_QUALITY_REJECTED` | No zone judgment; report separately. |
| Capture passes but region cannot be judged | `ZONE_UNASSESSABLE` | A placement/visibility limitation, not a quality-pass finding. |
| Visible zone is misplaced | `ZONE_MISALIGNED` | Engineering failure requiring a new geometry revision. |
| Visible zone appears correctly placed | `ZONE_ALIGNED` | Exploratory placement evidence only, not cue accuracy. |

Do not collapse these categories into one denominator or reinterpret an
`ALIGNED` judgment as support for any appearance label. This proposal sets no
numerical acceptance target, sample size, or performance claim. Any formal
evaluation must pre-register those items before enrollment and separately
resolve the live-reference method and personal-baseline comparison question.

## Required decisions before a live audit build or tester instruction

- [ ] Privacy reviewer approves the transient face-image display, consent
      language, screenshots/screen-recording risk, private QA-record controls,
      and deletion/backup verification method.
- [ ] Independent method reviewer approves the per-zone judgment rubric,
      observer training, exclusions, and how disagreements will be counted.
- [ ] Product/claims owner confirms the QA-only wording and that no skin
      finding or score can be surfaced by this route.
- [ ] Engineering verifies the internal-only gate, native-only image handling,
      cleanup paths, and no change to the existing QA result flow.
- [ ] A separate decision names any QA build, eligible testers, and bounded
      device/condition scope. A paid build is not authorized by this proposal.

Until those decisions are recorded, work may continue on synthetic tests and
source review, but no new live audit capture should be requested. The SkinIA
member-result admission gate remains closed.
