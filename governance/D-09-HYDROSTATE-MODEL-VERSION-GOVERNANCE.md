# D-09 — HydroState Model-Version Governance (Architecture Proposal)

**Status:** ⏳ **PROPOSAL — awaiting founder decisions.** Governance and design only.
**Prepared:** 2026-07-22 · **Blocks:** D-08 implementation · G-6 closure

> **No code, schema, migration, constant, or runtime behaviour was created.** This document
> presents architecture and options. **The first version number is deliberately not assigned.**

---

# PART 1 — Authoritative model-version source

## 1.1 Where it should live

**Recommendation: `artifacts/aforce-os/config/hydroStateModel.ts`.**

| Why | Detail |
|---|---|
| Build Rule 13 | "All thresholds, weights, and tunable values live in `config/hydroStateModel.ts`" — the version *identifies the set of those values*, so it belongs beside them |
| Single source | `scoringEngine.ts` and `statusColor.ts` are **off-limits**; config is the one scoring-adjacent file that is routinely extended |
| Proximity | A coefficient change and its version bump land in the same file, in the same commit — the version is hard to forget |
| Precedent | The same file already holds the `BASELINE_CONFIDENCE` lifecycle and Stage 1/2 retention and graph constants |

**Rejected alternatives:** a database table (a version the code cannot read at write time is
useless); `package.json` (couples scoring lineage to release engineering); a new dedicated file
(fragments the config surface Build Rule 13 deliberately centralises).

## 1.2 How it should be represented

| Property | Recommendation |
|---|---|
| Form | A single exported string constant |
| Format | `hydrostate-v<major>.<minor>` — matching `graph-v1.0`, `p42-v1.0`, `l42-v1.0` |
| Type | `string` (stored as `text`, nullable, on the snapshot) |
| Uniqueness | **Exactly one** such constant may exist. No second or competing source. |
| Registry | Mirrored as a row in `MODEL-VERSION-REGISTRY.md` with date, change, comparability, migration action |

## 1.3 Ownership

| Role | Responsibility |
|---|---|
| **Owner** | **Founder** — HydroState is the hero metric; its lineage is a founder-owned asset |
| **Steward** | Engineering — proposes bumps, keeps constant and registry in lockstep |
| **Approver** | **Founder + Engineering** always; **Scientific** additionally when the change is physiological (coefficients, sweat/sodium math, band thresholds) |

## 1.4 What requires an increment

**The governing test — one sentence:**

> **Increment when an approved change can alter HydroState output for identical inputs.**

| Change | Increment? | Major/minor |
|---|---|---|
| Scoring formula or weighting | ✅ Yes | **Major** |
| Band thresholds (90/75/60) | ✅ Yes | **Major** |
| Coefficient change in config | ✅ Yes | Minor unless it re-bands typical users |
| Score-eligibility rule change | ✅ Yes | **Major** |
| Bug fix that **changes output** | ✅ Yes | Minor (major if it re-bands) |
| Bug fix, provably output-identical | ❌ No | — |
| Refactor, output-identical | ❌ No | — |
| New *input source* feeding existing math | ✅ Yes | Minor |
| Copy, UI, colour, or label change | ❌ No | — |
| Test-only change | ❌ No | — |
| Config value that is **not** a scoring input | ❌ No | — |

**Major** = historical scores are **not comparable**; any trend spanning the boundary must surface
the discontinuity. **Minor** = comparable refinement.

## 1.5 Relationship to the other versions

**Nine distinct versions exist. This is the tenth, and it is the only one describing the hero
metric.** It must never be substituted for, or derived from, any other.

| Version | Relationship to HydroState model version |
|---|---|
| **Profile version** | **Orthogonal.** Profile = *who the user is*. Model = *how the score was computed*. A snapshot carries both; neither implies the other. |
| **Baseline version** | **Orthogonal.** Baseline = *what the user is measured against*. |
| **Graph derivation version** | **Downstream, independent.** The graph observes score outputs; it never defines them. |
| **Prediction Engine model version** | **Downstream.** §39 reads HydroState read-only. A prediction records which model produced the state it read. |
| **§42 gate-policy version** | **Unrelated.** Language policy, not computation. |

**The reproducibility triple:** a HydroState snapshot is only fully reproducible given
**profile version + baseline version + model version**. Two of the three already exist on the row;
this decision supplies the third.

## 1.6 The first version — founder options

**Not assigned here, by instruction and on principle.** The current scoring math has an
undocumented lineage; naming it is a claim about history, not a technical default.

### Option A — current scoring becomes the first official version

Declare today's shipped math `hydrostate-v1.0`. All new snapshots stamp it.

| ✅ | ❌ |
|---|---|
| Simplest; one concept | **Asserts the current math is a deliberate, reviewed "version 1" — it was never reviewed as such** |
| Every future snapshot is versioned | Silently absorbs an unknown amount of pre-versioning drift into one label |
| No null-handling beyond historical rows | If the math changed during development, v1.0 spans *several* real behaviours |

### Option B — current scoring stays "pre-versioned"; the first governed release is v1.0

