# Stage 2 Graph Schema — Deployment Runbook

**Status:** ⏳ **PREPARED — NOT EXECUTED.** No deployment has occurred.
**Scope note (2026-07-22):** this runbook now also covers the **D-08** column
`aforce_score_snapshots.hydrostate_model_version`, which deploys in the same push.
**Prepared:** 2026-07-22 (Phase 3.7) · **Closes when executed:** R-21

> **No `DATABASE_URL` is configured in this environment**, so deployment was not attempted and no
> safe development database is available to this session. **This runbook stops before execution.**
>
> **No secrets appear in this document. No `DATABASE_URL` was invented.**

---

## 1. Current state (inspected 2026-07-22)

| Question | Finding |
|---|---|
| Do migration files exist? | **No.** The db package has no migrations directory and no `.sql` files. |
| Does the schema exist only in ORM definitions? | **Yes.** `lib/db/src/schema/aforce.ts` lines 1218–1312, exported via `schema/index.ts`. |
| Deployment mechanism | `drizzle-kit push` — **schema-first, diff-based**, no migration files, **no down-migrations** |
| Required env var | `DATABASE_URL` (read by `lib/db/drizzle.config.ts`, which throws if absent) |
| Intended target | **UNDETERMINED — founder/engineering decision.** See §2. |
| Is deployment reversible? | Yes, by dropping the two new tables. **No scripted rollback exists** — consistent with every other table here. |
| May existing tables/data be affected? | **No.** Both tables are new. No existing column is altered. |
| Indexes complete? | **Yes** — 4 on nodes, 5 on edges (incl. a GIN index on `provenance_links`) |
| Constraints complete? | Primary keys yes. **No foreign keys** — consistent with the **repo-wide convention** (`references(` count across the entire schema file: **0**). Referential integrity is application-enforced. |
| Can retention/deletion rules operate after deployment? | **Partially.** Invalidation columns exist and the propagation planner is implemented and tested. **No runtime caller exists**, so nothing writes or cascades yet. |
| Does the schema match the Stage 2 design? | **Yes** — verified against `docs/design/PHASE3-C-PERSISTENCE-MODEL.md` and the Stage 2 report. |

## 2. Target environment — **must be decided before execution**

**Not determinable from the repository.** Candidates:

| Target | Suitability |
|---|---|
| Local development Postgres | Safest. Recommended first. |
| Shared development / Replit dev DB | Acceptable if it is genuinely non-production |
| Staging | Acceptable with authorization |
| **Production** | ❌ **Requires explicit founder authorization.** Not authorized. |

> `drizzle-kit push` diffs live schema against definitions. Pointing it at the wrong database
> could emit unintended statements against unrelated tables. **Confirm the target before running.**

## 3. Prerequisites

- [ ] Target environment explicitly identified and authorized
- [ ] `DATABASE_URL` available in the shell (never committed, never logged)
- [ ] Backup or snapshot taken (§5)
- [ ] `pnpm install` completed
- [ ] Operator can read the schema diff before applying

## 4. Known behaviour to expect

**A pre-existing, harmless diff will appear on every push:** `aforce_privacy.fields SET DEFAULT`.
This is a documented drizzle-kit JSONB-default normalization quirk
(`docs/SCHEMA_DRIFT.md`) — drizzle-kit serializes the default compactly while Postgres
canonicalizes it, so the comparison never matches and the statement re-emits forever.

**It is `SET DEFAULT` only — no row rewrite, no destructive statement.** Do not treat it as a
failure; do not "fix" it during this deployment.

## 5. Pre-deployment

```bash
# 1. Confirm the target — print host only, never the full URL
node -e "const u=new URL(process.env.DATABASE_URL); console.log('host:', u.host, '| db:', u.pathname)"

# 2. Confirm the two tables do NOT already exist
psql "$DATABASE_URL" -c "\dt aforce_graph_*"
```

**Backup expectation:** take a snapshot before running. For a managed database use its
point-in-time restore; for local Postgres, `pg_dump` to a file outside the repository.

## 6. Schema-diff review — do not skip

`drizzle-kit push` is interactive and prints the statements it intends to run.

**Expected:** `CREATE TABLE aforce_graph_nodes` · `CREATE TABLE aforce_graph_edges` ·
9 `CREATE INDEX` statements · the known `aforce_privacy.fields SET DEFAULT`.

**Abort immediately if you see:** any `DROP` · any `ALTER COLUMN` on an existing table ·
any `TRUNCATE` · any statement touching a table other than the two new ones or the known privacy
default.

## 7. Deployment

