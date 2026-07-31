# Phase 3 · C — Proposed Persistence Model

**Status:** DESIGN ONLY — **no migrations written, no schema changed.** **Updated:** 2026-07-22
**Governed by:** `DR-002` — PostgreSQL authoritative; limited encrypted non-authoritative device cache.

---

## 1. Conventions inherited from the existing schema

Adopted deliberately, from `lib/db/src/schema/aforce.ts`:

| Convention | Why |
|---|---|
| `aforce_*` table prefix, snake_case columns | Consistency |
| **Append-only + JSONB payload + denormalized flat columns** | `aforceHydroScans` pattern — forward-compatible without migration, still queryable |
| `(user_id, client_*_id)` unique index for idempotency | `aforceProfileVersions` contract; retries return the existing row |
| `timestamp with time zone`, `defaultNow()` | Existing convention |
| **Never a JSONB column default** | `docs/SCHEMA_DRIFT.md` — drizzle-kit compact-vs-canonical diff re-emits `SET DEFAULT` forever. Application owns defaults. |
| Per-user + time composite indexes | Existing read patterns |

## 2. Tables — extensions to existing

| Table | Change | Notes |
|---|---|---|
| `aforce_profile_versions` | **None** | Referenced by FK. Already append-only + idempotent. |
| `aforce_baseline_versions` | **None** | Referenced by FK. Confidence/observationCount semantics reused, not re-derived. |
| `aforce_profile_change_log` | **None** | Read as an invalidation trigger. |
| `aforce_privacy` | **Extend** — intelligence consent + retention preference columns | **No JSONB default.** Application supplies. |
| `aforce_analytics_events` | **None** | Pseudonymity boundary must hold — intelligence events are user-identified and stay separate. |

## 3. Proposed new tables

### 3.1 `aforce_intelligence_events` — canonical event sink

Append-only. The single source of truth for §38 inputs.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | text NOT NULL | Clerk id |
| `client_event_id` | text NOT NULL | **Idempotency key** |
| `category` | text NOT NULL | §B.3 |
| `type` | text NOT NULL | |
| `schema_version` | integer NOT NULL default 1 | |
| `occurred_at` / `recorded_at` | timestamptz NOT NULL | device clocks |
| `received_at` | timestamptz NOT NULL defaultNow | server clock |
| `day_index` | integer NOT NULL | |
| `day_index_basis` | text NOT NULL | `local-calendar` \| `utc-floor` |
| `profile_version_id` | integer | FK → `aforce_profile_versions.id` |
| `baseline_version_id` | integer | FK → `aforce_baseline_versions.id` |
| `model_version` | text | null for primary events |
| `privacy_class` | text NOT NULL | S0–S3 |
| `freshness` / `signal_quality` | text | from `utils/confidence/*` |
| `confidence` | real | null for primary observations |
| `invalidation_status` | text NOT NULL default `'active'` | active \| invalidated \| superseded |
| `invalidation_reason` / `invalidated_at` / `superseded_by` | text / timestamptz / text | |
| `provenance` | jsonb NOT NULL | `{source, derivedFrom[], sourceRecordRef}` |
| `payload` | jsonb NOT NULL | category-specific |
| `retention_class` | text NOT NULL | §6 |

**Indexes:** `(user_id, client_event_id)` UNIQUE · `(user_id, occurred_at DESC)` ·
`(user_id, category, occurred_at DESC)` · `(user_id, invalidation_status)` ·
GIN on `provenance` for reverse-derivation lookup.

### 3.2 `aforce_graph_nodes` (§38)

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | text NOT NULL | |
| `node_key` | text NOT NULL | deterministic identity (`kind:descriptor`) |
| `kind` | text NOT NULL | `context` \| `behavior` \| `outcome` |
| `descriptor` | jsonb NOT NULL | normalized attributes |
| `first_observed_at` / `last_observed_at` | timestamptz | |
| `observation_count` | integer NOT NULL default 0 | |
| `model_version` | text NOT NULL | |
| `invalidation_status` | text NOT NULL default `'active'` | |

**Indexes:** `(user_id, node_key)` UNIQUE · `(user_id, kind)`.

### 3.3 `aforce_graph_relationships` (§38)

