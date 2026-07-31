# Phase 3 · J — Test and Validation Plan

**Status:** DESIGN ONLY — no tests written. **Updated:** 2026-07-22
**Complements:** `governance/INTELLIGENCE-VALIDATION-MATRIX.md` (V-1…V-8 + per-system checks)

Existing harness: Vitest, `environment: node`, `@/` alias, pure-runner globs already covering
`utils/`, `services/`, `store/`, `hooks/`, `featureFlags/`, `data/`, plus `api-server`. **New pure
modules placed inside those paths are covered with no config change** (A24).

---

## 1. Unit

| Target | Key assertions |
|---|---|
| Graph builder | Deterministic keys; idempotent re-derivation; supporting **and** contradiction counts; distinct-day counting |
| Graph query | Filters `invalidation_status='active'` by default; returns confidence + provenance with every result |
| Confidence | Thin evidence cannot reach high confidence; single-day clustering penalized; contradictions reduce; staleness decays |
| Prediction gates | Each `DR-003` gate independently blocks; correct state resolution across all four |
| DNA lifecycle | Only the five states; hysteresis prevents oscillation; **no numeric output type exists** |
| LPM | Existing daily-lesson tests still green (**M-1 regression gate**); on-track preserved |
| Event envelope | `dayIndexBasis` round-trips; three clocks stay distinct |
| Merge | First-wins; idempotent |

## 2. Integration

| Scenario | Assertion |
|---|---|
| Ingest → graph → query | Event batch produces expected relationships with provenance |
| Profile version change | Baseline-relative conclusions invalidated and re-derived |
| Baseline recalibration | Confidence re-evaluated against the new baseline |
| Prediction → outcome | Reconciliation writes correct verdict; original prediction unedited |
| Pattern transitions | Each transition logged to history with reason |
| Evidence adapter | Refuses to emit without a provenance path |
| Founder inspector | Reads Sandbox; **writes nothing to Production** |

## 3. Synchronization

| Scenario | Assertion |
|---|---|
| Duplicate `clientEventId` | Lands exactly once; second returns `duplicate` |
| Retry storm | N retries → 1 row |
| Partial batch | Per-item status; no all-or-nothing failure |
| Conflict | **Server wins**; client discards local derivation |
| Offline → online | Queue drains in `occurredAt` order (Water-First) |
| **User switch** | Previous user's queue stays under their key; **no cross-user replay** (**R-13**) |
| Flag off | Storage key null; every persist/hydrate/clear a no-op; **byte-identical to today** |
| Cross-device | Two devices converge to identical server state |
| Attempt cap | `failed` items retained and surfaced, never silently dropped |

## 4. Deletion propagation

The highest-consequence suite — it proves the `DR-002` hard invariant.

| Scenario | Assertion |
|---|---|
| Delete one source event | Dependents recomputed via provenance links |
| Delete all supporting evidence | **Relationship becomes `invalidated` — never remains active** |
| Delete evidence behind a pattern | Pattern retired; transition logged |
| Delete evidence behind a prediction | Prediction invalidated (`source_deleted`) |
| Delete behind LPM snapshot | Snapshot regenerated or invalidated |
| **Cache propagation** | Deleted-derived content removed from the **device cache**, not just the server |
| Account-wide deletion | All derived records gone; audit row retained |
| Audit survives | Deletion is itself recorded |
| **Property test** | For any deletion set: no `active` derived record has an entirely invalidated `derivedFrom` set |

That last one is the invariant stated as an executable property rather than a list of cases.

## 5. Backtesting

Replay historical events against the derivation pipeline to check the engine behaves sensibly
before any user sees it.

| Check | Purpose |
|---|---|
| Replay real ledger history | Do relationships form at plausible rates? |
| Sufficiency-gate timing | How long until a typical user reaches `emerging` / `calibrated` under `DR-003`? |
| False-pattern rate | Do patterns form from noise? |
| Stability | Do patterns oscillate across replay? |

**`DR-003` thresholds are explicitly beta-validation defaults.** Backtesting is how they get
revised — the numbers are expected to move.

## 6. Confidence calibration

| Check | Assertion |
|---|---|
| Predicted vs. observed | Match rate tracks stated confidence |
| Overconfidence | Systematic over-prediction damps the calibration factor |
| **Calibration ceiling** | Calibration may only **tighten**, never inflate past evidence-derived confidence |
| Per-type isolation | One type's calibration cannot contaminate another |

## 7. Compliance-copy testing — §42

**The mechanical gate. A surface without these tests is not shippable.**

| Check | Assertion |
|---|---|
| **Banned-term sweep** | No banned term (*risk, injury, diagnosis, diagnose, prevent, prevention, treat, cure, deficiency, disorder*) reachable in **any** emitted copy key, **in any locale** |
| Voice included | Spoken output covered, not just rendered text |
| `context_only` labeling | A context-only estimate can never render as personal learning (**R-16**) |
| Fail-closed | Unevaluable gate blocks output |
| Physician routing | Recurring/severe symptom path preserved |
| Guardian copy | "Injury-risk protection" absent; canonical wording present (`DR-003`) |
| DNA framing | No genetic, deterministic, or fixed-identity language |
| LPM register | "Your body taught us" preserved; Legacy uses no prevention/causal medical language |

Locale coverage matters: a banned term can enter through a translation even when the English key
is clean.

## 8. Score Protection

| Check | Assertion |
|---|---|
| No reducer dispatch | No intelligence module dispatches a reducer action |
| No score mutation | Score, band, and Performance Memory unchanged by any intelligence path |
| Read-only gating allowed | Reading score for fail-closed gating passes |
| Outbox freezes score | Queued events transport frozen values; never recompute |
| **Adherence isolation** | Follow-rate is **not** fed into Command Confidence™ |
| HydroScan isolation | Advisory-only preserved (DR-001) |

## 9. Load

| Scenario | Target |
|---|---|
| Batch ingest | Sustained rate without queue growth |
| Graph construction | Latency scales sub-linearly with per-user event volume |
| Query | Insight fetch within budget at realistic graph size |
| Deletion cascade | Account-wide deletion completes within budget |
| Back-derivation | Bulk rebuild is resumable, rate-limited, off the request path |
| Storage growth | Per-user growth stays within retention-class expectations |

## 10. Offline

| Scenario | Assertion |
|---|---|
| Capture offline | Events queue; nothing lost |
| Serve from cache | Cached insights **labeled as cached** |
| No canonical state | **No new predictions or patterns** |
| Empty cache offline | **Insufficient data** — never a fabricated default |
| Extended offline | Queue bounded; trimming logged, never silent |
| Reconnect | Drains in order; converges to server state |

## 11. Rollback

| Scenario | Assertion |
|---|---|
| Flag off mid-flight | Clean stop; no partial state; no data loss |
| Backend off, surface on | **Fails closed** — surface shows nothing, never stale or fabricated |
| Tables absent, code deployed | Feature reports insufficient-data; **app functions identically** |
| Re-enable after rollback | Resumes; re-derivation idempotent |
| **Core-independence** | HydroState, logging, commands, scoring work identically with the entire layer absent |

## 12. Gate summary

| Gate | Blocks |
|---|---|
| Score Protection (§8) | **Everything** |
| Deletion propagation (§4) | Any persistence beyond Founder Mode |
| §42 copy tests (§7) | **All §39/§40 user-facing output** |
| Sync (§3) | Multi-device rollout |
| Backtesting + calibration (§5, §6) | Threshold finalization |
| Load (§9) | General availability |
