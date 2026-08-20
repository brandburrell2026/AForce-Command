# AForce AI Content Operating System

A coordinated multi-agent content department for AForce Hydration, Inc. — not a chatbot, not a single marketing prompt. Nineteen specialized agents share one Brand Brain, one data layer, and one learning loop, and together run content strategy, planning, creation, quality control, and performance iteration.

**Start here:** `CLAUDE.md` (operating instructions) → `brand/AFORCE_BRAND_BRAIN.md` (who AForce is).

## The map

```text
aforce-content-team/
├── CLAUDE.md                 Operating instructions for Claude — read first
├── brand/                    Institutional memory: Brand Brain, products, audiences,
│                             claims, messaging, pillars, voice training, culture
│                             strategy, content franchises
├── agents/                   19 agent specifications (01 CCO → 19 Creator Manager)
├── workflows/                The engines: daily/weekly/monthly, campaign, approval,
│                             performance learning, voice training, winner detection,
│                             content flywheel
├── campaigns/                Campaign memory — one folder per campaign
│   └── hydration-sticks-launch/   "The Ritual Travels" — September 2026
├── calendar/                 Posting calendar conventions + monthly masters
├── content/                  Produced work: scripts/, founder/, ugc/, captions/,
│                             ideas/, production/
├── data/                     CSV databases: content, hooks, ideas, experiments,
│                             feedback, social performance, creators
├── training/                 Real source material leadership drops in — approved/
│                             rejected/edited content, decks, packaging, customer
│                             language, competitors, scientific substantiation
├── integrations/             Analytics + Google Drive asset architecture (spec'd,
│                             not fabricated — nothing is "connected" until it is)
├── learning/                 What the system has learned: voice lessons, content
│                             insights, performance patterns — evidence-tagged
├── dashboard/                TODAY.md (daily ops) + APPROVALS.md (review queue)
├── references/               Curated creative references
└── reports/                  Weekly briefs, /run-week outputs, analyses
```

## Commands

Slash commands are installed at the repo root (`.claude/commands/`). The founder operates the department through four (full guide: `FOUNDER_WORKFLOW.md`):

- **`/run-day`** — the operational daily brief: posts, filming, editing, approvals, trends, comments, top hook, live experiment, deadlines.
- **`/content-war-room`** — the operating dashboard: pipeline, agent status, campaign state, performance (real or `NO VERIFIED DATA`), winners, risks, next actions.
- **`/ceo-review`** — the executive approval interface: a ≤10-bullet summary and a numbered APPROVE/EDIT/REJECT/DEFER queue with evidence; decisions are recorded to `data/ceo_decisions.csv` and learned from via evidence thresholds (`workflows/executive-decision-loop.md`).
- **`/run-week`** — the full weekly department cycle: executive brief → strategy → portfolio → 50 scored hooks → scored concepts → scripts → founder + UGC → briefs → filming list → calendar → community plan → experiments → priority list.

Plus: `/content-today`, `/content-week`, `/content-month`, `/hooks [topic]`, `/script [concept]`, `/campaign [objective]`, `/repurpose [content]`, `/analyze-content`, `/double-down`, `/founder-content`, `/ugc [product]`, `/launch-plan [product]`.

The 19 agents are also installed as invocable subagents (`.claude/agents/`, e.g. `hook-writer`, `brand-voice-guardian`).

## The operating loop

```
LISTEN → IDENTIFY OPPORTUNITIES → CREATE → REVIEW → PRODUCE → PUBLISH
   → MEASURE → IDENTIFY WINNERS → REPURPOSE → ITERATE
   → UPDATE BRAND + PERFORMANCE LEARNING → CREATE AGAIN
```

Human approval is structural: nothing moves from DRAFT to POSTED without leadership marking it APPROVED (see `workflows/approval-workflow.md` and `dashboard/APPROVALS.md`). Leadership feedback (APPROVED / EDITED / REJECTED) feeds `data/content_feedback.csv` and becomes voice lessons — the system gets more AForce over time.

## Ground rules

- No fabricated metrics, findings, or claims — ever. Empty data stays empty until real data arrives.
- Health/physiology language comes only from `brand/CLAIMS.md`.
- Knowledge is category-tagged: BRAND FACT / LEADERSHIP PREFERENCE / PERFORMANCE INSIGHT / HYPOTHESIS / AI RECOMMENDATION — and the categories never merge.
- The system challenges weak ideas instead of agreeing with them.
