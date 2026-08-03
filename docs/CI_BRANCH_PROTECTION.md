# CI & Branch Protection

This documents the checks defined in `.github/workflows/ci.yml` and
`.github/workflows/integration.yml`, what to require on `main`, and — critically —
two pre-existing repo defects that will make a truly fresh checkout fail even
though the long-lived local dev checkout looks green. Read the last section
before wiring up required status checks.

## Required status checks — recommendation

Settings → Branches → branch protection rule for `main`:

| Check (job name) | Workflow | Required? |
|---|---|---|
| `typecheck` | ci.yml | **Yes, always** |
| `tests-baseline` | ci.yml | **Yes, always** |
| `focused-health` | ci.yml | **Yes, always** |
| `governance-drift` | ci.yml | **Yes, always** |
| `integration` | integration.yml | **Yes, always** (see recommendation below) |

Also enable:

- Require branches to be up to date before merging.
- Require linear history.
- Do not allow bypassing the above settings (including for admins, once the
  team is comfortable — see CODEOWNERS for the owner-handle placeholders that
  need filling in first).

**Vercel preview-deployment checks are not a substitute for any of the above.**
Vercel's check only proves `aforce-site` built and deployed; it does not run
`tsc`, does not run the vitest suite, does not touch `artifacts/api-server` or
`artifacts/aforce-os` at all, and Railway's API deploy has no PR-time check
today. A PR that only shows a green Vercel check has had zero backend or
mobile-app verification. Treat Vercel's check as informational for marketing-
site PRs, never as a required gate for app/backend changes.

### Integration: required-always vs. required-on-label

The prompt that produced this workflow asked for an explicit recommendation
between gating the `integration` job behind a label (e.g. `run-integration`)
versus always running it. **Recommendation: always required, no label.**

The strongest argument for label-gating is cost: spinning up a Testcontainers
Postgres on every PR adds container-pull-and-boot time to changes that have
nothing to do with the database. That argument loses here because:

- The runner already has Docker preinstalled at no extra cost, and the
  current integration suite is 3 files (`lib/db/src/__integration__/*`) — the
  overhead is real but small, not a multi-minute tax.
- Label-gating creates exactly the failure mode this repo has already been
  burned by once: a human has to remember to attach a label, and "forgot the
  label" is indistinguishable from "didn't need it" until a DB-layer
  regression ships. `main`'s own standing law is "never merge red" — a check
  that can be silently skipped by omission isn't a green/red signal at all.
- If the integration suite later grows large enough that per-PR cost becomes
  a real problem, the better lever is a **path filter** (only run when
  `lib/db/**` or migration files change), not a human-remembered label — that
  keeps the check unconditionally required while cutting cost automatically.
  Not implemented here; flagging it as the next optimization if/when the
  suite grows.

## What each check does

- **`typecheck`** — `pnpm install --frozen-lockfile`, then `tsc --build` for
  the `lib/*` packages referenced by root `tsconfig.json`, then `tsc --noEmit`
  for `aforce-os` and `api-server` separately (so a failure names the exact
  workspace, not just "typecheck failed somewhere"). Also verifies the
  install didn't rewrite `pnpm-workspace.yaml`/`pnpm-lock.yaml` — see
  "pnpm allowBuilds" below.
- **`tests-baseline`** — runs the full `vitest run` suite with `DATABASE_URL`
  deliberately unset (matching `governance/TEST-BASELINE.md`'s canonical
  no-DB run), then compares the JSON report against the failed-file and
  failed-test counts documented in that file. New **passing** tests never
  fail this check; a rise in **failures** beyond the documented ceiling does.
  The baseline numbers are parsed from `governance/TEST-BASELINE.md` at
  runtime (regex on the `**Test files — failed**` / `**Tests — failed**`
  table rows); if that ever fails to parse, the workflow falls back to
  constants pinned in `ci.yml` with a comment pointing back at this doc — if
  you see the `::warning::` about that fallback, the doc's table format
  changed and needs a look.
