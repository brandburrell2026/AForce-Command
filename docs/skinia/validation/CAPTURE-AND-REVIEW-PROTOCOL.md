# SkinIA Phase 1 capture and review protocol

**Status:** proposed internal QA protocol; product/privacy review and device
evidence are pending. Do not enroll participants until the review is recorded.

**Applies to:** only the controlled internal build and approved engineering/QA testers.

## 1. Freeze the study before collecting results

The product/claims owner and independent reviewer must record, in a new
[evidence packet](EVIDENCE-RECORD-TEMPLATE.md), the exact build, native engine
revision, device/OS support list, sampling plan, number of repeats, reference
rating rubric, exclusion rules, proposed quality and confidence thresholds,
and required performance by stratum. These are **proposals**, not approved
release thresholds. Do not choose them after seeing favorable outcomes.
Before enrollment, product/privacy reviewers must also approve the consent
language, who may access the private QA working record, its retention period,
and the deletion procedure. Record that approval in the packet.

The present pixel-feature thresholds are unvalidated sensitivity probes. No
live observation may pass to the member UI while the §25.3 admission set is
empty. Do not quietly reinterpret a LOW candidate as an observation.

## 2. Enrol and set up a session

1. Confirm internal TestFlight entitlement, informed participation, camera
   permission, and the exact build and feature-flag state. Non-entitled or
   non-TestFlight access must fail closed.
2. Use a physical supported device. Record model, OS version, camera generation,
   app build, and test condition in the **private QA working record**; publish
   only aggregates and support-list summaries to the repository. Never record
   a serial number, advertising ID, account ID, or exact location here.
3. The Fitzpatrick I–VI coverage category must come from a voluntary,
   consented participant report under the approved QA process. Do not infer
   skin type, race, or ethnicity from an image. Record only aggregate coverage
   in the repo; leave a cell unreported if it would identify a participant.
4. Confirm neutral expression, eyes open, hair clear when possible, no
   sunglasses, filters, portrait blur, or flash, even ambient light, camera
   unobstructed, full face visible, and approximately 30–45 cm distance.

## 3. Execute the coverage matrix

Run the same protocol on the frozen support list, including multiple iPhone
and Android camera generations. Cover indoor, outdoor, warm, cool, and low
light. Record illumination method or measured light level when available,
without a precise location. Cross the key conditions with Fitzpatrick I–VI
coverage; a pooled pass cannot hide an untested or failing stratum. Include
age ranges, facial structures, and the §25.3 challenges: facial hair,
cosmetics, tattoos, eyewear, occlusion, motion, and compression.

For each planned condition, exercise:

- an eligible capture with a single frontal face;
- unsuitable capture attempts (no face, multiple faces, off-angle/too-small
  face, eyes closed or obscured, blur, too dark, overexposure, occlusion);
- permission denied, cancellation, interruption, background/abandonment,
  timeout/failure, consent withdrawal, and module-unavailable paths;
- the pre-registered number of repeated captures without changing condition,
  followed by separately planned cross-session captures.

For unsuitable captures, the expected outcome is `Unable to Analyze` or an
equivalent approved non-result; no candidate or observation may be emitted.
Record quality true accept, false accept, true reject, and false reject counts
by condition. A quality PASS state is not an accuracy claim.

## 4. Establish a reference without retaining raw images

Two trained, independent reviewers use the **approved visible-appearance
vocabulary only** and the frozen rubric to assess the participant live during
the session. They must not see the engine candidate before recording their
reference decisions. If reviewers disagree or cannot reliably judge, record
an ambiguous reference and exclude it from the primary confusion matrix while
reporting the exclusion count. An agreed live rating is an imperfect reference
to the captured frame; the independent reviewer must assess this limitation.

Do not save a captured frame or screenshot for later adjudication. Raw images
exist only in volatile memory and are released immediately after inference.
The QA working record may hold the minimum consented observations needed to
compute aggregates under the approved retention policy; it must never enter
the repository or analytics. Repository packets contain only aggregate
confusion counts and issue links.

## 5. Analyze candidates and comparisons

For each of the five labels, aggregate true positives, false positives,
false negatives, true negatives, ambiguous references, and quality rejections.
Show results overall and by device family/camera generation, lighting, and
Fitzpatrick coverage; report denominators and exclusions. Review both false
positive and false negative examples *during* the live session without
retaining the image. Record root-cause categories, not participant anecdotes.

Report within-condition agreement and cross-session stability using the
pre-registered repeat count. Compare only captures that meet an explicit
capture-equivalence rule. iOS camera auto-exposure and auto-white-balance are
not locked by the current app; **brightness or color differences across
sessions are not valid comparisons** until the equivalence control is proven.
No favorable repeatability number overrides that physical constraint.

Fit proposed confidence bands using held-out internal data, then evaluate on
a separate held-out set. Record how many cases fall into HIGH, MODERATE, LOW,
and UNABLE_TO_DETERMINE and their error rates. Do not select a release
threshold based only on pooled performance, and do not display numeric
confidence to members. A threshold requires independent approval; until then
all generated candidates remain LOW and member-facing output remains blocked.

## 6. Verify privacy and record the verdict

On every exit path, inspect the app sandbox, network traffic, logs, crash
reports, analytics, backups, and image/file caches for raw image persistence
or transmission. The expected count is zero. Do not collect raw imagery as
proof of its absence. Log only aggregate counts and tooling/method details.

File a separate issue for every privacy leak, quality false accept, unfair
stratum gap, or observation error that needs correction. Complete an evidence
packet with denominators and limitations, then send it to an independent
reviewer using [the review gate](REVIEW-AND-RELEASE-GATE.md). A failed or
missing test stays `PENDING` or `FAIL`; it is never silently omitted.
