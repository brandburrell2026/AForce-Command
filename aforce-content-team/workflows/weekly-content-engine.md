# WEEKLY CONTENT ENGINE

**Invoked by:** `/run-week` (full) or `/content-week` (plan-only, steps 3–9). Runs every week. Output: one weekly package in `reports/YYYY-MM-DD-run-week.md` + updated calendar, database, and dashboards.

## The fourteen steps

| Step | Owner | Action |
|---|---|---|
| 1 | Agent 15 | **Performance review** of prior week — real data only; "no data yet" is a valid, complete answer pre-launch |
| 2 | Agent 01 | **Winning themes** — what the data (or, pre-data, leadership feedback) says to lean into |
| 3 | Agent 03 | **Priorities** — the week's objective, audience, core message, content thesis |
| 4 | Agent 14 | **Trend opportunities** — scored; most rejected; POST-TODAY items fast-tracked |
| 5 | Agents 03/05/06/07/11/13/17 | **Concept generation** — 20–30 concepts across the three levels |
| 6 | Agent 04 | **Hooks** — ≥50 across the week's themes, all rated /40; top 10 named |
| 7 | Agent 05 | **Scripts** for concepts selected by scorecard (80+/100 prioritized) |
| 8 | Agent 10 | **Creative briefs** for higher-production pieces + consolidated FILMING LIST |
| 9 | Agent 09 | **Calendar** — the week scheduled; no-repetition check passed; level split reported |
| 10 | Agent 02 | **Voice review** — everything scored; <8 rewritten |
| 11 | Agent 18 | **QA + compliance** — 12-point checklist; flags raised |
| 12 | Humans | **Production + posting** — leadership approves (dashboard/APPROVALS.md); team films, edits, posts |
| 13 | Agent 15 | **Data returns** — metrics into `social_performance.csv` as they arrive |
| 14 | Agents 15/12/16 | **Iteration** — winner detection → variations → next week's inputs |

The loop: **CREATE → POST → MEASURE → LEARN → ITERATE → SCALE.**

## The weekly package (what `/run-week` must produce)

1. **WEEKLY EXECUTIVE BRIEF** — business priorities · campaign priorities · current performance · winning/losing content · trends · opportunities · important dates.
2. **WEEKLY STRATEGY** — main objective · main audience · core message · campaign focus · content thesis.
3. **CONTENT PORTFOLIO** — the week's pieces bucketed Always-On / Campaign / Culture, with the split vs. 45/30/25.
4. **50 HOOKS** — rated; top 10 identified.
5. **CONTENT CONCEPTS** — 20–30, each scored on the scorecard below; only the strongest recommended for production.
6. **PRODUCTION SCRIPTS** — full format (hook, script, shot list, B-roll, overlays, editing, CTA) for selected concepts.
7. **FOUNDER CONTENT** — the week's founder pieces (Agent 06).
8. **UGC CONTENT** — creator assignments (Agents 11+19).
9. **CREATIVE BRIEFS** — for higher-production items.
10. **FILMING LIST** — one consolidated batch-filming checklist: LOCATION → TALENT → PRODUCT → WARDROBE → PROPS → SHOT.
11. **POSTING CALENDAR** — date, time, platform, content, hook, talent, product, CTA, status.
12. **COMMUNITY PLAN** — questions, polls, comment prompts, response videos, community topics (Agent 17).
13. **EXPERIMENT PLAN** — 3–5 tests: hypothesis, variable, control, variant, success metric (Agent 16).
14. **PRIORITY LIST** — MUST PRODUCE / SHOULD PRODUCE / OPTIONAL, capacity-honest.

## The content scorecard — before anything is recommended for production

```
HOOK /10 · ORIGINALITY /10 · BRAND FIT /10 · SHAREABILITY /10 · SAVEABILITY /10
ENTERTAINMENT /10 · VALUE /10 · PRODUCT INTEGRATION /10 · PRODUCTION SIMPLICITY /10
CONVERSION POTENTIAL /10 — TOTAL /100
```

- **80+** — priority production. **65–79** — produce if capacity allows or revise the weak dimension. **<65** — rework or archive; do not produce out of sunk-cost.
- Product Integration scores a *culture* piece 10/10 when product is deliberately absent per its franchise spec — the score measures *appropriateness*, not presence.
- Scores are honest: a week where nothing clears 80 means the concepts get another pass, not that the bar drops.

## The no-repetition system — runs at step 9, blocks the calendar until clear

Review the trailing 21 days (`data/content_database.csv` + calendars) and flag: repeated hooks · repeated opening structures · repeated topics · repeated CTAs · repeated visuals · repeated educational lessons · repeated founder stories. Full rules in Agent 09. Flags are resolved by the CCO (swap, reschedule, or consciously accept with a stated reason). **Consistent, never repetitive.**

## Ground rules

- Steps may compress when inputs are empty (no data → step 1 is one honest line) but never skip silently.
- Everything generated lands in the right stores: scripts → `content/`, hooks → `hook_library.csv`, concepts → `content_ideas.csv`, calendar rows → campaign/master calendar, statuses → `dashboard/APPROVALS.md`.
- The package ends with the priority list — the week must be executable by a small human team.
