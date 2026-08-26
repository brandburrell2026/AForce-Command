# DR-012 — AForce Moments: learning loop (PR-002 item 5.6) — constrained approval

**Date:** 2026-08-12
**Deciders:** Brandon (founder) — APPROVED ("proceed and next 5.6 loop").
**Julius — countersignature PENDING** ([JB] per PR-002; the build proceeds
dark on Brandon's approval, DR-010/DR-011 precedent).
**Source proposal:** governance/proposals/PR-002-aforce-moments.md item 5.6.

---

## Ruling 1 — Design amendment (recorded, not silent)

PR-002 5.6 contemplated populating reserved command-ledger kinds. None of the
reserved kinds carries prep-feedback semantics ("felt too early" is not an
accept/reject), and widening the ledger's validated vocabulary is a larger
governance change than this feature needs. **Amended design:** prep feedback
lives in a dedicated, capped, on-device store (`@aforce/momentFeedback`) —
member-volunteered app interaction, the same data class as manual moments and
preferences (no new raw collection; Appendix A unaffected). The ledger's
reserved kinds remain unpopulated. A future migration into ledger vocabulary
would need its own decision record.

## Ruling 2 — Feedback capture constraints (P6/P10: sparing, never nagging)

1. Asked ONLY on a moment that is completed, was actually prepared (I'M
   READY), and is high-importance. Never after every moment.
2. At most ONE ask per calendar day (config-tunable), one ask per moment,
   dismissible, three options max: Just right / Too early / Too late.
3. Feedback is display-and-learning only — Score Protection holds: it never
   dispatches a reducer action, never moves a hydration point or band.

## Ruling 3 — Adaptation safety gates (adaptiveRecheck template)

1. **Flag-gated hard no-op:** `moments_learning_enabled` OFF in production;
   when off, the adapter returns zero adjustment and the Adaptive lead
   option stays locked.
   > **AMENDED 2026-08-12 (founder):** production activation ordered as part
   > of the Moments-family flag flip (Julius countersignature on this record
   > still pending). Gates 2–4 remain binding unchanged.
2. **Minimum evidence:** no adjustment until ≥ MOMENT_FEEDBACK_MIN_SAMPLES
   for that moment type inside the rolling window, with a strict majority.
3. **Bounded:** lead shifts move in MOMENT_LEAD_ADJUST_STEP_MIN increments,
   clamped to ±MOMENT_LEAD_ADJUST_MAX_MIN. All constants in
   config/hydroStateModel.ts (Build Rule 13).
4. **Water-First protection:** adaptation only shifts WHEN the prep signal
   fires; it never removes, reorders, or de-prioritizes a hydration action,
   and the DR-010 interruption budget (quiet hours, gap, daily cap) applies
   AFTER adjustment — adaptation can never push a notification into quiet
   hours or past the moment start.

## Explicitly NOT decided here

Calendar activation (still blocked on Legal + Privacy per Appendix A); the
"Ritual" terminology ruling; any server-side learning (everything here is
on-device).