The edges. Carries evidence **for and against**.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | text NOT NULL | |
| `relationship_key` | text NOT NULL | deterministic from endpoints + model version |
| `context_node_id` / `behavior_node_id` / `outcome_node_id` | integer | FK → nodes |
| `observation_count` | integer NOT NULL default 0 | supporting |
| `contradiction_count` | integer NOT NULL default 0 | **counter-evidence — never discarded** |
| `confidence` | real NOT NULL | derived, never asserted |
| `observation_period_start` / `_end` | timestamptz | |
| `distinct_day_count` | integer NOT NULL default 0 | serves the `DR-003` 3-distinct-days gate |
| `model_version` | text NOT NULL | |
| `invalidation_status` | text NOT NULL default `'active'` | |
| `last_evaluated_at` | timestamptz | |

**Indexes:** `(user_id, relationship_key)` UNIQUE · `(user_id, confidence DESC)` ·
`(user_id, invalidation_status)`.

### 3.4 `aforce_provenance_links` (§41)

The reverse index that makes deletion propagation tractable. Without it, "which relationships
depend on this event?" is a full scan.

| Column | Type |
|---|---|
| `id` | serial PK |
| `user_id` | text NOT NULL |
| `derived_kind` | text NOT NULL — `relationship` \| `prediction` \| `pattern` \| `snapshot` |
| `derived_id` | integer NOT NULL |
| `source_event_id` | integer NOT NULL — FK → `aforce_intelligence_events.id` |
| `model_version` | text NOT NULL |

**Indexes:** `(source_event_id)` — the deletion-cascade entry point ·
`(derived_kind, derived_id)` — the explainability entry point ·
`(user_id, derived_kind, derived_id, source_event_id)` UNIQUE.

### 3.5 `aforce_model_versions` (§41)

| Column | Type |
|---|---|
| `id` | serial PK |
| `system` | text NOT NULL — `graph` \| `prediction` \| `dna` \| `lpm` |
| `version` | text NOT NULL — `<system>-v<major>.<minor>` |
| `comparable_to_prior` | boolean NOT NULL |
| `migration_action` | text — `re-derive` \| `retire` \| `none` |
| `notes` | text |
| `created_at` | timestamptz defaultNow |

**Index:** `(system, version)` UNIQUE. Mirrors `governance/MODEL-VERSION-REGISTRY.md`.

### 3.6 `aforce_predictions` (§39)

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | text NOT NULL | |
| `client_prediction_id` | text NOT NULL | idempotency |
| `prediction_type` | text NOT NULL | |
| `state` | text NOT NULL | `insufficient_data` \| `context_only` \| `emerging` \| `calibrated` — **`DR-003`** |
| `confidence` | real | |
| `evidence_count` / `distinct_day_count` | integer | |
| `observation_period_start` / `_end` | timestamptz | |
| `issued_at` / `expires_at` | timestamptz NOT NULL | **projections expire** |
| `model_version` | text NOT NULL | |
| `invalidation_status` | text NOT NULL default `'active'` | |
| `payload` | jsonb NOT NULL | |

**Indexes:** `(user_id, client_prediction_id)` UNIQUE · `(user_id, issued_at DESC)` ·
`(user_id, expires_at)` for expiry sweeps.

### 3.7 `aforce_prediction_outcomes` (§39)

What actually happened. The calibration substrate.

| Column | Type |
|---|---|
| `id` | serial PK · `user_id` text |
| `prediction_id` | integer FK → `aforce_predictions.id` |
| `outcome` | text — `matched` \| `diverged` \| `unresolved` |
| `observed_event_id` | integer FK → events |
| `resolved_at` | timestamptz |
| `delta` | jsonb |

**Index:** `(prediction_id)` UNIQUE.

### 3.8 `aforce_dna_patterns` (§40)

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK · `user_id` text | |
| `pattern_key` | text NOT NULL | deterministic |
| `state` | text NOT NULL | **only** `emerging` \| `observed` \| `high_confidence` \| `recalibrating` \| `retired` |
| `supporting_observations` / `contradictory_observations` | integer NOT NULL | **both mandatory** |
| `confidence` | real NOT NULL | |
| `observation_period_start` / `_end` | timestamptz | |
| `evidence_count` | integer NOT NULL | |
| `last_evaluated_at` | timestamptz NOT NULL | |
| `explanation_key` | text NOT NULL | i18n key — **never inline copy** |
| `user_disposition` | text | `null` \| `challenged` \| `dismissed` |
| `model_version` | text NOT NULL | |

**No numeric score column exists, by construction** (Founder Decision 4, validation D-1).
**Indexes:** `(user_id, pattern_key)` UNIQUE · `(user_id, state)`.

