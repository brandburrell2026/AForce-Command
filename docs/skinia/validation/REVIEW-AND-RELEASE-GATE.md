# SkinIA Phase 1 independent review and release gate

**Current decision: `BLOCKED`.** The packet templates are not evidence.

## Verdict definitions

- `PENDING`: no completed physical-device record or missing review.
- `FAIL`: a pre-registered criterion failed, a privacy breach occurred, or a
  forbidden observation/output was emitted. Fix and retest on a new revision.
- `PARTIAL`: some strata or paths pass, but any required coverage, reference,
  repeatability, confidence, privacy, or quality check is missing or unclear.
- `PASS`: every pre-registered criterion for the named build/revision and
  support list has evidence, required strata have adequate denominators,
  failures are resolved, and an independent reviewer signs the packet.

`PASS` is scoped to that build, model revision, support list, and observation
family. It is not a blanket approval for a later binary, new device, or new
claim. Tests and successful builds alone never earn `PASS`.

## Independent reviewer checklist

- [ ] Verify the packet was frozen before results were examined; check build,
      source commit, model revision, rubric, sample plan, exclusions, and
      proposed thresholds.
- [ ] Verify approved internal testers, device support list, and physical
      iOS **and** Android evidence; simulator-only records do not count.
- [ ] Verify all lighting, Fitzpatrick I–VI, age, structure, camera-generation,
      and §25.3 challenge strata, including denominators and gaps.
- [ ] Recompute aggregate quality acceptance, false acceptance, and false
      rejection from the recorded counts.
- [ ] Recompute per-label false-positive/false-negative results, inspect issue
      dispositions, and check reviewer disagreement and ambiguous exclusions.
- [ ] Verify repeatability and a capture-equivalence control that survives
      auto-exposure/auto-white-balance; do not permit unsupported cross-session
      brightness or color claims.
- [ ] Verify confidence calibration on held-out cases and errors by stratum;
      no numerical confidence is shown to members.
- [ ] Verify zero persistent/uploaded raw images in success and every failure,
      cancellation, timeout, withdrawal, and abandonment path.
- [ ] Verify only the five AF-SI-001A labels, approved copy, and non-medical
      disclosure; no score, diagnostic or physiological inference.
- [ ] Check that open issues, missing evidence, and support limitations are
      prominent; the independent reviewer did not execute the tests being
      signed off.

## Decision sequence

1. QA and engineering file completed aggregate packets and issue references.
2. Independent, privacy, and product/claims reviewers record dated decisions.
3. The §25.3 owner separately decides which, if any, observation families are
   admitted. Until then, member-facing live observations remain unavailable.
4. A founder-approved release decision separately names the permitted cohort
   and build. Internal engineering/QA authorization does not imply external
   beta, public beta, App Store release, or production authorization.

Any missing or failing item leaves the decision `BLOCKED`. No one should
change the rollout flag or emit member-facing live observations merely because
this documentation exists or because an EAS/TestFlight build succeeded.
