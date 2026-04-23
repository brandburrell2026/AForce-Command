# Overview

This project is a pnpm workspace monorepo utilizing TypeScript, focused on developing AForce OS, a production-ready React Native / Expo mobile application. AForce OS functions as a real-time human performance operating system, incorporating hydration intelligence and AI-driven decision-making. The project also includes an API server developed with Express 5 and PostgreSQL.

Key capabilities include:
- **Hydration Tracking & AI Coaching:** A mobile application that scans products, analyzes hydration levels, provides AI-driven coaching, and offers product comparisons.
- **Social & Competitive Features:** "Circles" for private accountability networks and "Territory" for live competition mapping.
- **E-commerce & Subscription Management:** Integration with Stripe for cart checkout and subscription management.
- **Scalable Architecture:** A blueprint for a highly scalable backend infrastructure designed to support 50M+ users, with considerations for multi-region deployments, sharded databases, and real-time event processing.

The project's vision is to deliver a comprehensive platform for athletic performance and wellness, leveraging advanced technology to provide personalized insights and foster community engagement.

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

## Recent Architecture Updates (Apr 2026)

### Home Tab Polish (Task #3)
- `WhyThisScore` is now a single tappable CTA into `ScoreBreakdownSheet` — the duplicate "FULL BREAKDOWN" button in the header was removed; the whole card is the affordance and a chevron in the header signals it. Component is wrapped in `React.memo`.
- Added a 24h "no recent intake" empty-state pill in `app/(tabs)/index.tsx` `orbSection` — when `Date.now() - userState.lastIntakeTime > 24h`, the prediction strip is replaced with a calm "No intake in 24h — log a drink to start" placeholder (`testID=no-recent-intake`, i18n key `home.no_recent_intake`).
- `PhantomBandCard`, `HeatAlertBanner`, and `SocialModeBanner` are wrapped in `React.memo` so the bottom-zone signal cards don't re-render on unrelated store updates.
- Deeper context-split / global memoization sweep + component tests are deferred to follow-up Tasks #4 and #5.

### Authentication (Clerk)
- `@clerk/express` on api-server, `@clerk/expo` on mobile.
- `requireAuth` middleware (`artifacts/api-server/src/middlewares/requireAuth.ts`) attaches `req.userId` from the Clerk session; falls back to `DEFAULT_USER_ID` only when Clerk env is unset (dev mode). Uses `declare global namespace Express` to add `userId?: string` to `Request`.
- Mobile root `_layout.tsx` wraps the tree in `<ClerkProvider><ClerkLoaded>` and mounts `<ClerkAuthBridge/>` once. The bridge calls `setTokenGetter(...)` so `services/authToken.ts` can inject `Authorization: Bearer` into every fetch + WS handshake, and also fires the entitlement hook.
- Custom branded `(auth)/sign-in.tsx` and `sign-up.tsx` use `useSignIn` / `useSignUp` directly (no Clerk component UI).
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is mirrored from `CLERK_PUBLISHABLE_KEY` in the dev script.

