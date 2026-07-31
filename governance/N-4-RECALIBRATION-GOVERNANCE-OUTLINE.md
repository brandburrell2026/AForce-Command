# N-4 — Prediction Recalibration Governance (Reviewer-Ready Outline)

**Status:** ⏳ **PREPARATION ONLY — N-4 REMAINS OPEN.**
**Prepared:** 2026-07-22 (Phase 3.7) · **Mandated by:** `DR-008` §6

> **N-4 may not be closed through documentation alone.** This outline is a structure for reviewers
> to fill, not an approved process. Every scientific or legal value is **UNSET**.

---

## 1. The frozen prohibition (already decided, not open)

> **The Prediction Engine may not silently retrain, reweight, recalibrate, or change its own model
> after individual predictions or outcomes. Online learning and autonomous self-modification are
> NOT authorized.**

This is settled by `DR-008` §6 and is **not** part of what N-4 resolves. N-4 defines the
*governed* process that replaces automatic adaptation.

**Design consequence already applied:** the outcome-reconciliation sweep may **record and
evaluate** outcomes but may **not apply** calibration. `calibration.ts` may compute a *proposed*
factor for review; it may never apply one.

## 2. Outline — 16 items for reviewer completion

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | **Trigger conditions** | **UNSET — scientific + engineering** | What observation justifies considering recalibration? Sample count? Drift in accuracy? Elapsed time? **Must never be automatic.** |
| 2 | **Eligible dataset** | **UNSET — scientific** | Which recorded predictions and outcomes qualify? |
| 3 | **Exclusion criteria** | **UNSET — scientific** | Invalidated · expired-without-outcome · outcome-unavailable · insufficient-evidence records must not silently bias the set |
| 4 | **Minimum sample** | **UNSET — scientific** | Per prediction type |
| 5 | **Evaluation window** | **UNSET — scientific** | |
| 6 | **Comparison to current model** | **UNSET — scientific** | Champion/challenger? Held-out set? |
| 7 | **Regression criteria** | **UNSET — scientific** | What degradation blocks release? |
| 8 | **Calibration criteria** | **UNSET — scientific** | What constitutes acceptable calibration? |
| 9 | **Subgroup review** | **UNSET — scientific + legal** | Which subgroups, and what disparity is unacceptable? Note the known bias risk for irregular-schedule users. |
| 10 | **Approval owners** | **UNSET — founder decision** | Proposed: Scientific + Engineering always; Legal when claim behaviour changes; Founder for any user-visible change |
| 11 | **Version increment** | **Governance defined** | Major = not comparable ⇒ re-derive or retire. Minor = comparable refinement. Both bump `policy_version` and/or model version. |
| 12 | **Rollout method** | **UNSET — engineering** | Proposed: flag-gated, cohort-staged, never global-immediate |
| 13 | **Rollback criteria** | **UNSET — engineering + scientific** | |
| 14 | **Monitoring period** | **UNSET — engineering** | |
| 15 | **Audit record** | **Governance defined** | Trigger · dataset · evaluation report · comparison · approvals · version · rollback plan — all retained |
| 16 | **Prohibition on automatic self-training** | ✅ **DECIDED — `DR-008` §6** | Not open. Not revisable by this process. |

**12 of 16 items are UNSET.** Three are already governance-defined; one is decided and closed.

## 3. Interaction with other open items

| Item | Interaction |
|---|---|
| **N-1** | Recalibration cannot be evaluated until a confidence floor exists |
| **N-2** | Cannot recalibrate against an undefined success metric |
| **R-23** | Graph weighting is unapproved, so there is no numeric input to recalibrate |
| **`DR-007` §A** | Calibrated predictions are separately blocked; N-4 does not unblock them |

**N-4 cannot be resolved before N-1 and N-2.** Recalibration presupposes a defined measure of
success, and none exists.

## 4. Standing rules (frozen, not open)

1. **A prediction may never retroactively change.** An issued prediction stands as issued.
2. **Calibration may only tighten**, never inflate confidence past what evidence supports.
3. **Validation may not be claimed from internal tests alone.**
4. **The same records may not be used for tuning and final evaluation** without documenting the
   method and its limitations.
5. **Every model change is versioned.** No silent threshold or weight change.

## 5. Closure criteria

N-4 closes only when **all 12 UNSET items are resolved with named owners**, the process is
approved by the founder, and an approved recalibration has been executed end-to-end at least once
in a non-production environment. **Documentation alone does not close it.**
