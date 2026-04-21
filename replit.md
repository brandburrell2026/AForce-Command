# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### AForce OS (Mobile App — `artifacts/aforce-os`)
Production-ready React Native / Expo mobile app — real-time human performance OS (hydration intelligence + AI decisioning). See `artifacts/aforce-os/README.md` for the full spec.

**Latest build — AForce Circles + AForce Territory (Apr 2026):**
- **AForce Circles (aforce-os)**: premium private accountability network — not a public feed. Types: `types/circle.ts` (CircleUser, SharedStatus, Reaction, CircleChallenge, PrivacySettings, CircleNotification). Mock data: `data/mockCircleData.ts` (8 users across friends/team/coach/family, REACTIONS list of 8 performance-first reactions, 2 open challenges, 4 notifications). Services: `circleService.ts` (membership + feed), `reactionService.ts` (state-appropriate reactions, sanitizeComment with banned hype tokens / no `!` / no hashtags — same tone rules as Voice/Share), `privacyService.ts` (4 scopes + per-field toggles, `projectSharedStatus` is the single source of truth used everywhere a status leaves the device). Components: `CircleUserCard`, `SharedStatusCard`, `ReactionBar`, `CircleChallengeCard`. Screens + routes: `/circles` (feed + group filter + open challenges), `/circles/[id]` (friend detail + reaction picker), `/circles/shared` (preview + privacy controls), `/circles/manage` (accept/decline/mute/remove + group reassignment).
- **AForce Territory (aforce-os)**: live competition map (Strava energy, premium sports intelligence). Types: `types/territory.ts` (TerritoryRegion, CompetitionStats, TerritoryBattle, MapMarker, TerritoryLayer). Mock data: `data/mockTerritoryData.ts` (10 cities, 7 states, 3 teams, 3 active battles — abstract 0..100 grid coordinates, ready to swap for lat/lng later). Services: `territoryEngine.ts` (single-source weighted score: perf 0.35 + protocol 0.25 + streak 0.15 + recovery 0.15 + momentum 0.10 normalized, NaN-safe, clamped 0..100), `mapAggregationService.ts` (per-layer marker color/intensity), `battleService.ts` (BattleView with both sides hydrated, supportSide tilts score 1pt). Components: `TerritoryMap` (react-native-svg, 100x60 abstract grid + Pressable touch overlay), `MapLayerToggle` (territory/heat/momentum/battle), `CityCard` (also serves state and team detail via `region.kind`), `StateCard` (re-export of CityCard for spec compliance + future divergence), `BattleCard` (Miami vs NYC layout + support CTAs). Screen + route: `/territory` (scope toggle city/state/team, layer toggle, map, region detail card, active battles, trending list). Home action row gained two buttons: CIRCLES (`testID="home-circles-button"`) and TERRITORY (`testID="home-territory-button"`).
- No real maps lib added — react-native-svg keeps preview working on web/iOS/Android with no native config; swap `TerritoryMap` for Mapbox/Google Maps later without touching the screen.

**Stripe — cart checkout (Apr 2026):** the consumer Store cart now goes through real Stripe Checkout (one-time payment), matching the existing subscription flow.
- New endpoint `POST /api/checkout/cart` in `artifacts/api-server/src/routes/checkout.ts` accepts `{ items: [{skuId, qty}], returnUrl }`. It NEVER trusts client-sent prices — every line is re-priced against `artifacts/api-server/src/lib/storeCatalog.ts`, which mirrors the consumer SKU catalog with authoritative cents. Shipping ($5.99 under $50) and 8.75% tax are added as separate Stripe line items so the Stripe total is identical to what `CartScreen` displayed. Validation: rejects unknown SKUs, duplicate SKUs in one cart, qty outside 1..99, non-integer qty, and any `returnUrl` outside the allow-listed scheme set (`http`, `https`, `exp`, `exps`, `aforce`, `aforceos`).
- `/api/checkout/return` now also accepts a `kind` query param (`subscription` | `cart`) and forwards it back to the app, so the deep-link handler can route correctly. Both subscription and cart success URLs include `kind`.
- `CartScreen` replaces the old "coming soon" stub with a real flow: `createCartCheckoutSession` → `WebBrowser.openAuthSessionAsync` → on `status=success`, clear the cart + show a confirmation banner; on cancel/dismiss, leave the cart intact. Disabled state + `ActivityIndicator` while the session is being created.
- 12 new tests in `artifacts/api-server/src/lib/__tests__/storeCatalog.test.ts` pin the catalog shape (every SKU has a positive integer cent price), input validation (every reject path), the free-shipping threshold, the tax rate, exact cent-level totals, and — critically — that any client-sent unit price is ignored. Total tests: 65 → 77.
- Live verified: a cart of 2 berry sticks returns a real `cs_test_…` session URL with the correct $76.10 total; bad SKUs return 400 with a clear message; `javascript:` URLs are blocked at the scheme allow-list.

