# Specification Reconciliation Register

**Status:** Canonical · **Updated:** 2026-07-22 (Phase 2)

Every contradiction found in the Phase 1 audit, its ruling, and its disposition. Phase 2 is
documentation-only: entries marked **PENDING (Phase 3+)** describe changes that are *specified*
here but deliberately **not yet applied to code**.

---

## 1. The V1 architecture lock

| Item | Detail |
|---|---|
| **Conflict** | `docs/AFORCE_OS_ARCHITECTURE_V1.md` line 3: *"Version 1 architecture is locked after Sections 53–57. No new branded systems beyond what is specified here."* Track 2 introduces four ™ systems. |
| **Evidence it was already superseded** | §58–64 were added after the lock, several carrying ™ marks, with `Claude-Code-Build-Rules.md` rule 1 explicitly instructing the build. |
| **Ruling** | **Founder Decision 1** — lock formally amended to authorize Performance Knowledge Graph™, Prediction Engine™, Performance DNA™, and the Living Performance Model™ expansion, under seven binding constraints. |
| **Disposition** | APPLIED — `AFORCE_OS_ARCHITECTURE_V1.md` amended in place with a Founder Decision 1 note. |

## 2. Meridian™ — architectural meaning retired

**Ruling (Founder Decision 2):** AForce Intelligence™ is the coordinated intelligence
architecture. Meridian™ is the Phase 3 premium tier only. Replace the architectural meaning
"Meridian decides" with "AForce Intelligence coordinates."

Complete reference inventory and disposition:

| # | Location | Usage | Disposition |
|---|---|---|---|
| 1 | `docs/AFORCE_OS_ARCHITECTURE_V1.md:37` | "Meridian™ is the intelligence layer that consumes the engines, decides, and routes…" | **RECONCILED** — rewritten to AForce Intelligence™ |
| 2 | `docs/AFORCE_OS_ARCHITECTURE_V1.md:365` | Heading "## Meridian™ — the intelligence layer" | **RECONCILED** — retitled to the premium tier |
| 3 | `docs/AFORCE_OS_ARCHITECTURE_V1.md:367` | "Meridian decides; Evidence Engine explains…" | **RECONCILED** — attribution moved to AForce Intelligence™ |
| 4 | `docs/AFORCE_OS_ARCHITECTURE_V1.md:380` | "Everything is prepared by **Meridian™**." | **RECONCILED** — now AForce Intelligence™ |
| 5 | `docs/AFORCE_OS_ARCHITECTURE_V1.md:10` | Positioning-principle inheritance | **RETAINED** — valid for a tier |
| 6 | `docs/AFORCE_OS_ARCHITECTURE_V1.md:63` | Ecosystem scope of positioning principle | **RETAINED** — valid for a tier |
| 7 | `docs/AFORCE_OS_ARCHITECTURE_V1.md:375` | Final rule, positioning inheritance | **RETAINED** — valid for a tier |
| 8 | `governance/Phase-Roadmap.md:21` | "Meridian luxury tier" (Phase 3) | **RETAINED** — this is now the *only* correct meaning |
| 9 | `artifacts/aforce-os/governance/Phase-Roadmap.md:21` | mirror copy | **RESOLVED** — mirror replaced by pointer (§4) |
| 10 | `docs/COMPLIANCE_FRAMEWORK.md:36` | Compliance inheritance scope | **RETAINED** — a tier still inherits compliance |
| 11 | `docs/COMPLIANCE_FRAMEWORK.md:182` | Compliance mapping row | **RETAINED** |
| 12 | `artifacts/aforce-os/legal/COMPLIANCE_FRAMEWORK.md:36` | sanctioned in-app copy | **RETAINED** — must stay identical to canonical |
| 13 | `artifacts/aforce-os/legal/COMPLIANCE_FRAMEWORK.md:182` | sanctioned in-app copy | **RETAINED** |
| 14 | `artifacts/aforce-os/docs/AForce-OS-Specification.md:45` | Positioning inheritance | **RETAINED** — legacy tier 5 |
| 15 | `artifacts/aforce-os/docs/PRODUCT_POSITIONING_PRINCIPLE.md:31` | Positioning inheritance | **RETAINED** |
| 16 | `artifacts/aforce-os/types/index.ts:596` | Code comment "Meridian enterprise stub" | **PENDING (Phase 3+)** — comment only; no behavior. Phase 2 makes no code edits. |
| 17–22 | `exports/phantom-rfp/*.md` | "Phantom Meridian" hardware SKU | **RETAINED** — distinct meaning, registered in Terminology §1 |

**Net:** 4 architectural references reconciled, 1 code comment deferred to Phase 3, all other
references retained as valid tier / hardware / compliance usage.

## 3. Sections 38–46 vacancy

| Item | Detail |
|---|---|
| **Finding** | Both the Appendix and Architecture V1 jump §37 → §47. Zero references to §38–46 anywhere. |
| **Ruling** | **Founder Decision 5** — permanent allocation: §38 PKG, §39 Prediction Engine, §40 Performance DNA, §41 Provenance/Retention/Model Versioning, §42 Language & Compliance Gate, §43–46 Reserved. |
| **Disposition** | APPLIED — sections added to `Architecture-Appendix.md`. |

