# Contributing to AForce OS

Welcome. This monorepo holds every AForce surface — the Expo mobile app, the
Express + Postgres API server, the investor pitch deck, a component
mockup-sandbox, and the shared `lib/*` packages. The repository is primary on
Replit and mirrored to GitHub for external development in Cursor / VS Code.

If you're new, read this whole document once before opening a PR. It saves
review cycles.

---

## 1. Prerequisites

| Tool        | Version (pinned)      | Notes                                              |
| ----------- | --------------------- | -------------------------------------------------- |
| Node.js     | **24.x**              | Use `nvm` or `volta`; older majors will not build. |
| pnpm        | **10.x**              | `corepack enable && corepack prepare pnpm@10 --activate` |
| PostgreSQL  | **16+**               | Local instance reachable on `localhost:5432`.      |
| Expo CLI    | bundled via `pnpm`    | Do not install globally — use the workspace version. |
| Xcode       | 15+ (iOS work only)   | macOS only. Required for iOS Simulator builds.     |
| Android Studio | latest (Android work only) | Required for Android emulator + EAS local builds. |

> **Do not** run `pnpm dev` or `pnpm install` outside the repo root unless this
> doc tells you to. We use pnpm workspaces and a catalog; running installs in a
> sub-package can de-sync versions.

---

## 2. First-time setup

```bash
git clone git@github.com:<org>/<repo>.git aforce-os
cd aforce-os
pnpm install            # installs every workspace package
cp .env.example .env    # see "Environment variables" below
pnpm run typecheck      # confirm everything compiles
```

Then create a local Postgres database and apply the schema:

```bash
createdb aforce_dev
DATABASE_URL=postgres://localhost:5432/aforce_dev \
  pnpm --filter @workspace/api-server run db:push
```

---

## 3. Environment variables

Never commit secrets. Every secret loaded by the app comes from the local
`.env` file in development (or the Replit secrets vault in production).

