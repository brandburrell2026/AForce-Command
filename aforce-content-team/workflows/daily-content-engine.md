# DAILY CONTENT ENGINE

**Invoked by:** `/run-day` (operational brief) and `/content-today` (today's content generation). Keeps the day executable and the dashboard true.

## Morning sequence (`/run-day`)

1. **Calendar pull** (Agent 09): today's scheduled posts + tomorrow's at-risk items (approved-but-unproduced).
2. **Status sweep**: `dashboard/APPROVALS.md` — what's waiting on leadership, what's cleared to film/edit/schedule.
3. **Trend check** (Agent 14): any POST-TODAY urgency items from supplied inputs; most days: none, and the brief says none.
4. **Community check** (Agent 17): comments worth responding to from available material.
5. **Experiment check** (Agent 16): what's running today and what it needs (e.g., variant B posts at 19:00).
6. **Assemble the brief** → update `dashboard/TODAY.md`:

```
TODAY'S POSTS — platform · time · content_id · hook · status
TODAY'S FILMING — from the filming list, batched
TODAY'S EDITING — assets due, editor notes
CONTENT WAITING FOR APPROVAL — oldest first, with wait time
TREND OPPORTUNITIES — scored, or "none today"
COMMENTS WORTH RESPONDING TO — triaged (Agent 17)
TOP HOOK — today's single best available hook + where it should go
EXPERIMENT RUNNING TODAY — id, arm, metric
UPCOMING DEADLINES — 72-hour horizon
```

## Content generation (`/content-today`)

For each unfilled slot in today/tomorrow's calendar: concept (scorecard-checked) → hook options → script/copy → Guardian → QA → REVIEW status in the approvals dashboard. Same-day speed never skips the Guardian, QA, or the human gate.

## Rules

- The dashboard reflects reality: if nothing is scheduled, TODAY.md says so and points at the bottleneck.
- Daily trend/community sections state their input sources; empty inputs = honest "no inputs supplied today."
- End-of-day: post statuses updated (POSTED + asset links), misses rolled forward with a reason logged in `performance_notes`.