## 4. Governance mirror drift — CRITICAL DEFECT

| Item | Detail |
|---|---|
| **Finding** | `artifacts/aforce-os/governance/Architecture-Appendix.md` was missing the 9-line DR-001 amendment, still presenting §35 as unamended "Build Now". It told an in-tree agent that HydroScan may write into HydroState, Performance Memory, and Command Confidence — which DR-001 forbids. Four further governance documents were absent from the mirror entirely. |
| **Unique-content inventory** | Per Founder Decision 3 steps 1–4, all five mirrored files were diffed against root. **The only mirror-only line in the entire directory was `**Status:** Build Now.`** — the superseded text itself. **No unique material existed to preserve.** |
| **Ruling** | **Founder Decision 3** — `/governance/` is the sole authoritative source. |
| **Disposition** | APPLIED — mirrored `.md` files replaced with `artifacts/aforce-os/governance/README.md` pointing to `/governance/`; drift check added at `scripts/src/check-governance-drift.mjs` and wired into CI. |

## 5. Duplicated locks across four documents

| Item | Detail |
|---|---|
| **Finding** | Water-First, Score Protection, Language lock, and Product Positioning are restated in full in `replit.md`, `SPEC-SHEET.md`, `AForce-OS-Specification.md`, and `AFORCE_FINAL_SPEC.md` — four copies, none marked authoritative. |
| **Ruling** | `SPECIFICATION-AUTHORITY.md` establishes the tier order; those four become tier 5 (legacy) and are marked superseded where they conflict. |
| **Disposition** | APPLIED for authority; **PENDING (Phase 3+)** for mechanical de-duplication of the restated text. |

## 6. Two band systems

| Item | Detail |
|---|---|
| **Finding** | 4-band Performance State (PEAK/BALANCED/RECOVERING/DEPLETED, ≥90/75/60) and 5-band Score Status (OPTIMAL/STABLE/DECLINING/RISK/CRITICAL, 85/70/50/30). |
| **Ruling** | **Not a contradiction.** Two intentional systems with different jobs and non-aligning thresholds. Never describe one as an alias of the other. |
| **Disposition** | DOCUMENTED — `TERMINOLOGY-REGISTRY.md` §6. No change. `statusColor.ts` remains off-limits. |

## 20. Named-development deployment authorized but blocked (2026-07-22)

| Item | Detail |
|---|---|
| **Authorization** | Deploy D-08 + Stage 2 to a **named, persistent development Postgres**, reported provisioned. |
| **What the environment shows** | **`DATABASE_URL` not set** — absent from shell, every repo `.env`, shell profiles, and the environment. No `psql`. Docker daemon down. |
| **Also not supplied** | Environment name · provider · Postgres version · host · confirmation of no production data · backup/restore evidence — **all §1 requirements**. |
| **Authoritative** | The environment. An authorization cannot supply a connection. |
| **Action** | **Stopped at §1.** No command run, no database contacted, no secret read or printed. |
| **Root cause** | **Provisioning ≠ availability.** A `DATABASE_URL` exported in another terminal does not reach this session; each command runs in a shell inheriting only the harness environment. |
| **Consequence** | D-08 and Stage 2 remain **implemented in source, deployed nowhere**. Any release carrying the D-08 code would fail against the live schema. |
| **R-21** | **OPEN.** |

## 19. Disposable validation authorized but blocked (2026-07-22)

| Item | Detail |
|---|---|
| **Authorization** | Validate pending schema against a **disposable** local Postgres. Explicitly **not** deployment; explicitly **cannot close R-21**. |
| **Environment** | Docker CLI v29.6.1 installed; **daemon not running**. Runtime is **Colima**, VM `default` **Stopped**. **Docker Desktop is not installed** — `/Applications/Docker.app` absent. |
| **Action** | **Stopped at §1.** No container, no push, no database contacted, no secret exposed. |
| **Correction recorded** | The authorization's remediation ("start Docker Desktop") does not apply to this machine. The correct action is **`colima start`**, which provisions a VM — a host-level change not taken under a report-and-stop instruction. |
| **Consequence** | D-08 and Stage 2 remain **implemented in source, validated only by unit tests, deployed nowhere**. |
| **R-21** | **OPEN** — and would have remained open regardless. |

## 18. Development deployment authorized but blocked (2026-07-22)

| Item | Detail |
|---|---|
| **What the authorization says** | Deploy D-08 + Stage 2 additive schema to a **named development database**. |
| **What the environment provides** | **No database connection of any kind.** `DATABASE_URL` unset and absent from every `.env`; `psql` not installed; Docker installed but not running. |
| **Authoritative** | The environment. An authorization cannot conjure a target. |
| **Action** | **Stopped at the §1 precondition. No command run, no database contacted, no secret read or printed.** Source audit completed instead — all authorized objects present, **zero unauthorized tables**. |
| **Consequence** | D-08 and Stage 2 remain **implemented in source, deployed nowhere**. Until pushed, code writing `hydrostate_model_version` would fail against the live schema — deployment must precede any release carrying it. |
| **R-21** | **OPEN.** |
| **Blocks release?** | Yes — for any release carrying the D-08 code. |