**Stripe — security hardening (Apr 2026):** addressed every issue from the architect review of the cart Stripe integration.
- **Open-redirect guard.** `isAllowedReturnUrl` now requires `http(s)` returnUrls to match the inbound request's host (workspace proxy in dev, deployment domain in prod). Native deep-link schemes (`exp:` / `aforce:` / `aforceos:`) are still trusted by-scheme since the OS is the trust anchor. Verified live: `https://evil.example.com` is rejected; `aforce://cart` succeeds.
- **Server-side checkout finalization.** New `GET /api/checkout/session/:id` retrieves the Stripe session and returns the authoritative `payment_status`. The session id is regex-validated (`cs_(test|live)_…`) and unknown ids fail closed (404). Both `CartScreen` and `SubscriptionScreen` now call `fetchCheckoutSession(session.sessionId)` AFTER the `?status=success` redirect AND verify `paid && kind/planId` matches before clearing the cart or switching the plan — closes the double-charge / fake-success window.
- **Catalog parity test.** `artifacts/api-server/src/lib/__tests__/catalogParity.test.ts` imports both the client `STORE_SKUS` and the server `STORE_CATALOG` and asserts: every client SKU exists on the server with the exact same price, no orphan server SKUs, sizes match. Catches drift the moment a price changes on either side. To make the cross-package import compile cleanly under api-server's `tsc rootDir: "src"`, tests are excluded from api-server typecheck — they're typechecked by vitest's transformer instead.
- Tests: 77 → 80.

- Still mocked (intentional, separate work): subscription billing actions (cancel/pause/resume/skip), webhook sync to Postgres, customer portal. These need stripe-replit-sync + a Postgres DB and are a larger piece.

**AForce HydroScan + competitor comparison engine (Apr 2026):** the Hydration Scan flow was renamed end-to-end to **AForce HydroScan** (screen header + camera modal title). Built a competitor-comparison system layered on top:
- `data/beverageCompetitors.ts` — AForce flagship profile + 11 top hydration brands (Gatorade, Powerade, Pedialyte, LMNT, Liquid I.V., Prime, Nuun, BODYARMOR, G2, Propel, DripDrop). Each entry carries the published nutrition panel for one canonical serving (sodium / potassium / magnesium, sugar + added sugar, calories, approximate liquid pH, artificial colors/sweeteners, functional adders).
- `services/beverageComparisonEngine.ts` — pure scoring layer. Five rubric metrics (electrolyte load, sugar burden, clean label, functional stack, alkaline lift), each 0-100, weighted (0.28 / 0.22 / 0.20 / 0.18 / 0.12) into an overall total. `compareBeverages(a, b)` returns per-metric winner + overall verdict + spread. No React, no store, no network — fully unit-testable.
- `screens/HydroScanCompareScreen.tsx` + `app/hydroscan-compare.tsx` route — two-pane UX: grid of all 11 competitors → tap one for an AForce-vs-them scorecard with verdict pill, side-by-side profile cards, per-metric bars with winner badges, and a "pick another" reset. Entry point is a new "COMPARE VS COMPETITORS" CTA on the HydroScan screen below the simulate-scan tray.
- `services/__tests__/beverageComparisonEngine.test.ts` (5 tests) pins the rubric: AForce scores >75, beats every legacy sugar drink, alkaline lift > acidic competitors, clean-label flags artificial sweeteners (Propel), and the per-metric winner map always covers all 5 keys. Tests: 80 → 85.