```bash
pnpm --filter @workspace/db run push
```

Review the printed diff, then confirm. **Do not use `push-force`** — it skips confirmation and
would apply any unexpected destructive statement without review.

## 8. Post-deployment verification

```bash
# Tables exist
psql "$DATABASE_URL" -c "\d aforce_graph_nodes"
psql "$DATABASE_URL" -c "\d aforce_graph_edges"

# All 9 indexes exist
psql "$DATABASE_URL" -c "\di aforce_graph_*"
```

**Expected indexes (9):**
`aforce_graph_nodes_user_family_idx` · `_user_status_idx` · `_user_occurred_idx` ·
`_source_event_idx` · `aforce_graph_edges_user_family_idx` · `_user_status_idx` ·
`_source_node_idx` · `_target_node_idx` · `_provenance_idx` (GIN)

## 9. Smoke tests

Read-only and insert/rollback only. **No production data.**

```sql
-- 1. Empty tables, correct columns
SELECT count(*) FROM aforce_graph_nodes;    -- expect 0
SELECT count(*) FROM aforce_graph_edges;    -- expect 0

-- 2. Insert + rollback (never committed)
BEGIN;
INSERT INTO aforce_graph_nodes
  (id, user_id, family, occurred_at, recorded_at, day_index, day_index_basis,
   privacy_class, retention_class, provenance, quality, attributes)
VALUES
  ('n:smoke:action:1','smoke','action', now(), now(), 20833,'local-calendar',
   'S1','R2','{"source":"user_log","derivedFrom":[]}','{"freshness":"fresh","signalQuality":"good","confidence":null}','{}');
SELECT invalidation_status FROM aforce_graph_nodes WHERE id='n:smoke:action:1';  -- expect 'active'
ROLLBACK;

-- 3. Confirm rollback left nothing
SELECT count(*) FROM aforce_graph_nodes;    -- expect 0

-- 4. GIN index is usable
EXPLAIN SELECT * FROM aforce_graph_edges WHERE provenance_links @> '["e1"]';
```

**Also verify defaults:** `invalidation_status` defaults to `'active'`; `direction` to
`'directed'`; counts to `0`.

## 10. Rollback

```sql
DROP TABLE IF EXISTS aforce_graph_edges;
DROP TABLE IF EXISTS aforce_graph_nodes;
```

**No user data is lost** — nothing writes to these tables (no runtime caller exists). Indexes drop
with their tables.

## 11. Evidence required to close R-21

**CLOSED 2026-07-31 on FOUNDER ATTESTATION (production).** Items 1/2/6 recorded on the founder's
attestation; items 3/4/5 (console output) were **not independently captured in this environment**
(no `DATABASE_URL`) — they are **attested, not verified**. If the `\d`/`\di`/smoke-test output is
later captured, upgrade this to fully-verified.

- [x] **1.** Target environment: **production** — founder-authorized + attested 2026-07-31
- [x] **2.** Deployment executed — **founder-attested 2026-07-31** (exact date/operator/command not captured in-repo)
- [ ] **3.** Both tables verified present (`\d` output) — **founder-attested; `\d` output NOT captured in-repo**
- [ ] **4.** All 9 indexes verified present (`\di` output) — **founder-attested; `\di` output NOT captured in-repo**
- [ ] **5.** Smoke tests §9 passed — **founder-attested; result NOT captured in-repo**
- [x] **6.** Evidence recorded in `OPEN-RISKS.md` R-21 + `CAPABILITY-STATUS-REGISTER.md` — done (this attested closure)

**Deploying to a development database closes R-21 only for that environment.** Production
deployment is a separate, separately-authorized event.

## 12. What deployment does NOT do

| It does not |
|---|
| Advance §39 — three other gates remain |
| Advance Stage 2 beyond **Partially Built** — deployment supplies persistence, but there is still **no runtime caller and no end-to-end workflow** |
| Enable any feature flag |
| Cause any data to be written |
| Change any user-facing behaviour |

## 12.1 Deployment attempt — 2026-07-22 · ❌ BLOCKED, NOT EXECUTED

Founder authorized a **development-only** deployment of D-08 + Stage 2. **Stopped at the §1
precondition: no database connection is available.**

