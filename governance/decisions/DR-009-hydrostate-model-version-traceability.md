# DR-009 — HydroState Model-Version Traceability (resolves D-08)

- **Status:** ✅ **ACCEPTED — Option A approved.** ✅ **IMPLEMENTED IN SOURCE 2026-07-22** (D-09 cleared). ⚠️ **NOT DEPLOYED.**
- **Date:** 2026-07-22 · **Decider:** Brandon (founder)
- **Resolves:** `D-08`, `D-09` · **Closes:** **G-6** (implemented in source)
- **Governs:** `aforce_score_snapshots`, HydroState scoring-model versioning

---

## 1. Decision

**HydroState score snapshots must preserve the version of the scoring model used to calculate
each snapshot.**

**Rationale:** historical HydroState scores become difficult to compare, reproduce, audit, or
explain when scoring logic changes without a recorded model version.

**Approved implementation (Option A):** an additive **nullable** model-version field on
`aforce_score_snapshots`, following the existing `profileVersionId` / `baselineVersionId` pattern.

### 1.1 Historical rows

**Remain null** unless a version can be proven from trustworthy evidence. **No backfill.**

### 1.2 Meaning of null — binding

> **null = "scoring-model version was not recorded."**

**Null must NEVER be interpreted as:** version 1 · the current model version · a default version ·
an inferred version.

Readers must branch on null. Coercing it is a correctness defect, not a convenience.

## 2. Scope of this authorization

**Authorized:** D-08 implementation · its tests · migration artifact · documentation · governance
updates.

**NOT authorized:** §39 implementation · prediction algorithms · prediction thresholds ·
prediction-type activation · graph-schema deployment · production deployment · Performance DNA ·
LPM expansion · **scoring-formula changes** · **historical recalculation** · **fabricated version
backfills** · UI changes.

## 3. Inspection performed (2026-07-22)

| Item | Finding |
|---|---|
| `aforce_score_snapshots` | `lib/db/src/schema/aforce.ts:185–225`. Carries `profileVersionId`, `baselineVersionId` — **nullable, no default**, historical rows untouched. |
| **Authoritative model-version source** | ❌ **DOES NOT EXIST** — see §4.1 |
| Score-**write** paths (server) | **TWO independent insert sites**, no central path — see §4.2 |
| Score-**read** paths | `routes/aforce/journal.ts`, `achievements.ts`, `sensors.ts` |
| Score computation | `utils/scoringEngine.ts` → `calculateScore()`; state via `utils/scoring/breakdown.ts` `resolveState` |
| Client score mutation | `store/app/actions.ts` (`logIntake`), `store/appStoreReducer.ts` (`CYCLE_SUCCESS`, `CONFIRM_COMMAND`) |
| Profile/baseline pattern | Nullable, no default, stamped on new writes — **the precedent for this field** |
| Migration convention | **No committed migration files anywhere.** `drizzle-kit push` only, **no down-migrations** |
| Serialization | Drizzle `$inferSelect` / `$inferInsert`; JSON over REST |
| Consumers | api-server routes; Performance Memory; weekly report; achievements |
| Test convention | Vitest, workspace-root-relative globs |
| Rollback convention | Additive-only; reversal = drop column |

## 4. Why implementation was blocked — ✅ RESOLVED 2026-07-22

> **HISTORICAL RECORD.** Both blockers below were cleared by founder decision on 2026-07-22
> (D-09). Retained because they explain *why* the implementation took the shape it did.
> **Resolution:** (1) `HYDROSTATE_MODEL_VERSION = 'hydrostate-v0'` in `config/hydroStateModel.ts`
> — Option C, pre-governance identifier; (2) `lib/db/src/scoreSnapshotRepo.ts` is the central write
> path; duplicated stamping was **rejected**.

### 4.1 BLOCKER 1 — no authoritative HydroState model-version source exists

Verified three ways:

1. **No constant** — no `HYDROSTATE_MODEL_VERSION`, `SCORING_MODEL_VERSION`, `SCORE_MODEL_VERSION`,
   `SCORING_VERSION`, or `ENGINE_VERSION` exists in `config/hydroStateModel.ts`,
   `utils/scoringEngine.ts`, `utils/scoring/`, or `utils/scoreBand.ts`.
2. **No registry entry** — `MODEL-VERSION-REGISTRY.md` has **no HydroState row**.
3. **Already recorded as absent** — `INTELLIGENCE-VERSION-CONTEXT.md` #3 states
   *"NOT IMPLEMENTED — no version field exists"*, gap **G-6**.

**The field has nothing authoritative to store.**

The authorization explicitly says: *"If no authoritative current model-version source exists, stop
before schema implementation and report the exact missing governance or engineering decision. Do
not invent a value such as `v1`, `1`, or `current`."*

Creating a constant such as `HYDROSTATE_MODEL_VERSION = 'hydrostate-v1.0'` **would be inventing
exactly the prohibited value** — it would assert that the current scoring math is "version 1.0",
a claim no evidence supports. The current math has an unknown lineage; calling it v1.0 is a
fabrication, not a starting point.

**→ Requires founder/engineering decision D-09.**

### 4.2 BLOCKER 2 — no central snapshot-write path exists

