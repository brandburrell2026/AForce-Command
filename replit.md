# Overview

AForce OS is a production-ready React Native / Expo mobile application complemented by an Express 5 and PostgreSQL API server. It functions as a real-time human performance operating system, specializing in hydration intelligence and AI-driven decision-making. The project aims to deliver personalized insights and foster community engagement for enhancing athletic performance and overall wellness.

Key capabilities include:
- **Hydration Tracking & AI Coaching:** Mobile features for product scanning, hydration analysis, AI coaching, and product comparisons.
- **Social & Competitive Features:** "Circles" for private accountability and "Territory" for live competition mapping.
- **E-commerce & Subscription Management:** Integration with Stripe for purchases and subscription handling.
- **Scalable Architecture:** Designed to support a large user base (50M+) with considerations for multi-region deployments, sharded databases, and real-time event processing.

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo:** pnpm workspaces (root `pnpm-workspace.yaml`); leaf workspace packages typecheck with `tsc --noEmit`, composite libs with `tsc --build`.
- **Backend:** Node.js (v24), Express 5, PostgreSQL, Drizzle ORM, Zod.
- **Mobile:** React Native / Expo SDK 54 with Expo Router 6, React Native Reanimated 3, `i18next`, `@tanstack/react-query`.
- **State Management (mobile):** React Context + `useReducer`, organised as a **slice-based store** (`store/slices.tsx`) composed by `store/useAppStore.tsx` over `store/appStoreReducer.ts`. Slices include drinks, hydration, social, voice, heat, biometrics, and engine — each independently unit-tested in `store/__tests__/slice.*.test.ts` (≥5 tests per slice).
- **API Tools:** Orval for OpenAPI codegen against `lib/api-spec`; generated React Query hooks live in `@workspace/api-client-react`.

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette includes lime, teal, amber, red, Clutch teal, and Guardian purple (`theme/colors.ts`).
- **Design Language:** "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND," with a "Phantom-card" aesthetic.
- **Visuals:** Stylized maps for "Territory" and smooth animations with Reanimated.
- **Home screen layout:** The Home tab's body is split out into composable section components under `components/home/*` so the tab file (`app/(tabs)/index.tsx`) stays a thin orchestrator.

## Authentication & Identity (Clerk)

- **Provider:** Clerk via `@clerk/expo`. Mounted once in `app/_layout.tsx` inside `<ClerkProvider>` with `tokenCache` from `@clerk/expo/token-cache`.
- **Sign-in:** Custom email+password flow in `app/(auth)/sign-in.tsx` using the canonical `useSignIn().create() + setActive()` pattern. Google SSO via `useSSO()` + `expo-auth-session`. `@clerk/expo`'s hosted `<SignIn>` component is intentionally **not** used (incompatible with Expo Go).
- **Token bridge:** `components/ClerkAuthBridge.tsx` registers Clerk's `getToken` into the imperative `services/authToken.ts` registry **and** the generated OpenAPI client (`setAuthTokenGetter`) so REST + WebSocket fetches outside the React tree carry the current Bearer token. Explicitly nulls both getters on sign-out to prevent stale-token reuse.
- **Auth-gated routes:** All `/(tabs)/*` mobile routes are gated by `app/(tabs)/_layout.tsx` (`useAuth().isSignedIn` → `<Redirect href="/(auth)/sign-in" />`). Server-side, every mutating `/api/aforce/*` route requires `@clerk/express` middleware.
- **Demo bypass:** `services/demoMode.ts` exports a `DEMO_MODE` constant for marketing screenshots and pitch demos; when true, the tabs gate is skipped. Defaults to `false`.

## Subscription & Entitlement (Stripe)

- **Source of truth:** Stripe + `stripe-replit-sync` mirror webhook events into Postgres. The API server reads entitlement from the synced rows, never from client claims.
- **Client hook:** `hooks/useEntitlement.ts` (mounted once via `ClerkAuthBridge`) pulls the server-authoritative plan tier on every fresh session and powers paywall gating across screens.
- **Paywalls:** Premium features (Phantom Band, Cruise, Heat Guard escalations, advanced Territory, etc.) check the entitlement tier before rendering content; otherwise show the upsell card.
- **Server hardening:** Pricing, shipping, and tax are computed server-side in `artifacts/api-server`; the client never sends amounts. Webhook events go through signature verification (`STRIPE_WEBHOOK_SECRET`).

## Server Hardening (`artifacts/api-server`)

- **Routing:** Express 5 with route-level Zod input/output validation generated from the OpenAPI spec.
- **Concurrency:** Intake mutations use `SELECT ... FOR UPDATE` to serialize concurrent posts per user (covered by `slice.biometricsRace.test.ts` + server-side intake tests).
- **Rate limiting & cache:** OpenWeather is proxied with an in-memory TTL cache to bound third-party fan-out. Public endpoints sit behind per-IP rate limits; auth-gated endpoints behind per-user rate limits.
- **Logging:** Route handlers use `req.log`; non-request code uses the singleton `logger`. `console.log` is forbidden in server code per the workspace skill.
- **Real-time:** REST mutations are broadcast over a shared HTTP/WebSocket server (`ws` package), keyed by user, so the mobile client's optimistic state can be reconciled in real time.

