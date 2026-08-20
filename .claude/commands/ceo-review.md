---
description: Executive approval interface — synthesize everything requiring Brandon's judgment into one decision queue
---

You are producing the **CEO Review** for Brandon Burrell — the executive approval interface of the AForce AI Content Department. Brandon should never need to read hundreds of files; your job is to reduce the organization to the decisions that genuinely require executive judgment, with evidence.

Read first: `aforce-content-team/CLAUDE.md`, then `aforce-content-team/brand/AFORCE_BRAND_BRAIN.md`. Institutional memory overrides your general knowledge.

## Sources to inspect (all of these, before writing anything)

1. `aforce-content-team/dashboard/APPROVALS.md` — the review queue and blocked items
2. `aforce-content-team/dashboard/TODAY.md` — current operational state
3. `aforce-content-team/data/content_database.csv` — statuses, [verify] notes
4. `aforce-content-team/data/ceo_decisions.csv` — what Brandon already decided (never re-ask a decided item unless something material changed)
5. `aforce-content-team/data/content_feedback.csv` + `learning/voice_lessons.md` + `learning/ceo_preferences.md` — learned preferences
6. Active campaigns: each `aforce-content-team/campaigns/*/strategy.md` + `performance.md`
7. `aforce-content-team/data/social_performance.csv` + `learning/content_insights.md` — real performance only
8. `aforce-content-team/data/experiments.csv` — decisions that depend on running tests
9. `aforce-content-team/brand/CLAIMS.md` + each script's CLAIMS CHECK section — compliance state
10. The latest report in `aforce-content-team/reports/` — the department's own current plan

## Output — exactly these sections, in this order

### A. EXECUTIVE SUMMARY
**Maximum 10 bullets.** What the content organization is focused on · major campaigns · upcoming launches · important content opportunities · meaningful performance signals (only when real data exists — otherwise one bullet: "No verified performance data yet") · significant risks · count of decisions awaiting CEO approval. No filler bullets — fewer than 10 is fine.

### B. CEO DECISIONS REQUIRED
Group into **APPROVE / EDIT / REJECT / DEFER** recommendation buckets (your recommendation — Brandon decides). For each decision:
1. **Item** (ID + one-line description)
2. **Why it matters**
3. **Recommendation** (one, decisive)
4. **Evidence** (cite files/rows; "no data — judgment call" is valid evidence framing)
5. **Risk** (of approving AND of not approving)
6. **Deadline/urgency** — only real ones from the calendar or campaign dates. **Never manufacture urgency**; "no deadline" is a valid answer.
7. **Exact CEO decision required** — phrased so Brandon can answer in one word or one sentence.

Do not surface trivia: anything the specs already authorize (e.g., routine Always-On production of approved concepts) does not need the CEO. Decisions already recorded in `ceo_decisions.csv` are settled — show them only under "previously decided" if context requires. **Standing unresolved items are presented as one line each in the queue — never re-explained at length in report after report** (C-005): the full case for each was made once; link to where it lives.

### C. TOP CONTENT
The highest-priority content currently proposed (typically 5–10 items, from the scorecards + calendar criticality). For each: platform · audience · content pillar · hook · concept · CTA · campaign · rationale (why this one matters now) · claim/compliance status (✔ clean / ⚠️ flagged: what) · approval status.

### D. CLAIMS / COMPLIANCE
Surface every open item, each with location and what resolution requires: unsupported health claims · questionable alkaline/pH framing · ingredient claims needing substantiation (including anything touching the [PENDING] stick formulation) · comparative claims · performance claims · medical/disease language · missing evidence/sources · content requiring legal or regulatory review. **Never convert an unsupported claim into an approved one — approval authority for claims is leadership + counsel via `brand/CLAIMS.md` §7, not this report.** If a claim's source cannot be found, say exactly that.

### E. BRAND ALIGNMENT
Anything currently proposed that is inconsistent with the Brand Brain, the approved founder voice, product positioning, audience strategy, or the active campaign's messaging. Cite the rule breached and propose the fix. "No misalignments found" is a valid section when true — do not invent findings.

### F. LEARNING
What the system believes it has learned from CEO decisions so far, with every statement labeled exactly one of: **FACT / CEO PREFERENCE / OBSERVATION / HYPOTHESIS / RECOMMENDATION** (per `workflows/executive-decision-loop.md`: 1 occurrence = observation, 2 consistent = emerging preference, 3+ consistent = candidate learned preference — still requiring Brandon's confirmation before entering the Brand Brain). **A single CEO edit never becomes a permanent rule automatically.** Show candidate preferences awaiting confirmation, if any.

### G. FINAL CEO QUEUE
End with a plain numbered queue — one line each, answerable fast:

```
CEO DECISION QUEUE
1. APPROVE — …
2. EDIT — …
3. REJECT — …
4. DEFER — …
```

Order by real urgency, then impact. Every queue item must have appeared in section B.

## After Brandon responds

Record each decision through `aforce-content-team/workflows/executive-decision-loop.md`: append the row to `data/ceo_decisions.csv`, update the item's status in `dashboard/APPROVALS.md` and `data/content_database.csv`, route text edits (original vs. final) to `data/content_feedback.csv`, and update `learning/ceo_preferences.md` per the evidence thresholds. **Never write to `brand/` files from a decision — Brand Brain changes happen only when Brandon explicitly confirms a candidate preference.**

## Integrity rules (mandatory)

No fabricated analytics, testimonials, sales, approvals, or evidence — anywhere. Missing data is stated as missing ("NO VERIFIED DATA"). Simulated/demo material is labeled as such. This command synthesizes the existing system (`/run-day`, `/run-week`, the dashboards, the database) — it never spawns a parallel one. The goal is fewer, better decisions reaching the CEO — if the queue is empty, say so and stop; an empty queue is a healthy state, not a failure to produce.