## 17. D-08 implemented in source (2026-07-22)

| Item | Detail |
|---|---|
| **Change** | D-09 cleared both blockers. D-08 implemented: `HYDROSTATE_MODEL_VERSION = 'hydrostate-v0'` in `config/hydroStateModel.ts`; nullable `hydrostate_model_version` column; `lib/db/src/scoreSnapshotRepo.ts` as the central write path; both routes migrated. |
| **Architectural tension found and resolved** | The founder placed the authoritative constant in the **app** package, but the stamping repository lives in **`lib/db`** — and `api-server`/`lib/db` deliberately never import from the app (documented in `profileRepo.ts` and `routes/profile.ts`). Importing would invert package layering and pull RN app code into the server bundle. **Resolved using the existing repo convention:** a documented server mirror plus a **parity test importing both across the boundary** — the same pattern as `subscriptionPlanParity.test.ts`. One value, mechanically enforced. |
| **Decision 5 honoured structurally** | `NewScoreSnapshot` **omits** the version field, so callers cannot supply, override, or forget it; `modelVersion` is a **required** constructor argument. Proven by test. |
| **What the code does** | Matches the spec exactly. Scoring math untouched; `scoringEngine.ts` / `scoreBand.ts` / `statusColor.ts` unmodified. |
| **Not deployed** | The column exists in **no database**. `drizzle-kit push` was **not run**. No SQL migration was invented — this repo has none. |
| **Disposition** | APPLIED — 23 new tests, all passing; three packages typecheck clean; full suite shows **zero new failures** vs `TEST-BASELINE.md`. **G-6 closed in source.** |

## 16. D-08 approved, implementation blocked (2026-07-22)

| Item | Detail |
|---|---|
| **Decision** | D-08 **approved under Option A** (`DR-009`): additive nullable HydroState scoring-model version on `aforce_score_snapshots`. |
| **What the spec now says** | Snapshots must preserve the scoring-model version. Null means "not recorded" — never v1, current, default, or inferred. |
| **What the code does** | **No such field. No such version constant. No central write path.** |
| **BLOCKER 1** | **No authoritative model-version source exists** — verified across the scoring surface, `MODEL-VERSION-REGISTRY.md`, and `INTELLIGENCE-VERSION-CONTEXT.md` #3. Creating `hydrostate-v1.0` would be **inventing the prohibited value**. |
| **BLOCKER 2** | **No central snapshot-write path** — two independent insert sites (`journal.ts:35`, `sensors.ts:103`). Consistent stamping would require an unauthorized refactor. |
| **Authoritative** | Code. The approval stands; the preconditions do not exist. |
| **Action** | **D-09 raised** (blocking). **Nothing implemented.** G-6 remains OPEN. |
| **Blocks release?** | No — blocks auditability of a future scoring change only. |

## 15. Phase 3.7 — prediction implementation readiness (2026-07-22)

| Item | Detail |
|---|---|
| **D-08 authorization** | **Inspected and found NOT authorized.** D-08 sits under *Open* in `DECISION-REQUIRED.md` marked **[JB]**; no decision record exists. Per the phase instruction the prompt does **not** override a missing authorization ⇒ **no code or schema change was made**. Authorization request prepared instead. |
| **Precedent found** | `aforce_score_snapshots` **already carries** `profileVersionId` / `baselineVersionId` — nullable, no default, historical rows untouched. D-08 is the same pattern for a third version reference, which materially lowers its risk. |
| **Deployment** | **Not executed.** No `DATABASE_URL` in this environment; no safe development database available. Runbook prepared and stops before execution. |
| **Schema inspection** | No migration files exist anywhere — `drizzle-kit push` only, no down-migrations. Graph tables have complete indexes (9) and **no foreign keys — consistent with the repo-wide convention** (`references(` count across the whole schema: **0**), not a defect. |
| **Reviews** | Two packages prepared. **Neither reviewed.** No approval inferred or recorded. |
| **Disposition** | APPLIED — 7 documents created, 5 updated. **No production code, schema, migration, flag, or UI changed.** |

## 14. DR-008 — prediction success governance (2026-07-22)

| Item | Detail |
|---|---|
| **Change** | Success measurement frozen **before** any prediction algorithm exists. 26-field success contract required per type; 9-valued evaluation; 18-field evaluation record; automatic self-training prohibited. |
| **Structural inversion** | The measure of success is fixed before the thing measured exists, so success cannot be defined retroactively to fit whatever the engine produces. |
| **Duplicate-truth avoided** | The 18-field registry briefly in design §17 was **moved, not copied**, to `PREDICTION-SUCCESS-CONTRACTS.md`. Design §17 is now a pointer. |
| **Design narrowed** | §9 calibration: the sweep may record and evaluate outcomes but **may not apply** calibration. `calibration.ts` is not a runtime module in the first implementation — it may propose, never apply (N-4). |
| **Honest gaps** | 8 of 26 contract fields UNSET per type; **14/14 backtest-governance items UNSET**. Deliberately unset rather than filled with plausible values. |
| **Disposition** | APPLIED — `DR-008`, `PREDICTION-SUCCESS-CONTRACTS.md`, DR-007 §G, design §§9/17/18, Capability Register, Review Matrix, Open Risks N-4. **No code, schema, migration, flag, or UI.** |