Snapshots stay **null** until the next approved scoring change, which becomes `hydrostate-v1.0`.

| ✅ | ❌ |
|---|---|
| **Honest.** Null means exactly what D-08 says: "version not recorded" | No snapshot is versioned until the next scoring change — could be a long wait |
| Never claims review that did not happen | Two epochs to reason about (unversioned, then versioned) |
| The first version is genuinely a *governed* release | The field sits unused meanwhile, so a defect in it surfaces late |

### Option C — current scoring becomes `hydrostate-v0` (explicitly pre-governance) — **recommended**

Stamp today's math as **`hydrostate-v0`**, meaning *"the pre-governance baseline, recorded as
observed, never reviewed as a version."* The first governed release becomes `hydrostate-v1.0`.

| ✅ | ❌ |
|---|---|
| **Gets both properties:** every new snapshot is versioned *and* nothing false is asserted | A third concept (`v0`) to explain — mitigated by it appearing in the registry with exactly that definition |
| `v0` is self-documenting: the zero says "before governance" | |
| Distinguishes **"not recorded"** (null, historical) from **"recorded, pre-governance"** (`v0`) — a real and useful distinction | |
| The field is exercised immediately, so defects surface now | |
| The `v0 → v1.0` boundary is a genuine major bump, correctly signalling non-comparability | |

**Why C over A:** A makes a claim about the past that no evidence supports. **Why C over B:** B
leaves the field unexercised and drops a real distinction — a snapshot written tomorrow under
known math is *not* the same epistemic object as one written a year ago under unknown math, yet B
records both as null.

---

# PART 2 — Central write path

## 2.1 What exists

| # | Site | Shape |
|---|---|---|
| 1 | `api-server/src/routes/aforce/journal.ts:35` | `db.insert(aforceScoreSnapshots).values({ userId, ...parsed.data })` — spreads a validated client payload |
| 2 | `api-server/src/routes/aforce/sensors.ts:103` | `tx.insert(aforceScoreSnapshots).values(snapshots)` — batch insert inside a transaction |

**No shared abstraction. Neither route knows about the other.**

## 2.2 The decisive finding — the convention already exists

**`lib/db/src/` already has a repository layer**, and one member is a near-exact analogue:

`demandSnapshotRepo.ts` — *"Hydration Demand snapshot repository — pure persistence layer.
Framework-free: no Express, no auth, no engine code."* Ships an in-memory binding and a Drizzle
binding behind one contract, with documented idempotency.

Siblings: `profileRepo.ts` · `scanRepo.ts` · `whoopTokenStore.ts` · `garminTokenStore.ts` ·
`ouraTokenStore.ts` · `stravaTokenStore.ts`.

**`aforce_score_snapshots` is the notable snapshot table with no repository.** It predates the
pattern. This is not a question of inventing an architecture — it is a question of whether the
score snapshot joins the one already in use.

## 2.3 Options

### Option A — shared snapshot *service* (api-server)

A service module in `api-server/src/services/` both routes call.

| ✅ | ❌ |
|---|---|
| Single stamping point | **Introduces a layer that does not exist for any other table** |
| Room for cross-cutting logic | Wrong home: `sensors.ts` inserts inside a transaction; a service would need the tx handle passed through, leaking persistence into the service boundary |
| | Diverges from the established `lib/db` repo convention |

### Option B — shared *repository* in `lib/db` — ✅ **RECOMMENDED**

`scoreSnapshotRepo.ts`, mirroring `demandSnapshotRepo.ts`.

| ✅ | ❌ |
|---|---|
| **Follows the existing convention exactly** — the lowest-novelty option | Touches two route files (each swaps an inline insert for a repo call) |
| Framework-free, so the transaction in `sensors.ts` is naturally supported | Repo needs a transaction-aware binding — already how the Drizzle bindings are shaped |
| One stamping point; **impossible to forget** by construction | |
| Brings in-memory bindings, so snapshot writes become testable without a database | |
| Closes the anomaly of the only snapshot table lacking a repo | |

### Option C — approved duplicated stamping with validation

Stamp at both sites; add a test asserting both supply the version.

| ✅ | ❌ |
|---|---|
| Smallest diff | **Exactly what the D-08 authorization warned against** — relying on callers to remember |
| No new module | A third insert site added later silently writes null, and null is indistinguishable from a legitimate historical null |
| | The validating test can only check sites that exist today |

## 2.4 Recommendation

**Option B.** It is the **lowest-novelty** choice — it adopts a convention already in the
repository rather than inventing one, puts stamping where it cannot be bypassed, and fixes an
existing inconsistency as a side effect.

Option C's failure mode is the serious one: a future fourth insert site writes null, and **null
already means "not recorded"**, so the defect is invisible in the data.

## 2.5 Risks, migration strategy, backward compatibility

