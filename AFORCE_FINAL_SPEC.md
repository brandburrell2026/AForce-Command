# AFORCE OS — Final Spec (Core Product)

> **Brand system:** v2.1.0 (AForce Brand System) — see `design/aforce-design-tokens.md`.

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
  AForce cinematic dark aesthetic, slice-based store, Drizzle/Zod
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
Black screen. AForce wordmark fades in — Bone `#F5F0E8` with a Signal Red
`#C1281B` hairline on near-black `#0D0D0D`. Subtitle: "The Performance
Operating System." Orb pulses once.

**Act 2 — Readiness Score (0:10–0:20)**
Orb animates from Depleted → Recovering → Balanced → Peak. Score climbs from 14
to 97. Soursop-green peak glow (`#1FA35A`) intensifies. Label: "From depleted to peak. In real time."

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
- Auto-dismisses at 60 seconds — the modal closes to reveal the app underneath (no return to a `welcome.tsx` screen; the cinematic mounts as an overlay over whatever the app routed to).

## Product Surface (high-level)

### Mobile — `artifacts/aforce-os` (Expo SDK 54 / Expo Router 6)

- **Opening sequence**: no `app/splash.tsx` / `app/welcome.tsx` routes exist.
  `app/_layout.tsx` (AppShell) runs a cold-launch front-door state machine
  (`opening → welcome → done`) of stacked overlays that touch no routing: the
  `OpeningSequence` cinematic (`components/opening/OpeningSequence.tsx`,
  top-most) plays once per cold launch, then crossfades into the `WelcomeHero`
  photo front door (`components/welcome/WelcomeHero.tsx` — GET STARTED →
  `/onboarding`, SIGN IN → `/(auth)/sign-in`); once an entry is picked the
  overlays dismiss to reveal the routed app underneath. The home dashboard is
  `app/(tabs)/index.tsx`; first-run routing is decided by `SplashGate` via the
  pure `firstRunRoute` helper keyed on `hasCompletedOnboarding`.
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

AForce cinematic dark aesthetic (AForce Brand System v2.1.0). Near-black
canvas (`#0D0D0D`), Signal Red hero accent (`#C1281B`) used sparingly,
Soursop green (`#1FA35A`) for positive status, an amber → orange → red
declining ladder, Berry blue (`#1E5BFF`) for secondary data, near-invisible
borders. Soft radial glows, never hard box shadows. Big numbers, small
tracked labels. Generous spacing. Typography: Archivo Black (display),
IBM Plex Mono (eyebrows / metrics), Inter (body). Pure black (`#000000`)
is reserved for scrims, drop-shadow color, and `text.inverse` only.
`design/aforce-design-tokens.md` is the canonical source of truth; tokens
are also exported via `design/aforce-tokens.json` (Tokens Studio).

## Out of Scope (this document)

- Social Mode contexts, Morning Reset, Moments Engine
- Cruise Mode Voyage Recovery, Recovery Concierge, Cruise contexts
- Recovery Journey, Journey Summary, Phantom — **not built**, kept as
  architecture-only stubs

See `AFORCE_SOCIAL_CRUISE_ADDON.md` for the enhancement layer that
sits on top of this core once it is stable.