## 13. §39 design approval with constraints (2026-07-22)

| Item | Detail |
|---|---|
| **Change** | §39 implementation design **approved with seven constraining decisions** (`DR-007` §A–§G). Implementation remains blocked. |
| **Scope reduction** | `calibrated_personal` **removed from first implementation**; three states only. Prediction types scoped to three named candidates; nine categories permanently prohibited. |
| **Rejected values** | `PREDICTION_CONFIDENCE_FLOOR = 0.35` and `PREDICTION_CALIBRATED_CONFIDENCE_MIN = 0.70` **rejected as numeric defaults** — I had proposed them without basis. Now `null`, fail-closed. **N-1 unresolved.** |
| **Design consistency** | Verified: with the floor UNSET, every projection resolves to `insufficient_data`. This is intended, not a defect. The design states it explicitly rather than hiding it behind a default. |
| **Disposition** | APPLIED — `DR-007`, design doc §§3–6/16/17, Capability Status Register, Review Matrix §4.1–4.3, Open Risks N-1/N-2/N-3. **No code, schema, migration, flag, or UI.** |

## 12. Truth & status reconciliation (assignment-wide rules, applied 2026-07-22)

Applying the truth/status rules to what has actually been built. **Specification vs. code, both
sides recorded — neither silently rewritten.**

| # | Item | What the spec says | What the code does | Authoritative | Consequence | Action | Blocks release? |
|---|---|---|---|---|---|---|---|
| T-1 | §38/§42 status language | Earlier reports called Stages 1–3 "COMPLETE" | Headless modules with **no runtime consumer, no flag, no route, no user visibility** | Code | "Complete" could be read as shipped | Restated with canonical labels. ⚠️ **This row's original action (Stages 2–3 → Built-Hidden) is SUPERSEDED by T-9** — all three stages are **Partially Built**. | No |
| T-2 | Graph tables | Stage 2 reported "2 Postgres tables" | Schema **defined and typechecked**; `drizzle-kit push` **never executed** (no `DATABASE_URL` on this machine) | Code | Tables do not exist in any database yet | Recorded as R-21; must be pushed in a DB-enabled environment before any deploy | No — but blocks deploy |
| T-3 | Multilingual intelligence | Language lock ships 6 launch locales | §42 validates **English only**; all other locales suppress intelligence claims | Code | No intelligence output in es/fr/de/pt/it | `LOCALE-POLICY-REGISTRY.md` + R-24. **No multilingual compliance is claimed.** | No |
| T-4 | Evidence confidence | Confidence described throughout the specs | `EvidenceAssessment.score` is **always null**; only coarse states are produced | Code | No numeric confidence exists to surface | Intentional (§9 Stage 2) — recorded in `MODEL-VERSION-REGISTRY` and R-23 | No |
| T-5 | HydroScan → HydroState | DR-001: advisory-only, never mutates score | Verified: no intelligence module dispatches a reducer or writes score; §42 blocks scan-raises-score copy (`P42-SCR-001`) | Both agree | — | No action | No |
| T-6 | Hero metric | HydroState is the only hero metric | No `dna_score` / numeric pattern score exists anywhere; §42 `P42-SCR-002` blocks a second hero score in copy | Both agree | — | No action | No |
| T-7 | Reserved §43–46 and reserved node/claim families | Reserved, non-operational | Declared and **rejected at construction / evaluation** | Both agree | — | No action | No |
| **T-9** | **Capability status of Stages 2 and 3** | Prior reports labeled both **Built-Hidden** | Stage 2: schema **defined but never pushed**, no executable end-to-end graph workflow in the target environment. Stage 3: **no approved internal caller**, no executable claim path. | **Founder ruling (2026-07-22)** | "Built-Hidden" overstated readiness — it implies a working capability being withheld, when neither has a working end-to-end path | **CORRECTED** to **Partially Built** in `CAPABILITY-STATUS-REGISTER.md`, `FEATURE-PHASE-MATRIX.md`, and here. Built-Hidden definition clarified: it **requires a functioning end-to-end capability intentionally withheld**. | No |
| **T-10** | **Pipeline order: §42 vs Evidence Engine** | `INTELLIGENCE-DEPENDENCY-MAP.md` §1 diagram put **§42 before the Evidence Engine** | The gate has **no caller**, so no runtime order exists; the implemented contract (`gate.ts` consumes an adapter verdict) matches Evidence Engine → §42 | **Phase 3.5 freeze** — `INTELLIGENCE-DATA-FLOW-CONTRACTS.md` | A wrong diagram could have been built against, wiring the gate before explanation | **CORRECTED** — data-flow contracts canonical; dependency map marked superseded-in-part | No |
| T-8 | Scientific basis of thresholds | `DR-003` calls them beta defaults; Stage 2 confidence is counting | No validated science behind either | Code | Thresholds must not be described as scientifically supported | R-20, R-23; backtesting is the correction mechanism | No |

