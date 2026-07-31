# Open Risks — Intelligence Layer

**Status:** Canonical · **Updated:** 2026-07-22 (Phase 2)
**Relationship:** Complements `governance/Risk-Register.md` (product/launch risks). This file
tracks risks specific to AForce Intelligence™ and §38–42.

Severity: **S1** critical (blocks launch) · **S2** major · **S3** moderate

---

| ID | Risk | Sev | Status | Mitigation |
|---|---|---|---|---|
| **R-01** | **Prediction language becomes a medical claim.** §39 output in the wrong register turns observation into diagnosis, breaching Principle 5 and COMPLIANCE_FRAMEWORK §2. Highest-consequence risk in this layer. | **S1** | OPEN — mitigated by design | §42 gate blocks all §39 user-facing output; banned-term list in `CLAIMS-REGISTER.md`; mechanical test asserting no banned term reaches an emitted copy key; Risk-Register CR-1 pre-launch claims review must cover §39 explicitly. |
| **R-02** | **Performance DNA™ drifts into a score.** Pressure to make it memorable produces a single number, creating a competing hero metric against Principle 2. | **S1** | OPEN — mitigated by design | Founder Decision 4 prohibits it explicitly; §40 emits pattern states only; no numeric output type is specified; Principle 2 review is a phase gate. |
| **R-03** | **Score Protection breach via a new write path.** Four new systems each represent a new opportunity to touch score. | **S1** | OPEN — mitigated by design | Advisory-only for all of §38–42 (DR-001 precedent); per-system Score-Protection test proving no reducer dispatch; reading score read-only for fail-closed gating remains permitted. |
| **R-04** | §38 persistence location undecided. | **S2** | ✅ **CLOSED** | `DR-002` — server-synced, PostgreSQL authoritative, limited encrypted non-authoritative device cache. |
| **R-12** | **Device cache is currently plaintext.** `DR-002` requires an *encrypted* local cache, but every existing client store uses plaintext AsyncStorage. `expo-secure-store` is keychain-backed and unsuitable for bulk payloads. | **S1** | **OPEN — design required** | Phase 3 output C/F must specify an encrypted bulk-cache strategy. No intelligence cache ships plaintext. |
| **R-13** | **Cross-user cache leakage.** A durable local intelligence cache not scoped per user replays or reads another person's data after a user switch. | **S1** | OPEN — mitigated by precedent | Per-user storage key (intake-outbox precedent), generation guard on user transition, never clear-on-sign-out. |
| **R-14** | **Orphaned derived relationships.** A graph edge, pattern, or projection surviving deletion of its supporting evidence would state something the data no longer supports. | **S1** | OPEN — design required | `DR-002` deletion propagation; invalidation status is a first-class server field; Phase 3 output F + deletion-propagation tests. |
| **R-15** | **Sync/conflict surface is new.** Server-authoritative + offline queue introduces idempotency, retry, conflict, and degraded-mode failure modes that did not previously exist. | **S2** | OPEN — design required | Phase 3 output E; `clientEventId` idempotency precedent from the intake outbox. |
| **R-16** | **Context-only estimates read as personal predictions.** `DR-003` permits context-based forecasts on thinner history; if unlabeled they claim personal learning that did not happen. | **S2** | OPEN — mitigated by design | Four mandatory output states; labeling enforced by the §42 gate and copy tests. |
| **R-05** | **Governance drift recurs.** The mirror defect was caught by audit, not by tooling. Nothing structurally prevented it. | **S2** | **MITIGATED** | Mirror replaced by pointer README; `scripts/src/check-governance-drift.mjs` added and wired into CI; `SPECIFICATION-AUTHORITY.md` §3 enumerates the only sanctioned duplicate. |
| **R-06** | **Fabrication under sparse data.** A graph with few edges could emit confident-sounding output from thin evidence. | **S2** | OPEN — mitigated by design | Absence is never a favorable default; explicit insufficient-data state; data-sufficiency gate on §39 (60–90 days, config-driven); no-fabrication test per system. |
| **R-07** | **Ledger recorder loops / history clobbering.** Documented failure modes in the existing ledger; new recorders reintroduce them. | **S2** | OPEN — mitigated by design | Freshest-state existence check plus in-flight latch; deferred writes until after boot-hydration; `clear()` generation counter. Carried from `.agents/memory/aforce-intelligence-core.md`. |
| **R-08** | **Surface pressure.** Founder Decision 1 forbids exposing these systems merely because the backend exists — but a working backend creates its own pull. | **S3** | OPEN | All new systems Architecture Only or headless; per-surface founder approval required; `FEATURE-PHASE-MATRIX.md` §5 phase-gate rule. |
| **R-09** | **Legacy tier-5 documents keep being read as authoritative.** Four documents restate the locks; readers may not know they are superseded. | **S3** | **MITIGATED** | `SPECIFICATION-AUTHORITY.md` tier table; superseded banners added to legacy documents in Phase 2. |
| **R-10** | **Contradictory-evidence display is uncomfortable.** §40 requires showing evidence *against* each pattern; there will be pressure to hide it. | **S3** | OPEN | Founder Decision 4 makes contradictory observations mandatory, not optional. Non-negotiable in the §40 spec. |
| **R-11** | **Model versioning absent at first ship.** Without it, a pattern's origin becomes unreconstructable after a logic change. | **S2** | OPEN — mitigated by design | §41 includes model versioning; `MODEL-VERSION-REGISTRY.md` created in Phase 2, populated at first implementation. |