- **`focused-health`** — `vitest run` scoped to `lib/health-core`,
  `artifacts/aforce-os/services/health`,
  `artifacts/api-server/src/__tests__/whoopParity`, and
  `artifacts/api-server/src/lib/garminMock`. All four are DB-free by
  construction (the WHOOP/Garmin parity suites default `DATABASE_URL` to an
  unused placeholder specifically so they collect outside the baseline's
  known-failure set — see their own `_env.ts` / READMEs) and must be **100%
  green**, no baseline tolerance: any failure here is a real regression by
  definition, verified empirically (15 files / 301 tests, all passing) before
  this was wired up.
- **`governance-drift`** — `node scripts/src/check-governance-drift.mjs`,
  enforcing Founder Decision 3 (2026-07-22: `/governance` is the sole
  authoritative source, no diverging copies under `artifacts/`). Pure
  `node:fs`/`node:path`, no dependency install, its own job for a fast,
  independently-named signal.
- **`integration`** (integration.yml) — `pnpm test:integration`, the
  Testcontainers-backed suite under `lib/db/src/__integration__/`. No GitHub
  Actions `services:` block is used because Testcontainers manages its own
  Postgres container lifecycle via the Docker daemon directly; a `services:`
  block is for fixed sidecar containers and isn't the right tool here. A
  preflight `docker info` step fails the job loudly if Docker is ever
  unavailable — there is no `continue-on-error` anywhere in this workflow, by
  design, so an infra problem shows up as red, not as a quietly-skipped green.

## Node / pnpm pins

The repo has **no `.nvmrc` and no `engines` field** (verified 2026-08-03).
The only place a Node version is pinned today is the Dockerfile Railway
builds from (`FROM node:22-slim`), so CI pins **Node 22** to match that — the
one path where version parity actually matters in production. pnpm is pinned
via the existing `packageManager: "pnpm@11.1.2"` field in root `package.json`,
read automatically by `pnpm/setup@v1` (version input omitted on purpose, so
CI and the repo's pin can't drift apart).

Recommend adding an `engines.node` field (or an `.nvmrc`) to `package.json` so
this pin lives in one place instead of two (Dockerfile + workflow) that have
to be kept in sync by hand.

