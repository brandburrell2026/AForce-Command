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
| 10 | Investor Demo Overlay                              | Pending |

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

## Final Refinement Locks

> Refinement locks only — **not** architecture changes. No redesign, no new
> navigation, no new tabs, no new screens, no dashboard expansion. Goal: increase
> retention, reduce friction, protect free mode, improve future Phantom rollout.
> Keep AForce OS simple externally and powerful internally.

**Lock #1 — Impact Engine confidence.**
Impact confidence increases as signal quality improves. Impact uses existing
surfaces only — no new UI. *Purpose:* protect the loop —
Signal → Command → Action → Impact → Learning. No rebuilds required.

**Lock #2 — Manual-first engine rule.**
The core hydration loop must function using phone + manual inputs only. Wearables
and future Phantom signals increase confidence but are not required. *Purpose:*
protect free users, protect onboarding, prevent hardware dependency.

**Lock #3 — Reminder guardrail.**
Completed goals reduce correction urgency and reminder frequency. *Purpose:*
reduce notification fatigue, improve long-term retention.

**Lock #4 — Verification layer rule.**
The verification layer resolves to the highest-confidence signal source available
and degrades gracefully downward. Priority: (1) Phantom Signals →
(2) Connected Wearables → (3) Phone + Manual Inputs. *Purpose:* protect the
future Phantom rollout without creating dependencies.

These are refinement locks only. No architecture rebuilds. No additional
user-facing modules.

## Phase 10 — Investor Demo Overlay

**Status: Pending**

A scripted 60-second full-screen cinematic overlay. Triggered only when the
`demo_mode_enabled` feature flag is ON. Never visible in production. Never
accessible via standard navigation.

### Script — 6 acts, 10 seconds each

**Act 1 — Opening (0:00–0:10)**
Black screen. AForce wordmark fades in gold. Subtitle: "The Performance
Operating System." Orb pulses once.

**Act 2 — Readiness Score (0:10–0:20)**
Orb animates from Depleted → Recovering → Balanced → Peak. Score climbs from 14
to 97. Lime glow intensifies. Label: "From depleted to peak. In real time."

**Act 3 — HydroScan (0:20–0:30)**
Scan animation. Product recognized. Score updates. Voice Engine fires: "You're
back in range. Lock in." Label: "AI-powered hydration intelligence."

**Act 4 — Social Mode (0:30–0:40)**
BAC overlay appears on orb. Crimson ring pulses. Safety card visible. Recovery
Mode activates. Label: "Performance protection. Even off the clock."

**Act 5 — Territory + Heat Guard (0:40–0:50)**
Stylized map activates. Heat Guard band flips to WARNING. Guardian alert fires.
Label: "Environmental intelligence. Real-time."

**Act 6 — The Standard (0:50–1:00)**
All surfaces collapse back to the clean orb at PEAK. One line fades in: "Built
for people who don't get to be off." AForce wordmark. Fade to black.

### Hard Rules

- `demo_mode_enabled` must be `false` in all production builds.
- No real user data is used — all demo state is seeded from `data/demoProfile.ts`.
- Overlay dismisses on tap at any point.
- Auto-dismisses at 60 seconds and returns to `welcome.tsx`.

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
