# AFORCE OS — Final Spec (Core Product)

> **Authoritative core-product reference.** This document captures the
> baseline AForce OS product. Social Mode and Cruise Mode enhancement
> layers live in a separate document — `AFORCE_SOCIAL_CRUISE_ADDON.md`
> — and **must not be merged into this spec** under any circumstance.

## Implementation Order

Implement one phase at a time. Stop after each phase. Never rebuild.
Analyze current code first. Protect existing architecture.

| #  | Phase                                              | Status |
| -- | -------------------------------------------------- | ------ |
| 1  | Opening Screen Safe-Area Fix                       | —      |
| 2  | Profile + Units + Login                            | —      |
| 3  | Bottom Navigation + Timeline                       | —      |
| 4  | HydroScan Core                                     | —      |
| 5  | Orb Intelligence                                   | —      |
| 6  | Heat + Territory                                   | —      |
| 7  | Share System + BECOME AFORCE footer                | —      |
| 8  | Legal + Compliance                                 | —      |
| 9  | Feature Locks (Guardian / Clutch hidden)           | —      |

Live status is tracked in `AFORCE_PHASE_STATUS.md`.

## Hard Rules

- One phase per session. Stop after the phase ships. Wait for approval.
- Never rebuild existing surfaces. Patch, do not redesign.
- Analyze current code first. Touch only files relevant to the phase.
- Protect the existing architecture (pnpm monorepo, Expo Router stack,
  WHOOP-cinematic dark aesthetic, slice-based store, Drizzle/Zod
  server contracts).
- Social Mode and Cruise Mode additions stay in the addon document
  and are not implemented until **all** core phases are stable.

## Product Surface (high-level)

### Mobile — `artifacts/aforce-os` (Expo SDK 54 / Expo Router 6)

- **Opening sequence**: `app/splash.tsx` (cinematic four-stage lobby
  shown on first launch only) → `app/welcome.tsx` (home dashboard,
  also reachable from the home tab).
- **Tab bar**: `app/(tabs)/` — `index`, `profile`, plus the rest of
  the primary tabs. Bottom navigation includes the Timeline surface.
- **HydroScan**: `app/scan.tsx` → `screens/HydrationScanScreen.tsx`.
- **Orb**: hydration-score orb surface backed by the live scoring
  engine. Driven by `services/`, animated with Reanimated 3.
- **Heat / Territory**: `app/heat.tsx`, `app/territory.tsx`.
- **Share**: `app/share.tsx` → `screens/SharePreviewScreen.tsx`. The
  invite + "BECOME AFORCE" footer lives in the Profile invite card
  (spec #7 referral loop).
- **Legal**: `app/legal/`.
- **Feature locks**: Guardian (heat/guardian) and Clutch surfaces are
  hidden from production navigation until released.

### API server — `artifacts/api-server`

- Express 5, Postgres + Drizzle, Zod input/output validation derived
  from `lib/api-spec/openapi.yaml`.
- Auth-gated routes via Clerk (`@clerk/express`).
- Stripe entitlements mirrored via the managed `stripe-replit-sync`
  webhook (no `STRIPE_WEBHOOK_SECRET` env var — pulled from the
  Replit connector at boot).
- OpenWeather proxy with in-memory TTL cache.
- WebSocket broadcaster shared with the HTTP server.

### Shared libs — `lib/`

- `api-spec` (OpenAPI source of truth, regenerates `api-client-react`
  + `api-zod` on `pnpm --filter @workspace/api-spec run codegen`).
- `db` (Drizzle schemas + migrations).

## Design Language

WHOOP-cinematic dark aesthetic. Pure black canvas (`#000000`), WHOOP
lime hero accent (`#B6FF00`), near-invisible borders, WHOOP recovery
status colors (green / yellow / red). Soft radial glows, never hard
box shadows. Big numbers, small tracked labels. Generous spacing.
Tokens exported via `design/aforce-tokens.json` (Tokens Studio) and
the human-readable `design/aforce-design-tokens.md`.

## Out of Scope (this document)

- Social Mode contexts, Morning Reset, Moments Engine
- Cruise Mode Voyage Recovery, Recovery Concierge, Cruise contexts
- Recovery Journey, Journey Summary, Phantom — **not built**, kept as
  architecture-only stubs

See `AFORCE_SOCIAL_CRUISE_ADDON.md` for the enhancement layer that
sits on top of this core once it is stable.