**Tooling note:** `pnpm/action-setup` (the action referenced in most
pnpm-CI examples you'll find) is only maintained going forward for pnpm v10
and older; for pnpm v11+ its own README directs you to `pnpm/setup`, which is
what both workflows here use. Confirmed against the current
`pnpm/action-setup` and `pnpm/setup` READMEs on 2026-08-03.

## Caching

`pnpm/setup@v1`'s built-in `cache: true` caches the pnpm store, keyed on
`pnpm-lock.yaml` by default — no separate `actions/cache` step is needed.
This is a deliberate substitution for the "actions/cache keyed on lockfile"
approach: functionally equivalent, less YAML, and it's the officially
documented pattern for this action rather than a hand-rolled cache key.

## The pnpm-workspace.yaml `allowBuilds` hazard — verified, not just handled

`pnpm-workspace.yaml` carries **two** dependency-build-approval settings:
the legacy `onlyBuiltDependencies` list (5 packages) and the current
`allowBuilds` map (3 packages, all `false`, added later for the Testcontainers
SSH transport). **`onlyBuiltDependencies` was fully removed in pnpm 11** (no
auto-migration — confirmed against pnpm's own 11.0 release notes) and pnpm
11.1.2 (the version pinned here) no longer reads it at all.

During install, any dependency with a build script that isn't yet listed in
`allowBuilds` gets an automatic placeholder written into
`pnpm-workspace.yaml`, and — because `strictDepBuilds` defaults to `true` —
the install then **fails** rather than silently proceeding (confirmed against
pnpm's `/settings/build` docs). `--frozen-lockfile` only protects
`pnpm-lock.yaml`; it says nothing about this placeholder write, which is why
`typecheck`'s "Verify install did not silently rewrite workspace config" step
exists — it turns that write into a loud CI failure with an actionable
message instead of a state nobody notices.

On the long-lived local checkout, `pnpm install --frozen-lockfile` currently
reports "Already up to date" and touches nothing, because those 5 packages'
build scripts already ran and were approved on that machine at some point.
**That approval state is local-machine memory, not part of the repo.**

## Before this can go green: two pre-existing defects, verified in isolation

Everything above was validated against an isolated `git worktree` checked out
at `main@20136093` — deliberately *not* the long-lived local working
directory, which has weeks of accumulated `node_modules` state that masks
both of the following. Both were reproduced twice from a full `rm -rf
node_modules && pnpm install --frozen-lockfile`, so they are deterministic on
a fresh runner, not flaky:

1. **`pnpm install --frozen-lockfile` fails outright** with
   `ERR_PNPM_IGNORED_BUILDS` for `@clerk/shared`, `browser-tabs-lock`,
   `core-js`, `esbuild`, and `sharp` — the 5 packages stranded in the dead
   `onlyBuiltDependencies` list above. **Fix:** add them to `allowBuilds` as
   `true` (they're already trusted and already running today; this only
   re-declares that trust in the format pnpm 11 actually reads):

   ```yaml
   allowBuilds:
     '@clerk/shared': true
     browser-tabs-lock: true
     core-js: true
     cpu-features: false
     esbuild: true
     protobufjs: false
     sharp: true
     ssh2: false
   ```

   (`pnpm approve-builds --all` in a scratch checkout produces exactly this
   diff.) Once fixed, also delete the now-fully-inert `onlyBuiltDependencies`
   block so the file doesn't keep lying about what's in effect.

2. **`artifacts/aforce-os` typecheck fails** — 18 `TS2307` errors across 6
   files under `utils/__tests__/` (`Cannot find module 'node:fs'` /
   `'node:url'` / `'node:path'`). Root cause: `artifacts/aforce-os/package.json`
   never declares `@types/node` as a dependency. It typechecks today on
   aged local machines only because `@types/node` happens to be hoisted to
   the repo root `node_modules/@types/node` as an incidental side effect of
   that machine's install history — not because the lockfile or any
   `package.json` guarantees it. A CI runner, or anyone's fresh `git clone`,
   starts with none of that incidental state and hits this every time. These
   test files were added 2026-06-21, four weeks before
   `governance/TEST-BASELINE.md` recorded aforce-os typecheck as green — the
   gap has been silently masked since before the baseline was even written.
   **Fix:** add `@types/node` (matching the `catalog:`-pinned version the
   `scripts` package already uses) as an explicit devDependency of
   `artifacts/aforce-os`.

Neither fix is in scope for this PR — `pnpm-workspace.yaml` and
`artifacts/aforce-os/package.json` are both outside the files this change
touches, and both fall under CODEOWNERS' owner-only / mobile-lead paths. Until
they land, `typecheck` will fail on every fresh runner regardless of what the
PR under review actually changed. **Do not flip on required-status-checks
branch protection for `typecheck` until both are fixed and verified with a
clean-checkout run** (`rm -rf node_modules && pnpm install --frozen-lockfile`
locally is enough to reproduce and confirm the fix).

## Validation method for this workflow (stated honestly)

`pyyaml` is not installed on this machine and `actionlint` is not on `PATH`
(both checked directly, not assumed). Validation actually performed:

- Parsed both workflow files with the `yaml` npm package (already present in
  `node_modules` via the workspace catalog) — both parse cleanly into the
  expected job structure.
- Extracted the exact embedded `run:` script strings from the parsed YAML
  (not hand-retyped) and ran `bash -n` on each for syntax validation.
- Executed the baseline-comparison script end-to-end against a real
  `vitest --reporter=json` report from a clean-checkout run of main@20136093
  (46 failed files / 18 failed tests) and confirmed it correctly reports
  "within baseline."
- Executed the workspace-config-mutation-guard script against both a clean
  and a deliberately-dirtied scratch git repo and confirmed exit 0 / exit 1
  respectively.
- Manual review against current GitHub Actions workflow syntax for the
  parts no local tool can check (trigger syntax, `concurrency`, job-level
  `steps`/`uses`/`with` shape).

This is not a substitute for a real Actions run on the actual runner image —
recommend treating the first PR that includes these files as also the first
real-environment smoke test, and watching that run closely rather than
merging on the strength of local validation alone.
