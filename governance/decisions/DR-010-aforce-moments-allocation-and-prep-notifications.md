# DR-010 — AForce Moments: §43 allocation + prep-notification authorization

**Date:** 2026-08-12
**Deciders:** Brandon (founder) — APPROVED ("Approve PR-002 items 5.1 and 5.4 and
proceed with Phase 3"). **Julius — COUNTERSIGNED 2026-08-12** (founder relayed).
Both [JB] gates are satisfied; this record is fully ratified.
**Source proposal:** governance/proposals/PR-002-aforce-moments.md (Parts 5.1, 5.4).

---

## Ruling 1 — Section allocation (PR-002 item 5.1)

**§43 of the reserved §43–46 block is allocated to AForce Moments** — the
preparation layer (Moments + prep windows + the PAUSE/HYDRATE/LOCK IN/PERFORM
ritual delivery). Registered in FEATURE-PHASE-MATRIX §2 (the same location that
records §38–42, per the established pattern). Build status: Phases 1–2 built
(PR #713, `moments_enabled` OFF in production); Phase 3a (prep notifications,
this record) in build. Terminology: **"Moment"** is registered in the
Terminology Registry as part of this allocation; the **"Ritual"** overload
(Opening Sequence / Shop builder / Shopify plan) is NOTED and its resolution
remains a separate founder terminology ruling (PR-002 Part 4).

## Ruling 2 — Prep notifications (PR-002 item 5.4)

The PT-1 rule "prediction-type outputs are prohibited on the notification
surface" (DR-008 / PREDICTION-SUCCESS-CONTRACTS) is **narrowly amended**:
**Moments preparation notifications are authorized** under ALL of the following
binding constraints:

1. **Behavioral, not predictive, in copy.** A prep notification states the
   moment, the time, and one action ("Investor Meeting in 75 min — Hydrate
   now. Best before 1:15 PM."). It never states a predicted score, band,
   demand forecast, or any Tomorrow-Load-Forecast output. PT-1 itself remains
   unauthorized on every strict surface.
2. **Interruption budget.** Delivery is planned through the shipped reminder
   guardrails: quiet hours respected (22:00–07:00 defaults), ≥60-minute
   minimum gap between Moments notifications, hard daily cap (below the
   global 6/day ceiling), high/moderate-importance moments only by default.
   This stream is separate from the Day-0/1/3/7 cadence and does not consume
   its 1/day budget — both caps bind independently.
3. **Local only.** Pre-scheduled local notifications (expo-notifications,
   already installed) — no remote push, no server involvement, no background
   execution.
4. **Off by default in production.** Gated by a NEW dedicated flag
   `moments_notifications_enabled` (OFF in production, ON in demo) *in
   addition to* `moments_enabled`, plus a user-facing toggle in Notification
   settings (`momentPrep`). Trust-over-attention (P10/P11): one prepared
   moment beats one more ping; when in doubt the notification is dropped.
5. **Source scope.** Manual + demo moments only — calendar-derived moments
   remain blocked until PR-002 items 5.2 (Founder + Legal + Privacy), 5.3,
   and 5.5 are approved. Nothing in this record authorizes calendar access.

## Explicitly NOT decided here

PR-002 items 5.2 (calendar data class), 5.3 (calendar-derived surfacing),
5.5 (native build), 5.6 (learning loop / adaptive lead timing — the
"Adaptive" lead option ships disabled until 5.6), and the "Ritual"
terminology resolution.
