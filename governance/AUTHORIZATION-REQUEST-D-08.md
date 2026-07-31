# Authorization Request — D-08: HydroState Model Version

**Status:** ⏳ **AWAITING FOUNDER AUTHORIZATION — not implemented**
**Raised:** 2026-07-22 (Phase 3.5 sweep, gap G-6) · **Requested:** Phase 3.7
**Approvers required:** **[JB]** — Julius **and** Brandon

> **D-08 is NOT currently authorized.** It appears under *Open* in `DECISION-REQUIRED.md`; no
> decision record authorizes a code or schema change. Per the Phase 3.7 instruction, this phase
> prompt does **not** override a missing D-08 authorization, so **nothing was implemented**.

---

## 1. Inspection performed (evidence for this request)

| Item | Finding |
|---|---|
| Decision record | **None.** `governance/decisions/` holds DR-001…DR-008; **no D-08 record exists.** |
| Snapshot schema | `aforce_score_snapshots` (`lib/db/src/schema/aforce.ts:185`) — **no model-version column** |
| Migration files | **None.** The db package uses `drizzle-kit push` only (`lib/db/package.json`) |
| Migration convention | Schema-first, push-based; **no down-migrations** |
| Version registries | `MODEL-VERSION-REGISTRY.md`, `INTELLIGENCE-VERSION-CONTEXT.md` (#3 records this gap) |
| Score-write paths | `store/app/actions.ts` (`logIntake`), `store/appStoreReducer.ts` (`CYCLE_SUCCESS`, `CONFIRM_COMMAND`) |
| Historical readers | Performance Memory™, Performance Age snapshots, weekly report |
| Rollback convention | Additive-only; reversal = drop column. No scripted down-migration exists. |

## 2. The precedent that makes this low-risk

**The exact pattern already exists in the same table.** `aforce_score_snapshots` carries:

```ts
// The active Profile Version™ / Baseline Version™ at the moment this
// HydroState record was captured. NULLABLE with no default: existing
// rows are never touched (historical preservation — brief #5) …
profileVersionId: integer("profile_version_id"),
baselineVersionId: integer("baseline_version_id"),
```

Nullable, no default, historical rows untouched, stamped on new writes. **D-08 is the same shape
for a third version reference.** This is not a novel change; it is an existing, approved pattern
applied to one more field.

## 3. Exact change requested

**One additive nullable column. Nothing else.**

```ts
// ── HydroState scoring-model version (D-08) ──────────────────────────
// The scoring-model version used to CALCULATE this snapshot. NULLABLE
// with no default, exactly like profileVersionId/baselineVersionId:
// historical rows are never touched.
//
// NULL means "version not recorded" — it does NOT mean version 1.
// No backfill: a trustworthy version cannot be proven for historical
// rows, so inventing one would be fabrication.
hydroStateModelVersion: text("hydrostate_model_version"),
```

**Column name:** `hydrostate_model_version` (snake_case, matching table convention).
**Type:** `text`, consistent with `model_version` on the Stage 2 graph tables.

## 4. Explicit non-changes

| Guarantee |
|---|
| **No score value changes.** Scoring math untouched. |
| **`utils/scoringEngine.ts` and `theme/statusColor.ts` are NOT modified.** |
| No band or status-color change |
| **No historical backfill** — null stays null |
| **No fabricated default** |
| No score recalculation |
| No destructive migration; no existing column altered |
| No user-facing change |

## 5. Semantics

**NULL means "version not recorded", never "version 1".** Readers must branch on null, never
coerce. A snapshot with a null version is not comparable to a versioned one — that is the honest
answer, and the entire point of the field.

## 6. Increment triggers (to be documented on approval)

Bump the HydroState model version when: scoring math changes · band thresholds change · a
material input weight changes · a config value that changes output materially changes.
**Do not** bump for refactors with identical output or test-only changes.

Major vs. minor follows `MODEL-VERSION-REGISTRY.md`: **major** = not comparable (historical scores
must not be charted against new ones without a break); **minor** = comparable refinement.

## 7. Replay and rollback

**Replay:** snapshots are historical records, never re-derived. A version bump does not rewrite
history — it marks the boundary. Trend readers spanning a major bump must surface the
discontinuity rather than silently blend.

**Rollback:** drop the column. No data loss (nothing else reads it initially). No scripted
down-migration exists — consistent with every other table in this repository.

## 8. Test plan (on approval)

| # | Test |
|---|---|
| 1 | **HydroState values are unchanged** — same inputs, same score, before and after |
| 2 | New snapshots carry the current model version |
| 3 | Legacy rows with null read correctly; null is never coerced to a version |
| 4 | Serialization/query compatibility — existing readers unaffected |
| 5 | No score-write path behaviour change |
| 6 | Rollback (drop column) leaves readers functional |

## 9. What is being requested

**Choose one:**

- **(a) Authorize the additive nullable column as specified above** — *recommended*. Additive, no
  behaviour change, mirrors an existing pattern in the same table.
- **(b) Decline and accept the gap permanently** — record that a future scoring change will not be
  auditable.
- **(c) Defer until the next scoring change** — accepts that the first such change will be the one
  that cannot be reconstructed.

**Why it matters:** without this field, a change to scoring math makes every historical score
incomparable **with no record that the change happened**. It is the only versioning gap in the
system that touches the hero metric.

**Blocks today:** nothing. **Blocks:** auditability of any future scoring change.

## 10. Authorization block (to be completed by the founder)

```
D-08 DECISION: ______________________  (a / b / c)
Julius approval:  ____________  Date: __________
Brandon approval: ____________  Date: __________
Conditions: _________________________________________
```

Until this block is completed, **no code or schema change may be made** for D-08.