The authorization requires: *"The new field must be stamped on every newly persisted HydroState
snapshot through the authoritative snapshot-write path. Do not rely on individual callers to
remember to provide it when the central write path can apply it consistently."*

**There is no central write path.** Two independent insert sites:

| # | Site | Shape |
|---|---|---|
| 1 | `artifacts/api-server/src/routes/aforce/journal.ts:35` | `db.insert(aforceScoreSnapshots).values({ userId, ...parsed.data })` — spreads a client-supplied payload |
| 2 | `artifacts/api-server/src/routes/aforce/sensors.ts:103` | `tx.insert(aforceScoreSnapshots).values(snapshots)` — batch insert inside a transaction |

Consistent stamping would require **creating a central write path** — a refactor of two server
routes. That is a structural change to the scoring persistence surface and is **not within this
authorization**, which covers "D-08 implementation and its required tests, migration artifact,
documentation, and governance updates."

**→ Requires founder decision D-09 (part b).**

## 5. Version semantics (specified now, effective on D-09)

Documented so D-09 can be decided with full context. **None of this is implemented.**

| Item | Specification |
|---|---|
| **Canonical field name** | `hydrostate_model_version` (column) / `hydroStateModelVersion` (TS) — snake_case column, camelCase property, matching table convention |
| **Type** | `text` nullable, no default — consistent with `model_version` on the graph tables |
| **Authoritative source** | **UNSET — D-09.** Must be a single constant; **no second or competing source may be introduced.** |
| **Format** | `hydrostate-v<major>.<minor>`, matching `MODEL-VERSION-REGISTRY.md` |
| **Increments when** | **Any approved change that can alter HydroState output for identical inputs.** |
| Coefficient change | **Yes — increment** (changes output for identical inputs) |
| Eligibility-rule change | **Yes — increment** |
| Bug fix | **Yes if output changes** for identical inputs; no if provably output-identical |
| Refactor, output-identical | **No** |
| **Approves an increment** | Founder + Engineering; Scientific where the change is physiological |
| **Major vs minor** | Major = historical scores **not comparable**; minor = comparable refinement |
| **Replay** | Snapshots are historical records, **never re-derived**. A bump marks a boundary; it does not rewrite history. |
| **Rollback** | Drop the column. No data loss. No scripted down-migration exists. |
| **Historical comparison** | A trend spanning a **major** bump must surface the discontinuity, never silently blend |
| **Export** | Included in exports; null exported as null, never defaulted |
| **Audit** | The field *is* the audit record for scoring lineage |

**Must not be confused with:** profile version · baseline version · graph schema version · graph
derivation version · LPM version · Prediction Engine model version · prediction-policy version ·
Evidence Engine version · §42 gate-policy version. (Nine distinct versions —
`INTELLIGENCE-VERSION-CONTEXT.md`.)

## 6. Migration reality — recorded truth

**This repository does not use committed migration files.** There are no `.sql` files and no
migrations directory. Schema changes are applied with `drizzle-kit push`, which diffs live schema
against ORM definitions. **There are no down-migrations.**

**No migration workflow was fabricated.** When D-09 clears, the "migration artifact" for this
change is the schema definition itself plus the deployment runbook — the same mechanism used for
every other table here.

## 7. Implementation plan (on D-09 clearance)

1. Add the authoritative version constant at the source D-09 names.
2. Register it in `MODEL-VERSION-REGISTRY.md`.
3. Add the nullable column, mirroring `profileVersionId` exactly.
4. Establish the central write path (if D-09 authorizes the refactor) **or** stamp at both sites
   (if D-09 accepts that trade-off, with its consistency risk recorded).
5. Add the 14 tests in §8.
6. Update governance; **G-6 closes only on implementation evidence**.

## 8. Test plan (not yet run — nothing implemented)

1. New snapshots carry the authoritative version · 2. Historical null rows remain readable ·
3. Null is never replaced with a fabricated default · 4. Profile-version behaviour unchanged ·
5. Baseline-version behaviour unchanged · 6. Serialization backward compatible ·
7. Queries backward compatible · 8. **HydroState numeric values unchanged** ·
9. **State labels unchanged** · 10. Score Protection unchanged · 11. No scan/purchase/
recommendation/view becomes score-eligible · 12. No §39 dependency introduced ·
13. Rollback documented and tested where supported · 14. No new suite failures.

## 9. Status

| Stage | Status |
|---|---|
| **Implemented in source** | ✅ **YES — 2026-07-22** |
| **Migration prepared** | ⚠️ **N/A by design** — this repo has no committed migration files; schema changes apply via `drizzle-kit push`. **No SQL migration was invented.** |
| **Deployed to development** | ❌ **No** |
| **Deployed to staging** | ❌ **No** |
| **Deployed to production** | ❌ **No** |

**Both D-09 blockers cleared by founder decision 2026-07-22:** the authoritative constant is
`HYDROSTATE_MODEL_VERSION = 'hydrostate-v0'` in `config/hydroStateModel.ts`, and
`lib/db/src/scoreSnapshotRepo.ts` is the central write path. Duplicated stamping was **rejected**.

**G-6 CLOSED** — model-version source, persistence field, central repository stamping, and tests
all implemented in source. **Deployment is a separate, unclaimed step.**