## Environment Variables

- **Server:** `DATABASE_URL`, `STRIPE_WEBHOOK_SECRET`, `OPENWEATHER_API_KEY`, `ELEVENLABS_API_KEY`, `SESSION_SECRET`. Stripe keys are auto-injected by the Replit Stripe integration.
- **Mobile (Expo):** All client-readable env vars must be prefixed `EXPO_PUBLIC_*`. The `aforce-os` workflow wires up `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_REPL_ID` from the Repl-level secrets at start time. **Never** commit secrets; new client-readable values must be requested through the `environment-secrets` skill and follow the `EXPO_PUBLIC_` convention.

## Technical Implementations & Feature Specifications

### Persistence & Real-Time Backend
- User state, intake logs, and answers are persisted in PostgreSQL via Drizzle.
- REST API endpoints (`/api/aforce`) broadcast mutations to WebSocket clients.
- A shared HTTP/WebSocket server (`ws` package) handles real-time communication.
- OpenWeather API is proxied with in-memory caching.
- The server is the source of truth for all data, excluding `appleHealth`.

### Per-Event Hydration Scoring
- Defines point values, absorption caps, and release curves for hydration events.
- Uses `SELECT ... FOR UPDATE` for concurrent intake operations.

### AForce Protocol Screen (real-time)
- `app/(tabs)/protocol.tsx` derives its stage **synchronously** via `useMemo(deriveProtocol(userState, engineOutput), [...])`. There is no async fetch or loading spinner on the hot path — when the engine score crosses the DEPLETED threshold, the "Depletion Correction" stage flips on the same render.
- `services/mockApi.ts:deriveProtocol(userState, engineOutput, weeklyCompliancePct?)` is the pure mapping function: PEAK→Peak Support, BALANCED→Maintain, RECOVERING→Recovery, DEPLETED→Depletion Correction. `fetchProtocol()` is a thin async wrapper kept for legacy callers.
- Contract is locked by `services/__tests__/deriveProtocol.test.ts` (8 cases): mapping, synchronous return, urineSignal step-completion, riskTimer propagation, deterministic compliance.

### Water Cycle / "Become AForce"
- `WaterAmountModal` drives per-ounce water intake (4–64 oz) through `logIntake('water', { ozOverride })`.
- `FlavorPickerModal` drives 12 oz hydration sticks / RTD through `logIntake('aforce_stick' | 'aforce_rtd', { flavor })`. Defaults to `aforce_stick` when the user taps the "Become AForce" CTA without explicit choice (`completeCycle('aforce_stick')`).
- `inferFlavorFromLabel` resolves all label shapes (Berry/Watermelon/Soursop ± Dulse/Chlorella/Seamoss suffixes, "12 oz" suffix, case-insensitive) — covered by `utils/__tests__/inferFlavorFromLabel.test.ts` (7 cases).
- `WaterCycleBar` reactively reflects `unitsConsumedToday` from the store.
- Wire contract to the server is locked by `services/__tests__/realApi.intake.test.ts`.

### Social Mode → Hydration Score
- Alcohol intake immediately impacts hydration scores and amplifies decay rate.
- `utils/hangoverRisk.ts:socialIntakePoints` calculates negative score delta per active drink, with mitigation for matched water intake.
- `SocialModeSheet` drink tiles render via `MaterialCommunityIcons` glyphs (`beer`, `glass-wine`, `glass-cocktail`, `bottle-tonic`, `bottle-soda-classic`, `glass-mug-variant`).

### Multi-Provider Health Signals → Hydration Score
- Integrates Apple Health, Oura Ring, Samsung Health, Google Health Connect, Garmin Connect, WHOOP, and Strava.
- `utils/biometricsAggregator.ts` applies "freshest-wins" logic per metric and derives activity / recovery signals.

### Hydration Depletion Math (`utils/depletionRate.ts`)
- A pure, dependency-free helper modeling score-points-per-minute decay.
- Physiologically grounded against ACSM, IOM, and ISO 7933 standards.
- Formula accounts for weight, activity, heat, humidity, sleep, and social factors.

