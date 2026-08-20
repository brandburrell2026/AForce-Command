# APPROVALS — Content Review Queue

*The human gate (`../workflows/approval-workflow.md`). Leadership: change a status, add a note — the system learns from every decision (notes flow to `../data/content_feedback.csv`). Statuses: READY FOR REVIEW → (APPROVED / EDITED / REJECTED+reason) → READY TO FILM → READY TO EDIT → READY TO SCHEDULE.*

**How to act on a row:** edit the Status/Reviewer Notes cells here, or tell Claude (e.g., "approve SF-004", "reject SF-006 — too generic", "edit SF-005: change X"). Claude records the decision, updates the database, and extracts lessons from edits/rejections.

## READY FOR REVIEW (needs leadership decision)

| ID | Concept | Platform | Hook | Script | Campaign | Owner | Status | Reviewer Notes |
|---|---|---|---|---|---|---|---|---|
| SF-004 | Thirst is a lagging indicator | TikTok | H-018 | content/scripts/sf-004 | launch (P1) | Agent 05 | READY FOR REVIEW | |
| SF-012 | First Action template | TikTok | H-054 | content/scripts/sf-012 | — | Agent 05 | READY FOR REVIEW | |
| SF-002 | Sodium (F04 ep1) | Shorts | H-016 | content/scripts/sf-002 | — | Agent 07/05 | READY FOR REVIEW | |
| SF-016 | Non-Negotiables vol.1 | TikTok | H-042 | content/scripts/sf-016 | — | Agent 05 | READY FOR REVIEW | |
| SF-009 | Quiet Hours 5 AM | Reels | H-053 | content/scripts/sf-009 | — | Agent 05/10 | READY FOR REVIEW | |
| SF-006 | Soursop first-timers | TikTok | H-081 | content/scripts/sf-006 | launch-adj | Agent 05 | READY FOR REVIEW | |
| SF-010 | Sweat loses more | Shorts | H-019 | content/scripts/sf-010 | — | Agent 07/05 | READY FOR REVIEW | |
| SF-013 | Different Arenas 4:45 | Reels | H-070 | content/scripts/sf-013 | — | Agent 05/10 | READY FOR REVIEW | |
| SF-003 | Moment Before: fighter | Reels | custom | content/scripts/sf-003 | — | Agent 05/10 | READY FOR REVIEW | |
| SF-017 | Heat rules | Shorts | H-029 | content/scripts/sf-017 | — | Agent 07/05 | READY FOR REVIEW | |
| SF-015 | Electrolytes ≠ energy | Shorts | H-021 | content/scripts/sf-015 | — | Agent 07/05 | READY FOR REVIEW | |
| SF-014 | Hotel room ritual | TikTok | H-027 | content/scripts/sf-014 | launch | Agent 05 | READY FOR REVIEW | |
| SF-005 | Ritual travels: airport | Reels | H-092 | content/scripts/sf-005 | launch | Agent 05/10 | READY FOR REVIEW | |
| SF-007 | Seven demands | Reels | H-067 | content/scripts/sf-007 | launch | Agent 05 | READY FOR REVIEW | |
| SF-018 | Which flavor | Reels | H-099 | content/scripts/sf-018 | launch | Agent 05 | READY FOR REVIEW | |
| SF-020 | Variety Pack 15s (DR) | Reels | custom | content/scripts/sf-020 | launch | Agent 05 | READY FOR REVIEW | |
| SF-001 | pH on the can | TikTok | H-007 | content/scripts/sf-001 | — | Agent 05 | READY FOR REVIEW | |
| FD-001 | 4:58 beach | Reels | H-033 | content/founder/fd-001 | — | Agent 06 | READY FOR REVIEW | film-ready, fully canonical |
| FD-002 | The call | Reels | custom | content/founder/fd-002 | — | Agent 06 | READY FOR REVIEW | optional slots |
| FD-004 | The spreadsheet | Shorts/LI | H-006 | content/founder/fd-004 | — | Agent 06 | READY FOR REVIEW | film-ready |
| FD-006 | Julius's dream | Reels | custom | content/founder/fd-006 | — | Agent 06 | READY FOR REVIEW | |
| FD-007 | Vision/structure duo | TikTok | custom | content/founder/fd-007 | — | Agent 06 | READY FOR REVIEW | |
| FD-010 | Why Pause | Reels | custom | content/founder/fd-010 | — | Agent 06 | READY FOR REVIEW | film-ready |
| UGC-001…010 | 10 creator briefs | TT/Reels | in briefs | content/ugc/ | launch (3) | Agent 11 | READY FOR REVIEW | approve briefs → casting starts |

## NEEDS REVISION / BLOCKED (cannot be approved as-is)

| ID | Concept | Blocker | Decider |
|---|---|---|---|
| SF-011 | Alkaline honesty | meta-sensitive myth-bust — explicit leadership sign-off required | Leadership |
| SF-019 | When you don't need us | market-shrinking honesty play — leadership sign-off | Leadership |
| SF-008 | Expensive salt | "thirty-some failed batches" figure unverified — confirm or genericize | Founders |
| FD-003 | Two years impossible | 1 rejection-story [SLOT] | Brandon |
| FD-005 | Formulate/Fail loop | batch-detail [SLOT]s | Founders |
| FD-008 | Launch month inside | ALL substance is [SLOT]s — needs real checklist/numbers | Brandon |
| FD-009 | Hardest no | needs a real decision + sensitivity review | Leadership |

## APPROVED
*(empty — leadership hasn't reviewed yet)*

## READY TO FILM / READY TO EDIT / READY TO SCHEDULE
*(fill as items clear the gate; the filming batches are pre-grouped in TODAY.md and the run-week filming list)*