**No external-readiness claim is made for any Stage 1–3 artifact.** None has legal, scientific,
privacy, or partner review recorded. Per the truth rules, absence of review is labeled
**"Not yet reviewed"** — never inferred as approval.

## 11. Phase 4 Stage 3 — §42 Intelligence Language and Claims Gate

| Item | Detail |
|---|---|
| **Change** | Pure, headless §42 gate: claim-candidate contract, 14 outcomes, 12 active + 3 reserved claim categories, versioned policy registry (`p42-v1.0`), locale policy registry (`l42-v1.0`), governed transformations, audit-decision contract. |
| **Policy authority** | `governance/CLAIMS-REGISTER.md` remains authoritative; `policyRegistry.ts` is its compiled machine-readable form. Both now declare the relationship (drift risk R-25). |
| **Locale honesty** | **English only.** Five launch locales and five flag-gated locales are `unvalidated` and suppress intelligence claims. No multilingual compliance claimed. |
| **Transformation** | Governed copy keys only — **no generative rewriting**. Transformability follows the *rule that fired*, not the outcome, so a state-integrity overclaim can never be reworded into apparent support. |
| **Disposition** | APPLIED — validated 2026-07-22. Typecheck clean; 62 new tests; pure-runner 106 files / 1556 tests; full suite **zero new failures** vs `TEST-BASELINE.md`. No surface, no flag, no route, no Evidence Engine behaviour change. |

## 10. Phase 4 Stage 2 — Performance Knowledge Graph™ foundation

| Item | Detail |
|---|---|
| **Change** | Headless §38 foundation: node/edge contracts (`types/knowledgeGraph.ts`), pure construction to a mutation plan, internal query interfaces, deletion propagation, Evidence Engine adapter boundary, and **two** Postgres tables. First model version minted: `graph-v1.0`. |
| **Minimal schema** | **2 tables** (`aforce_graph_nodes`, `aforce_graph_edges`) — not the 11 proposed across the full design package. Prediction, DNA-pattern and LPM tables were **not** created. A separate provenance-link table was **not** created; edge provenance is inline + GIN-indexed, sufficient for the Stage 2 cascade. |
| **Duplication avoided** | Profile/baseline versions referenced by id, never restated. `aforce_analytics_events` deliberately not reused — it is pseudonymous by design and reuse would re-identify analytics. Domain ledgers left untouched. |
| **Causation** | **No `causes` edge family exists**, and none may be added without a future scientifically approved causal-evidence policy. The adapter boundary refuses causal framing structurally. |
| **Confidence** | No scientific weighting invented. `EvidenceAssessment.score` is **always null**; the raw inputs are stored so an approved weighting can be applied later without re-deriving. Coarse states only: insufficient · emerging · supported · contradicted · superseded. |
| **Disposition** | APPLIED — validated 2026-07-22. Typecheck clean (client + db); 54 new tests; pure-runner 105 files / 1494 tests green; full suite shows **zero new failures** against `TEST-BASELINE.md`. |

## 9. Phase 4 Stage 1 — shared intelligence data contracts

| Item | Detail |
|---|---|
| **Change** | Canonical `IntelligenceEvent` envelope and contract helpers implemented (`types/intelligenceEvents.ts`, `utils/intelligence/intelligenceEventContracts.ts`), plus DR-005 retention windows in `config/hydroStateModel.ts`. |
| **Duplication avoided** | Profile/baseline versions are **referenced by id only** (`VersionContext`) — the existing `aforce_profile_versions` / `aforce_baseline_versions` tables are not restated. Freshness and signal quality reuse the shipped `utils/confidence/*` vocabulary rather than a parallel definition. |
| **New governance surface** | `PrivacyClass` (S0–S3, S4 deliberately absent), `RetentionClass` (R0–R7 per `DR-005`), `InvalidationStatus`/`InvalidationReason`, `SyncState` (cache-local only, not canonical), `AuditMetadata`. |
| **Invariant encoded** | `mustInvalidateForLostEvidence` expresses the `DR-002`/`DR-005` hard rule in code: no active derived record survives total evidence loss. |
| **Disposition** | APPLIED — validated 2026-07-22 (typecheck clean; 34 new tests; 1440 pure tests green). No schema, no API, no flags, no surface. |

## 8. AForce Intelligence™ four-layer taxonomy (amends Founder Decision 2)

