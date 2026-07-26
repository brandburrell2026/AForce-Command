# Phase 3 · I — Migration and Rollback Plan

**Status:** DESIGN ONLY — **no migrations written.** **Updated:** 2026-07-22

---

## 1. Migration principles

| # | Principle |
|---|---|
| 1 | **Additive only.** New tables and new columns. No existing column is altered, renamed, or dropped. |
| 2 | **No data migration required.** The graph is built forward from events; nothing existing is reshaped. |
| 3 | **Every step is independently deployable and independently reversible.** |
| 4 | **Backward compatible.** An older client works unchanged against the newer server. |
| 5 | **Dark by default.** Schema lands before behavior; behavior lands before surfaces. |

## 2. Sequence

| Step | Scope | Reversible by | Risk |
|---|---|---|---|
| **I-0** | `aforce_model_versions`, `aforce_intelligence_audit` — no dependencies | Drop tables | 🟢 |
| **I-1** | `aforce_intelligence_events` + indexes | Drop table | 🟢 |
| **I-2** | `aforce_provenance_links` | Drop table | 🟢 |
| **I-3** | `aforce_graph_nodes`, `aforce_graph_relationships` | Drop tables | 🟢 |
| **I-4** | `aforce_privacy` column additions (**no JSONB default**) | Drop columns | 🟡 touches an existing table |
| **I-5** | `aforce_predictions`, `aforce_prediction_outcomes` | Drop tables | 🟢 |
| **I-6** | `aforce_dna_patterns`, `aforce_dna_pattern_history` | Drop tables | 🟢 |
| **I-7** | `aforce_lpm_snapshots` | Drop tables | 🟢 |
| **I-8** | Ingest endpoint, flag off | Disable route | 🟡 |
| **I-9** | Client outbox + encrypted cache, flag off | Flag off | 🟠 client-side, needs **R-12** resolved first |
| **I-10** | Derivation services, flags off | Flags off | 🟡 |
| **I-11** | Surfaces, one flag at a time | Per-surface flag | 🟠 user-visible |

**I-4 is the only step touching an existing table**, and it is column-additive. Everything through
I-7 is pure creation — nothing existing can break.

## 3. Backward compatibility

| Concern | Guarantee |
|---|---|
| Older clients | New endpoints are additive; existing endpoints unchanged in shape |
| Existing tables | Untouched except additive columns on `aforce_privacy` |
| Existing engines | Signatures unchanged; tests stay green (A10, A13) |
| Scoring | `scoringEngine.ts` / `statusColor.ts` untouched |
| Navigation | Unchanged (Build Rule 14) |
| Flag-off | Byte-identical to today |

## 4. Partial rollout

Server-authoritative derivation makes cohort rollout clean — derived records are server-owned, so
enabling for a cohort cannot produce inconsistent client-side state.

1. Founder Mode only (Sandbox).
2. Internal accounts in Production, backend flags only, **no surfaces**.
3. Founding 250 subset, backend only — validates ingest volume and derivation cost.
4. Surfaces one flag at a time, per `DR-003` order for DNA.

**Watch at each step:** ingest error rate, sync queue depth, derivation latency, storage growth,
`failed` sync items, and — before any surface — §42 copy-test results.

## 5. Rollback

| Failure | Rollback |
|---|---|
| Surface issue | Flag off. Instant, no data loss. |
| Derivation wrong | Backend flag off; records retained for inspection; re-derive after fix |
| Sync misbehaving | `spec_intelligenceSync` off; outbox holds; no loss |
| Ingest overload | Disable route; clients queue locally and drain later |
| Schema problem | Drop the new tables — nothing existing depends on them |
| Bad model version | Major bump → re-derive or retire per registry |

**No rollback path deletes user data.**

## 6. Failed-migration behavior

| Situation | Behavior |
|---|---|
| Migration fails mid-run | Steps are independent; a failed step leaves prior steps valid. No step is required for the app to function. |
| Table created, code not deployed | Harmless — unused tables |
| Code deployed, table missing | **Fail closed** — the feature reports insufficient-data, never crashes the app |
| Partial index build | Query performance degrades; correctness unaffected |
| `aforce_privacy` column add fails | I-4 is isolated; retry independently |

**Governing rule:** the intelligence layer is **never load-bearing for core app function**. HydroState,
logging, commands, and scoring must work identically if every table in this package is absent.

## 7. Graph rebuild strategy

The graph is fully derivable from `aforce_intelligence_events`, which is the point of storing
primary events separately from derived records.

| Scenario | Strategy |
|---|---|
| Major model bump | Re-derive all relationships at the new version; old records retired per registry |
| Corruption | Truncate derived tables (nodes, relationships, provenance links); rebuild from events |
| Back-derivation at first run | **Recommended** — build from existing ledger history rather than only forward, since events are already recorded and derivation is idempotent under first-wins merge. Opens `DR-003` sufficiency gates sooner. |
| Per-user rebuild | Scoped by `user_id`; supports targeted repair without a global rebuild |

**Rebuild is idempotent** — deterministic keys plus first-wins merge mean running it twice equals
running it once.

**Cost note:** back-derivation over the full user base is a bulk job. It should run per-user,
rate-limited, off the request path, and be resumable. Sizing it is an implementation-time concern,
flagged in Output K.
