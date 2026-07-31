# Intelligence Dependency Matrix

**Status:** FROZEN (Phase 3.5) · **Frozen:** 2026-07-22 · **Authority:** tier 3
**Canonical for:** permitted / prohibited dependencies, violations, cycles, enforcement.
Flow diagram lives in `INTELLIGENCE-DATA-FLOW-CONTRACTS.md`.

---

## 1. Permitted dependencies

| From | May depend on | Condition |
|---|---|---|
| Normalization | Signals, profile/baseline versions | version referenced by id, never copied |
| Knowledge Graph (§38) | Canonical events, §59 library | read-only; append-only writes to its own store |
| Prediction Engine (§39) | §38 edges; HydroState **read-only** | read for fail-closed gating only |
| Performance DNA (§40) | §38 edges over time | read-only |
| Living Performance Model (§61) | §59 library; §38 (expansion) | additive source; existing exports unchanged |
| Evidence Engine | All engines; §41 provenance | must have a provenance path |
| §42 gate | Adapter verdict, policy + locale registries | terminal |
| Interaction Intelligence | Evidence Engine output **after §42** | never the stores directly |
| Core Intelligence | Context Intelligence | context informs only |
| Founder/Sandbox inspection | Any store, read-only | Sandbox scope; never Production |

## 2. Prohibited dependencies (frozen)

| # | Prohibited | Rule source |
|---|---|---|
| D1 | **Prediction Engine → HydroState (write)** | §39 advisory-only |
| D2 | **Prediction Engine → Today's Command (write)** | §39 advisory-only |
| D3 | **Prediction Engine → public copy (direct)** | must pass Evidence Engine + §42 |
| D4 | **Performance DNA → any score** | Principle 2 · Founder Decision 4 |
| D5 | **Performance DNA → HydroState (write)** | Score Protection |
| D6 | **AI Coach → user copy bypassing §42** | §42 mandatory |
| D7 | **HydroScan → HydroState (write)** | DR-001, permanent |
| D8 | **Interaction Intelligence → restricted intelligence stores for public copy** | must route via Evidence Engine + §42 |
| D9 | **Any system → a second readiness score** | Principle 2 |
| D10 | **Recommendations / scans / product views / purchases → score change** | not completed behaviour |
| D11 | HydroState → §38/§39/§40 | hero metric must not depend on advisory systems |
| D12 | Evidence Engine → §39 projections for factual explanation | explanation stands on recorded fact |
| D13 | Context Intelligence → command issuance | D-07 |
| D14 | Meridian™ tier → routing | Founder Decision 2 |
| D15 | Any new system → new raw data collection | §38–42 derive from consented data only |
| D16 | Graph strength / prediction confidence → user-facing score | internal only |
| D17 | Adherence / follow-rate → Command Confidence | would silently upgrade confidence |

## 3. Current violations

**None detected.** Verified 2026-07-22 by inspection and test:

| Check | Result | Evidence |
|---|---|---|
| Any intelligence module dispatching a reducer action | **None** | grep over `utils/intelligence/**` |
| `hydroScanHistory` → reducer | **None** | module comment + code |
| Purchase/checkout → `calculateScore` | **None** | no path found |
| Score mutation surface | intake + confirm only | `store/app/actions.ts`, `appStoreReducer.ts` |
| §38/§42 modules touching score | **None** | grep + tests |
| Second score type anywhere | **None** | no `dna_score` / numeric pattern score exists |

**Caveat (truth rules):** these checks cover **built** code. D1–D6 concern systems that do not
exist yet (§39, §40), so they are **frozen rules awaiting enforcement**, not verified-clean paths.

## 4. Possible cycles

| Candidate cycle | Status | Control |
|---|---|---|
| Graph → LPM → events → Graph | **Intended feedback loop, not a cycle** | Loop closes only through *completed behaviour*; derived output never re-enters as a primary event |
| Prediction → outcome → Graph → Prediction | **Permitted** | Outcome is a real observation; calibration adjusts *future* predictions only, never rewrites the original |
| DNA → Graph → DNA | **Prevented** | §40 is a read-only view of graph structure; it writes only its own patterns |
| Evidence Engine → §42 → Evidence Engine | **Prevented** | §42 is terminal; it returns a decision, never re-enters the engine |
| Command Confidence → adherence → Command Confidence | **Prevented by D17** | adherence deliberately not wired |

**Frozen rule:** a derived record may never become a primary observation. This is the structural
guarantee against a self-reinforcing loop where the system's own conclusions become its evidence.

## 5. Future enforcement requirements

| # | Requirement | Status |
|---|---|---|
| E1 | Score-Protection test per new intelligence module | **In place** (Stages 1–3) |
| E2 | §42 mechanical copy test before any surface | **In place** |
| E3 | Provenance-or-nothing at the adapter boundary | **In place** |
| E4 | Automated dependency-cycle check in CI | **NOT built** — gap G-3 |
| E5 | Automated check that no module imports the store from `utils/intelligence/**` | **NOT built** — gap G-4 |
| E6 | Policy-registry ↔ Claims Register drift check | **NOT built** — R-25 |
| E7 | Deployment check that schema matches definition | **NOT built** — R-21 |

E4–E7 are recorded gaps, not silently assumed. Building them is not authorized in Phase 3.5.