Ask the owner ([@OWNER_HANDLE](#)) for a sandbox set of these. Production keys
live only in Replit and are not shared.

### Server (`artifacts/api-server`)

| Variable                 | Required | Purpose                                            |
| ------------------------ | -------- | -------------------------------------------------- |
| `DATABASE_URL`           | yes      | Postgres connection string.                        |
| `SESSION_SECRET`         | yes      | Express session signing key. Generate any random 32+ char string. |
| `OPENWEATHER_API_KEY`    | yes      | Powers Cruise Mode live env data. Use a free dev key. |
| `ELEVENLABS_API_KEY`     | yes      | AI Coach voice synthesis.                          |
| `CLERK_SECRET_KEY`       | yes      | Server-side Clerk auth.                            |
| `STRIPE_WEBHOOK_SECRET`  | no (dev) | Only needed when testing webhook flow locally via Stripe CLI. |

> The production Stripe webhook secret is **not** an env var — it's pulled from
> the Replit Stripe connector at boot. Do not try to set it in `.env` for prod.

### Mobile (`artifacts/aforce-os`, Expo)

| Variable                          | Required | Purpose                                       |
| --------------------------------- | -------- | --------------------------------------------- |
| `EXPO_PUBLIC_API_BASE`            | yes      | Base URL of the API server (e.g. `http://localhost:8080`). |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes    | Clerk publishable key. Must be the dev key.   |

`EXPO_PUBLIC_*` is the only prefix Expo exposes to the client bundle. Anything
without that prefix stays server-side.

---

## 4. Repository layout

```text
artifacts/                Deployable apps (one workflow per artifact)
  aforce-os/              React Native + Expo mobile app
  api-server/             Express 5 + Drizzle + Postgres backend
  aforce-pitch/           Investor slide deck (React)
  mockup-sandbox/         Component preview server for canvas/design work
lib/                      Shared libraries
  api-spec/               OpenAPI source of truth
  api-client-react/       Generated React Query hooks (DO NOT hand-edit)
  api-zod/                Generated Zod schemas (DO NOT hand-edit)
  db/                     Drizzle schema + migrations
  integrations-openai-ai-server/
scripts/                  Repo-level utility scripts (@workspace/scripts)
design/                   Figma tokens + design spec
docs/                     Architecture docs
```

**Golden rule:** code in `artifacts/*` must not import from another
`artifacts/*` package. Shared code goes in `lib/*`. The CI typecheck catches
this.

---

## 5. Running things locally

Each artifact has its own dev command. Run them from the **repo root** with
`--filter` so the workspace resolver works:

```bash
# Mobile (Expo dev server on a random port; opens in iOS Simulator / Android emulator / browser)
pnpm --filter @workspace/aforce-os run dev

# API server (Express on port 8080 by default)
pnpm --filter @workspace/api-server run dev

# Investor deck
pnpm --filter @workspace/aforce-pitch run dev

# Component sandbox (Vite preview server for canvas iframes)
pnpm --filter @workspace/mockup-sandbox run dev
```

You almost always want **mobile + API** running together. Two terminals.

---

## 6. Workflow for a change

1. **Branch from `main`:** `git checkout -b <area>/<short-name>`
   - Examples: `mobile/cruise-block-7`, `api/social-rate-limit`, `lib/api-spec-new-route`.
2. **Code + commit small.** Conventional Commits are appreciated but not required.
3. **Before pushing**, run from the repo root:
   ```bash
   pnpm run typecheck           # full workspace
   pnpm run test                # vitest across all packages
   ```
   Both must be green.
4. **If you touched the OpenAPI spec** (`lib/api-spec/`), regenerate the client:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
   Commit the regenerated files. Reviewers reject hand-edits to generated code.
5. **If you touched the DB schema** (`lib/db/schema/`), add a migration:
   ```bash
   pnpm --filter @workspace/api-server run db:generate
   ```
   Commit the generated SQL.
6. **Push and open a PR against `main`.** Fill in the PR template. Tag the
   relevant CODEOWNERS — GitHub will do this automatically based on the
   `.github/CODEOWNERS` file.

---

## 7. Code style & conventions

- **TypeScript everywhere.** No `any` without a `// eslint-disable-next-line`
  comment explaining why.
- **No `console.log` in server code.** Use `req.log` inside route handlers and
  the singleton `logger` elsewhere. See `.local/skills/pnpm-workspace/references/server.md`.
- **Mobile state:** use the slice-based reducer in `store/`. Don't introduce
  Redux, Zustand, or MobX.
- **Auth-gated routes** on the server use the Clerk middleware in
  `artifacts/api-server/src/middleware/`. Public endpoints must explicitly opt
  in via the public-routes allow-list.
- **Feature flags:** every in-progress surface ships behind a flag in
  `artifacts/aforce-os/featureFlags/flags.ts`. Default OFF for public,
  ON for internal/demo via `DEMO_ALL_ON_FLAGS`.
- **Internationalization:** new user-facing strings go in **all six** locale
  JSON files under `artifacts/aforce-os/i18n/locales/`. English is the source
  of truth; ping [@OWNER_HANDLE](#) for translations.
- **No medical / safety claims** in user-facing copy. Use the compliance-vetted
  wording (e.g. "Recovery available", "Ready for your next experience"). When
  in doubt, ask in the PR.

---

## 8. Testing

- **Unit:** Vitest. Files in `<package>/**/__tests__/*.test.ts`.
  - Run all: `pnpm run test`
  - Run one file: `pnpm exec vitest run <relative/path/to/test.ts>` (from repo root)
- **Type:** `pnpm run typecheck` from repo root.
- **End-to-end** (Playwright, mobile-web flows): see `diagnostic_test.spec.ts`
  for the harness. New E2E tests go in the same directory.

A PR will not be merged if `typecheck` or `test` fail.

---

## 9. What you **cannot** do from a clone

These are intentionally restricted to the Replit owner:

- **Deploy to production.** Publishing happens from Replit; PRs that land in
  `main` are pulled into Replit and the owner clicks Publish.
- **Rotate production secrets.** Production env values live in Replit's secret
  vault — request changes via [@OWNER_HANDLE](#).
- **Manage Stripe / Clerk dashboards.** Use the dev/sandbox keys you were given.
- **Change billing or subscription plans.** Server-side pricing is the source
  of truth; PRs touching `services/productPricingService.ts` need owner sign-off.
- **Bypass CODEOWNERS.** See section 10.

---

## 10. CODEOWNERS & branch protection

`.github/CODEOWNERS` declares who must review which folder. Highlights:

- Any change to `artifacts/aforce-os/**` → mobile reviewers.
- Any change to `artifacts/api-server/**` or `lib/db/**` → backend reviewers.
- Any change to `lib/api-spec/**` → backend reviewers (contract is binding on both sides).
- Any change to `design/**`, `theme/`, locale JSONs → owner + design lead.
- Any change to `.github/`, `replit.md`, this file, package.json, lockfile, or
  CI config → owner only.

`main` is a protected branch:
- 1 approving review required (2 for protected paths above).
- All status checks must pass.
- Linear history (no merge commits — squash or rebase).

---

## 11. Getting help

- **Architecture / "where does X live?"** — read `replit.md` first; it's the
  high-level map. Then `docs/`.
- **Bugs in dev environment** — open a draft PR with a failing test and tag
  [@OWNER_HANDLE](#).
- **Anything destructive** (schema drop, secret rotation, dependency major
  bump, library swap) — ask in an issue *before* writing code.

Thanks for contributing. Keep it small, keep it shipped.
