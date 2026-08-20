# APPROVAL WORKFLOW — THE HUMAN GATE

**The rule that governs everything:** no piece of content moves from DRAFT to POSTED automatically. Leadership retains final publishing approval. The system prepares; humans decide.

## Status vocabulary (used in every database, calendar, and dashboard)

```
IDEA → DRAFT → REVIEW → APPROVED → PRODUCTION → SCHEDULED → POSTED
                                          ↓ (after data)
                              WINNER / LOSER / ITERATE / ARCHIVED
```

| Status | Meaning | Who moves it here |
|---|---|---|
| IDEA | In the idea bank; not yet developed | anyone |
| DRAFT | Script/copy exists | Agents 05/06/08/11 |
| REVIEW | Passed Guardian (≥8) + QA checklist; awaiting leadership | Agent 18 |
| APPROVED | **Leadership said yes** — the only humans-only transition | leadership only |
| PRODUCTION | Being filmed/edited (sub-states in APPROVALS.md: READY TO FILM / READY TO EDIT / READY TO SCHEDULE) | production team |
| SCHEDULED | On the calendar with a time | Agent 09 |
| POSTED | Live; asset link recorded | whoever posts |
| WINNER / LOSER | Assigned by winner detection from real data | Agent 15 |
| ITERATE | Winner variation in progress | Agent 12/16 |
| ARCHIVED | Retired | CCO |

## The review path (before leadership sees anything)

1. **Agent 02** — voice score ≥8 (rewrites below that).
2. **Agent 18** — 12-point QA; claims flags attached. QA passes it forward as APPROVED-FOR-LEADERSHIP, which lands it in REVIEW.
3. **`dashboard/APPROVALS.md`** — the piece appears in READY FOR REVIEW with: content id, concept, platform, hook, script link, campaign, owner, status, reviewer notes.

## How leadership acts (the feedback loop)

Leadership reviews in `dashboard/APPROVALS.md` (or directly in files) and marks each piece:

- **APPROVED** — optionally with notes → status APPROVED; piece may be copied to `training/approved/`.
- **EDITED** — leadership changes the text → both versions + the diff go to `data/content_feedback.csv`; the Voice Training Engine extracts the lesson; the edited version proceeds as APPROVED.
- **REJECTED** — with a reason category (too generic / too salesy / too corporate / too soft / too long / doesn't sound like AForce / weak hook / bad product integration / unsupported claim / boring / too similar to competitor / wrong audience) → `content_feedback.csv`; piece returns to DRAFT or ARCHIVED.

Every leadership action is learning fuel — the Guardian consults this history before future reviews.

Every decision (including DEFER) is also recorded as a row in `../data/ceo_decisions.csv` per `executive-decision-loop.md` — the executive ledger that `/ceo-review` reads so Brandon is never re-asked a settled question, and the source the preference-learning thresholds run over. Recording a decision never edits the Brand Brain; confirmed patterns get there only through the loop's explicit confirmation step.

## Escalations that bypass nothing but move faster

- ⚠️ QA claim flags: only the named decider (leadership / counsel / Agent 07) clears them; the piece cannot reach APPROVED with an open flag.
- POST-TODAY trend items: same gates, front of queue, leadership pinged explicitly.
- Founder [SLOT]s: unresolved slots block APPROVED.

## Timing discipline

REVIEW items older than 48h are surfaced at the top of `/run-day`'s approvals section with wait times. The system may nag; it may never skip.
