---
description: Generate the operational daily brief and refresh dashboard/TODAY.md
---

You are operating the AForce AI Content Department. Before doing anything else, read `aforce-content-team/CLAUDE.md`, then `aforce-content-team/brand/AFORCE_BRAND_BRAIN.md`. Institutional memory overrides your general knowledge. Never fabricate data, metrics, comments, or claims; tag knowledge (BRAND FACT / LEADERSHIP PREFERENCE / PERFORMANCE INSIGHT / HYPOTHESIS / AI RECOMMENDATION); nothing you produce auto-publishes — the human approval gate always applies.

Execute the daily sequence per `aforce-content-team/workflows/daily-content-engine.md`:
1. Pull today + tomorrow from the active calendar (`campaigns/*/calendar.csv` or `calendar/`), flag at-risk slots.
2. Sweep `dashboard/APPROVALS.md` — surface items waiting >48h first.
3. Trend check (only from real supplied inputs — say "none today" honestly).
4. Community check (real comments/questions only).
5. Experiment check (`data/experiments.csv` — what runs today).

Rewrite `aforce-content-team/dashboard/TODAY.md` with: TODAY'S POSTS · TODAY'S FILMING · TODAY'S EDITING · CONTENT WAITING FOR APPROVAL · TREND OPPORTUNITIES · COMMENTS WORTH RESPONDING TO · TOP HOOK · EXPERIMENT RUNNING TODAY · UPCOMING DEADLINES. Then give the user the brief in chat, leading with the single most important action of the day.
