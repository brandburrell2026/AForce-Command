# AForce — Developer Handoff

Welcome. This monorepo holds the AForce product suite. Everything runs in Replit today; no local setup is required to start.

## 1. Access

You should have been added as a **collaborator** on the Replit workspace `@brandburrell/AForce-Command`. Open it in the Replit web IDE and the project is live — no clone needed.

A GitHub mirror exists at `github.com/brandburrell2026/AForce-Command` but is currently **out of sync** with the Replit source of truth. Treat Replit as canonical until GitHub sync is restored.

## 2. What's in the box

This is a pnpm monorepo with five running artifacts:

| Artifact | Path | What it is | Workflow |
|---|---|---|---|
| `aforce-os` | `artifacts/aforce-os/` | React Native / Expo SDK 54 mobile app — the product | `artifacts/aforce-os: expo` |
| `aforce-pitch` | `artifacts/aforce-pitch/` | Investor pitch deck (slides) | `artifacts/aforce-pitch: web` |
| `aforce-site` | `artifacts/aforce-site/` | Marketing website | `artifacts/aforce-site: web` |
| `api-server` | `artifacts/api-server/` | Express 5 + PostgreSQL backend | `artifacts/api-server: API Server` |
| `mockup-sandbox` | `artifacts/mockup-sandbox/` | Component preview server for canvas mockups | `artifacts/mockup-sandbox: Component Preview Server` |

Shared libraries live under `lib/`. API contract is OpenAPI-first under `lib/api-spec/`; React Query hooks and Zod schemas are generated via `pnpm --filter @workspace/api-spec run codegen`.

## 3. Stack

- **Backend:** Node.js v24, Express 5, PostgreSQL, Drizzle ORM, Zod
- **Mobile:** React Native / Expo SDK 54, Expo Router 6, Reanimated 3, React Query, i18next
- **Auth:** Clerk (`@clerk/expo` mobile, `@clerk/express` server) — email/password + Google SSO
- **Payments:** Stripe (via Replit Stripe connector; webhook secret is managed, not env-var driven)
- **Voice:** ElevenLabs (key in env)
- **Weather:** OpenWeather (key in env, server-side proxied with TTL cache)
- **Codegen:** Orval (OpenAPI → React Query hooks)

## 4. First-run

In Replit, all five workflows auto-start. To restart any of them after pulling changes, use the Workflows panel or `restart_workflow <name>`. Do **not** run `pnpm dev` at the repo root — there is no root dev script; each artifact's workflow wires up its own `PORT` and `BASE_PATH`.

To typecheck the whole repo from a shell:

```
pnpm run typecheck
```

To regenerate API client hooks after editing the OpenAPI spec:

```
pnpm --filter @workspace/api-spec run codegen
```

## 5. Hard constraints — read before changing anything

These are locked-in product rules. Do not redesign around them; see `replit.md` → **FINAL BUILD LOCK** for the full spec.

- **Water-First Command System** — Recommendation order is *Water → Command → Optional support → Score Update*. Coach copy must begin with `HYDRATE NOW` / `Start with water`. Products never lead.
- **Score Protection Rule** — Only completed actions modify score. Recommendations, scans, and product selection do **not** change score.
- **Language Lock** — Launch locales: en, es, fr, de, pt, it. Other locales exist as resource files only, gated behind feature flags, not exposed in the LanguageSelector.
- **Engine / UI Governance** — The engine may grow; navigation may not. No new tabs, no dashboard expansion. Build once, expose over time via feature flags.
- **MVP Surfaces (do not remove)** — Orb · Timeline · HydroScan · Coach · Journal · Recovery · Feature Flags · Internal Preview.

## 6. Environment & secrets

Managed via Replit Secrets. Currently set:

- `ELEVENLABS_API_KEY`
- `OPENWEATHER_API_KEY`
- `SESSION_SECRET`
- `DATABASE_URL` (PostgreSQL, provided by Replit)

Stripe credentials come from the Replit Stripe connector, not env vars. Clerk credentials are wired through the Replit Clerk integration.

Missing / optional: `STRIPE_WEBHOOK_SECRET` — not needed because the Replit Stripe connector manages the webhook secret automatically. Confirmed by server boot log: `initStripe: managed webhook ensured`.

## 7. Build & ship (mobile)

EAS Build is configured in `artifacts/aforce-os/eas.json` (development / preview / production profiles). Bundle IDs are `com.aforce.os` for both iOS and Android.

```
# from artifacts/aforce-os/
pnpm eas:login
pnpm eas:configure
pnpm eas:build:ios       # production iOS
pnpm eas:build:android   # production Android
pnpm eas:build:preview   # internal preview, no store submission
pnpm eas:submit:ios      # App Store
pnpm eas:submit:android  # Google Play (internal track)
```

**Before first iOS submit**, run the helper from repo root (do not hand-edit `eas.json`):

```
EAS_ASC_APP_ID=<numeric> \
EAS_APPLE_TEAM_ID=<10-char-uppercase> \
pnpm --filter @workspace/scripts run eas-configure-submit
```

**Before first Android submit**, place a Google Play service account JSON at `artifacts/aforce-os/google-service-account.json`. Path is already in `eas.json`. Never commit it.

## 8. Deploy (web + API)

Production lives on Replit Deployments (Autoscale, 2 vCPU / 4 GiB / 1 Max). Triggered from the **Publishing** tab in the workspace. URLs:

- Marketing site: `a-force-command--brandburrell.replit.app/aforce-site/`
- API: `api.drinkaforce.com/api/...`
- Investor deck: `a-force-command--brandburrell.replit.app/aforce-pitch/`

The published apps are routed through Replit's path-based proxy. In application code, prefer relative URLs.

## 9. Repo conventions

- `pnpm` workspaces. Workspace package names use `@workspace/` prefix.
- Each artifact declares its own dependencies — nothing implicit.
- Catalog-pinned deps live in `pnpm-workspace.yaml`.
- Static / client-only artifacts → all deps in `devDependencies`. Server artifacts → runtime imports in `dependencies`, build tools in `devDependencies`.
- **Never use `console.log` in server code.** Use `req.log` in route handlers, the singleton `logger` elsewhere.
- **Never edit `artifact.toml` or `.replit` directly.** Use the artifact skills.
- Project-wide design tokens: `design/aforce-tokens.json` (Tokens Studio format) and `design/aforce-design-tokens.md`. Download endpoint: `GET /api/design-tokens`.

## 10. Where to look first

- Product spec, build lock, architecture overview → `replit.md`
- Per-package READMEs → `artifacts/*/README.md` (where present)
- API contract → `lib/api-spec/`
- Generated React Query hooks & Zod schemas → `lib/api-client/` (regenerated, do not hand-edit)
- Mobile app entry → `artifacts/aforce-os/app/` (Expo Router 6 file-based routing)
- Server entry → `artifacts/api-server/src/index.ts`

## 11. Known open items

- **GitHub sync is broken.** Replit↔GitHub connection authenticates but pushes fail with divergent-history / auth errors. Resolving is low-priority; Replit holds the source of truth.
- **App Store / Play Store screenshots** are not yet captured. They must come from a real device or simulator running an EAS build — Replit's web preview is not acceptable to Apple/Google. Capture path is documented in `replit.md` → *Release-Readiness Status*.
- **iOS submit IDs** (`EAS_ASC_APP_ID`, `EAS_APPLE_TEAM_ID`) need to be supplied via the helper script before first iOS submission.

## 12. Questions

For product / design intent, the source of truth is `replit.md`. For implementation patterns and skills available in this monorepo, browse `.local/skills/`.
