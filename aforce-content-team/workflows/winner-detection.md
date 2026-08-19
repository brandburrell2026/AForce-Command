# WINNER DETECTION

Defines what "winning" means before anyone is tempted to define it after the fact. A winner is **relative outperformance against the right baseline** — never raw views alone.

## Baselines (computed from our own data as it accumulates)

- **Platform baseline** — trailing median per metric per platform (last 20 posts or 60 days, whichever is larger).
- **Content-type baseline** — median within the same format/pillar/level (education compares to education; culture to culture).
- Pre-data state: no baselines → no winners. The first ~20 posts build the baseline; early standouts are noted as PROVISIONAL, not crowned.

## Signals evaluated

View velocity (first 24–48h vs. baseline curve) · completion rate · saves · shares · comments (volume + quality) · follows generated · conversions/clicks · and each vs. both baselines.

## The five winner categories — one piece rarely wins them all

| Category | Primary signals | What it tells us |
|---|---|---|
| **ATTENTION WINNER** | view velocity, reach vs. baseline | the hook/format stops the scroll |
| **ENGAGEMENT WINNER** | completion, watch time, saves | the content keeps its promise |
| **COMMUNITY WINNER** | comments, shares-with-comment, submissions | it started a conversation people joined |
| **CONVERSION WINNER** | link clicks, conversions, profile→follow chains | it moved someone to act |
| **BRAND WINNER** | shares, save-to-view, sentiment, "this is my people" comments | it built the identity (culture content's honest scoreboard) |

Detection threshold (starting rule [REC], tune with data): ≥1.5× the relevant baseline on the category's primary signal, minimum absolute floor to avoid tiny-number noise. Every declared winner states its category, numbers, and baseline.

## When a winner is detected

1. Status → WINNER (category-tagged) in the database; hook's `winner` flag set in the library.
2. **Within 72h:** Agent 12 generates the repurposing package, and `/double-down` produces **5–10 intelligent variations** — *not* the same script rewritten:
   - new hook (same payoff) · new angle (same topic) · new talent (founder↔creator) · new setting · new format (video→carousel→thread) · deeper version (the 90s or long-form cut) · shorter version (the 15s distillation) · contrarian version (steel-man the objection) · founder version · UGC version.
3. Each variation is a normal piece: scorecard, Guardian, QA, human gate. Winner lineage recorded (`notes: variation_of: ID`).
4. The *pattern* (not just the piece) goes to the learning loop as a candidate — one winner is an anecdote; a repeated pattern is a candidate insight.

## Losers

Below ~0.5× baseline on its category's primary signal → LOSER tag, one-line autopsy (hook? topic? execution? timing?), and a stop-rule check: three same-pattern losers = stop the pattern (recorded in learning). No shame, no burial — losers teach cheaper than winners.

## Prohibitions

No winners from vibes. No cross-category inflation ("it converted" when it merely reached). No variation floods that skip the quality gates. No baseline cherry-picking.