### Stripe Paywall
- `aforce_users` table (in `lib/db/src/schema/aforce.ts`): `id` (=Clerk userId), `email`, `stripeCustomerId`, `stripeSubscriptionId`, `planId` (default `core`), `subscriptionStatus`, `currentPeriodEnd`. Pushed via `drizzle-kit push`.
- `POST /api/stripe/webhook` mounted **before** `express.json()` with `express.raw({type:'application/json'})` so HMAC verification works. Delegates the raw body + signature to `stripe-replit-sync`'s `processWebhook`, which mirrors all events into the `stripe.*` schema (customers, subscriptions, prices, products, etc).
- `lib/initStripe.ts` boots the integration on server start (after `listen`) by running `runMigrations` → `getStripeSync` → `findOrCreateManagedWebhook` → `syncBackfill`. The `stripe.*` schema is now the source of truth; `aforce_users.planId/subscriptionStatus/currentPeriodEnd` are kept as a freshness cache and refreshed on every entitlement read.
- `GET /api/entitlement` resolves the user's plan by joining `stripe.subscriptions → subscription_items → prices → products` on `aforce_users.stripe_customer_id`, falling back to the cached row when the integration isn't connected. Forces a safe downgrade to `core` whenever the cached planId is paid but no live Stripe sub exists, so a stale cache cannot keep granting paid features.
- `POST /api/stripe/portal-session` opens a Stripe Customer Portal session for the signed-in user (requires a previous checkout). Wired into `app/(tabs)/profile.tsx` SubscriptionPanel's Manage button via `expo-web-browser`. Same-origin web returnUrl validation matches checkout's policy.
- `routes/checkout.ts` now resolves the Stripe price by `stripe.products.metadata->>'planId'` (seeded by `scripts/src/seed-products.ts`) with an inline `price_data` fallback that still echoes `metadata.planId` so the entitlement join keeps working before products are seeded. `ensureStripeCustomer(userId)` get-or-creates the Stripe customer and persists it to `aforce_users.stripe_customer_id`.
- `/checkout/session` and `/checkout/cart` now both `requireAuth` and inject `metadata.userId: req.userId` (subscription also mirrors onto `subscription_data.metadata`) so the webhook can join Stripe events back to a Clerk user.
- Mobile `hooks/useEntitlement.ts` polls `/api/entitlement` on sign-in, on app foreground, and every 60s. Maps response into the `UserSubscription` shape via the local `PLAN_BY_ID` whitelist + `getEffectiveFeatures(planId)`, and dispatches into the store via `setSubscription`. This makes `state.subscription.planId` server-authoritative; the existing `RecoveryModePaywall` / `SocialModeSheet` swap continues to work unchanged.
- Webhook signing secret is supplied by the Stripe connector (`settings.webhook_secret`), so no manual `STRIPE_WEBHOOK_SECRET` env var is required when the integration is connected.

### Server Hardening
- `helmet()` security headers (CSP off — JSON API only).
- `app.set('trust proxy', 1)` so `express-rate-limit` and request logging see the real client IP behind the Replit edge.
- Body-size cap: `express.json({ limit: '64kb' })`.
- Per-route limiters: `intakeLimiter` (60/min), `weatherLimiter` (30/min), `checkoutLimiter` (10/min).

### Store Slicing
- `store/appStoreTypes.ts` — `AppState` + `Action` union.
- `store/appStoreReducer.ts` — pure reducer, no React/AsyncStorage imports (unit-testable).
- `store/useAppStore.tsx` — provider + action creators only. Exports focused selector hooks: `useSubscription`, `useFeatureFlags`, `useEngineOutput`, `useUserState` for call-site clarity and a future migration path to `use-context-selector`.

# System Architecture

