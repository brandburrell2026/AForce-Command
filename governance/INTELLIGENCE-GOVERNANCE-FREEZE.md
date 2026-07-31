# Intelligence Governance Freeze — Phase 3.5

**Status:** FROZEN · **Frozen:** 2026-07-22 · **Authority:** tier 3
**Scope:** governance, documentation, reconciliation and contract audit **only**
**Owner:** Brandon (founder)

The defensible frozen snapshot of the AForce Intelligence™ architecture **before predictive
systems are built**.

> **No production code, schema, migration, feature flag, UI, navigation, public API, scoring
> behaviour, or user-facing copy was changed in Phase 3.5.**

---

## 1. What this freeze establishes

| # | Outcome | Document |
|---|---|---|
| 1 | Architecture locked against uncontrolled change | `INTELLIGENCE-CHANGE-CONTROL.md` |
| 2 | Consolidated snapshot of the layer as it exists | this document + `CAPABILITY-STATUS-REGISTER.md` |
| 3 | Terminology, ownership, sections, status labels, confidence concepts, event vocabulary, versioning frozen | Ownership · Confidence · Event · Version-Context matrices |
| 4 | Change-control and approval gates established | `INTELLIGENCE-CHANGE-CONTROL.md` · `REVIEW-APPROVAL-MATRIX.md` |
| 5 | Audit sweep for overstatement, conflicts, unsupported claims, bypasses | §4 below + Reconciliation Register |

## 2. The frozen document set

| Document | Covers |
|---|---|
| `INTELLIGENCE-DATA-FLOW-CONTRACTS.md` | Canonical pipeline, feedback loop, side paths, **14 prohibited bypasses**, completed-behaviour definition |
| `INTELLIGENCE-OWNERSHIP-MATRIX.md` | 18 systems × 12 fields |
| `INTELLIGENCE-DEPENDENCY-MATRIX.md` | Permitted / prohibited / violations / cycles / enforcement |
| `INTELLIGENCE-CONFIDENCE-TAXONOMY.md` | **11 distinct concepts** and their non-equivalences |
| `INTELLIGENCE-EVENT-REGISTRY.md` | Actual inventory + 23 reconciled events |
| `INTELLIGENCE-VERSION-CONTEXT.md` | 14 versions, when required, replay/rollback/audit |
| `CAPABILITY-STATUS-REGISTER.md` | Canonical status labels + audit |
| `REVIEW-APPROVAL-MATRIX.md` | Review status per capability and artifact |
| `INTELLIGENCE-CHANGE-CONTROL.md` | Post-freeze process, approval gates, standing prohibitions |

## 3. Frozen invariants (summary)

1. **HydroState™ is the single hero metric.** No system may create a second readiness score.
2. **Only completed behaviour changes score.** Recommendations, scans, product views, and
   purchases are **not** completed behaviour.
3. **HydroScan never changes HydroState** (DR-001, permanent).
4. **No intelligence-derived copy reaches a user without the Evidence Engine and §42.**
5. **No claim without a provenance path.**
6. **No active derived record may survive total loss of its supporting evidence.**
7. **Association is not causation.** No causal relationship type exists.
8. **Performance DNA has no score.**
9. **Context Intelligence informs; it never commands.**
10. **Graph strength and prediction confidence are internal only.**

## 4. Audit sweep findings

### 4.1 Implementation-status overstatement — **1 finding, corrected**

Stages 2 and 3 were previously labelled **Built-Hidden**. Corrected to **Partially Built**:
Stage 2's schema is defined but never deployed, and Stage 3 has no approved internal caller.
Recorded as **T-9**; the superseding of T-1 is recorded in place.

### 4.2 Architectural conflicts — **1 new finding**

| # | Conflict | Resolution |
|---|---|---|
| **A-1** | **`INTELLIGENCE-DEPENDENCY-MAP.md` §1 shows the pipeline as `… → §42 gate → Evidence Engine™ → Command Confidence™ …`, placing the §42 gate BEFORE the Evidence Engine.** Every other authority — the Stage 3 instructions, `docs/AFORCE-INTELLIGENCE-ARCHITECTURE.md`, and the gate implementation — places the Evidence Engine first: *Learning → Evidence Engine adapter → §42 → Interaction*. | **Resolved.** `INTELLIGENCE-DATA-FLOW-CONTRACTS.md` is now canonical and states the correct order (Evidence Engine → §42). The dependency map carries a superseded-in-part banner. **No code was affected** — the gate is not wired to any caller, so the inverted diagram never governed runtime behaviour. Recorded as **T-10**. |

All conflicts from Phases 1–3 remain resolved and recorded (T-1…T-9).

### 4.3 Undocumented bypasses — **none found**

Verified by inspection: no intelligence module dispatches a reducer action; `hydroScanHistory`
never dispatches; no purchase/checkout path reaches `calculateScore`; score recomputation occurs
only on intake/confirm. **Caveat:** §39 and §40 do not exist, so their prohibitions are frozen
rules awaiting enforcement, not verified-clean paths.

