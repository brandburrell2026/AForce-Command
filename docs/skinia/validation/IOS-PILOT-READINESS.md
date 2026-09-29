# SkinIA Phase 1 iPhone pilot readiness

**Status:** planning only — no enrollment, validation result, or observation admission

This note prepares an initial internal engineering/QA check without changing the
[capture protocol](CAPTURE-AND-REVIEW-PROTOCOL.md) or the
[release gate](REVIEW-AND-RELEASE-GATE.md). It contains no participant record or
image data.

## Available starting devices

- Two iPhone 17 Pro units have been reported as available. One tester reported
  an AForce OS 1.0.0 (100) TestFlight capture that displayed `Capture check
  passed` with `OBSERVATIONS_NOT_ADMITTED`, then returned to the SkinIA
  overview. This confirms that one technical device flow reached the intended
  QA-only result; it does not establish skin accuracy, repeatability, privacy
  cleanup, or performance on the second phone. Exact iOS versions, camera
  settings, native module revision, and internal entitlement must still be
  recorded for any future frozen study.
- Android participation and its exact device model are deferred. The two
  iPhones are the same generation; they cannot satisfy the multi-generation,
  Android, lighting, or Fitzpatrick I–VI coverage requirements.

## Analysis-method decision

The current native modules detect a face, reject some unsuitable captures, and
return derived pixel metrics in memory. The JavaScript rules compare those
metrics with a same-session reference and emit only LOW-confidence experimental
candidates. No Core ML, TensorFlow Lite, or ONNX observation-model asset is
tracked in the AForce OS source tree at this review. This is **not** a selected
or validated observation model. Its
absolute brightness, shine, and edge probes have not demonstrated equivalence
across exposure, white balance, lighting, devices, or skin types. The
member-result admission gate remains closed.

Engineering must select and freeze a candidate **on-device** analysis method
before observation-performance testing. A candidate review must document:

1. Exactly which of the five AF-SI-001A visible-appearance labels it proposes
   to support, and which labels remain unsupported.
2. Its model/rule revision, provenance, license, device requirements, and
   reproducible integration. A third-party asset must not add uploads or raw
   image retention; in-project capture data must not be used for model training.
3. How capture quality, comparable baselines, exposure/white-balance variation,
   confidence bands, and an `UNABLE_TO_DETERMINE` result are handled.
4. Pre-registered reference rubric, sampling and repeat counts, exclusions,
   minimum per-stratum performance, and held-out evaluation. Two starting
   iPhones cannot establish these results.

Until that decision and the later evidence review, experimental candidates
remain internal signals only, never member observations. A technical pilot
must not be re-labeled as accuracy validation.

## Next bounded decision: live-reference feasibility

The proposed first study is **visible flaking only**, judged live by two
blinded reviewers in one pre-specified diffuse-indoor iPhone 17 Pro setup.
Its purpose is to determine whether the reference itself is repeatable without
retaining face images. It is not an evaluation of the current bright-edge
probe, a validated skin reading, or an admission to the member UI. The
pre-registration packet must fix the named facial regions, viewing/capture
conditions, reviewer training, minimum visible-detail rule, sample and repeat
counts, uncertainty and acceptance criteria, and distinct reasons for
capture-quality rejection versus an ambiguous live reference. Baseline-free
flaking does not require a personal comparison; a repeated same-session
capture is a technical repeat, not a personal baseline. The current proposal
remains a draft and no participant enrollment follows from this note.

## Before any participant scan

- [ ] Assign the QA executor, product/claims owner, privacy reviewer, and an
      independent evidence reviewer who will not sign off on tests they ran.
- [ ] Resolve the product/claims **changes required** decision and record an
      explicit independent-method decision against the exact first-stage
      protocol. Typed reviewer names are not selected decisions.
- [ ] Record explicit privacy approval of consent language, private QA-record
      access, retention, backup/version behavior, and deletion procedure;
      verify the controls in the chosen account before enrollment.
- [ ] Freeze the build, source/native revisions, support list, rubric, sample
      plan, quality criteria, exclusions, and proposed confidence thresholds in
      a new [evidence packet](EVIDENCE-RECORD-TEMPLATE.md).
- [ ] Verify internal entitlement and the feature flag on each device. Record
      only aggregate results in the repository; never attach faces, frames,
      participant IDs, device IDs, or individual appearance records.

After those approvals, the first two-device pilot may check native-module
availability, camera rejection/acceptance paths, interruption cleanup, and
zero raw-image storage/upload. It does not enable observations or satisfy the
full Phase 1 validation matrix.