## Core Technologies
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **Package Manager:** pnpm
- **TypeScript:** v5.9
- **Mobile App:** React Native / Expo SDK 54 / React Native 0.81
- **API Framework:** Express 5
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)
- **State Management (Mobile):** React Context + `useReducer` with `useSyncExternalStore` for reactive services.
- **Navigation (Mobile):** Expo Router 6 (file-based navigation)
- **Animations (Mobile):** React Native Reanimated, React Native Gesture Handler
- **Fonts (Mobile):** Inter font (`@expo-google-fonts/inter`)
- **i18n (Mobile):** `i18next` + `react-i18next` + `expo-localization`. Six MVP locales (en/es/fr/de/pt/it) live in `artifacts/aforce-os/locales/*.json`. `services/i18nService.ts` initializes from device locale, then both TTS paths (`services/ttsService.ts` for the voice overlay AND `services/textToSpeech.ts` for the AI coach card / heat-warning) read `getVoiceLocale()` at speak time so playback uses the matching BCP-47 voice immediately on language switch. The AI coach command strings (`engineOutput.command.action` / `.explanation`) live under the `coach.*` i18n namespace and are resolved in `utils/scoringEngine.ts → generateCommand()` via `i18n.t()`. `useAppStore` listens to `i18n` `languageChanged` and dispatches `REFRESH_ENGINE` so the on-screen coach card swaps languages without waiting for the next state pull. User selection persists to `aforce_user_state.language` via `POST /api/aforce/language` and rehydrates via `useAppStore` on next /state pull. STT is stubbed (`services/speechRecognitionService.ts` with `isSupported()=false` and a localized command vocabulary) until a dev-build STT engine is wired up; UI falls back to text input. Localized surfaces include tabs, home CTAs (`BECOME AFORCE`, snooze button), Profile settings, Score breakdown labels, Store tab, and the (currently orphaned but i18n-ready) `LogIntakeRow` component — when remounted, its tile labels (`AFORCE STICK`/`AFORCE RTD`/`WATER`) and helper text resolve through `logIntake.*` keys.
- **Product artwork (Sticks):** `artifacts/aforce-os/assets/images/products/stick_{watermelon,berry,soursop}.png` ship the latest 3D pack renders (red/silver Watermelon Surge + Chlorella, blue/silver Berry Blast + Dulse, yellow/silver Soursop Edge + Seamoss). Used by the home `LogIntakeRow` tiles and the Store screen via `data/products.ts` → `PRODUCT_FLAVORS`.

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette uses lime (#B4FF50 - PEAK), teal (#00E5C8 - BALANCED), amber (#FFA01E - RECOVERING), and red (#FF2D55 - DEPLETED) to represent performance states. Clutch teal and Guardian purple are used for specific features.
- **Design Language:** Emphasizes "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND."
- **Action Row:** Uses icon-only square tiles (`flex:1`, `aspectRatio:1`) with a "Phantom-card" aesthetic for navigation, ensuring consistent layout across devices.
- **Stylized Maps:** TerritoryMap intentionally renders a stylized view with aggregated locations, explicitly stating "NO PRECISE LOCATION" to maintain privacy and design consistency. Precise cartography would be an opt-in additive layer.
- **Animations:** Uses Reanimated for smooth score count-ups and dynamic Pulse animations (color, speed, wave behavior, glow).

## Technical Implementations & Feature Specifications

### Persistence & Real-Time Backend (T6)
- **Postgres-backed user state:** AForce OS now persists `userState`, intake logs, and confirmation answers to Replit Postgres via Drizzle (`lib/db/src/schema/aforce.ts`). V1 is single-user (`userId='default'`); the schema is shaped so multi-user/auth is a drop-in change later.
- **REST API:** `artifacts/api-server/src/routes/aforce.ts` mounts under `/api/aforce` — endpoints: `/state`, `/intake` (atomic increment in a tx), `/signals`, `/urine`, `/energy`, `/checkin`, `/confirm` (tx + ±3 + clutch boost), `/flags`, `/weather?lat&lon`. All mutations broadcast to subscribed WebSocket clients.
- **WebSocket hub:** `ws` package in noServer mode at `/api/aforce/ws?user=default`, sharing one HTTP server (and one PORT) with Express. 30s heartbeat. Mobile client (`services/realApi.ts → subscribeToStateUpdates`) reconnects with exponential backoff.
- **Server-side OpenWeather:** `lib/openWeather.ts` proxies OpenWeather with a 10-minute in-memory cache so the API key never reaches the client. Snapshot is persisted into `aforce_user_state` and consumed by `scoringEngine.ts` (`weatherTempC`/`weatherHumidity` — falls back to the heatLoad approximation when missing). Client refreshes every 15 min using `expo-location` (Denver default).
- **Client overlay model:** Server is source of truth for everything except `appleHealth` (HealthKit on-device only), which the mobile store preserves via a ref-backed overlay across WS pushes.

### Per-Event Hydration Scoring (replaces baseIntake/aforceBonus aggregate)
- **Spec:** Water 0.5 pt/oz (12/16/24/32oz → +6/+8/+12/+16). AForce flavors: Berry +10, Watermelon +10 (or +12 if Heat Guard active = `heatLoad ≥ 6`), Soursop +11 (or +13 if `scoreBefore < 40`).
- **Absorption cap:** 1.5 units in any rolling 20-min window; excess intake scaled to 75% efficiency.
- **Release curves:** Water releases 60% immediately + 40% linearly over 12.5 min. AForce releases 70% immediately + 30% linearly over 25 min.
- **Implementation:** Pure logic in `artifacts/aforce-os/services/hydrationScoreService.ts` (`computeEventImpact`, `materializedIntakePoints`, `trimOldEvents`). Each `/intake` call appends an `IntakeEvent` to the `intake_events` JSONB column on `aforce_user_state`. `scoringEngine` materializes points from events when present, else falls back to legacy aggregate.
- **Rolling 24h window:** Trimmed on every `/intake` write AND defensively re-trimmed inside `materializedIntakePoints` so stale events can't contribute. UTC day rollover preserves `intake_events` (window is independent of day boundary).
- **Concurrency:** `/intake` uses `SELECT ... FOR UPDATE` row lock inside the tx so concurrent intakes can't lose each other to a JSONB read-modify-write race.
- **Tests:** `artifacts/aforce-os/utils/__tests__/hydrationScoreService.test.ts` — 17 tests covering flavor bonuses, cap math, release curves, and trim behavior.

### Mobile Application (`artifacts/aforce-os`)
- **AForce HydroScan:** Premium scan-to-decide UX for product recognition and comparison. Maps barcodes/QR/manual queries to `CompareProduct` and provides AI commands and recommendations.
- **AForce Circles:** A premium private accountability network with shared status, reactions, challenges, and privacy controls.
- **AForce Territory:** Live competition map with regions, competition stats, and battles. Scoring engine weights performance, protocol, streak, recovery, and momentum.
- **AForce Voice Engine:** Mode-aware coach voice with templates fanning out per `VoiceUrgencyMode` (peak/balanced/recovering/depleted) and tone enforcement (banned phrases, word/sentence ceilings). The voice **input** path is fully wired: tap-mic FAB on Home (`components/VoiceButton`) opens `VoiceOverlay` → STT → `voiceService.processTranscript()` → visual response card + side-effect dispatch (logIntake / nav). Heat-warning and Phantom-band escalations also auto-open the overlay. Voice **output (TTS playback)** is intentionally disabled per product decision — `services/textToSpeech.ts` exports no-op `speak()`/`stopSpeaking()` stubs gated by the `VOICE_PLAYBACK_ENABLED = false` flag, so all callsites (VoiceOverlay, heat-warning narration, AICommandCard) compile and dispatch normally but produce no audio. `AICommandCard` no longer renders a HEAR IT pill or auto-speaks. To re-enable audio, flip the flag in `textToSpeech.ts` — no other code changes required.
- **Heat Guard Escalation:** Triggers voice warnings, haptics, and UI overlays on significant changes in performance state.
- **Social Sharing:** Premium, non-feed sharing of performance moments using voice-correct templates and visual previews.
- **Subscription System:** Manages 6 plan tiers with feature inheritance, including mock billing actions and feature gating.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking with axis breakdowns and "Why AForce Wins" / "Full Comparison" toggles.
- **AI Coaching Videos:** Cinematic Reanimated video player with scenes matched to user state via a video engine.
- **Community Competition:** Applies a formula (performance, compliance, consistency, recovery) to individuals, cities, states, and teams.
- **Core Loop:** Score -> Why This Score -> AI Command -> Quick Intake -> Cycle Success -> Engine refresh.
- **Social Mode (real-time alcohol mitigation + BAC + legal safety):** Activate → pick a drink (beer / wine / cocktail / liquor / hard_seltzer / custom; ABV/oz overridable per drink) → `services/socialModeEngine.ts` (orchestrator) builds the rollup that scoringEngine consumes. Pillars:
  - **BAC estimator** (`services/bacEstimationService.ts`) — Widmark approximation with sex-aware r-factor, ±0.01 range, food factor 0.92, trend (rising/steady/falling), confidence (low/med/high), and 5-min rounded-up clear time.
  - **5-level impairment** — LOW / ELEVATED / MODERATE / HIGH / CRITICAL (thresholds 0.03 / 0.05 / 0.08 / 0.12).
  - **Legal/transportation safety** (`services/legalSafetyService.ts`) — at MODERATE+ surfaces a transportation prompt with disclaimers; never says "safe to drive". Card hidden at LOW/ELEVATED.
  - **Recovery Mode** — 8h window after end (RECOVERY_WINDOW_MS); pre-sleep protocol + AForce RTD recommendation + morning estimate via `RecoveryModeCard`.
  - **Coach escalation** in `utils/scoringEngine.ts`: CRITICAL → `cmd-social-stop-critical`; HIGH → `cmd-social-do-not-drive`; then existing hydrate / RTD / pace logic.
  - **UI:** `BACEstimateCard`, `ImpairmentRiskBadge` (5-level), `SocialSafetyCard`, `RecoveryModeCard`, updated `SocialModeBanner` (BAC + impairment, crimson at HIGH/CRITICAL) and `SocialModeSheet`. Orb gets a subtle purple outer ring overlay (crimson + faster pulse when unstable) via opt-in `socialOverlay` prop on `StatusPulseOrb`, wired from `app/(tabs)/index.tsx`.
  - Hangover risk retained via `utils/hangoverRisk.ts` (now consumes drink sugar load + sleep deficit). Localized across en/es/fr/de/pt/it. Persisted as JSONB on `aforce_user_state.social_mode` (now includes optional `sex` and `ateRecently`, set via `setSocialContext` store action → `POST /api/aforce/social/context`). Spec: `artifacts/aforce-os/docs/social-mode-safety-spec.md`.
  - **Disclaimer copy is locked, neutral, and global-safe (no jurisdiction logic):** `not_legal_medical` = "BAC and impairment estimates are approximate only and must never be used to determine whether you are safe or legal to drive. If you have been drinking, do not drive. Use a rideshare, designated driver, or other safe transportation." Higher-risk states (HIGH/CRITICAL) collapse `safety_*_body` to "Impairment risk is rising. Do not drive." Transportation card shows title="Transportation Safety" + body="Do not drive. Use a rideshare, designated driver, or other safe transportation." Mirrored across all 6 locales. The product stance is **safety guidance, not legal advice, not a breathalyzer replacement**.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Documents target topology for 50M+ users, including edge/CDN, multi-region active/active reads, sharded Postgres, Redis hot state, Kafka event log, and AI provider failover. Placeholder modules provide working in-memory defaults for `cache`, `events`, `queues`, `middleware`, `observability`, `health`, and `config`.
- **Stripe Integration:**
    - Handles one-time cart checkouts and subscription flows.
    - Server-side re-pricing against `storeCatalog.ts` (authoritative cents) for all items.
    - Adds shipping and tax as separate Stripe line items.
    - Robust validation for SKUs, quantities, and return URLs.
    - Open-redirect guard requiring return URLs to match the inbound request's host for `http(s)` schemes.
    - Server-side checkout finalization by retrieving Stripe session status to verify `payment_status` before confirming orders/subscriptions.
    - `catalogParity.test.ts` ensures client and server SKU catalogs are in sync regarding existence and pricing — guards both atomic SKUs (`STORE_SKUS`) and the flavor-agnostic bundles (`STORE_BUNDLES`).

### Store + Subscription System (`artifacts/aforce-os/data/pricing.ts`, `data/subscriptionPlans.ts`, `services/productPricingService.ts`, `screens/StoreScreen.tsx`)
- **SKU pricing:** Sticks $34.99 (12 ct), RTD 12-pack $47.99, Canister 30 srv $59.99. Each SKU carries a separate `subscriptionPriceCents` (~15% off) plus product intelligence (`useCase`, `protocolRole`, `recommendedFor: PerformanceLevel[]`, optional `badge`).
- **Bundles:** Per-format flavor-agnostic bundles (`STORE_BUNDLES`) — sticks 3pk $89.99 / 6pk $169.99, RTD 24pk $89.99, canister 2pk $109.99 / 3pk $149.99. Bundles are mirrored on the server catalog and priced authoritatively at checkout.
- **`services/productPricingService.ts`** centralizes Subscribe-and-Save math (`getSubscriptionPricing`), bundle savings (`getBundlePricing`, `getBundlesForSku`), and `recommendedSkuFor(state, formatId)` lookup — UI never re-derives discount logic.
- **Consumer subscription tiers (5):** `core` $9.99/mo, `recovery_plus` $9.99/mo (standalone Recovery Mode add-on, gates `recovery_mode_enabled` only — does NOT inherit Core), `athlete` $19.99/mo, `system` "Performance Bundle" $59.99/mo (flagship — Athlete tier + monthly product drop of 1 canister OR 2 stick packs at member pricing), and `elite` $99/mo (adds Guardian Mode for individuals, premium analytics, full monthly bundle, early-access, concierge). Plan id `system` is intentionally unchanged so existing Stripe wiring, `subscriptionGate` feature requirements, and `STRIPE_PLAN_IDS` keep working — only the display name + price + allotments evolved.
- **Recovery+ paywall:** `components/RecoveryModePaywall.tsx` replaces `RecoveryModeCard` inside `SocialModeSheet` whenever `gate(state.subscription, 'recovery_mode_enabled').allowed` is false. CTA opens Stripe Checkout directly via `createCheckoutSession({planId:'recovery_plus'})` + `expo-web-browser`, with a fallback to the in-app subscription screen if checkout creation fails (server `PLAN_CATALOG.recovery_plus` = 999 cents, parity test enforces client/server agreement).
- **StoreScreen UI** preserves the dark-luxury card layout while adding: badge chips (Best Value / Most Popular / Included · Performance Bundle), product-intelligence row (USE CASE · PROTOCOL ROLE · RECOMMENDED FOR), one-time/subscribe toggle, bundle quantity selector with savings badge, and a "Subscribe & Save N%" CTA. Cart wiring is unchanged — bundle ids reuse the cart's existing skuId keying.

## Architecture Diagram (AForce OS)
The mobile application structure is organized as follows:
- `app/`: Contains root layouts and screen definitions, including a tab bar with Home, Check, Protocol, and Profile, along with gated demo routes.
- `components/`: Reusable UI components such as `StatusPulseOrb`, `AnimatedScore`, `AICommandCard`, and `QuickIntakeBar`.
- `services/`: Encapsulates business logic, including `mockApi.ts` (the sole source of engine output), product recognition, hydration scanning, and subscription management.
- `store/`: Manages application state using `useAppStore` (Context + `useReducer`).
- `utils/`: Contains utilities like `scoringEngine.ts`.
- `featureFlags/`: Manages feature toggles.
- `theme/`: Defines brand colors.
- `types/`: Global type definitions.
- `data/`: Mock data, product definitions, and templates for voice and sharing.

# External Dependencies

- **Stripe:** For payment processing (one-time cart checkout and subscriptions). Credentials are pulled from Replit Connectors API.
- **Expo SDK:** Core framework for React Native application development.
- **Expo WebBrowser:** Used for opening Stripe Checkout sessions.
- **Expo Speech:** For native text-to-speech capabilities.
- **@expo-google-fonts/inter:** For custom font rendering.
- **React Native Reanimated:** For declarative animations.
- **React Native Gesture Handler:** For gesture recognition.
- **PostgreSQL:** Primary database, managed with Drizzle ORM.
- **Orval:** For OpenAPI spec-based API client and Zod schema generation.
- **Zod:** Schema validation library.
- **pnpm workspaces:** Monorepo management.
- **esbuild:** For bundling Node.js and client-side code.
- **k6:** For load testing (specified in load testing plans, not directly integrated into runtime).
- **Stripe-replit-sync:** Integrated. Mirrors all Stripe webhook events into a `stripe.*` Postgres schema; powers entitlement resolution, customer portal, and seeded-price lookup.