## Risks added at Stage 2

| ID | Risk | Sev | Status | Mitigation |
|---|---|---|---|---|
| **R-21** | **Graph schema is NOT deployed — exists in no database.** `drizzle-kit push` also has no down-migration. The db package uses `push` (no migration files), so "reversible" means *drop the new tables*. There is no scripted rollback, and `push` cannot be exercised here without `DATABASE_URL`. | **S2** | OPEN | Both Stage 2 tables are **new and additive** — no existing table or column was altered, so reversal is a clean drop with no user-data loss. Schema definition is typechecked. **Runbook prepared: `STAGE-2-GRAPH-SCHEMA-DEPLOYMENT-RUNBOOK.md`.** No `DATABASE_URL` in this environment ⇒ **not deployed**. R-21 closes only on all six evidence items in runbook §11. |
| **R-22** | **Edge provenance is inline, not a join table.** Chosen to avoid a table whose consumers do not exist yet. At scale, reverse provenance lookup relies on a GIN index over a JSONB array rather than a relational index. | **S3** | OPEN — accepted | GIN index declared on `provenance_links`. If cascade latency becomes a problem, promoting to `aforce_provenance_links` (already designed in Phase 3 Output C) is additive and non-breaking. |
| **R-23** | **Evidence assessment is counting, not science.** `evidence_count_v1` uses conservative thresholds with no validated basis. | **S2** | OPEN — mitigated by design | `score` is always null so no false precision is exposed; raw inputs are stored so an approved weighting applies retroactively without re-derivation; thresholds live in config. Backtesting (Phase 3 Output J §5) is the correction mechanism. |

## Risks added at Stage 3

| ID | Risk | Sev | Status | Mitigation |
|---|---|---|---|---|
| **R-24** | **Only English is §42-validated.** Five launch locales (es, fr, de, pt, it) ship product copy but cannot emit intelligence claims. If a surface later assumes multilingual intelligence parity, it will find suppression instead. | **S2** | OPEN — recorded, not a defect | `LOCALE-POLICY-REGISTRY.md`. Suppression is deliberate and fails closed. Each locale needs an eight-item review before its intelligence output is possible; a direct translation of the English banned list is explicitly **not** sufficient. |
| **R-25** | **Policy registry could drift from the Claims Register.** The machine-readable rules live in code; the governance source is markdown. Nothing mechanically ties them. | **S2** | OPEN | `CLAIMS-REGISTER.md` §0 and `policyRegistry.ts` header both declare the authority relationship. A future drift check (like the governance-mirror check) would close this properly. |
| **R-26** | **Concept matching is lexical, not semantic.** The gate blocks phrases; a novel paraphrase expressing a prohibited concept could pass. | **S2** | OPEN — mitigated by design | Governed copy keys are the intended production path (free text is the exception); transformations are template-only; evidence/state gates block independently of wording. Semantic review remains a human step before any surface ships. |

## Risks added at Phase 3.5

