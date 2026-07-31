# Intelligence Event Registry

**Status:** FROZEN (Phase 3.5) · **Frozen:** 2026-07-22 · **Authority:** tier 3

Canonical event vocabulary. **No new runtime events were implemented in Phase 3.5** — this
registry inventories what exists and freezes the naming, ownership, and eligibility rules.

---

## 1. Actual inventory found in code

| Source | Count | Location |
|---|---|---|
| **Analytics events (Phase 1)** | **32** | `lib/analytics-contract/src/index.ts` → `PHASE1_EVENTS`; sink `aforce_analytics_events` (**pseudonymous**) |
| **Command-event ledger kinds** | **14** | `utils/intelligence/commandEvents.ts` → `CommandEventKind` (5 live, 9 reserved-architecture) |
| **Domain ledgers** | 4 tables | `aforce_intake_logs`, `aforce_confirmations`, `aforce_score_snapshots`, `aforce_hydro_scans` |
| **Canonical intelligence events** | 11 categories | `types/intelligenceEvents.ts` (**contract only — no runtime emitter**) |

**Critical boundary (frozen):** the analytics sink is **pseudonymous** (`analytics_id`, Clerk id
deliberately absent). Canonical intelligence events are **user-identified**. These are two
separate vocabularies and **must never be merged** — reuse would re-identify analytics.

## 2. Field contract

Every canonical intelligence event carries: canonical name · category · source · authoritative
ledger · required fields · **idempotency key (`clientEventId`, frozen at creation)** · user scope ·
event time (`occurredAtMs`) · recorded time (`recordedAtMs`) · privacy class (S0–S3) ·
retention class (R0–R7) · provenance behaviour · HydroState impact eligibility ·
completed-behaviour requirement · graph mapping · implementation status.

**Frozen:** `clientEventId` is minted on-device and **never regenerated on retry**. Idempotency is
`(user_id, client_event_id)` UNIQUE — the same contract as `aforceProfileVersions.clientChangeId`.

## 3. Canonical registry — the 23 reconciled events

**Legend — HydroState eligibility:** ✅ = may change score (completed behaviour) · ❌ = must never.

| Canonical name | Category | Authoritative ledger | Privacy | Retention | HydroState | Completed behaviour? | Graph mapping | Status |
|---|---|---|---|---|---|---|---|---|
| `hydration_logged` | behavior | `aforce_intake_logs` | S1 | R2 | ✅ | **Yes** | `action` node | **Live** |
| `hydration_confirmed` | behavior | `aforce_confirmations` | S1 | R2 | ✅ | **Yes** | `action` node | **Live** |
| `command_completed` | behavior | ledger `command_confirmation` | S1 | R2 | ✅ | **Yes** | `action` node + `action_completed` edge | **Live** |
| `command_skipped` | behavior | ledger | S1 | R2 | ❌ | No | `action_skipped` edge | **Specified** |
| `workout_imported` | physiological | wearable adapters | S2 | R1 | ❌ | No (import ≠ behaviour) | `observation` node | **Live** (WHOOP/Garmin/Oura/Strava) |
| `workout_completed` | behavior | ledger `performance_session` | S1 | R2 | ✅ | **Yes** | `action` node | **Specified** (reserved kind) |
| `sleep_imported` | physiological | wearable adapters | S2 | R1 | ❌ | No | `observation` node | **Live** |
| `recovery_observation` | outcome | ledger `recovery_session` | S1/S2 | R2 | ❌ | No | `outcome` node | **Specified** |
| `environmental_pressure` | context | `aforce_demand_snapshots` | S1 | R3 | ❌ | No | `context` node | **Live** |
| `heat_exposure` | context | derived from weather | S1 | R3 | ❌ | No | `context` node | **Live** |
| `caffeine_logged` | behavior | `aforce_intake_logs` | S1 | R2 | ✅ | **Yes** | `action` node | **Live** |
| `alcohol_logged` | behavior | `aforce_intake_logs` | S1 | R2 | ✅ | **Yes** | `action` node | **Live** |
| `hydroscan_result` | outcome | `aforce_hydro_scans` | **S3** | R2 | ❌ **never (DR-001)** | **No** | `observation` node (advisory) | **Live** |
| `product_scan` | behavior | `aforce_hydro_scans` | S3 | R2 | ❌ **never** | **No** | advisory only | **Live** |
| `recommendation_viewed` | context | analytics only | S1 | R1 | ❌ **never** | **No** | **not graph-mapped** | **Live** (analytics) |
| `product_purchased` | behavior | Stripe → Postgres | S1 | R2 | ❌ **never** | **No** | **not graph-mapped** | **Live** |
| `product_consumed` | behavior | `aforce_intake_logs` | S1 | R2 | ✅ **only via an approved completed-action event** | **Yes — only when logged** | `action` node | **Live** |
| `prediction_created` | prediction | `aforce_predictions` | S0 | R5 | ❌ | No | derived | **Specified** — not built |
| `prediction_outcome_observed` | prediction_outcome | `aforce_prediction_outcomes` | S1 | R5 | ❌ | No | derived | **Specified** — not built |
| `pattern_created` | pattern | `aforce_dna_patterns` | S1 | R6 | ❌ | No | derived | **Specified** — not built |
| `pattern_recalibrated` | pattern | `aforce_dna_pattern_history` | S1 | R6 | ❌ | No | derived | **Specified** — not built |
| `source_deleted` | audit | `aforce_intelligence_audit` | S0 | R7 | ❌ | No | triggers cascade | **Specified** — not built |
| `evidence_invalidated` | audit | `aforce_intelligence_audit` | S0 | R7 | ❌ | No | triggers cascade | **Specified** — not built |

