# Test Baseline — pre-Stage-2

**Status:** Canonical · **Recorded:** 2026-07-22, immediately after Phase 4 Stage 1 approval and
**before any Stage 2 work began** · **Reconciled:** 2026-08-05 (RC-1 final fold-in, item 7 —
`fix/rc1-final-foldin`, `baseline-override` label) · **RESOLVED:** 2026-08-12 (Wave-4 Part 3
burn-down — PRs #750, #753, `baseline-override` label)
**Purpose:** distinguish pre-existing environmental failures from genuine regressions.

> ## 2026-08-12 — THE BASELINE IS ZERO
>
> **Both causes are fixed. The accepted failure ceiling is now 0 files / 0 tests.**
>
> The "45 files / 18 tests" recorded below was never 45 defects. It was **two environment
> faults** that crashed suites at *import* — and in doing so **hid 332 tests that had never
> executed at all**. Fixing the environment unmasked them, and every one of the resulting
> failures was then classified and resolved (PR #750):
>
> | Original cause | Files | Resolution |
> |---|---|---|
> | A — `ReferenceError: __DEV__ is not defined` | 12 | `vitest.setup.ts` defines `__DEV__ = false`. Audited: **zero** `typeof __DEV__ === 'undefined' \|\|` patterns exist, so all 8 in-repo guards evaluate identically. |
> | B — `DATABASE_URL must be set` | 33 | `vitest.setup.ts` sets an **unreachable placeholder** only when absent (`pg.Pool` does not connect until first query). The 9 suites that issue *real* queries moved to a gated **DB lane** (`vitest.db.config.ts`, `describe.runIf(DB_TESTS)`, `pnpm test:db`) with a `postgres:16` CI job (#753 added the `pgcrypto` extension it needs). |
>
> Of the 22 failures the fix unmasked: 11 were client suites crashing at import on RN/Expo
> native edges (fixed with a per-suite `vi.mock` of only the offending edge), 9 needed real
> Postgres (the DB lane), 1 was a **stale test** (`whoopOAuth` asserted a 32-char OAuth state
> against WHOOP's deliberate 8-char contract), and 1 was an **invalid assertion**
> (`orbReasons` expected a frame-boundary value its own sibling assertions contradicted).
>
> **No assertion was weakened, skipped, or deleted, and no product code was changed** to
> produce this result. Sections 2–4 below are preserved as the historical record of what the
> baseline *was*; §5 is rewritten to the new standard.

> **2026-08-05 reconciliation note:** a full canonical `npx vitest run` now reports **366 test
> files / 4644 tests** total — up from the 255 files / 2614 tests recorded on 2026-07-22, from the
> ordinary accumulation of Stage-2-era work (new features, new suites, this fold-in's own new
> `nonEnLocaleParity.test.ts`) landing in the four weeks between recordings. That growth is
> background drift, not something this reconciliation re-derives or audits line-by-line — it does
> not change §5's regression test, which is keyed to the **failure** counts, not the totals. What
> **is** in scope, verified directly against the log of that same run: the failing-file ceiling
> dropped from **46 to 45** and Cause A's file count from **13 to 12** — one previously-failing
> file (`coachMode.test.ts`) no longer exists under that name; its successor,
> `coachModeResolution.test.ts`, loads and passes cleanly (8/8). The 18 failing tests are
> unchanged, same two files, same assertions. See the taxonomy below for the one other change
> worth flagging: Cause A's error **signature** itself shifted.

> **No test was weakened, skipped, or excluded to produce this record.** The baseline documents
> failures as they are; it does not suppress them. Blanket exclusions to make the suite appear
> green are prohibited.

---

## 1. Commands

```bash
npx vitest run                        # full suite — the baseline below
npx tsc -p artifacts/aforce-os/tsconfig.json --noEmit
node scripts/src/check-governance-drift.mjs
```

Targeted pure-runner subset (the suite that actually exercises shared client logic):

```bash
npx vitest run artifacts/aforce-os/utils artifacts/aforce-os/featureFlags artifacts/aforce-os/data artifacts/aforce-os/theme
```

> Vitest `include` globs are **workspace-root-relative** — run from the repo root. Per-package
> invocation silently matches nothing.

## 2. Recorded baseline

| Metric | 2026-07-22 recorded | 2026-08-05 reconciled |
|---|---|---|
| **Test files — total** | 255 | **366** |
| Test files — passed | 209 | **321** |
| **Test files — failed** | **45** | 46 (pre-RC-1 historical) |
| **Tests — total** | 2614 | **4644** |
| Tests — passed | 2596 | **4626** |
| **Tests — failed** | **18** | 18 (unchanged) |
| Typecheck (`aforce-os`) | ✅ exit 0 | ✅ exit 0 |
| Pure-runner subset | ✅ 104 files / 1440 tests, all passing | ✅ 114 files / 2016 tests, all passing |
| Governance drift | ✅ passes | ✅ passes |

The total/passed columns grew from ordinary Stage-2 accumulation (§ note above); the **failed**
columns are the ones this reconciliation certifies: **46 → 45** files, **18 → 18** tests.

## 3. Failure taxonomy — 45 files, exactly two causes

Every failure is accounted for. Error-signature scan over the 2026-08-05 reconciled log returned
**only** these two signatures (33 × `DATABASE_URL`, 12 × `ReferenceError: __DEV__ is not defined`
— see the 2026-08-05 note below on the latter).

### Cause A — React Native module load failure under the Vite/Rollup SSR transform · 12 files

```
ReferenceError: __DEV__ is not defined
  at expo-modules-core/src/environment/browser.ts:10  →  if (__DEV__) { ... }
```

**What it is:** any test whose module graph *transitively* imports `react-native` (usually via
`@/store/useAppStore`, AsyncStorage, or an expo module) fails to **load** — this is a module-load
failure, **not** an assertion failure — zero assertions run in these files. `__DEV__` is a global
Metro/React-Native's own bundler injects at build time; nothing in `vitest.config.ts` defines it
(no `define`, no `setupFiles`), so any module graph that reaches this far in the node/happy-dom
test environment throws.

**2026-08-05 note — signature changed, count dropped 13 → 12:** on 2026-07-22 this same file set
(then 13 files) failed with `RollupError: Parse failure: Expected 'from', got 'typeOf'` at
`react-native/index.js:27` (Vite/Rollup's SSR transform could not parse RN's Flow `import typeof`
syntax) — that parse-level signature no longer reproduces anywhere in the log. Something in the
dependency/transform chain between the two recordings now gets further before failing: past the
Flow-syntax parse and into `expo-modules-core`'s own module body, where it hits the unrelated,
always-latent `__DEV__` gap instead. Both are still pre-existing environmental module-load
failures with zero assertions run, not Stage code defects — the category (Cause A) is unchanged,
only the failure point moved one step later. One of the original 13 files, `coachMode.test.ts`,
no longer exists under that name; its apparent successor `coachModeResolution.test.ts` loads and
passes cleanly (8/8 tests), accounting for the 13 → 12 drop.

**Affected (12):** all under `artifacts/aforce-os/services/__tests__/` — hydroJournal, hydroScan,
notifications, orbReasons, productPeek, profileSource, recoveryCircle, sharedContextLayer,
sleepStateMachine, socialState, timelineLock, uiFreeze.

**Prior documentation:** `.agents/memory/aforce-vitest-rn-parse.md` records the original 13-file
set (RollupError signature) as a known non-regression, reproducible on an untouched file
(`uiFreeze.test.ts`) in isolation. That memory entry now describes a superseded signature for the
same 12-of-13 files; it has not been rewritten here as part of this minimal reconciliation.

### Cause B — `DATABASE_URL` not provisioned · 33 files (unchanged)

```
Error: DATABASE_URL must be set. Did you forget to provision a database?
  at lib/db/src/index.ts:8
```

**What it is:** `lib/db` throws at import time when `DATABASE_URL` is absent. Any api-server test
whose graph reaches `routes/index.ts` → `routes/scans.ts` → `lib/db` fails. This is a local
environment gap — no database is provisioned on this machine — not a code defect.

**Affected:** 33 files under `artifacts/api-server/`, split two ways:

- **31 files fail to load** (bracketed in vitest output) — 0 assertions run.
- **2 files load but their assertions fail** — `whoopOAuthMount.test.ts` and
  `whoopAdminMount.test.ts`. **These 2 files contain all 18 failing tests.**

**All 18 failing tests** are WHOOP OAuth mount / `WHOOP_AUTH_STATE_STORE_DRIVER` gate assertions
that depend on route mounting, which throws on the missing `DATABASE_URL`.

### Summary (2026-08-05 reconciled)

| Cause | Files | Failing tests |
|---|---|---|
| A — RN module load failure (`__DEV__` gap; was RollupError) | 12 | 0 |
| B — `DATABASE_URL` (load failure) | 31 | 0 |
| B — `DATABASE_URL` (assertion failure) | 2 | **18** |
| **Total** | **45** | **18** |

## 4. Relationship to Stage 1

**These failures predate Stage 1 or are unrelated to it.**

Evidence:

1. Both causes are environmental — a parser limitation and a missing env var — and neither
   involves Stage 1 code.
2. **No failing file imports any Stage 1 module.** Stage 1 added
   `types/intelligenceEvents.ts`, `utils/intelligence/intelligenceEventContracts.ts`, and an
   additive block in `config/hydroStateModel.ts`; nothing references them yet except the Stage 1
   test.
3. Cause A is independently documented as pre-existing in `.agents/memory/aforce-vitest-rn-parse.md`.
4. The Stage 1 config append is **additive only** (52 insertions, 0 deletions) and typecheck
   passes, so it cannot have broken a module load.
5. The pure-runner subset — which *does* transitively load the modified config — is **fully
   green** (104 files / 1440 tests).

## 5. Criteria for treating a future failure as NEW

**Superseded 2026-08-12.** The old criteria measured against a 45/18 ceiling. That ceiling is
gone. The standard is now simply:

> **Any failing test is new.** The unit lane must be **0 failures**.

A run is a regression if **any** holds:

1. `node_modules/.bin/vitest run` reports **one or more failing tests or files**.
2. The skip count is anything other than the **9 files / 71 tests** of the gated DB lane — a
   *growing* skip count is a regression wearing a disguise, and the DB lane's membership is an
   explicit file list in `vitest.db.config.ts` (no globs) precisely so it cannot silently grow.
3. `pnpm test:db` fails against a provisioned Postgres (CI's `db-lane` job).
4. `pnpm typecheck` exits non-zero for `typecheck:libs`, `@workspace/aforce-os`, or
   `@workspace/api-server`.
5. `node scripts/src/check-governance-drift.mjs` fails.
6. A previously passing test flips to failing, even if totals are unchanged.

**Prohibited responses to a failure** (unchanged, and now load-bearing): skipping the test,
loosening an assertion, adding a blanket `exclude` glob, moving a suite into the DB lane to
duck a real defect, or setting a working `DATABASE_URL` to mask a suite that should not need
one. Fix the cause, or record an explicit, justified decision in the PR.

**Classifying a failure** — every failure must land in exactly one class, stated in the PR:
REAL DEFECT · STALE TEST · TEST INFRASTRUCTURE DEFECT · MISSING ENVIRONMENT · INTENTIONALLY
UNSUPPORTED · DEAD CODE · INVALID ASSERTION. "Unexplained" is not a class.

## 6. Resolving the baseline — DONE (2026-08-12)

Both causes were fixed in Wave-4 Part 3; the plan below is kept as the record of what was
proposed and how it was actually carried out (PRs #750, #753):

- **Cause A** — a vitest `define` for `__DEV__` (or a broader alias/stub for `react-native`) in
  the node environment, or moving the affected tests to a RN-capable environment. Would recover
  12 files (2026-08-05: was 13; see §3).
- **Cause B** — provision a local Postgres or `DATABASE_URL` for the test run; the repo already
  has `@testcontainers/postgresql` and a separate `vitest.integration.config.ts`. Would recover
  33 files and all 18 failing tests.

Tracked as a follow-up, deliberately out of Stage 2 scope.