### 3.9 `aforce_dna_pattern_history` (§40)

Append-only state transitions — the audit trail behind "why did this pattern change?".

`id` · `user_id` · `pattern_id` FK · `from_state` · `to_state` · `reason` · `confidence_at` ·
`model_version` · `created_at`. **Index:** `(pattern_id, created_at DESC)`.

### 3.10 `aforce_lpm_snapshots` (§61)

`id` · `user_id` · `client_snapshot_id` (idempotency) · `kind` (`lesson` \| `on_track`) ·
`payload` jsonb · `model_version` · `generated_at` · `invalidation_status`.
**Index:** `(user_id, client_snapshot_id)` UNIQUE · `(user_id, generated_at DESC)`.

### 3.11 `aforce_intelligence_audit` (§41)

Append-only. `id` · `user_id` · `action` (`access` \| `export` \| `delete` \| `invalidate` \|
`re-derive`) · `actor` (`user` \| `system` \| `founder_mode`) · `scope` jsonb ·
`affected_counts` jsonb · `created_at`. **Index:** `(user_id, created_at DESC)`.

## 4. Relationship overview

```
aforce_profile_versions ──┐
aforce_baseline_versions ─┤ (existing, FK only — NOT duplicated)
                          ▼
              aforce_intelligence_events ◄──── aforce_provenance_links ────┐
                          │                          (reverse index)       │
                          ▼                                                │
              aforce_graph_nodes ──► aforce_graph_relationships ───────────┤
                                              │                            │
                          ┌───────────────────┼──────────────────┐         │
                          ▼                   ▼                  ▼         │
                 aforce_predictions   aforce_dna_patterns  aforce_lpm_snapshots
                          │                   │
                          ▼                   ▼
          aforce_prediction_outcomes   aforce_dna_pattern_history

              aforce_model_versions  ·  aforce_intelligence_audit
```

## 5. Deletion behavior per table

| Table | On source deletion |
|---|---|
| `aforce_intelligence_events` | Hard-delete the source row; cascade via `aforce_provenance_links` |
| `aforce_graph_relationships` | Recompute counts; if all supporting events gone → **`invalidated`**, never left active |
| `aforce_graph_nodes` | Decrement; orphaned node → `invalidated` |
| `aforce_predictions` | `invalidated` (`source_deleted`) |
| `aforce_dna_patterns` | Re-evaluate; unsupported → `retired`; transition logged to history |
| `aforce_lpm_snapshots` | Regenerate or `invalidated` |
| `aforce_provenance_links` | Cascade-delete with the source event |
| `aforce_dna_pattern_history` | **Retained** — audit trail, non-derived |
| `aforce_intelligence_audit` | **Retained** — the record of the deletion itself |

## 6. Retention classes

`DR-002` forbids unrestricted permanent retention.

| Class | Applies to | Proposed retention |
|---|---|---|
| `R-raw` | Primary behavior/context/physiological events | Rolling window, config-driven; needed for re-derivation |
| `R-derived` | Relationships, patterns, snapshots | Live while supported; invalidated when unsupported |
| `R-ephemeral` | Predictions | Until `expires_at` + a short outcome-reconciliation window |
| `R-audit` | Audit, pattern history, model versions | Long-lived — these *are* the accountability record |
| `R-versioned` | Profile/baseline versions | Existing policy unchanged (never deleted) |

**Open:** exact windows per class are a founder/legal decision — see Output K.

## 7. Local cache representation

Non-authoritative. **Encrypted.** Per-user keyed.

| Cache store | Holds | Bound |
|---|---|---|
| `outbox` | pending events, sync state | until `acked` |
| `hydroStateContext` | recent HydroState context | small rolling window |
| `recentCommands` | recent commands | small rolling window |
| `graphInsights` | **selected** graph-derived insights | strict cap |
| `lpmSnapshot` | current approved LPM snapshot | single record |

**Rules:** never authoritative (server wins) · encrypted at rest (`OPEN-RISKS.md` **R-12** — all
existing stores are plaintext AsyncStorage; `expo-secure-store` is keychain-backed and unsuitable
for bulk, so a key-in-SecureStore + encrypted-blob approach is the likely shape, to be settled in
Output K) · per-user storage key with generation guard on user transition (**R-13**) · deferred
write until after boot-hydration · `clear()` bumps the generation counter · **deletion propagates
to the cache**, not only the server.