| Item | Detail |
|---|---|
| **Change** | Founder Decision 2's flat list of 14 coordinated members is superseded by a **four-layer functional taxonomy of 18 members** (Core · Learning · Interaction · Context), stated by the founder 2026-07-22 and completed by the D-07 ruling. |
| **Added (+5)** | **Explainability** (§52 Explainability Center™) → Interaction; **Response Timeline** (§60) → Interaction; **Climate Profile™** → Context; **Environmental Pressure™** → Context; **Performance Drift™** (§27) → Context *(via D-07)* |
| **Removed** | **None.** Performance Drift™ was absent from the first statement of the taxonomy; **D-07 (closed 2026-07-22)** placed it in Context Intelligence. Net 14 → 18. |
| **Naming** | **Adaptive Response Engine™** is canonical in all structural contexts (architecture, registry, dependency maps, interfaces, diagrams, acceptance criteria, governance records, engineering specs). **Adaptive Response™** is approved shorthand for explanatory prose only — not an alias to be normalized away. Section mapping unchanged (§59). |
| **Disposition** | APPLIED — `docs/AFORCE-INTELLIGENCE-ARCHITECTURE.md` §2, `docs/AFORCE-OS-MASTER-SPEC.md` §1, `TERMINOLOGY-REGISTRY.md` §3/§3.1, `INTELLIGENCE-DEPENDENCY-MAP.md` §0, `DECISION-REQUIRED.md`. |

## 7. AForce Intelligence™ previously undefined

| Item | Detail |
|---|---|
| **Finding** | Three non-normative mentions (one code comment, two memory-index lines). |
| **Ruling** | **Founder Decision 2** — now canonically defined. |
| **Disposition** | APPLIED — `docs/AFORCE-INTELLIGENCE-ARCHITECTURE.md` + `TERMINOLOGY-REGISTRY.md` §1. |

## 21. Final Consolidated Implementation Lock — new conflicts (2026-07-26)

New contradictions found in the `/AUDIT` (PASS 1) of the Final Consolidated Implementation Lock
against **actual code** and prior specs. All **OPEN — pending `/RECONCILE` + founder ruling**.
No code changed. IDs prefixed `RC-L` to avoid collision with the R-## risk register.

| ID | Conflict (Lock § vs code) | Evidence (verified) | Proposed disposition | State |
|---|---|---|---|---|
| **RC-L1** | Lock §6 wants 5th primary tab **Circle** (with competition *inside* it, §22); code exposes **Competition** as its own primary tab. Legacy `replit.md` said "Community"; a hidden `social` route also exists. | `app/(tabs)/_layout.tsx`: visible triggers = index, journal, protocol, **competition**, profile; `scan`/`social`/`sleep`/`social-legacy` are `href:null`. | **Founder ruling 2026-07-26: canonical name is Circle.** 5th tab becomes **Circle**; competition folds inside it (§22). Label/route change — **not** a rebuild. Implementation deferred to `/PLAN`+`/BUILD`. | **RESOLVED — ruling recorded; code change PENDING BUILD** |
| **RC-L2** | Lock §5 names only the **4-band Performance State**; the repo also has the **5-band Score Status** (statusColor). | `utils/scoreBand.ts` 4 bands = 90/75/60/0 **match** Lock exactly. `theme/statusColor.ts` 5-band present & intact (10 color returns, off-limits). Both intentional per §6 of this register. | Both systems intentional; Lock's silence is not a merge mandate. **Do not merge.** | **RESOLVED — no change (confirmatory)** |
| **RC-L3** | Lock §5/§12: current can is **11 oz** (pH 8.8, 25 mg sodium as *unverified* inputs); code says **12 oz** throughout. | `data/pricing.ts`, `data/products.ts`, `data/productDatabase.ts` all read "12 ounces". | **Founder ruling 2026-07-26: keep 12 oz.** Code already reads 12 oz → **no-op, no change.** The Lock's 11 oz reference is superseded; pH 8.8 / 25 mg remain unverified and out of scope. | **RESOLVED — no change needed** |
| **RC-L4** | Terminology: Lock uses **"Circle"**; governance/code use **social / Community / competition**. | `TERMINOLOGY-REGISTRY`, tab routes, `data/*`. | **Canonical term = Circle** (per RC-L1). Record in `TERMINOLOGY-REGISTRY` during `/BUILD` alongside the tab rename. | **RESOLVED — ruling recorded; doc/code update PENDING BUILD** |
| **RC-L5** | Lock §5: HydroState values live in one versioned config. | `config/hydroStateModel.ts` + `HYDROSTATE_MODEL_VERSION='hydrostate-v0'` (D-08/DR-009). | **Aligned** — Lock ratifies existing decision. | **RESOLVED — aligned (confirmatory)** |
| **RC-L6** | Lock §2 mandates **one** Reconciliation Register. | This file is the single canonical register. | Confirm no parallel register is created; all Lock conflicts land here. | RESOLVED — this section |
| **RC-L7** | Lock §30: do not silently switch between **Founder 200** and **Founder 250** counts. | **PASS-2: "Founding N" appears in ZERO app code** (`grep`=0). Only in **governance/docs**: `AForce-Constitution.md:73,91`, `Phase-Roadmap.md:17`, `FEATURE-PHASE-MATRIX.md:119`, `Learning-Journal.md:5`, `docs/PRIVACY-COMPLIANCE-VALIDATION.md:104`, `docs/design/PHASE3-I-MIGRATION-ROLLBACK.md:55`. | **Founder ruling 2026-07-26: canonical = "Founder 250".** Change is **docs-only** (no app copy exists). ⚠️ Two sites are **frozen governing docs** (Constitution, Phase-Roadmap) → per Constitution's own terms a change needs **Julius + Brandon** sign-off; flag before editing. | **RESOLVED — ruling recorded; docs-only update PENDING BUILD (Constitution edit needs Julius+Brandon)** |
| **RC-L8a** | Lock §8/§9 canonical **append-oriented event ledger**. | **PASS-2 verified:** `aforce_intake_logs`, `aforce_score_snapshots`, `aforce_confirmations` are all **APPEND-ONLY** — no production `update()`/`delete()` (only in tests). No physical table literally named event/ledger; the §41 `IntelligenceEvent` ledger has **no Postgres backing** yet. | Append-only guarantee **holds** for the three core tables. The canonical IntelligenceEvent ledger table is **unbuilt** (design-stage). | **RESOLVED (append-only confirmed); IntelligenceEvent DB table = PROPOSED, not built** |
| **RC-L8b** | Lock §8/§9 **Score Protection**: score changes only from *verified completed behavior*. | **PASS-2 GAP:** enforcement is **DOCUMENTED-ONLY**. Server persists any client-supplied `score` 0–100 (`journal.ts:39`, `scoreSnapshotRepo.ts:90`); `POST /intake` (`intake.ts:132`) mutates score-input counters from an unverified request; `aforce_confirmations` is written but **never read as a gate** before a snapshot write. Guarantee lives in client determinism + comments, **not** a server guard. | **This is a real gap, not a contradiction.** Closing it = new server-side guard (join snapshot writes to a confirmed behavior record) — **new logic, needs `/PLAN` + founder approval.** Does NOT touch off-limits `scoringEngine.ts`/`statusColor.ts` (score math unchanged; only the *write gate*). Logged as **N-5 / R-29** below. | **OPEN — flagged for `/PLAN`; no code this phase** |
| **RC-L9** | Stage-1/2/3 intelligence contracts (`IntelligenceEvent`, knowledgeGraph, claimGate, languageGate). | **PASS-2 verified HEADLESS:** defined + unit-tested, **zero runtime callers** (no screen/hook/store/service/route imports them; contract fns never invoked outside tests). Separate older live intelligence surface (`commandLedger`, `executionMemory`) is unrelated. | Consistent with recorded status **Partially Built** (§9/§10 of this register). No new conflict — confirms the capability-status vocabulary was applied honestly. | **RESOLVED — status confirmed accurate** |