| Item | Assessment |
|---|---|
| **Risk — behaviour change** | Low. The repo wraps the same insert; no values change. Mitigate with a before/after test on the returned row. |
| **Risk — transaction handling** | The real risk. `sensors.ts` inserts inside `tx`. The contract must accept an optional transaction handle, as the Drizzle bindings already do. |
| **Risk — scope creep** | Moderate. A repository invites unrelated refactors. **Constrain to: insert, read-for-existing-callers, nothing else.** |
| **Migration strategy** | Pure code refactor. **No data migration, no schema change beyond the D-08 column.** |
| **Backward compatibility** | Full. Table shape unchanged apart from the new nullable column; existing readers unaffected; API responses unchanged. |
| **Rollback** | Revert the two route call sites to inline inserts. No data impact. |
| **Sequencing** | Repository **before** the column, so the field has exactly one write path from the moment it exists. |

---

# PART 3 — The minimum founder decisions

**Five. Decisions 1 and 2 alone unblock D-08.**

### Decision 1 — Where does the authoritative version live, and in what form?

**Question:** Should the HydroState model version be a single exported string constant in
`config/hydroStateModel.ts`, formatted `hydrostate-v<major>.<minor>`?

**Recommendation:** **Yes.** Build Rule 13 already centralises scoring tunables there; the version
identifies that set, and format matches the four existing version schemes.

**Alternatives:** a database table (unreadable at write time) · `package.json` (couples scoring
lineage to releases) · a new dedicated file (fragments the config surface).

**Consequences:** the constant becomes the sole source; a second one anywhere is a governance
defect. Bumps happen in the same file as the coefficients that caused them.

### Decision 2 — What is the first version? 🔴 **the actual blocker**

**Question:** Option A (current math = `v1.0`) · Option B (stay null until the next governed
release) · **Option C (current math = `v0`, pre-governance; first governed release = `v1.0`)**?

**Recommendation:** **Option C.** Every new snapshot gets versioned immediately *and* nothing false
is asserted about the past. It preserves the distinction between **"not recorded"** (historical
null) and **"recorded, pre-governance"** (`v0`).

**Alternatives:** A is simpler but claims the current math was reviewed as a version — it was not.
B is honest but leaves the field unexercised and collapses that distinction.

**Consequences (C):** one extra concept to document; the `v0 → v1.0` transition is a **major** bump
signalling non-comparability, which is exactly right.

### Decision 3 — Who approves a version increment?

**Question:** Founder + Engineering always, plus Scientific when the change is physiological?

**Recommendation:** **Yes.** Mirrors the existing change-control approval gates for score
behaviour.

**Alternatives:** Engineering alone (too weak for the hero metric) · Founder alone (a bump is
partly a technical judgement about output equivalence).

**Consequences:** a scoring change acquires an approval step. Intended — that is the point.

### Decision 4 — May a shared score-snapshot repository be created?

**Question:** Authorize `lib/db/src/scoreSnapshotRepo.ts` mirroring `demandSnapshotRepo.ts`, with
the two routes migrated to it — scope strictly limited to insert plus existing reads?

**Recommendation:** **Yes (Option B).** Lowest-novelty; adopts the existing convention; makes
missing the stamp structurally impossible.

**Alternatives:** a service layer (wrong home, transaction leakage) · duplicated stamping (the
pattern D-08 explicitly warned against).

**Consequences:** two route files change. No behaviour change, no data migration. Without this,
Decision 5 must accept a known silent-null failure mode.

### Decision 5 — If Decision 4 is declined, is duplicated stamping accepted?

**Question:** If no repository is authorized, do you accept stamping at both sites with a
validating test, and the recorded risk that a future insert site writes null silently?

**Recommendation:** **Prefer Decision 4.** If declined, accept only with the risk formally
recorded — because null already means "not recorded", the defect would be **undetectable in the
data**.

**Alternatives:** leave D-08 blocked indefinitely.

**Consequences:** accepting adds a permanent open risk; the validating test can only cover sites
that exist at the time it is written.

---

# PART 4 — Implementation readiness

**Yes — D-08 becomes fully implementable if Decisions 1, 2, and 4 are approved.** (3 is governance
that can follow; 5 applies only if 4 is declined.)

| Blocker | Resolved by |
|---|---|
| No authoritative model-version source | **Decisions 1 + 2** |
| No central snapshot-write path | **Decision 4** |

**Nothing else blocks D-08.** The column shape, null semantics, increment triggers, replay,
rollback, export, and audit behaviour are already specified in `DR-009` §5, and the 14-test plan
in `DR-009` §8.

**Implementation sequence on approval:**

1. Add the version constant (Decision 1) with the value from Decision 2.
2. Register it in `MODEL-VERSION-REGISTRY.md`.
3. Create `scoreSnapshotRepo.ts` (Decision 4); migrate both routes.
4. Add the nullable column, mirroring `profileVersionId`.
5. Stamp in the repository — one place.
6. Run the 14 tests.
7. Update governance; **G-6 closes on implementation evidence, not approval.**

**Still out of scope and unaffected:** §39 implementation · graph-schema deployment · production
deployment · scoring-formula changes · historical recalculation or backfill · UI.

**Estimated change surface:** one constant · one column · one new repository module · two route
call sites · one registry row · fourteen tests. **No scoring math is touched.**
