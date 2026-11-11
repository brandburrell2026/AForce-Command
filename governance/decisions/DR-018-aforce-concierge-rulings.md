# DR-018 — AForce Concierge: founder rulings on PR-003 (D-01 … D-08)

**Status:** approved by founder (Brandon) — 2026-10-05. **Julius pending** on D-01 and D-02 (marked [JB] in PR-003).  
**Scope:** AForce Concierge — the Section 64 (Conversational Intelligence Architecture™) member-facing surface, merged dark in PRs #1078/#1079/#1080/#1081/#1082 and live for internal TestFlight testers from iOS build 104.  
**Related:** `governance/proposals/PR-003-aforce-concierge.md` (the proposal these rulings close), DR-003 D-01 (no additional branded systems), DR-013 (RecoveryCommand authority / mirror-exact), Risk-Register RD-1 (§64 enable gated on CR-1), `reviews/CR-1-CLAIMS-REVIEW-PACKAGE.md`.

## Decisions

| # | Decision | Ruling (2026-10-05) |
|---|---|---|
| D-01 | Member-facing name | **"AForce Concierge"** is the member-facing name of the §64 surface. "AI Coach" remains the architectural term in governance and code comments. Registered in TERMINOLOGY-REGISTRY §3 (Interaction Intelligence) and §4 (alias table). [JB] — Julius to confirm. |
| D-02 | Privacy disclosure | **Counsel drafts** the privacy-policy update. Engineering supplies the data-flow brief (`docs/concierge/COUNSEL-BRIEF-2026-10-05.md`); Claude Code does not write policy text. [JB] — Julius to confirm. |
| D-03 | Data class | **Approved as proposed:** transcripts **S2**, assistant preferences **S1**, per-turn grounding context **transient** (never stored). Rows added to DATA-CLASSIFICATION-MATRIX §2 and §5, marked *Privacy review pending* per INTELLIGENCE-CHANGE-CONTROL §4. |
| D-04 | Urgent-situation copy | **Keep the locked placeholder for internal preview; send to counsel + clinical review** with the trigger-phrase list (NO-9). Copy and triggers live in `api-server/src/lib/concierge/urgent.ts`, locked by `conciergeUrgent.test.ts` against every gate. |
| D-05 | Internal TestFlight overlay | **Granted** (PR #1080): `CONCIERGE_INTERNAL_PREVIEW_OVERLAY_FLAGS`. |
| D-06 | CR-1 copy review | **Fold into CR-1.** New §3.3b in the CR-1 package inventories every `concierge.*` key and the governed urgent reply so the single reviewer covers it with the existing §64 coach copy. |
| D-07 | Schema push | **Done** 2026-10-05 in production (reviewed SQL `lib/db/migrations/20261005_concierge.sql` via `railway run -e production`). |
| D-08 | Audience beyond internal | **Internal TestFlight only** until D-02 (privacy update), D-04 (urgent copy) and D-06 (CR-1) clear. No cohort step in between. `DEFAULT_FLAGS.ai_concierge_enabled` stays OFF; recorded in Launch-Readiness. |

## Standing constraints reaffirmed

- Section 64 governs the surface (Build Rule 11): full context loaded, one exchange, observation-only language, the member's own data, never a population.
- DR-013 mirror-exact: the concierge repeats engine quantities verbatim and authors none (server quantity-grounding gate).
- §42 claims gate on every reply, fail closed, never rewritten (`api-server/src/lib/claimsGate.ts`, parity-locked).
- Score-Protection: the concierge's only writes are the existing intake action, navigation, local reminders and its own three tables.
- No calendar, location, booking, order, pricing, inventory or support-availability claims.

## Evidence at ruling time

- Live end-to-end turn verified in build 104 (2026-10-05 ≈ 21:00 UTC): gated answer + next step + action card + "Why this?", intake grounded, engine command mirrored; no gate rejection logged.
- Two configuration faults found and fixed on the way: the production OpenAI key was a placeholder (so Smart Capture had also never reached the model in production), and the OpenAI organization had no credits.