**Founder rulings — 2026-07-26 (RECONCILE):**
1. **RC-L1 / RC-L4 — 5th tab = "Circle."** PASS-2: route file **stays `competition.tsx`** (deep-link
   stability, existing pattern); change is **label-only** — `tabs.competition` currently renders
   **"Community"** (`locales/en.json:30`) → set to **"Circle"** across all locale files. Competition
   domain (types/engine/`CompetitionScreenV2`) stays as content inside the tab (§22). Deferred to BUILD.
2. **RC-L3 — keep 12 oz.** No code change (code already 12 oz); Lock's 11 oz reference superseded.
3. **RC-L7 — "Founder 250."** PASS-2: **docs-only** (no app copy exists); Constitution + Phase-Roadmap
   edits need Julius + Brandon sign-off. Deferred to BUILD.

**New risk logged — N-5 / R-29 (Score Protection not enforced server-side):** see RC-L8b. The
score-write path trusts client-supplied values and reads no confirmation gate. This is a **security /
integrity gap**, not a spec contradiction. Recommend a `/PLAN` item to add a server-side write gate.
No code this phase.

**Build log — 2026-07-26 (`/BUILD`, branch `feat/lock-reconciliation`):** founder approved the safe
set; three commits landed. No off-limits files touched; score math unchanged.
- **RC-L1 — DONE** (`4000791f`): `tabs.competition` → **"Circle"** across all 11 locales
  (English brand term). Route `competition.tsx` and competition domain unchanged. In-screen
  `community.*` headings deliberately **not** touched (tab-label-only scope, per founder).
- **RC-L7 — 2a DONE** (`60720b6f`): "Founding 200" → "Founding 250" in the 4 non-frozen docs.
  **2b still HELD** — `AForce-Constitution.md:73,91` + `Phase-Roadmap.md:17` (the authoritative
  phase name) await **Julius + Brandon** sign-off. The phase rename is not complete until 2b lands.
- **RC-L8b — Phase 3A DONE** (`c7723f66`): pure guard `api-server/src/lib/scoreWriteGuard.ts`
  + 12 tests, wired into `POST /journal/snapshot` in **shadow** mode (observe + log, never blocks,
  fail-open). Mode via `SCORE_PROTECTION_MODE` (default shadow-dev / off-prod). **Scope trim vs
  plan:** only the journal snapshot path is wired; `sensors.ts` (batch/transaction, hardcoded
  `score:70`) is deferred to **Phase 3B**. **3B (enforce) remains OPEN** — gated on R-21 DB deploy
  (add nullable provenance columns) + client attaching provenance to snapshot posts.

