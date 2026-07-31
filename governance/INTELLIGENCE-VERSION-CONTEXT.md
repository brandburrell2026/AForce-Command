# Intelligence Version-Context Matrix

**Status:** FROZEN (Phase 3.5) · **Frozen:** 2026-07-22 · **Authority:** tier 3
**Complements:** `MODEL-VERSION-REGISTRY.md` (which versions exist) — this document freezes
**when each version is required**.

---

## 1. Matrix

| # | Version | Applicable record types | Mandatory / nullable | Increment trigger | Current |
|---|---|---|---|---|---|
| 1 | **Profile version** | every intelligence event; graph node | **Mandatory** where a profile exists; nullable pre-onboarding | Major profile variable change | **Live** — `aforce_profile_versions` |
| 2 | **Baseline version** | events; nodes; baseline comparisons | Nullable (opens on recalibration) | Recalibration | **Live** — `aforce_baseline_versions` |
| 3 | **HydroState model version** | score snapshots | ✅ **IMPLEMENTED IN SOURCE** (`DR-009`). Nullable — null = "not recorded", never backfilled. Current: **`hydrostate-v0`**. Stamped centrally by `scoreSnapshotRepo.ts`. **NOT deployed.** | **Any approved change that can alter HydroState output for identical inputs** (incl. coefficient and eligibility-rule changes; bug fixes only if output changes) | ✅ **G-6 CLOSED in source** |
| 4 | **Graph schema version** | nodes, edges | Implicit in table definition | table change | schema **not deployed** (R-21) |
| 5 | **Graph derivation version** | every node and edge | **Mandatory** | node/edge rule, confidence formula, or material threshold change | `graph-v1.0` |
| 6 | **Living Performance Model version** | LPM snapshots | **Mandatory** once snapshots persist | lesson-selection rule change | **unassigned** — shipped pre-registry |
| 7 | **Prediction Engine model version** | predictions | **Mandatory** | projection logic change | not built |
| 8 | **Prediction policy version** | predictions | **Mandatory** | DR-003 threshold change | not built |
| 9 | **Performance DNA derivation version** | patterns, pattern history | **Mandatory** | pattern/hysteresis rule change | not built |
| 10 | **Evidence Engine version** | explanations | **NOT IMPLEMENTED** | explanation logic change | **Gap G-7** |
| 11 | **§42 gate-policy version** | every gate decision | **Mandatory** | any policy rule change | `p42-v1.0` |
| 12 | **Locale-policy version** | every gate decision | **Mandatory** | any locale rule/status change | `l42-v1.0` |
| 13 | **Command-policy version** | commands | **NOT IMPLEMENTED** | command selection rule change | **Gap G-8** |
| 14 | **Source-adapter version** | imported physiological events | **NOT IMPLEMENTED** | provider API/mapping change | **Gap G-9** |

## 2. Behaviour per version

| Version | Replay behaviour | Historical reproducibility | Supersession | Rollback | Audit |
|---|---|---|---|---|---|
| Profile / Baseline | Append-only; historical rows never rewritten | **Full** — snapshots immutable | New row; prior retained | Point at prior version id | `aforce_profile_change_log` |
| Graph derivation | Deterministic ids include the version ⇒ **replay is idempotent within a version** | Full within a version; **not comparable across a major bump** | Major bump ⇒ re-derive or retire | Old rows retained, marked | node/edge `model_version` |
| LPM | Snapshot per generation | Full once versioned | New snapshot supersedes | Prior snapshot retained | snapshot `model_version` |
| Prediction (model + policy) | Never re-derived retroactively — **an issued prediction stands as issued** | Full | Expiry, then supersession | Calibration affects future only | prediction record |
| DNA derivation | Re-evaluated on new evidence | Full via pattern history | State transition logged | Prior state in history | `aforce_dna_pattern_history` |
| §42 gate + locale policy | **Every decision is reproducible from candidate + both policy versions** | Full | New version; decisions keep the version they ran under | Pin the prior version | gate decision audit |

## 3. Frozen rules

1. **Every derived record stores the derivation version that produced it.** A record without one
   is retired, never reinterpreted.
2. **A major bump means records are not comparable.** Re-derive or retire — **never silently
   reinterpret old records under new logic.**
3. **Historical records are never rewritten by a version change.**
4. **If a major bump retires patterns a user has already seen, that is a surface change requiring
   founder approval** — a pattern vanishing unexplained is a trust breach (Principle 10).
5. **Gate decisions must be reproducible** from candidate + gate-policy version + locale-policy
   version + evidence refs + provenance path + model version + timestamp.
6. **Profile and baseline versions are referenced by id, never copied.**

## 4. Gaps (recorded, not assumed away)

| Gap | Detail | Consequence |
|---|---|---|
| ~~**G-6**~~ | ✅ **CLOSED 2026-07-22.** Model-version source, persistence field, central repository stamping and tests all implemented in source (`DR-009`). | **Closed in source. NOT deployed** — the column does not yet exist in any database. |
| **G-7** | Evidence Engine has no version. | An explanation-logic change is unreconstructable. |
| **G-8** | Command policy has no version. | A command-selection change cannot be correlated with outcomes. |
| **G-9** | Source adapters have no version. | A provider mapping change silently alters imported data. |
| G-10 | LPM shipped pre-registry with no version assigned. | Assign at first change. |

**G-6 status: ✅ CLOSED in source (2026-07-22).** D-08 approved under Option A and implemented:
authoritative constant `hydrostate-v0` in `config/hydroStateModel.ts`; nullable
`hydrostate_model_version` column; central stamping in `lib/db/src/scoreSnapshotRepo.ts`;
23 tests passing. **Deployment is a separate, unclaimed step — the column exists in no database.**