| ID | Risk | Sev | Status | Mitigation |
|---|---|---|---|---|
| **R-27** | **Unsubstantiated superiority / competitive claims.** `docs/competitive-moat.md` carries claims such as "the only company stacking all four", "the only layer with a SKU attached", "a primitive no competitor has" with **zero citation or evidence markers**. `HYDROSTATE-WHITE-PAPER.md` characterises competitors without cited evidence. | **S2** | **OPEN** | Flagged, not removed — removal is a founder call. Both marked **Not Yet Reviewed**. Must be substantiated, qualified, or explicitly internal-locked before any external, investor, lender or partner use. Note `competitive-moat.md` already carries an internal-only banner and a prescriptive-language lock; neither substantiates the superiority claims. |
| **R-28** | **Investor / pitch materials not audited** against the truth rules (score change without completed behaviour, status overstatement). `artifacts/aforce-pitch/` and `exports/` were outside Phase 3.5's file scope. | **S2** | **OPEN** | Demo Mode itself is **verified clean** (`demoMode.ts`: no score reference, no dispatch). The materials remain unaudited — do not infer they are compliant. |

## Risks added at §39 design approval (2026-07-22)

| ID | Risk | Sev | Status | Mitigation |
|---|---|---|---|---|
| **N-1** | **Prediction confidence thresholds are UNSET.** The proposed 0.35 / 0.70 were **rejected** (`DR-007` §B). No approved values or rationale exist. | **S2** | **UNRESOLVED — blocks meaningful §39 output** | Represented as `null`, **fail-closed**: every projection resolves to `insufficient_data`. No implementation may silently substitute a default. Scientific review must set both values *with rationale*. |
| **N-2** | **All three authorized prediction types have UNDEFINED outcome definition, backtest method, and success metric.** | **S2** | **OPEN** | No type may be activated or scientifically reviewed until specified per type. Deliberately not resolved in design — inventing a success metric without scientific basis would repeat the N-1 error. |
| **N-4** | **Prediction Recalibration Governance undefined.** The operational process, approval owners, minimum dataset, validation method, release criteria, rollback criteria, and audit requirements for prediction-model recalibration are **not approved**. | **S2** | **OPEN** | `DR-008` §6 prohibits automatic self-training; online learning and autonomous self-modification are unauthorized. **N-4 may NOT be closed through documentation alone** — it requires an approved operational process. Until then, `calibration.ts` may propose but never apply. |
| **N-3** | **`calibrated_personal` could be reached by a local weighting workaround.** Pressure to make §39 useful may prompt a §39-local confidence formula that bypasses R-23. | **S2** | OPEN — mitigated by design | `DR-007` §A prohibits it explicitly. The state resolver must have **no code path** producing `calibrated_personal`. Enforce with a test. |

## Named-development deployment attempt 2026-07-22 — BLOCKED (3rd attempt)

Founder reported a named development Postgres provisioned and authorized deployment.
**`DATABASE_URL` is not available to this session** — absent from shell, all repo `.env` files,
shell profiles, and the environment. Environment name, provider, version, host, production-data
status and backup evidence were also not supplied. **Four §1 stop conditions applied; nothing was
run.** Root cause: **provisioning ≠ availability** — the connection string must be exposed to the
executing session. **R-21 remains OPEN.**

## Disposable-validation attempt 2026-07-22 — BLOCKED

Founder authorized validation against a disposable local Postgres (Docker/Testcontainers).
**Docker daemon not running** — this Mac uses **Colima** (VM `default` **Stopped**), and Docker
Desktop is **not installed**. Stopped at the §1 precondition; **no container created, no push run,
no database contacted.** Required action: `colima start`. **R-21 unaffected — disposable
validation cannot close it by definition.**

## Deployment attempt 2026-07-22 — BLOCKED

**Founder authorized development-only deployment of D-08 + Stage 2. It did not run.** No database
connection is available in this environment (`DATABASE_URL` unset, absent from all `.env` files,
`psql` not installed, Docker installed but not running). Stopped at the §1 precondition; **no
command was executed and no database was contacted.**

**R-21 remains OPEN.** Setup requirements: `STAGE-2-GRAPH-SCHEMA-DEPLOYMENT-RUNBOOK.md` §12.1.

## D-08 deployment status (2026-07-22)

| Item | Status |
|---|---|
| **D-08 schema change** | ✅ **Implemented in source** · ❌ **NOT deployed.** The `hydrostate_model_version` column exists in **no database**. It applies via `drizzle-kit push` alongside the Stage 2 graph tables — see `STAGE-2-GRAPH-SCHEMA-DEPLOYMENT-RUNBOOK.md`. **Until pushed, new snapshot writes would fail against the live schema**, so deployment must precede any release carrying this code. |

## Escalation

R-01, R-02, and R-03 are **S1 and launch-blocking**. Any of them being unresolved at a phase gate
stops that phase — they are not accepted as residual risk.