## 4. Explicit reconciliations

| Item | Finding |
|---|---|
| **`recommendation_viewed`** | Exists in analytics (`impact_shown`, `recovery_coach_viewed`) but is **deliberately not graph-mapped and never score-eligible**. Viewing is not behaviour. |
| **`product_purchased`** | Tracked commercially (`subscription_started`, Stripe) but **never score-eligible** and **not graph-mapped**. |
| **`product_consumed`** | Score-eligible **only** when it arrives as a logged intake (an approved completed-action event). Consumption inferred from a purchase is **never** score-eligible. |
| **`hydroscan_result` / `product_scan`** | Advisory-only, permanently (DR-001). `receipt_scanned` / `receipt_verified` / `receipt_activated` exist in analytics; none is score-eligible. |
| **`workout_imported` vs `workout_completed`** | Distinct. An **import** is an observation of a third-party record; a **completion** is user behaviour. Only the latter is score-eligible. Import is currently live; completion is a reserved ledger kind with no emitter. |
| **`sleep_imported`** | Observation only. Sleep never directly changes score; it feeds Sleep Readiness. |
| **Naming drift** | Analytics uses `water_cycle_logged`; the ledger uses `intake`; this registry freezes the canonical intelligence name as **`hydration_logged`**. The three are **different vocabularies for the same real behaviour** and must be mapped, never unified. |
| **`performance_age_snapshot`** | Present in both analytics and the ledger. Explicitly **display-only, never a scoring input**. |

## 5. Frozen rules

1. **Only completed behaviour is score-eligible.** The complete score-eligible set is:
   `hydration_logged` · `hydration_confirmed` · `command_completed` · `caffeine_logged` ·
   `alcohol_logged` · `product_consumed` (when logged) · `workout_completed` (when built).
2. **Scans, views, and purchases are never score-eligible.** Frozen permanently.
3. **Analytics and intelligence vocabularies stay separate.** Pseudonymous vs. user-identified.
4. **`clientEventId` is frozen at creation** and never regenerated.
5. **Day-index basis travels with every event** (`local-calendar` vs `utc-floor`), never normalized.
6. **Derived events never become primary observations.**
7. **No new runtime event may be added without change control.**

## 6. Gaps

| Gap | Detail |
|---|---|
| G-1 | **No runtime emitter exists** for canonical intelligence events. The envelope is a contract; nothing produces one yet. |
| G-2 | 9 of 14 ledger kinds are **reserved architecture with no emitter** (`lock_in_*`, `protocol_*`, `recovery_session`, `performance_session`, `ai_command_*`, `execution_event`). |
| G-5 | No automated check prevents an analytics event name and an intelligence event name from colliding. |
