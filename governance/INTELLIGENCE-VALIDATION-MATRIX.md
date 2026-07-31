# Intelligence Validation Matrix

**Status:** Canonical (criteria defined; nothing validated yet) · **Updated:** 2026-07-22 (Phase 2)

What each system must prove before it advances. A row is **green** only when every listed check
passes. `FEATURE-PHASE-MATRIX.md` §5 requires a green row before any surface ships.

> **Nothing is green.** No implementation exists — Phase 2 was documentation-only.

---

## 1. Universal checks — every intelligence system

| ID | Check | Method |
|---|---|---|
| **V-1** | **Score Protection.** Never dispatches a reducer action; never awards, mutates, or fabricates score. Read-only score access for fail-closed gating is permitted. | Unit test, modeled on `utils/__tests__/livingPerformanceScoreProtection.test.ts` |
| **V-2** | **No fabrication.** Empty, sparse, or low-confidence input yields the explicit insufficient-data state — never a manufactured output, never a favorable default. | Unit test with empty + sparse fixtures |
| **V-3** | **Provenance.** Every emitted claim resolves to real recorded source events plus a model version. | Unit test walking claim → events |
| **V-4** | **Language compliance.** No banned term (*risk, injury, diagnosis, prevent*, and the full `CLAIMS-REGISTER.md` §1 list) can appear in any emitted copy key. | **Mechanical test over the copy-key surface** — §42 |
| **V-5** | **Purity.** Pure and RN-free (type-only imports) so it runs under the existing vitest pure runner. | Runs green in `utils/__tests__/**` |
| **V-6** | **Flag-off identity.** With the flag off, behavior is byte-identical to today — short-circuit returns before any ledger read or clock access. | Unit test asserting same-reference return |
| **V-7** | **Config discipline.** No hardcoded thresholds; every tunable in `config/hydroStateModel.ts`. | Review + grep |
| **V-8** | **No navigation change.** No new tab, no route change. | Review |

## 2. Per-system checks

### §38 Performance Knowledge Graph™

| ID | Check |
|---|---|
| G-1 | Nodes created only from real recorded events — never inferred, never seeded |
| G-2 | Absence of an edge yields "not enough data yet", never a favorable default |
| G-3 | Day-index conventions preserved round-trip (local-calendar vs UTC floor) |
| G-4 | Re-derivation is idempotent under the ledger's first-wins merge |
| G-5 | Persistence defers writes until after boot-hydration; `clear()` bumps the generation counter |
| G-6 | Recorder effects guarded by both freshest-state existence check and in-flight latch |
| G-7 | Graph is never surfaced as a graph — no nodes or edges reach a user |

### §39 Prediction Engine™

| ID | Check |
|---|---|
| P-1 | Below the data-sufficiency gate, returns insufficient-data — never a low-confidence guess |
| P-2 | Every projection carries confidence, observation period, and evidence count |
| P-3 | A projection that cannot state its confidence is not emitted |
| P-4 | Output is the user's own demonstrated pattern extended forward — never a health forecast |
| P-5 | **§42 gate cleared** — blocking prerequisite for any user-facing output |
| P-6 | Projections expire; stale projections are discarded, never re-surfaced |

### §40 Performance DNA™

| ID | Check |
|---|---|
| D-1 | **No numeric output type exists in the code** — not a score, not a 0–100, not a grade, not a rank |
| D-2 | Every pattern carries all eight mandatory fields (Founder Decision 4) |
| D-3 | Contradictory observations are present and displayed, never suppressed |
| D-4 | Pattern states limited to the approved five |
| D-5 | Patterns are slow to form and slow to revise — no flicker on a single day's data |
| D-6 | User challenge and dismissal controls function |
| D-7 | No genetic, deterministic, or fixed-identity framing |

### §41 Provenance & Model Versioning

| ID | Check |
|---|---|
| R-1 | Every derived record stores its model version |
| R-2 | Deleting source events invalidates derived edges, patterns, and projections |
| R-3 | A record without a version is retired, never reinterpreted |

### §42 Language & Compliance Gate

| ID | Check |
|---|---|
| L-1 | Mechanical banned-term test covers every §39/§40 copy key, all locales |
| L-2 | Fail-closed — an unevaluable gate blocks output rather than passing it |
| L-3 | Recurring/severe symptom routing to physician consultation preserved |
| L-4 | Voice surfaces included, not just visual |

### §61 Living Performance Model™ (expansion)

| ID | Check |
|---|---|
| M-1 | Existing daily-lesson tests still green |
| M-2 | "Your body taught us" framing preserved |
| M-3 | Silent Intelligence on-track state preserved — no manufactured lesson |
| M-4 | Legacy summaries use no prevention or causal medical language |

## 3. Status board

| System | Universal | Per-system | Overall |
|---|---|---|---|
| §38 | ⬜ not started | ⬜ not started | **Not validated** |
| §39 | ⬜ not started | ⬜ not started | **Not validated — §42 blocking** |
| §40 | ⬜ not started | ⬜ not started | **Not validated** |
| §41 | ⬜ not started | ⬜ not started | **Not validated** |
| §42 | ⬜ not started | ⬜ not started | **Not validated** |
| §61 expansion | ⬜ not started | ⬜ not started | **Not validated** |
