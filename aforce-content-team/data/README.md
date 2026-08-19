# DATA — The System's Databases

CSV stores, edited by agents and leadership. **Prime directive: no fabricated data, ever.** Empty cells mean "not yet known" (distinct from `0` = "measured zero"). Performance fields fill only from real platform exports/integrations (`../integrations/social-analytics.md`).

| File | What it is | State |
|---|---|---|
| `content_database.csv` | Every piece of content, cradle to grave. 29 fields incl. level, pillar, statuses, metrics. Seeded with 40 production-ready scripts (SF-001–020, FD-001–010, UGC-001–010), all status DRAFT awaiting the human gate. | seeded |
| `hook_library.csv` | 100 original hooks (H-001–100) across all 16 hook types, tagged by topic/platform/persona. `times_used`/`views`/`watch_rate`/`winner` fill from real usage + data. | seeded |
| `content_ideas.csv` | The idea bank — 100 concepts (CI-001–100) across the 12 pillars, prioritized P1–P3. The system never loses a useful idea: everything lands here first. | seeded |
| `experiments.csv` | Agent 16's log. 10 PLANNED launch-window experiments (EXP-001–010); results/decisions only from real runs. | seeded (planned) |
| `content_feedback.csv` | Leadership's APPROVED/EDITED/REJECTED record — the voice-learning fuel (`../workflows/voice-training-engine.md`). | empty until feedback |
| `social_performance.csv` | Normalized per-post metrics (contract in `../integrations/social-analytics.md`). | empty until posts exist |
| `creators.csv` | Agent 19's creator database. Real people, sourced stats only. | empty until sourcing |

## Conventions

- IDs: `SF-`/`FD-`/`UGC-` content, `H-` hooks, `CI-` ideas, `EXP-` experiments, `CR-` creators, `CAL-` calendar-only concepts.
- Statuses per `../workflows/approval-workflow.md`; only leadership sets APPROVED.
- Dates ISO (`YYYY-MM-DD`); times 24h ET.
- Editing: prefer scripted/CSV-safe edits (quoting matters); every substantive change ships in a commit with a reason.