### Mobile Application (`artifacts/aforce-os`)
- **AForce HydroScan:** Product recognition and comparison.
- **AForce Circles:** Private accountability networks.
- **AForce Territory:** Live competition mapping and scoring.
- **AForce Ring (Calm Coach + Sport Mode):** Idle home screen (`/ring`) and live sport HUD (`/ring/session`).
- **AForce Voice Engine:** Mode-aware coaching with TTS via ElevenLabs or device synthesizer fallback.
- **AForce Voice Commands:** Mic-enabled commands (7 categories) classified via regex.
- **Heat Guard Escalation:** Triggers warnings and UI overlays based on performance state and environmental conditions.
- **Subscription System:** Six plan tiers with feature gating via Stripe.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking.
- **Core Loop:** Score evaluation, AI commands, intake logging, and engine refresh.
- **Social Mode:** BAC estimator, impairment assessment, and recovery protocols.
- **Hydration Journal:** Longitudinal score history, daily timeline, and PDF export.
- **Sweat Calculator:** ACSM-grade sweat-rate calculation with multiple input modes.
- **Phantom Band & AForce Ring Integration:** BLE service for automatic sip logging (gated by `phantom_wearable_enabled` flag).
- **Sensor Import:** Parses external sensor data (hDrop, Nix, Gatorade Gx).
- **Achievements:** Catalog of 12 badges.
- **Science & Methodology:** In-app documentation of formulas and references.
- **Cruise Mode:** Premium guest-only add-on; live conditions from OpenWeather.

### Investor Pitch Deck (`artifacts/aforce-pitch`)
- A 27-slide React presentation outlining vision, problem, solution, GTM, and recurring revenue model.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** 50M+ user topology — multi-region deployments, sharded DBs, Redis, Kafka, AI provider failover.
- **Stripe Integration:** One-time checkouts and subscription flows with server-side pricing, shipping, tax, and validation.
- **Auth-gated routes:** All mutating `/api/aforce/*` routes require `@clerk/express` middleware.
- **Social graph routes:** Drizzle-persisted endpoints for territory rivalries (`/api/battles`), circle membership and challenges (`/api/circle`), and privacy settings (`/api/privacy`).

### Store + Subscription System
- Defines SKU pricing, subscription discounts, and bundle offerings.
- `productPricingService.ts` centralizes pricing logic.
- Five consumer subscription tiers (`core`, `recovery_plus`, `athlete`, `system`, `elite`).
- Paywalls restrict access to premium features for non-subscribers; entitlement is read from the server (Stripe → Postgres mirror).
- `StoreScreen` provides product selection and subscription management UI.

## Architecture Diagram (AForce OS)
- **`app/`**: Root layouts, screens, tab bar, gated routes (`(auth)`, `(tabs)`).
- **`components/`**: Reusable UI elements (incl. `home/*` extracted home sections).
- **`services/`**: Business logic (`mockApi.deriveProtocol`, `realApi`, `demoMode`, `i18nService`, etc.).
- **`store/`**: Slice-based reducer state (`slices.tsx`, `appStoreReducer.ts`, `useAppStore.tsx`).
- **`utils/`**: Pure helpers (`hydrationScoreEngine`, `inferFlavorFromLabel`, `depletionRate`, `biometricsAggregator`, ...).
- **`featureFlags/`**: Feature toggles.
- **`theme/`**: Brand colors.
- **`types/`**: Global type definitions.
- **`data/`**: Mock data, product definitions, voice/sharing templates.

## Test Coverage Summary

- **Vitest aggregator:** 35 files / 448 tests passing across the workspace (`pnpm exec vitest run`).
- **Slice store:** `slice.drinks`, `slice.hydration`, `slice.social`, `slice.voice`, `slice.heat`, `slice.engine`, `slice.biometricsRace` — each ≥5 tests.
- **Score engine:** `hydrationScoreEngine.production.test.ts` (31 cases), `hangoverRisk.test.ts` (11), `socialIntake.test.ts` (24).
- **Protocol contract:** `services/__tests__/deriveProtocol.test.ts` (8 cases) — locks PerformanceLevel→stage mapping, synchronous return, urineSignal completion.
- **Wire contract:** `services/__tests__/realApi.intake.test.ts` — locks store→server intake plumbing.
- **API server:** `storeCatalog`, `catalogParity`, `subscriptionPlanParity`, `eventBus` — pricing/catalog/event-bus parity locked.
- **Typecheck:** `pnpm run typecheck` — clean across all 6 workspace projects (libs build first, then leaf packages).

# External Dependencies

- **Stripe:** Payment processing and subscription management.
- **stripe-replit-sync:** Mirrors Stripe webhook events to PostgreSQL (entitlement source of truth).
- **Clerk (`@clerk/expo`, `@clerk/express`):** Authentication on mobile and server.
- **Expo SDK 54:** React Native development framework.
- **Expo WebBrowser / AuthSession:** OAuth + in-app browser handoff.
- **Expo Speech:** Text-to-speech fallback when ElevenLabs is unavailable.
- **@expo-google-fonts/inter:** Custom font.
- **React Native Reanimated:** Declarative animations.
- **React Native Gesture Handler:** Gesture recognition.
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Schema + query layer.
- **Orval:** OpenAPI codegen → React Query hooks + Zod schemas.
- **Zod:** Schema validation.
- **pnpm workspaces:** Monorepo management.
- **esbuild:** Bundling.
- **OpenWeather API:** Environmental data (proxied with caching).
- **ElevenLabs:** Text-to-speech service.
- **i18next:** Localization.
