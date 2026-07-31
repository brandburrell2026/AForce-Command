# Intelligence Data-Flow Contracts

**Status:** FROZEN (Phase 3.5) · **Frozen:** 2026-07-22 · **Authority:** tier 3
**Supersedes:** the flow diagram in `INTELLIGENCE-DEPENDENCY-MAP.md`

The single authoritative intelligence flow. Any path not documented here is prohibited.

---

## 1. Canonical forward pipeline

```
  SIGNALS
  intake · commands · check-ins · wearables · weather · profile · scans
        │
        ▼
  NORMALIZATION
  canonical IntelligenceEvent envelope (§41) · privacy + retention class ·
  freshness + signal quality · profile/baseline version · provenance
        │
        ▼
  PERFORMANCE KNOWLEDGE GRAPH™  (§38)
  nodes · edges · observation counts · contradictions · evidence state
        │
        ▼
  LIVING PERFORMANCE MODEL™  (§61)
  daily lesson · Your Body's Manual · Confidence Journey
        │
        ▼
  PREDICTION ENGINE™  (§39)          ← NOT IMPLEMENTED (Specified)
  projections · four states · expiry
        │
        ▼
  EVIDENCE ENGINE™
  explains why, from the user's own data
        │
        ▼
  §42 INTELLIGENCE LANGUAGE AND CLAIMS GATE
  14 outcomes · fail-closed · governed transformation only
        │
        ▼
  INTERACTION INTELLIGENCE
  AI Coach · HydroScan · Explainability · Response Timeline
        │
        ▼
  USER
```

**HydroState™ remains the single hero metric.** It is computed upstream of this pipeline and is
never produced, replaced, or competed with by any stage in it.

## 2. Canonical feedback loop

```
  COMPLETED ACTION or OUTCOME
        │   (only completed behaviour — see §5)
        ▼
  PERFORMANCE MEMORY™            append-only; never overwrites history
        │
        ▼
  CANONICAL INTELLIGENCE EVENT   normalized envelope
        │
        ▼
  PERFORMANCE KNOWLEDGE GRAPH™   observation counts + contradictions updated
        │
        ▼
  LIVING PERFORMANCE MODEL™ RECALIBRATION
```

The loop is what makes the OS learn the individual (Principle 4). It is closed **only** by
completed behaviour — never by a recommendation, view, scan, or purchase.

## 3. Allowed side paths

| # | Path | Condition |
|---|---|---|
| S1 | Context Intelligence → Normalization | Climate Profile™, Environmental Pressure™, Tomorrow Load Forecast™, Recovery Window™, Performance Drift™ inform events. **They never issue commands.** |
| S2 | Adaptive Response Engine™ (§59) → Knowledge Graph | Personal Response Library read as a source. §59 is not modified. |
| S3 | Knowledge Graph → Evidence Engine (direct) | Only via the Stage 2 **adapter boundary**, and still through §42 before any surface. |
| S4 | HydroScan™ → advisory row | Writes an advisory record only. **Never into HydroState.** (DR-001) |
| S5 | Any system → Founder/Sandbox inspection | Read-only, Sandbox scope, never Production. Bypasses §42 **only because it emits no user-facing copy** — it shows raw records. |
| S6 | Prediction/DNA/LPM → invalidation review | Deletion propagation notices (Stage 2 contract). |
| S7 | Graph → device cache | Selected insights only, encrypted, non-authoritative (DR-002/DR-004). |

## 4. Prohibited bypasses (frozen)

| # | Prohibited | Why |
|---|---|---|
| B1 | Any intelligence-derived copy reaching a user **without passing §42** | §42 is the mandatory final boundary |
| B2 | Any claim reaching a user **without an Evidence Engine route** | Principle 3 — explainability |
| B3 | Any derived claim **without a provenance path** | §41 — no "trust me" path |
| B4 | Prediction Engine → HydroState or Today's Command | §39 is advisory-only |
| B5 | Prediction Engine → public copy directly | must pass Evidence Engine + §42 |
| B6 | Performance DNA → any score, or → HydroState | Principle 2 · Founder Decision 4 |
| B7 | AI Coach → user copy bypassing §42 | Interaction Intelligence never originates claims |
| B8 | HydroScan → HydroState mutation | DR-001, permanent |
| B9 | Interaction Intelligence → restricted intelligence stores directly for public copy | must route through Evidence Engine + §42 |
| B10 | Any system creating a **second readiness score** | Principle 2 |
| B11 | Context Intelligence → command issuance | Context informs; it never commands (D-07) |
| B12 | Graph strength / prediction confidence → user-facing score | internal only |
| B13 | Demo Mode → Score Protection bypass | demo writes nothing |
| B14 | Recommendations · scans · product views · purchases → score change | **not completed behaviour** |

## 5. Completed behaviour — the frozen definition

**Only completed behaviour modifies HydroState™.**

| Is completed behaviour | Is NOT completed behaviour |
|---|---|
| Logged intake (`logIntake` → engine recompute) | Viewing a recommendation |
| Confirmed command (`CONFIRM_COMMAND`) | Scanning a product (HydroScan) |
| Recorded completed action | Purchasing a product |
| | Consuming a product **without** an approved completed-action event |
| | Any projection, pattern, or graph edge |

**Verified in code (2026-07-22):** score recomputation occurs only on the intake/confirm paths
(`store/app/actions.ts`, `store/appStoreReducer.ts` `CYCLE_SUCCESS` / `CONFIRM_COMMAND`).
`services/hydroScanHistory.ts` never dispatches a reducer action. No purchase or checkout path
reaches `calculateScore`.

## 6. Stage gating

| Pipeline stage | Status | Gate before it may run |
|---|---|---|
| Signals → Normalization | **Partially Built** | contracts exist; no runtime caller |
| Knowledge Graph | **Partially Built** | schema not deployed (R-21) |
| Living Performance Model (daily lesson) | **Live** | shipped |
| LPM expansion | **Specified** | §38 deployed |
| Prediction Engine | **Specified** | not authorized; §42 gate exists |
| Evidence Engine | **Live** | unchanged by Phases 3.5 |
| §42 gate | **Partially Built** | no approved caller |
| Interaction Intelligence | **Live** (existing surfaces) | no new surface authorized |