**Home action row — Phantom-card aesthetic (Apr 2026):** the action row in `app/(tabs)/index.tsx` was overflowing once Circles + Territory landed (six labeled buttons couldn't fit a phone width and the labels were squashing to single letters). Replaced labeled buttons with icon-only square tiles styled to match `PhantomBandCard` (`Colors.fill.light` + `Colors.border.subtle` + `borderRadius: 14`). Each tile is `flex:1` with `aspectRatio:1` so all six destinations always fit edge-to-edge on any phone width without horizontal scroll. The DEPLETED-state Compare tint is preserved (mirrors how the Phantom card promotes its LIVE pill). All testIDs (`home-circles-button`, `home-territory-button`) and full screen-reader labels are preserved via `accessibilityLabel`.

**Hardening pass (Apr 2026):** addressed every B+ → A− issue from the post-build grade.
- **Reactive in-memory stores.** `circleService` and `battleService` now expose `subscribe(fn)` + monotonic version counters and `emit()` on every mutation. New `hooks/useCircleSubscription.ts` wraps `useSyncExternalStore` so screens consume `useCircleSubscription()` / `useBattlesSubscription()` and re-render automatically on any service mutation — including mutations made on a different mounted screen. Removed every `useReducer` "tick" + `force()` band-aid from CirclesScreen / ManageCircleScreen / TerritoryScreen. Both services also export `__resetCircleStateForTests` / `__resetBattlesForTests` for test isolation.
- **Stylized map is the design language, not a placeholder.** TerritoryMap now carries a `STYLIZED VIEW · NO PRECISE LOCATION` badge and a documented privacy stance: AForce intentionally never renders precise cartography — locations are always aggregated to city/state/team buckets. If we ever introduce real maps it'll be an opt-in additive layer; the stylized view stays as default.
- **expo-speech** pinned to `~14.0.8` (was `^55.0.13`) — silences the Expo SDK 54 compatibility warning at boot.
- **Tests added (29 → 65).** Three new files in `services/__tests__/`:
  - `territoryEngine.test.ts` (16 tests) — weight totals, NaN/Infinity safety, clamping, rank stability, monotonicity in every input dimension, statusLabel mapping.
  - `reactionService.test.ts` (12 tests) — every banned hype token, word-boundary safety (no false positives), `!` → `.`, hashtag stripping (including the lone-`#` edge case discovered by the tests and fixed in `reactionService`), 80-char ceiling, state-appropriate reaction filtering for all 4 states.
  - `privacyService.test.ts` (8 tests) — pins the privacy chokepoint: PRIVATE scope blanks every dimension including `updatedAt`, per-field overrides cannot re-leak in private mode, every field can be toggled independently, defensive clones, subscriber notification + unsubscribe + bad-listener isolation.
- Root `vitest.config.ts` now mirrors the aforce-os tsconfig path alias (`@/` → `artifacts/aforce-os/`) so service tests can import the same way the app does.

**Prior build — Scaling Blueprint + Social Sharing (Apr 2026):**
- **50M+ scaling architecture (api-server, blueprint not infra)**: `artifacts/api-server/docs/{scaling-architecture,load-testing-plan,failover-strategy}.md` describe the full target topology (edge/CDN, multi-region active/active reads, sharded Postgres, Redis hot state, Kafka event log, AI provider failover with deterministic template ground floor, observability + SLOs). Skeleton modules under `src/{cache,events,queues,middleware,observability,health,config}/` ship working in-memory defaults so the server keeps booting; each one defines the production interface (`getCache()`, `getEventBus()`, `getQueue()`, `rateLimit()`, `idempotency()`, `metrics`, `tracing`, `health.checks`, `featureFlags`) so swapping in real ioredis/kafkajs/prom-client is a one-line wiring change at boot. Load test seeds in `loadtests/{spec.md,k6-home-payload.js}`. Typechecks clean; nothing wired into the live request path yet.
- **Social Sharing system (aforce-os)**: premium, non-feed sharing of performance moments. `types/share.ts` + `data/shareTemplates.ts` + `services/{shareTemplateEngine,shareService}.ts` mirror the voice engine pattern — 3 voice-correct variations per moment (score, state, gain, streak, protocol, rank, heat_save, command, reset), tone enforced (banned hype words, no emojis, no `!`, no hashtags). Visual previews `components/{ShareCard,ShareStory,ShareText}.tsx` (square / 9:16 / text). `screens/SharePreviewScreen.tsx` registered at `app/share.tsx` (`/share` route) — format toggle, message variation picker, OS share sheet via RN `Share` API (web → Web Share API). Home screen has a small share icon next to the state pill (`testID="home-share-button"`). 10 new vitest cases in `services/__tests__/shareTemplateEngine.test.ts`.

**Previous build — Voice Engine + Heat Guard + Stripe (Apr 2026):**
- **AForce Voice Engine** (mode-aware coach voice): `types/voicePersona.ts`, `data/voiceTemplates.ts`, `services/{voicePersonaService,voiceTemplateEngine,ttsConfigService}.ts`. Templates fan out per `VoiceUrgencyMode` (peak/balanced/recovering/depleted) and pass through tone enforcement (banned-phrase strip on word boundaries, sentence + word ceilings). Wired into `voiceService.ts` + `services/textToSpeech.ts`.
- **Native TTS** via `expo-speech`: `services/textToSpeech.ts` now branches Web (`speechSynthesis`) vs Native (`Speech.speak`), both reading rate/pitch/volume from `getActiveTtsConfig()` so the spoken cadence shifts subtly with performance state.
- **Heat Guard escalation**: Home (`app/(tabs)/index.tsx`) tracks band transitions in a ref; on any STABLE→non-STABLE crossing or severity step-up it renders the `heat_warning` template via the persona, speaks it, fires a warning haptic, and opens the voice overlay. De-escalation is silent.
- **Stripe checkout (consumer upgrade demo)**: api-server route `POST /api/checkout/session` (`routes/checkout.ts`) creates a real Checkout Session via `lib/stripeClient.ts` (credentials pulled fresh from the Replit Connectors API on every call). `SubscriptionScreen` opens it via `expo-web-browser`'s auth session, parses the redirect status, and only flips local subscription state on `?status=success`. Plans `athlete` ($19) and `system` ($49) are wired through Stripe; everything else stays local. No webhook / DB by design (demo flow).
- **Unit tests** for the voice engine: `services/__tests__/voiceTemplateEngine.test.ts` (vitest, root config `vitest.config.ts`). 11 cases covering token replacement, mode-aware templates, banned-phrase stripping with word boundaries (`strategy` preserved while `try` removed), word/sentence clipping, and persona resolution invariants. Run with `pnpm vitest run`.

**Recent additions (Phase 4 — Hydration Scan + Subscription System):**
- **Hydration Scan** (`/scan`): premium scan-to-decide UX. `services/productRecognitionService.ts` maps barcodes/QR/manual queries → `CompareProduct` (BARCODE_INDEX includes AForce + Gatorade/Liquid IV/Pedialyte/LMNT/Prime). `services/hydrationScanService.ts` composes recognize → comparison-engine fit score → AI command + AForce equivalent recommendation. Screen has animated viewfinder ring, mock scan tray (preview-mode), QR shortcut, manual search fallback. Logs scanned AForce items via `logIntake`.
- **Subscription System** (`/subscription`, `/subscription/manage`): 6 plan tiers with feature inheritance — Core $5 → Athlete Mode $15 → Bundle $50 (FLAGSHIP w/ monthly product shipment) · Core Team $25–$300 · Clutch $800–$5K · Guardian $5K–$8K. Plans live in `data/subscriptionPlans.ts` (`PLAN_BY_ID`, `getEffectiveFeatures`, `getEffectiveFlags` walk the inheritance chain). Mock billing in `services/subscriptionService.ts` (switchPlan/cancel/pause/resume/skipNextDelivery). `featureFlags/subscriptionGate.ts` provides `gate(sub, featureId)` → `GateCheck` for `UpgradePrompt` modal. Manage screen shows billing, product shipment cycle, unlocked features, and pause/skip/cancel controls.
- `useAppStore` adds `state.subscription: UserSubscription` (initial via `defaultSubscription()`) and `setSubscription(sub)`. Profile screen renders dynamic plan name + status badge with Manage / Upgrade buttons.
- Home action row: SCAN / COMPARE / COMPETE.

**Recent additions (3-phase build):**
- **AI Coaching Videos** (Phase 1): cinematic Reanimated video player at `components/AIVideoPlayer.tsx` with 6 scenes matched to user state via `services/videoEngine.ts`. Compact + full-screen modal, command overlay.
- **Product Comparison Engine** (Phase 2): real-time, brand-neutral product ranking. `services/comparisonEngine.ts` (empty-catalog safe, NaN-clamped), `data/productDatabase.ts` (7 products), screen at `/compare` with axis breakdown, "Why AForce Wins" / "Full Comparison" toggle. Symmetric phrasing — never marketing.
- **Community Competition** (Phase 3): hydration as sport. Spec formula (perf 0.35 + compliance 0.25 + consistency 0.20 + recovery 0.20) applied uniformly to individuals, cities, states, and teams via `services/competitionEngine.ts`. Screen at `/competition` with City/State/Team/Individual scope tabs (flag-gated), highlighted YOU row, +12 spots delta pill, city-wins celebration ribbon. 4 new feature flags (`city_/state_/team_competition_enabled`, `global_leaderboard_enabled`).
- Home action row exposes both new screens via COMPARE + COMPETE buttons; COMPARE button auto-promotes when state is DEPLETED.

**Phase 1 (this build) delivers:**
- 4 tabs: Home (Hydration Control Center), Check (Performance Signals), Protocol (AForce Protocol), Profile (Settings + Demo Access).
- Stack routes for Phase 2 (`/clutch` — Command the Team) and Phase 3 (`/guardian` — Protect the Roster), gated behind feature flags toggled in Profile → DEMO ACCESS.
- Mocked `/v1` REST contract in `services/mockApi.ts` (8 endpoints, 60–220ms simulated latency). The store NEVER calls the scoring engine directly — engine output flows only from the service layer.
- Backend-driven Pulse animation contract (`PulseConfig`) — color, speed, wave behavior, glow, burst-on-intake.
- AI Commands enforced as WHAT + WHEN + OUTCOME (1–2 sentences, no soft language).
- 4 product types (sticks/jars/cans/bag) with brand imagery for tap-to-log Quick Intake.

**Tech Stack:**
- Expo SDK 54 / React Native 0.81
- React Native Reanimated (animations — useAnimatedReaction + runOnJS for score count-up)
- React Native Gesture Handler
- Expo Router 6 (file-based navigation)
- React Context + useReducer (state management — no backend)
- Inter font (via @expo-google-fonts/inter)
- No backend — service layer is mocked but contract-aligned to a real `/v1` API

**Architecture:**
```
artifacts/aforce-os/
├── app/
│   ├── _layout.tsx          # Root layout (SafeArea, Fonts, Providers)
│   ├── clutch.tsx           # Phase 2 demo (gated)
│   ├── guardian.tsx         # Phase 3 demo (gated)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar (4 tabs: Home, Check, Protocol, Profile)
│       ├── index.tsx        # Home — Hydration Control Center
│       ├── check.tsx        # Check — Performance Signals
│       ├── protocol.tsx     # AForce Protocol + Command History
│       └── profile.tsx      # Profile + Demo Access (feature flags)
├── components/
│   ├── StatusPulseOrb.tsx   # Pulse — driven entirely by PulseConfig
│   ├── AnimatedScore.tsx    # Score count-up (Reanimated)
│   ├── AICommandCard.tsx    # WHAT + WHEN + OUTCOME
│   ├── QuickIntakeBar.tsx   # 4 product types tap-to-log
│   ├── FeatureGate.tsx      # Locked-state wrapper for Phase 2/3
│   └── (LiveStatusStrip / WhyThisScore / RiskTimerDisplay / WaterCycleBar / PhantomSignal / CycleSuccessOverlay / GradientBackground / ErrorBoundary)
├── services/
│   └── mockApi.ts           # 8 mocked /v1 endpoints — sole source of engine output
├── store/
│   └── useAppStore.tsx      # Context + useReducer; routes through service layer
├── utils/
│   └── scoringEngine.ts     # Score formula + AI command + Phase 2/3 mocks
├── featureFlags/
│   └── flags.ts             # DEFAULT + DEMO_ALL_ON
├── theme/colors.ts          # Brand palette (lime/teal/amber/red, Clutch teal, Guardian purple)
├── types/index.ts           # PulseConfig / FluidType / FeatureFlags / GuardianRiskState
└── data/
    ├── mockData.ts          # User state, history, signal scales, roster
    └── products.ts          # 4 product types + bundled images
```

**Performance States:**
- PEAK (90–100): Lime #B4FF50
- BALANCED (75–89): Teal #00E5C8
- RECOVERING (60–74): Amber #FFA01E
- DEPLETED (0–59): Red #FF2D55

**Brand language enforced:** "Performance Signals" / "Hydration Signal Check" / "Energy State" / "Confirm Status" / "AFORCE COMMAND" / "HYDRATION CONTROL CENTER".

**Core Loop:** Score → Why This Score → AI Command → Quick Intake → Cycle Success → Engine refresh from /v1.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
