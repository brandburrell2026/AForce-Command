---
description: The operating dashboard of the whole AForce content department — status, pipeline, agents, campaigns, performance, next actions
---

You are producing the **Content War Room** — the single operating view of the AForce AI Content Department. It **synthesizes** the existing agents, workflows, dashboards, and databases; it never creates a parallel system, never re-plans what `/run-week` already planned, and never invents activity.

Read first: `aforce-content-team/CLAUDE.md` + `aforce-content-team/brand/AFORCE_BRAND_BRAIN.md`.

## Sources (inspect all before writing)

`dashboard/TODAY.md` · `dashboard/APPROVALS.md` · `data/content_database.csv` · the active calendar (`campaigns/*/calendar.csv`, else `calendar/`) · `data/experiments.csv` · `data/creators.csv` · `data/social_performance.csv` · `data/ceo_decisions.csv` · `learning/` (all three files) · each active campaign folder · the latest `reports/*run-week*.md` · `agents/README.md` (the roster) · `workflows/winner-detection.md` (winner rules). All paths relative to `aforce-content-team/`.

## Pipeline stage mapping (deterministic — use exactly this)

War-room stages ← database/approvals statuses:
**IDEA** ← IDEA (idea bank + DB) · **SCRIPT** ← DRAFT · **REVIEW** ← REVIEW (incl. APPROVED-FOR-LEADERSHIP wait) · **APPROVED** ← APPROVED · **PRODUCTION** ← PRODUCTION/READY TO FILM · **EDIT** ← READY TO EDIT · **SCHEDULED** ← SCHEDULED/READY TO SCHEDULE · **PUBLISHED** ← POSTED (< 14 days) · **MEASURING** ← POSTED with metrics still accruing · **WINNER** ← WINNER · **ARCHIVED** ← ARCHIVED/LOSER-retired. Do not claim a stage the source data doesn't support.

## Output — exactly these ten sections

### 1. TODAY
From TODAY.md + calendar, current date: content being created · awaiting approval (with wait times) · scheduled today · campaign activity · founder content · UGC activity · trend opportunities (real inputs only — else "no trend inputs supplied") · blockers. Lead with the single most important thing.

### 2. THIS WEEK
From the latest run-week report + calendar: weekly priorities · campaigns · production requirements (filming batches) · publishing requirements (slots to fill) · experiments live/pending · creator requirements (casting/deliverables due) · founder requirements (batches, [SLOT]s to resolve).

### 3. PIPELINE
Counts + notable items per stage using the mapping above. Empty stages shown as 0 — never padded.

### 4. AGENT STATUS
One row per agent (all 19): agent · responsibility (one clause) · current assignment · inputs · expected output · blockers · next action. **An agent with no artifacts or runs shows `NOT RUN` / `NO DATA` — never fabricated activity.** (Assignments derive from the database `owner`/`talent`/status fields, the run-week priority list, and workflow state — cite where each assignment comes from if non-obvious.)

### 5. CAMPAIGN STATUS
Per active campaign (from `campaigns/`): objective · audience · platforms · current phase (by date vs. strategy.md phases) · approved messaging (state whether messaging is leadership-approved or still pending sign-off) · assets (produced vs. remaining, from DB + calendar) · performance (real only) · risks · next action.

### 6. PERFORMANCE
Real data from `social_performance.csv` only: views, reach, watch time, retention/completion, engagement, shares, saves, comments, clicks, CTR, conversions, CPA, revenue — whichever exist. For anything absent, write **`NO VERIFIED DATA`** (analytics not connected, metric not exported, or nothing posted). **Never invent numbers. Never estimate to fill a cell.**

### 7. WINNERS
Apply `workflows/winner-detection.md`: winners require computed baselines (≥20 posts or 60 days) and ≥1.5× the category signal. Name each winner's category and the numbers behind it. With insufficient data: "No winners can be declared yet — baselines require n≥20 posts; current n = X." Provisional standouts may be *noted* as PROVISIONAL, never crowned.

### 8. DOUBLE DOWN
Recommendations: repost · repurpose · expand · series-ify · convert to founder content · convert to UGC · re-test with new hook · test on another platform · retire. **Two labeled lists: EVIDENCE-BASED (cite the data) and HYPOTHESIS (no data yet — reasoned bets).** Pre-data, everything sits under HYPOTHESIS and says so.

### 9. RISKS / BLOCKERS
Approval bottlenecks (items waiting >48h) · missing assets · missing analytics · unsupported claims (from CLAIMS CHECK flags + APPROVALS blocked list) · incomplete briefs/[SLOT]s · overdue content vs. calendar · inconsistent messaging · broken workflows/references. Each with owner + the unblocking action.

### 10. NEXT ACTIONS
```
DO TODAY — …
DO NEXT — …
WAITING FOR DATA — …
WAITING FOR CEO — … (these should match the /ceo-review queue)
BLOCKED — … (with what unblocks each)
```

## Relationship to other commands

`/run-day` *generates* the daily plan; `/run-week` *generates* the weekly plan; the war room *reports state* across both plus pipeline, agents, campaigns, and performance — read their outputs, don't redo their work. Items needing executive judgment are pointed at `/ceo-review`, not decided here. If TODAY.md is stale (older than today), refresh it via the `/run-day` sequence first, then report.

## Integrity rules (mandatory)

No fabricated analytics, creator performance, testimonials, sales, conversions, evidence, or approvals. `NO VERIFIED DATA` and `NOT RUN` are first-class answers. Simulated/demo data is labeled. Historical records are never silently rewritten; raw source data is never overwritten with interpretation. Nothing publishes automatically — human approval remains required.
