# EXECUTIVE DECISION LOOP

How CEO decisions get recorded, remembered, and — carefully — learned from. This loop turns Brandon's judgment into institutional memory **without ever letting a single decision silently rewrite the brand.**

```
/ceo-review queue → CEO decides → ceo_decisions.csv (the ledger)
   → statuses updated (APPROVALS.md + content_database.csv)
   → text edits → content_feedback.csv → voice-training engine
   → pattern detection → learning/ceo_preferences.md (thresholded)
   → Brandon CONFIRMS a candidate → only then a Brand Brain/MESSAGING edit
```

## 1. Recording a decision (every APPROVE / EDIT / REJECT / DEFER)

Append one row to `data/ceo_decisions.csv`:

| Field | Content |
|---|---|
| decision_id | D-#### sequential |
| timestamp | ISO datetime (UTC) |
| item_id / item_type | SF-/FD-/UGC-/CAL-/campaign slug / content · campaign · claim · strategy |
| decision | APPROVE / EDIT / REJECT / DEFER |
| original_recommendation | what the system proposed (one line or file ref) |
| ceo_modification | what Brandon changed (EDIT only; file ref for long text) |
| reason | Brandon's stated reason, verbatim-ish; **empty if none given — never invented** |
| platform / audience / content_pillar / campaign / hook_style | the affected dimensions (fill what applies) |
| confidence | how clearly the reason generalizes: LOW (unstated/situational) / MEDIUM (stated, specific) / HIGH (explicit general instruction) |
| lesson_candidate | one-line transferable lesson **candidate** (may be empty) |
| status_after | the new content status |
| recorded_by | ceo-review / run-day / manual |

Side effects, same session: update the item's row in `data/content_database.csv` and its entry in `dashboard/APPROVALS.md`. For EDITs of copy/scripts, also log the before/after pair in `data/content_feedback.csv` so the voice-training engine can diff it. DEFERs keep the item in REVIEW with the defer note and (only if Brandon gave one) a revisit date.

## 2. Evidence thresholds — decisions become preferences slowly

Pattern detection runs over the ledger (during `/ceo-review` section F and the weekly engine):

| Evidence | State | Meaning |
|---|---|---|
| **1 occurrence** | **OBSERVATION** | Noted in `learning/ceo_preferences.md`. Informs nothing automatically. |
| **2 consistent occurrences** | **EMERGING PREFERENCE** | Writers *see* it as a caution flag; Guardian may mention it in reviews; still not a rule. |
| **3+ consistent occurrences** | **CANDIDATE LEARNED PREFERENCE** | Surfaced to Brandon in `/ceo-review` §F with its evidence rows for explicit confirmation. |
| **Brandon confirms** | **CONFIRMED — CEO PREFERENCE** | Only now may the durable rule be written into the Brand Brain / MESSAGING / voice_lessons (tagged CEO PREFERENCE, citing the decision ids). |

"Consistent" means same lesson direction across different items — a contradicting decision resets the count and is recorded (taste is allowed to be situational). An explicit instruction from Brandon ("make this a rule") skips the ladder: record it as CONFIRMED with the instruction as evidence.

## 3. What this loop never does

- Never edits `brand/` files from a decision row — confirmation is a separate, explicit Brandon action.
- Never invents a `reason` Brandon didn't give; an unexplained REJECT is logged reason-empty and mined only as a weak signal.
- Never re-litigates recorded decisions: `/ceo-review` treats the ledger as settled unless something material changed (and says what changed).
- Never deletes or rewrites ledger rows — corrections are new rows referencing the old decision_id.
- Never manufactures decisions to make the learning system look busy. An empty ledger is an empty ledger.

## 4. Category discipline (inherited from CLAUDE.md, restated because this file mints knowledge)

Everything derived here is labeled: **FACT** (canonical/leadership-stated) · **SOURCE EVIDENCE** (the ledger rows themselves) · **CEO PREFERENCE** (confirmed) · **PERFORMANCE SIGNAL** (from real metrics — different loop) · **OBSERVATION / HYPOTHESIS** (unconfirmed patterns) · **AI RECOMMENDATION** (the system's own suggestions). The categories never merge.
