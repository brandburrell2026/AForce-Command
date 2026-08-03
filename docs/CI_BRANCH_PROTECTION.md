# CI & Branch Protection

This documents the checks defined in `.github/workflows/ci.yml` and
`.github/workflows/integration.yml`, and what to require on `main`. See "Fresh-
checkout defects" near the bottom for two repo defects a truly fresh checkout
used to hit (both fixed as of PR 2.2B) — read it before assuming a future
edit to `pnpm-workspace.yaml` or `artifacts/aforce-os/package.json` is safe.

**Repo setup required before `tests-baseline`'s self-serving-edit guard is
useful:** create a `baseline-override` label on this repository (Settings →
Labels → New label). The guard step in `ci.yml` checks for this exact label
name on the pull request; if the label doesn't exist yet, no PR can ever
apply it, and any PR that touches `governance/TEST-BASELINE.md` will fail
`tests-baseline` unconditionally until a maintainer creates it once.

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

  **Self-serving-edit protection (added PR 2.2B, 2026-08-03):** the file this
  job compares against is never the pull request's own working copy. For a
  `pull_request` event, the job does `git fetch --depth=1 origin
  ${{ github.base_ref }}` and reads `governance/TEST-BASELINE.md` from that
  target-branch ref (written to `target-baseline.md`) — so a PR that edits
  the doc cannot change the number it is itself judged against. (For a
  `push` event — e.g. a direct push to `main` — there is no separate target
  branch to diff against, so the checked-out `HEAD` copy is used, since
  `HEAD` *is* the branch of record at that point.) A PR is still allowed to
  edit `governance/TEST-BASELINE.md` — to legitimately lower it after fixing
  tests, or to raise it with an accepted new gap — but doing so without the
  **`baseline-override`** label fails the job outright with an
  `::error::` naming exactly that. The label doesn't change what this run is
  measured against (it still uses the target branch's numbers); it only
  turns a silent ceiling-move into something a reviewer had to consciously
  apply. `governance/TEST-BASELINE.md` also carries the `governance/`
  CODEOWNERS entry, so the same PR that trips this guard also requires the
  governance owner's review.
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

## Fresh-checkout defects — fixed in PR 2.2B (2026-08-03)

Everything above was originally validated against an isolated `git worktree`
checked out at `main@20136093` — deliberately *not* the long-lived local
working directory, which has weeks of accumulated `node_modules` state that
masked both of the defects below. Both are now fixed; kept here as the record
of what was wrong and how it was verified fixed, since a future edit to
either file could reopen either gap silently on a long-lived local checkout.

1. **`pnpm install --frozen-lockfile` used to fail outright** with
   `ERR_PNPM_IGNORED_BUILDS` for `@clerk/shared`, `browser-tabs-lock`,
   `core-js`, `esbuild`, and `sharp` — the 5 packages stranded in the dead
   `onlyBuiltDependencies` list. **Fixed:** `pnpm-workspace.yaml`'s
   `allowBuilds` now carries an explicit `true`/`false` per package, decided
   on evidence (not "true because it used to be inert-listed"):
   - `esbuild` and `sharp` stay `true` — both have genuine native
     install-time steps (esbuild downloads its platform binary; sharp
     fetches/builds libvips). Confirmed by reading `install.js` / `install/
     check.js` directly.
   - `@clerk/shared`, `browser-tabs-lock`, and `core-js` are now `false` —
     each package's postinstall script was read directly and does nothing
     but print a notice (Clerk's telemetry notice, browser-tabs-lock's
     thank-you banner, core-js's donation banner); none compiles anything,
     and all three ship prebuilt `dist`/entry files in their npm tarballs.
     Verified with a full `pnpm install --frozen-lockfile` against a
     **fresh, empty pnpm store** (`--config.store-dir` pointed at a new
     directory, so no prior build-approval cache could mask a real
     regression): exit 0, no `ERR_PNPM_IGNORED_BUILDS`, and the real
     Clerk-dependent adversarial route suite
     (`destructiveEndpointSecurity.test.ts`) still passed end-to-end
     (29/29) against that install.

   The now-fully-inert `onlyBuiltDependencies` block has also been deleted —
   pnpm 11.1.2 never reads it, so keeping it around only misrepresented what
   was actually in effect.

2. **`artifacts/aforce-os` typecheck was one version bump from drifting** —
   `artifacts/aforce-os/package.json` hand-pinned `@types/node` to
   `^25.3.3`, a version string that happened to match the shared
   `pnpm-workspace.yaml` catalog entry rather than being sourced from it.
   **Fixed:** it now reads `@types/node: "catalog:"`, identical to every
   other workspace's `@types/node` declaration, with `pnpm install
   --lockfile-only` re-run to regenerate `pnpm-lock.yaml` (a one-line
   specifier change; the resolved version is unchanged).

Both fixes were verified together with `pnpm --filter @workspace/aforce-os
run typecheck`, `pnpm --filter @workspace/api-server run typecheck`, and
`pnpm run typecheck:libs`, all green, plus the fresh-store install above.
**Recommendation:** re-run `rm -rf node_modules && pnpm install
--frozen-lockfile` (or an isolated `git worktree`) after any future edit to
`pnpm-workspace.yaml` or `artifacts/aforce-os/package.json`, rather than
trusting a long-lived local checkout's cached state — that's exactly the gap
that let both of these ship unnoticed the first time.

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

**Added for PR 2.2B's `tests-baseline` self-serving-edit guard:**

- Re-ran the same parse-then-extract-then-`bash -n` method above against the
  updated `tests-baseline` job after adding the target-branch-fetch and
  guard steps — all steps still parse and pass shell syntax validation.
- Extracted the (now target-baseline.md-reading) comparison script the same
  way as before and ran it against four synthetic `vitest-report.json`
  fixtures: exactly-at-baseline (pass), files-regressed (fails on file
  count), tests-regressed (fails on test count), and improved (pass) — all
  four produced the expected exit code and `::error::`/success messaging.
- Simulated the guard step's actual `git diff` logic (not just read the
  script) against a throwaway local bare-repo + clone: a branch that edits
  `governance/TEST-BASELINE.md` relative to its fetched `origin/main` is
  correctly detected (the step would fail without the label); a branch that
  edits an unrelated file is correctly left alone (the step would pass).
- `github.event.pull_request.labels.*.name` / `contains(...)` is the
  documented GitHub Actions object-filter + function pattern for checking a
  PR's labels from `github.event` directly (no `gh api` call needed) —
  confirmed against current GitHub Actions expression-syntax documentation,
  not run against a live PR event (that requires an actual PR, which local
  tooling can't fabricate).

This is not a substitute for a real Actions run on the actual runner image —
recommend treating the first PR that includes these files as also the first
real-environment smoke test, and watching that run closely rather than
merging on the strength of local validation alone. In particular, watch the
first PR that legitimately needs the `baseline-override` label end-to-end
(guard fails without the label, passes once applied) before trusting it as a
proven gate rather than a reviewed-but-unexercised one.