| Check | Result |
|---|---|
| `DATABASE_URL` in shell | ❌ **not set** |
| `DATABASE_URL` in any `.env` | ❌ **absent** (key-presence checked in 3 files; **no value was ever read or printed**) |
| `psql` client | ❌ not installed |
| `pg_isready` / local Postgres | ❌ not available |
| Docker (for a disposable container DB) | ⚠️ installed but **not running** |
| Branch / commit | `fix/smartmodes-water-first` @ `14c8d111` |
| Target environment | ❌ **none identified** |
| Backup / disposability | ❌ **N/A — no target exists** |
| Schema diff vs target | ❌ **not obtainable** — cannot diff against a database that is not reachable |
| Deployment command run | ❌ **none.** `drizzle-kit push` was **never invoked**. |
| Database changed | ❌ **no** |
| Secrets exposed | ❌ **none** |

**Per §1: "If the target cannot be proven to be a safe development database, stop." and
"If no database connection is available, stop and provide the exact setup instructions."**
Both conditions applied. **R-21 remains OPEN.**

### Source audit performed (§2) — passed, no target comparison possible

| Item | Source status |
|---|---|
| `aforce_score_snapshots.hydrostate_model_version` | ✅ present, nullable, no DB default |
| `aforce_graph_nodes` | ✅ present |
| `aforce_graph_edges` | ✅ present |
| Graph indexes | ✅ **9 declared** |
| Invalidation / retention support fields | ✅ 6 present |
| **Unauthorized §39 / Prediction / DNA / LPM tables** | ✅ **NONE — verified** |
| Total tables in schema | 30 |

**Deployment convention re-verified:** `drizzle-kit push` (`lib/db/package.json`). No committed
migration files exist. Still true.

## 12.2 Disposable-validation attempt — 2026-07-22 · ❌ BLOCKED, NOT EXECUTED

Founder authorized validation against a **disposable local Postgres** via Docker/Testcontainers.
**Stopped at the §1 precondition: the Docker daemon is not running.**

| Check | Result |
|---|---|
| Docker CLI | ✅ installed — `/opt/homebrew/bin/docker`, **v29.6.1** |
| Docker **daemon** | ❌ **NOT RUNNING** — `Cannot connect to the Docker daemon at unix:///Users/…/.colima/default/docker.sock` |
| **Runtime on this Mac** | ⚠️ **Colima — NOT Docker Desktop.** `/Applications/Docker.app` does **not** exist. |
| Colima VM (`default`) | **Stopped** — aarch64, 2 CPUs, 2 GiB RAM, 100 GiB disk |
| `DOCKER_HOST` | not set (falls back to the Colima socket) |
| Container created | ❌ **none** |
| `drizzle-kit push` | ❌ **never invoked** |
| Database contacted | ❌ **none** |
| Secrets exposed | ❌ **none** |

**Correction for future runbooks:** the authorization said *"report the exact action required to
start Docker Desktop"* — **Docker Desktop is not installed on this machine.** The correct action
is `colima start`. Starting Colima provisions a VM (CPU / memory / disk), which is a host-level
change; per the instruction to report-and-stop, it was **not** started.

**R-21 remains OPEN.** Disposable validation would not have closed it in any case.

## 12.3 Named-development deployment attempt — 2026-07-22 · ❌ BLOCKED, NOT EXECUTED

Founder authorized deployment to a **named, persistent development Postgres**, reported as
provisioned. **Stopped at the §1 hard precondition: the connection is not available to this
session.**

| §1 requirement | Result |
|---|---|
| Environment name | ❌ **not supplied** |
| Proof it is development | ❌ **not obtainable** |
| Provider / Postgres version | ❌ unknown — no connection |
| Host / database name | ❌ unknown |
| No production data | ❌ **unverifiable** |
| **`DATABASE_URL` available** | ❌ **NOT SET** — absent from the shell, from every `.env` in the repo, from shell profiles, and from the environment |
| `psql` client | ❌ not installed |
| Docker daemon | ❌ not running (Colima VM `Stopped`) |
| Branch / commit | `fix/smartmodes-water-first` @ `14c8d111` |
| Backup / restore evidence | ❌ **not supplied** |

**Four independent §1 stop conditions applied.** No command was run, no database contacted, no
secret read or printed.

### Root cause — provisioning ≠ availability

The database may well exist. **The connection string was never exposed to this session.** Exporting
`DATABASE_URL` in a separate terminal does **not** propagate here: each command runs in its own
shell inheriting only the harness environment. The value must reach this session explicitly.

**R-21 remains OPEN.**

## 13. Execution record

```
Target environment: ______________________
Authorized by: ____________  Date: __________
Operator: ____________  Date: __________
Diff reviewed: ☐ yes   Unexpected statements: ☐ none ☐ (list)
Tables verified: ☐   Indexes verified (9): ☐   Smoke tests: ☐ pass ☐ fail
R-21 closed for this environment: ☐
```
