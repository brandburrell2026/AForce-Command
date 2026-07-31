# Test Baseline — pre-Stage-2

**Status:** Canonical · **Recorded:** 2026-07-22, immediately after Phase 4 Stage 1 approval and
**before any Stage 2 work began**
**Purpose:** distinguish pre-existing environmental failures from genuine regressions.

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

| Metric | Value |
|---|---|
| **Test files — total** | **255** |
| Test files — passed | 209 |
| **Test files — failed** | **46** |
| **Tests — total** | **2614** |
| Tests — passed | 2596 |
| **Tests — failed** | **18** |
| Typecheck (`aforce-os`) | ✅ exit 0 |
| Pure-runner subset | ✅ 104 files / 1440 tests, all passing |
| Governance drift | ✅ passes |

## 3. Failure taxonomy — 46 files, exactly two causes

Every failure is accounted for. Error-signature scan over the full log returned **only** these two
signatures (32 × `DATABASE_URL`, 2 × `RollupError`; the RollupError is emitted once per unique
module graph and covers 13 files).

### Cause A — React Native Flow syntax under the Vite/Rollup SSR transform · 13 files

```
RollupError: Parse failure: Expected 'from', got 'typeOf'
  at react-native/index.js:27  →  import typeof * as ReactNativePublicAPI from ...
```

**What it is:** Vite/Rollup's SSR transform cannot parse React Native's Flow `import typeof`
syntax. Any test whose module graph *transitively* imports `react-native` (usually via
`@/store/useAppStore`, AsyncStorage, or an expo module) fails to **load**. This is a
module-load failure, **not** an assertion failure — zero assertions run in these files.

**Affected:** 13 files, all under `artifacts/aforce-os/services/__tests__/` — coachMode,
hydroJournal, hydroScan, notifications, orbReasons, productPeek, profileSource, recoveryCircle,
sharedContextLayer, sleepStateMachine, socialState, timelineLock, uiFreeze.

**Prior documentation:** `.agents/memory/aforce-vitest-rn-parse.md` records this exact set as a
known non-regression, reproducible on an untouched file (`uiFreeze.test.ts`) in isolation.

### Cause B — `DATABASE_URL` not provisioned · 33 files

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

### Summary

| Cause | Files | Failing tests |
|---|---|---|
| A — RN Flow parse (load failure) | 13 | 0 |
| B — `DATABASE_URL` (load failure) | 31 | 0 |
| B — `DATABASE_URL` (assertion failure) | 2 | **18** |
| **Total** | **46** | **18** |

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

A failure is **NEW** (a regression, requiring investigation before proceeding) if **any** holds:

1. Failing-file count **> 46**, or failing-test count **> 18**.
2. A failing file is **not** in the recorded affected set (§3).
3. A failure's error signature is **neither** `Expected 'from', got 'typeOf'` **nor**
   `DATABASE_URL must be set`.
4. Any file under `artifacts/aforce-os/utils/`, `featureFlags/`, `data/`, `theme/`, `store/`,
   `hooks/`, or `analytics/` fails — the pure-runner subset must stay at **104 files / 1440
   tests passing**, plus whatever new stage tests add.
5. `npx tsc --noEmit` exits non-zero.
6. `node scripts/src/check-governance-drift.mjs` fails.
7. A previously passing test flips to failing, even if totals are unchanged.

**Not new (expected):** totals rising **only** because a stage added passing tests; the same 46
files failing with the same two signatures.

**Prohibited responses to a failure:** skipping the test, loosening an assertion, adding a blanket
`exclude` glob, or setting a fake `DATABASE_URL` to mask Cause B. Fix the cause or record an
explicit, justified decision.

## 6. Resolving the baseline (not required for Stage 2)

Both causes are fixable and neither is blocked:

- **Cause A** — a vitest alias/stub for `react-native` in the node environment, or moving the
  affected tests to a RN-capable environment. Would recover 13 files.
- **Cause B** — provision a local Postgres or `DATABASE_URL` for the test run; the repo already
  has `@testcontainers/postgresql` and a separate `vitest.integration.config.ts`. Would recover
  33 files and all 18 failing tests.

Tracked as a follow-up, deliberately out of Stage 2 scope.
