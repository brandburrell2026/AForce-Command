# MONTHLY CONTENT ENGINE

**Invoked by:** `/content-month`. Produces the next 30 days: theme, calendar skeleton, campaign integration, and the month's learning agenda.

## Sequence

1. **Month review** (Agents 15 + 01): last month vs. objectives — real numbers, honest gaps, winner/loser summary; pillar and level performance. Pre-data months: leadership-feedback review instead, labeled as such.
2. **Monthly theme** (Agent 03): one dominant argument for the month, derived from quarterly strategy + campaign pipeline (Brand Brain dates: launch Sept, Brickell/Founding 250 Oct, TV runway Dec–Jan).
3. **Campaign integration**: active campaign windows block out their takeover days; the master calendar defers to campaign calendars inside those windows.
4. **30-day calendar** (Agent 09): full-field rows for week 1; concept + pillar + platform sketch for weeks 2–4 (they get fully specified by each `/run-week`). Level quota check across the whole month.
5. **Franchise schedule**: each active franchise gets its cadence slots (F02 weekly, F04 weekly, etc. per `CONTENT_FRANCHISES.md`).
6. **Production plan**: filming batches for the month (founder batch, creator deliverable due-dates, hero-content shoot days).
7. **Learning agenda** (Agent 16): which 3–5 hypotheses this month's experiments will settle.
8. **Monthly report skeleton** → `reports/YYYY-MM-month-plan.md`; calendar CSV → `calendar/YYYY-MM-content-calendar.csv` (or the campaign calendar when a campaign owns the month).

## Rules

- A month has one theme; campaigns may interrupt it but not erase it.
- Weeks 2–4 stay flexible on purpose — the weekly engine re-plans from fresh data; the monthly engine provides the spine, not a straitjacket.
- Seasonal/cultural moments enter from Agent 14's forward map only when they pass the participation test.
- End-of-month: pillar/level mix actuals vs. plan reported; persistent deviations become a CCO recommendation to leadership (re-weight or re-commit).