**PR #377 — code review APPROVED for shadow-mode merge (2026-07-26).** All hard gates passed
(guard tests 12/12, api-server typecheck clean, CI green, no off-limits files, score math unchanged,
fail-open verified, 11 locales consistent, frozen docs untouched, no log privacy leak).

**Phase 3B enforcement pre-flight — REQUIRED before flipping `SCORE_PROTECTION_MODE=enforce`
(tracked follow-ups, do NOT block the shadow merge):**
1. **Prod env guarantee.** Confirm the deployed api-server explicitly sets `NODE_ENV=production` —
   otherwise the `off-in-prod` default in `scoreWriteGuard.ts:resolveScoreProtectionMode` is
   contingent and the guard would run shadow in prod. If not guaranteed, change the default to
   **off-unless-explicitly-enabled**.
2. **Evidence-lookup index.** Add a `(userId, loggedAt)` index supporting the two `count(*)`
   evidence queries — `aforce_confirmations` currently has none; `aforce_intake_logs`'s `loggedAt`
   is unindexed. (Additive index; deploys with R-21.)
3. **Enforce-path integration coverage.** The route wiring (query construction, the 409 return, the
   catch) has no integration test — only the pure functions are covered. Add before 3B.
4. **Enforce-mode error handling.** The inner `try/catch` in `journal.ts` currently fails open even
   in `enforce` mode — a guard/DB error would let an unexplained write through. Change so that in
   `enforce`, a guard failure does **not** silently pass (fail-closed or explicit error). Safe as-is
   for shadow; must change for 3B.
5. **Wire `sensors.ts`** into the guard (deferred from 3A).

---

**Audit status — PASS 2 COMPLETE (2026-07-26).** Verified against code: navigation + label wiring,
both band systems, can-size copy, Founding-count sites, integrations present, flag count, schema
table count, **append-only ledger tables**, **Score Protection enforcement path**, and **intelligence-
contract runtime wiring**. Still NOT deep-audited (future passes, not blocking `/PLAN`): §10
consumption state machine end-to-end, §26 provider capability↔actual-access matrix, §30 entitlement
single-source-of-price. Screens, mocks, and comments are **not** counted as working features (Lock §2).

---

## 22. Same-day addendum — post-build events (2026-07-26 afternoon)

**D-08 went Public Live.** The stamping code deployed to Railway and the founder ran the additive
prod-DB migration (`hydrostate_model_version` column, per the runbook). New snapshots stamp
`hydrostate-v0`; historical rows honestly `NULL`. Closes the code+prod side of R-21 (dev-DB push
still open).

**Command commerce verified end-to-end (closes PR #380 review condition B).** Live E2E on a
Vercel Preview deployment: gate 1 (flag-off → guard 404, production, by design) · gate 2 (flag-on
+ no Storefront env → 503) · gate 3 (real `cartCreate`: **both selling plans confirmed applied** —
2532999286 @ $20.00/mo, 2533032054 @ $200.00/yr; checkout host `shop.drinkaforce.com`).
Storefront token provenance was investigated first (none ever existed anywhere — repo, history,
other projects); a new token was generated by the founder and lives Preview-scoped. Production
checkout remains **deliberately gated** per the founder's standing Preview-only rule (cutover =
launch decision). Condition A (auto-renew disclosure) shipped in #380; counsel nod on the copy
still recommended.

**Founder pricing ruling — NEW OPEN ITEM (RC-L10, cutover blocker).** Ritual plan `2501607542`
stays at **full price for now** (founder, 2026-07-26): charges $59.99 sticks / $29.99 RTD with
`price_adjustments: []`, while the shop page displays $53.99/$26.99 "Save 10%". **Displayed ≠
charged** — a §30/§32-class violation the moment checkout transacts. Resolution before Production
cutover: (a) add the 10% recurring policy to the plan, or (b) change shop copy to full price and
remove the Save-10% claim. State: **OPEN — founder decision deferred.**

**Incident disclosure (Lock §2 preservation duty).** PR #377 shipped imports of never-committed
files → Railway api-server deploys failed 11:26–13:0x (prod kept serving the last good build; no
outage). A `reset --hard` during the #377 retarget destroyed uncommitted tracked changes. Repaired
same day (#382 missing deps, #383 demo-build config restore). **Residual loss:** Stage-2 graph
tables + `sensors.ts` D-08 migration are no longer in source — reconstruction from
`STAGE-2-GRAPH-SCHEMA-DEPLOYMENT-RUNBOOK.md` queued for the next build slice. Stage-2 capability
status corrected accordingly: graph schema reverts from "in source" to **Specified (runbook)**.

**RC-L3 addendum:** can *artwork* (hero) reads 11 FL OZ (325 ml) vs the keep-12-oz ruling and
12-oz site copy — final approved label required to close the loop.
