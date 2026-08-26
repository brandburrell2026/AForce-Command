# CAMPAIGN ENGINE

**Invoked by:** `/campaign [objective]` and `/launch-plan [product]`. Builds Level-2 campaigns — concentrated attention around major AForce initiatives — into their own `campaigns/<slug>/` folder.

## Campaign triggers

Product launch · flavor launch · athlete partnership · retail launch · event (Brickell/Founding 250) · new market · podcast launch · founder announcement · challenge · seasonal campaign.

## The campaign package (generated in full)

```
CAMPAIGN NAME        — original, AForce-native; never borrowed language
OBJECTIVE            — one measurable objective + guardrail metrics
AUDIENCE             — primary persona + secondary
BIG IDEA             — one sentence that makes the campaign a story, not a promo window
CORE MESSAGE         — the line every asset must be able to trace to
CAMPAIGN STORY       — narrative arc across phases (tease → reveal → prove → sustain)
CONTENT PILLARS      — which of the 12 carry it
HERO CONTENT         — the 1–3 flagship pieces
SUPPORTING CONTENT   — the always-on-adjacent volume
30 HOOKS             — rated, library-registered
10 SHORT-FORM CONCEPTS · 5 UGC CONCEPTS · 3 FOUNDER CONCEPTS · 3 EDUCATIONAL CONCEPTS
POSTING CALENDAR     — CSV, full fields, phase-tagged
CREATIVE BRIEFS      — for hero + high-production supports
CTA STRATEGY         — funnel-staged CTAs per phase; direct-response ceiling respected
A/B TESTS            — 3–5 experiments wired to the campaign (Agent 16)
SUCCESS METRICS      — targets + measurement plan (what we can actually measure, honestly)
REVIEW PLAN          — mid-campaign checkpoint + post-mortem date
```

## Folder structure (campaign memory)

```
campaigns/<slug>/
├── strategy.md          name, objective, big idea, story, phases, hero/support
├── audience.md          personas, insights, platform focus
├── messaging.md         core message, phase messages, CTA strategy, banned angles
├── content-plan.md      all concepts (short-form/UGC/founder/edu) with scorecards
├── hooks.md             the 30 hooks, rated
├── scripts.md           index of production scripts (files live in content/)
├── calendar.csv         the campaign calendar
├── creative-briefs/     one file per brief
└── performance.md       metrics plan → results as they arrive (never invented)
```

## Process

1. Strategist frames objective/audience/big idea → CCO approves the frame.
2. Concepts generated across levels (a campaign still ships culture and education — it's a takeover, not a billboard month).
3. Scorecard pass (80+ priority) → hooks → scripts → briefs → calendar.
4. Guardian + QA full pass; claims check is stricter during launches (higher visibility = higher exposure).
5. Leadership sign-off on the package → production.
6. Campaign runs with weekly engine integration (campaign items appear inside `/run-week`).
7. Post-mortem: what the data said, what enters `learning/`, what the next campaign inherits.

## Rules

- One campaign takeover at a time (Strategist's focus rule).
- Campaign share of the weekly mix rises during the window (30% → up to 50% at peak); Always-On never drops below 30%; the deviation is declared in the weekly portfolio report.
- Every campaign name/line is checked against competitor language (`MESSAGING.md` §5) before adoption.