### 4.4 Unsupported claims — **3 findings**

| # | Finding | Action |
|---|---|---|
| C-1 | **`docs/HYDROSTATE-WHITE-PAPER.md`** contains competitive positioning ("trackers count ounces and stop", "wearables treat hydration as a footnote") with **no cited evidence**. | Flagged. **Not Yet Reviewed**; must be substantiated or qualified before any external use. **R-27.** |
| C-2 | No AForce diagnostic or prescriptive claim found in the specification set. Banned vocabulary is mechanically enforced by §42 for English. | Verified. No action. |
| **C-3** | **`docs/competitive-moat.md` carries multiple unsubstantiated superiority claims with ZERO citation or evidence markers (0 matches for source/citation/evidence).** Examples: *"AForce is the only company stacking all four"*, *"the only layer with a SKU attached to every recommendation"*, *"a primitive no competitor has"*, plus competitor characterisations (*"Best-in-class strain & recovery coaching"*, *"the only mainstream sweat-sodium sensor"*). | **Flagged, not removed** — it is an internal strategy document and removal is a founder call. Requires substantiation, qualification, or an explicit internal-only lock before **any** external, investor, lender, or partner use. **R-27 (broadened).** |

> **Correction to this audit.** An earlier draft of this section stated that superiority language
> was "searched for and not found in the canonical spec set." **That was wrong.**
> `docs/competitive-moat.md` sits in `docs/` and was included in the exported specification PDF.
> The claim is corrected here rather than quietly amended.

**Mitigating context (recorded, not treated as approval):** `competitive-moat.md` already opens
with an internal-only banner and an explicit language lock routing "prescribe/prescription" to
"recommendation" per a 2026-06-01 founder decision. That governs *prescriptive* language; it does
**not** substantiate the *superiority* claims, which remain unevidenced.

### 4.5 New gaps found during the sweep

| Gap | Detail |
|---|---|
| **G-6** | **HydroState model version does not exist** — score snapshots carry no version field. A scoring-math change would make historical scores incomparable with no record. **→ D-08** |
| G-7 | Evidence Engine has no version |
| G-8 | Command policy has no version |
| G-9 | Source adapters have no version |
| G-1/G-2 | No runtime emitter for canonical intelligence events; 9 of 14 ledger kinds have no emitter |
| G-3/G-4/G-5 | No automated cycle, store-import, or event-collision checks |

## 5. Truth-and-reconciliation confirmations

| Item | Status |
|---|---|
| HydroScan never changes HydroState | ✅ Verified in code |
| Scans / recommendations never increase HydroState | ✅ Verified |
| Purchase does not increase HydroState | ✅ Verified — no path |
| Consumption changes score only via an approved completed-action event | ✅ Frozen in the Event Registry |
| Demo Mode must not bypass Score Protection | ✅ **Verified** — `services/demoMode.ts` (725 bytes) contains **zero** references to score and **no reducer dispatch**; it structurally cannot mutate score. Seeded data lives in `data/demoProfile.ts` (read-only). |
| Investor demos must not show score change without completed behaviour | ⚠️ **Not audited** — investor/pitch materials (`artifacts/aforce-pitch/`, `exports/`) were outside Phase 3.5's file scope. **R-28** |
| Seeded demo data clearly labelled internally | ✅ `data/demoProfile.ts` is the named seeded source (§62); Demo Mode writes nothing |
| "Full architecture built" agrees with status tables | ✅ No such claim survives; all statuses restated |
| HydroState is the single hero metric | ✅ Verified — no second score type exists |
| Graph strength not a public score | ✅ `score` is always `null` |
| Prediction confidence not a readiness score | ✅ Not built; frozen prohibition |
| Performance DNA has no score | ✅ No numeric type exists |
| Architecture-only systems labelled accurately | ✅ Corrected |
| Competitor diagnostic claims | ✅ None found |
| AForce diagnostic/prescriptive claims | ✅ None found in specs |
| Only English is §42 validated | ✅ Recorded honestly |
| Stage 2 graph schema not deployed | ✅ Recorded (R-21) |
| No approval inferred | ✅ All "Not Yet Reviewed" |

## 6. Risks carried forward (none closed)

**R-21** schema not deployed · **R-22** inline provenance at scale · **R-23** evidence assessment
is counting not science · **R-24** English-only §42 · **R-25** policy/registry drift ·
**R-26** lexical matching · **R7** retention pending counsel.

**New:** **R-27** unsubstantiated superiority/competitive claims in `competitive-moat.md` and the
white paper (C-1, C-3) · **R-28** investor/pitch materials not audited against the truth rules
(Demo Mode itself is verified clean).

## 7. Freeze status

**The architecture is frozen.** Changes to any area in `INTELLIGENCE-CHANGE-CONTROL.md` §1 now
require a Change Record and the approvals in §4 of that document.
